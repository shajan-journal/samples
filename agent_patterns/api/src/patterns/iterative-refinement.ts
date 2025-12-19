/**
 * IterativeRefinementPattern: Generate → Execute → Validate → Refine loop
 *
 * This pattern asks the LLM to produce an actionable step (often code),
 * executes tools as needed, validates the latest result, and feeds
 * validation feedback back into the next iteration until success,
 * convergence, or max attempts.
 */

import { BasePattern } from './base';
import { AgentContext, PatternStep, Message, CapabilityResult, LLMProvider } from '../types';
import { ToolUseCapability } from '../capabilities/tool-use';
import { ValidationCapability } from '../capabilities/validation';
import { SynthesisCapability } from '../capabilities/synthesis';
import { shouldContinueIterating } from './utils';

export interface IterativeRefinementOptions {
  maxAttempts?: number;
  verbose?: boolean;
}

export class IterativeRefinementPattern extends BasePattern {
  name = 'iterative-refinement';
  description = 'Generate → Execute → Validate → Refine until valid or converged';

  private toolUseCapability: ToolUseCapability;
  private validationCapability: ValidationCapability;
  private synthesisCapability: SynthesisCapability;

  constructor(llmProvider: LLMProvider) {
    super();
    this.toolUseCapability = new ToolUseCapability(llmProvider);
    this.validationCapability = new ValidationCapability(llmProvider);
    this.synthesisCapability = new SynthesisCapability(llmProvider);
  }

  async *execute(
    input: string,
    context: AgentContext,
    options: IterativeRefinementOptions = {}
  ): AsyncGenerator<PatternStep> {
    const maxAttempts = options.maxAttempts || 5;
    const verbose = options.verbose ?? true;

    const messages: Message[] = [
      ...context.messages,
      { role: 'user', content: input }
    ];

    // Initialize iteration state
    const startTime = Date.now();
    const iterationState = {
      attemptNumber: 0,
      maxAttempts,
      previousAttempts: [] as any[],
      converged: false,
      startTime
    };

    yield this.createStep('info', `AGENT: Starting Iterative Refinement for: "${input}"`);

    while (iterationState.attemptNumber < maxAttempts) {
      iterationState.attemptNumber += 1;
      const attemptNo = iterationState.attemptNumber;

      if (verbose) {
        yield this.createStep('info', `\n[Attempt ${attemptNo}] Generate/Execute`);
      }

      // Ask LLM to decide and call tools if needed
      yield this.createStep('capability', 'AGENT-TOOL-USE: Generating and executing...', {
        capability: 'tool_use'
      });

      const toolUseContext: AgentContext = {
        ...context,
        messages,
        iterationState
      };

      const toolUseResult = await this.toolUseCapability.execute(toolUseContext);

      // Include debug if present
      if (verbose && toolUseResult.metadata?.debug) {
        yield this.createStep('info', `LLM: ${toolUseResult.metadata.debug.rawLLMOutput || '(empty response)'}`, {
          metadata: { debug: toolUseResult.metadata.debug }
        });
      }

      // If tools were called, reflect them in the conversation and steps
      if (toolUseResult.toolCalls && toolUseResult.toolCalls.length > 0) {
        // Assistant message with tool_calls
        messages.push({
          role: 'assistant',
          content: toolUseResult.output || '',
          tool_calls: toolUseResult.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        });

        for (let i = 0; i < toolUseResult.toolCalls.length; i++) {
          const call = toolUseResult.toolCalls[i];
          const result = toolUseResult.metadata?.toolResults?.[i];

          yield this.createStep('tool_call', `TOOL: ${call.name}(${JSON.stringify(call.arguments)})`, {
            tool: call.name,
            metadata: { arguments: call.arguments }
          });

          if (result) {
            const resultOutput = result.success ? `${JSON.stringify(result.data)}` : `ERROR: ${result.error}`;
            yield this.createStep('info', `TOOL: ${call.name} -> ${resultOutput}`, { metadata: { toolResult: result } });

            // Add tool result message (used by ValidationCapability)
            const toolMsgContent = result.success
              ? `Tool ${call.name} succeeded: ${JSON.stringify(result.data)}`
              : `Tool ${call.name} failed: ${result.error}`;
            messages.push({ role: 'tool', content: toolMsgContent, name: call.name, toolCallId: call.id });

            // Track in iteration history
            iterationState.previousAttempts.push({
              attemptNumber: attemptNo,
              result,
              timestamp: Date.now()
            });
          }
        }
      } else {
        // No tool calls; still add assistant content if any
        if (toolUseResult.output) {
          messages.push({ role: 'assistant', content: toolUseResult.output });
        }
      }

      // Validate latest tool execution
      yield this.createStep('capability', 'AGENT-VALIDATION: Validating latest result...', {
        capability: 'validation'
      });

      const validationContext: AgentContext = { ...context, messages, iterationState };
      const validation = await this.validationCapability.execute(validationContext);

      // Report validation outcome
      if (validation.isValid) {
        yield this.createStep('info', 'VALIDATION: Passed');
        break; // Success
      } else {
        const issues = validation.validationIssues?.length ? validation.validationIssues.join('; ') : 'Unknown issues';
        yield this.createStep('info', `VALIDATION: Failed - ${issues}`, {
          metadata: { issues: validation.validationIssues, fixes: validation.suggestedFixes }
        });

        // Feed validation feedback back into the conversation to refine next attempt
        const feedback = `Validation feedback: ${issues}. Suggestions: ${(validation.suggestedFixes || []).join('; ')}`;
        messages.push({ role: 'user', content: feedback });
      }

      // Decide whether to continue
      const cont = shouldContinueIterating(iterationState.previousAttempts as any, maxAttempts);
      if (!cont.shouldContinue) {
        yield this.createStep('info', `AGENT: Stopping - ${cont.reason}`);
        break;
      }
    }

    // If we exited due to hitting max attempts without an explicit stop, report it
    if (iterationState.attemptNumber >= maxAttempts) {
      yield this.createStep('info', `AGENT: Stopping - Reached maximum attempts (${maxAttempts})`);
    }

    // Final synthesis
    yield this.createStep('capability', 'AGENT-SYNTHESIS: Synthesizing final answer...', { capability: 'synthesis' });
    const synthesis = await this.synthesisCapability.execute({ ...context, messages });

    if (!synthesis.output) {
      yield this.createStep('error', 'AGENT-SYNTHESIS: Failed to synthesize answer');
      return;
    }

    yield this.createStep('answer', synthesis.output);
  }
}
