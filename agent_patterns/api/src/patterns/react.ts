/**
 * ReActPattern: Reasoning + Acting in a loop
 * 
 * The ReAct pattern interleaves reasoning and acting:
 * 1. Reason about the current state and what to do next
 * 2. Take action (use tools if needed)
 * 3. Observe the results
 * 4. Repeat until task is complete
 * 
 * This pattern is effective for tasks that require iterative problem-solving
 * and tool use, where each action informs the next reasoning step.
 */

import { BasePattern } from './base';
import { AgentContext, PatternStep, Message, CapabilityResult, LLMProvider } from '../types';
import { ReasoningCapability } from '../capabilities/reasoning';
import { ToolUseCapability } from '../capabilities/tool-use';
import { SynthesisCapability } from '../capabilities/synthesis';

export interface ReActOptions {
  maxIterations?: number;
  verbose?: boolean;
}

export class ReActPattern extends BasePattern {
  name = 'react';
  description = 'Reasoning + Acting loop: interleaves reasoning with tool use until task completion';

  private reasoningCapability: ReasoningCapability;
  private toolUseCapability: ToolUseCapability;
  private synthesisCapability: SynthesisCapability;

  constructor(llmProvider: LLMProvider) {
    super();
    this.reasoningCapability = new ReasoningCapability(llmProvider);
    this.toolUseCapability = new ToolUseCapability(llmProvider);
    this.synthesisCapability = new SynthesisCapability(llmProvider);
  }

  async *execute(
    input: string,
    context: AgentContext,
    options: ReActOptions = {}
  ): AsyncGenerator<PatternStep> {
    const maxIterations = options.maxIterations || 10;
    const verbose = options.verbose ?? true;

    // Initialize conversation with user input
    const messages: Message[] = [
      ...context.messages,
      { role: 'user', content: input }
    ];

    let iteration = 0;
    let isComplete = false;

    yield this.createStep('info', `AGENT: Starting ReAct pattern for: "${input}"`);

    while (iteration < maxIterations && !isComplete) {
      iteration++;

      if (verbose) {
        yield this.createStep('info', `\n[Iteration ${iteration}]`);
      }

      // Step 1: Reasoning
      yield this.createStep('capability', 'AGENT-REASONING: Analyzing the problem...', {
        capability: 'reasoning'
      });

      const reasoningContext: AgentContext = {
        ...context,
        messages
      };

      const reasoningResult = await this.reasoningCapability.execute(reasoningContext);

      // Show debug info if available - include EVERYTHING
      if (verbose && reasoningResult.metadata?.debug) {
        const debug = reasoningResult.metadata.debug;
        yield this.createStep('info', `LLM: ${debug.rawLLMOutput || '(empty response)'}`, {
          metadata: { 
            debug: debug  // Include the ENTIRE debug object with all fields
          }
        });
      }

      if (!reasoningResult.output) {
        yield this.createStep('error', 'AGENT-REASONING: Failed - no output generated');
        break;
      }

      yield this.createStep('info', `AGENT-REASONING: ${reasoningResult.output}`, {
        metadata: {
          reasoning: reasoningResult.reasoning,
          nextAction: reasoningResult.nextAction,
          debug: reasoningResult.metadata?.debug  // Also include debug here
        }
      });

      // Add reasoning to conversation
      messages.push({
        role: 'assistant',
        content: reasoningResult.output
      });

      // Check if task is complete (reasoning indicates completion)
      if (this.isTaskComplete(reasoningResult)) {
        isComplete = true;
        yield this.createStep('info', 'AGENT: Task completed');
        break;
      }

      // Step 2: Action (Tool Use)
      // Skip tool use if nextAction is 'none' or not specified
      const shouldUseTool = reasoningResult.nextAction && 
                           reasoningResult.nextAction.toLowerCase() !== 'none';
      
      if (context.tools && context.tools.length > 0 && shouldUseTool) {
        yield this.createStep('capability', 'AGENT-TOOL-USE: Evaluating tool needs...', {
          capability: 'tool_use'
        });

        const toolUseContext: AgentContext = {
          ...context,
          messages
        };

        const toolUseResult = await this.toolUseCapability.execute(toolUseContext);

        // Store visualizations if present
        if (toolUseResult.metadata?.visualizations) {
          context.state = context.state || {};
          context.state.visualizations = toolUseResult.metadata.visualizations;
          console.log('[ReActPattern] Stored visualization data for synthesis');
        }

        // Show debug info if available - include EVERYTHING
        if (verbose && toolUseResult.metadata?.debug) {
          const debug = toolUseResult.metadata.debug;
          const toolInfo = debug.toolCallsCount > 0 ? ` [${debug.toolCallsCount} tool call(s)]` : '';
          yield this.createStep('info', `LLM:${toolInfo} ${debug.rawLLMOutput || '(empty response)'}`, {
            metadata: { 
              debug: debug  // Include the ENTIRE debug object with all fields
            }
          });
        }

        // If tools were called
        if (toolUseResult.toolCalls && toolUseResult.toolCalls.length > 0) {
          // Add assistant's tool call message with tool_calls property
          // This is required by OpenAI API to properly link tool calls with their results
          messages.push({
            role: 'assistant',
            content: toolUseResult.output || '',
            tool_calls: toolUseResult.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments)
              }
            }))
          });

          // Process each tool call
          for (let i = 0; i < toolUseResult.toolCalls.length; i++) {
            const toolCall = toolUseResult.toolCalls[i];
            const toolResult = toolUseResult.metadata?.toolResults?.[i];

            yield this.createStep('tool_call', 
              `TOOL: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
              {
                tool: toolCall.name,
                metadata: { arguments: toolCall.arguments }
              }
            );

            // Step 3: Observation
            if (toolResult) {
              const resultOutput = toolResult.success
                ? `${JSON.stringify(toolResult.data)}`
                : `ERROR: ${toolResult.error}`;

              const observationContent = toolResult.success
                ? `Tool ${toolCall.name} succeeded: ${JSON.stringify(toolResult.data)}`
                : `Tool ${toolCall.name} failed: ${toolResult.error}`;

              yield this.createStep('info', `TOOL: ${toolCall.name} -> ${resultOutput}`, {
                metadata: { toolResult }
              });

              // Add tool result to conversation
              messages.push({
                role: 'tool',
                content: observationContent,
                name: toolCall.name,
                toolCallId: toolCall.id
              });
            }
          }
        } else {
          // No tools needed
          if (toolUseResult.output && toolUseResult.output !== reasoningResult.output) {
            yield this.createStep('info', `AGENT-TOOL-USE: No tools needed`);
            messages.push({
              role: 'assistant',
              content: toolUseResult.output
            });
          }
        }
      } else if (context.tools && context.tools.length > 0) {
        // Tools available but not needed based on reasoning
        yield this.createStep('info', 'AGENT-TOOL-USE: No tools needed based on reasoning');
        // If we have a definitive answer and no tools needed, we're done
        if (this.hasDefinitiveAnswer(reasoningResult)) {
          isComplete = true;
          yield this.createStep('info', 'AGENT: Task completed with definitive answer');
          break;
        }
      }

      // Check for early termination signals
      if (this.shouldTerminate(reasoningResult, messages)) {
        isComplete = true;
        yield this.createStep('info', 'AGENT: Task completed');
        break;
      }
    }

    if (!isComplete) {
      yield this.createStep('info', `AGENT: Stopped after ${iteration} iterations (max: ${maxIterations})`);
    }

    // Synthesize final answer from the conversation
    yield this.createStep('capability', 'AGENT-SYNTHESIS: Synthesizing final answer...', {
      capability: 'synthesis'
    });

    const synthesisContext: AgentContext = {
      ...context,
      messages
    };

    const synthesisResult = await this.synthesisCapability.execute(synthesisContext);

    if (!synthesisResult.output) {
      yield this.createStep('error', 'AGENT-SYNTHESIS: Failed to synthesize answer');
      return;
    }

    yield this.createStep('answer', synthesisResult.output, {
      metadata: { 
        iterations: iteration, 
        sources: synthesisResult.metadata?.sources 
      }
    });
  }

  /**
   * Check if the task is complete based on reasoning output
   */
  private isTaskComplete(result: CapabilityResult): boolean {
    if (!result.output) return false;

    const output = result.output.toLowerCase();
    const completionSignals = [
      'task completed',
      'task complete',
      'finished',
      'done',
      'final answer:',
      'in conclusion',
      'therefore, the answer is'
    ];

    return completionSignals.some(signal => output.includes(signal));
  }

  /**
   * Check if we should terminate early
   */
  private shouldTerminate(result: CapabilityResult, messages: Message[]): boolean {
    // Check nextAction for termination signals
    if (result.nextAction) {
      const nextAction = result.nextAction.toLowerCase();
      if (nextAction.includes('terminate') || nextAction.includes('complete')) {
        return true;
      }
      // If nextAction is 'none', it means the reasoning is complete
      if (nextAction === 'none') {
        return true;
      }
    }
    
    // Check if we have tool results in conversation (indicates we're post-tool execution)
    const hasToolResultsInConversation = messages.some(m => m.role === 'tool');
    
    // After tool execution, if there's no nextAction, the LLM probably said "none" 
    // which was filtered out by parseReasoningOutput()
    if (hasToolResultsInConversation && !result.nextAction) {
      // After tool execution with no next action, task is likely complete
      return true;
    }

    return false;
  }

  /**
   * Check if reasoning provides a definitive answer
   */
  private hasDefinitiveAnswer(result: CapabilityResult): boolean {
    if (!result.output) return false;

    const output = result.output.toLowerCase();
    const definitiveSignals = [
      'the answer is',
      'the result is',
      'the sum is',
      'the product is',
      'the value is',
      'therefore',
      'thus',
      'in conclusion'
    ];

    // Check if nextAction is 'none' (explicit signal)
    if (result.nextAction && result.nextAction.toLowerCase() === 'none') {
      return true;
    }

    return definitiveSignals.some(signal => output.includes(signal));
  }
}
