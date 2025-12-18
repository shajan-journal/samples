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

export interface ReActOptions {
  maxIterations?: number;
  verbose?: boolean;
}

export class ReActPattern extends BasePattern {
  name = 'react';
  description = 'Reasoning + Acting loop: interleaves reasoning with tool use until task completion';

  private reasoningCapability: ReasoningCapability;
  private toolUseCapability: ToolUseCapability;

  constructor(llmProvider: LLMProvider) {
    super();
    this.reasoningCapability = new ReasoningCapability(llmProvider);
    this.toolUseCapability = new ToolUseCapability(llmProvider);
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

    yield this.createStep('result', `Starting ReAct pattern for: "${input}"`);

    while (iteration < maxIterations && !isComplete) {
      iteration++;

      if (verbose) {
        yield this.createStep('result', `\n--- Iteration ${iteration} ---`);
      }

      // Step 1: Reasoning
      yield this.createStep('capability', 'Reasoning about the problem...', {
        capability: 'reasoning'
      });

      const reasoningContext: AgentContext = {
        ...context,
        messages
      };

      const reasoningResult = await this.reasoningCapability.execute(reasoningContext);

      if (!reasoningResult.output) {
        yield this.createStep('error', 'Reasoning failed: No output generated');
        break;
      }

      yield this.createStep('result', reasoningResult.output, {
        metadata: {
          reasoning: reasoningResult.reasoning,
          nextAction: reasoningResult.nextAction
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
        yield this.createStep('result', '\n✓ Task completed successfully');
        break;
      }

      // Step 2: Action (Tool Use)
      if (context.tools && context.tools.length > 0) {
        yield this.createStep('capability', 'Deciding if tools are needed...', {
          capability: 'tool_use'
        });

        const toolUseContext: AgentContext = {
          ...context,
          messages
        };

        const toolUseResult = await this.toolUseCapability.execute(toolUseContext);

        // If tools were called
        if (toolUseResult.toolCalls && toolUseResult.toolCalls.length > 0) {
          // Add assistant's tool call message
          if (toolUseResult.output) {
            messages.push({
              role: 'assistant',
              content: toolUseResult.output
            });
          }

          // Process each tool call
          for (let i = 0; i < toolUseResult.toolCalls.length; i++) {
            const toolCall = toolUseResult.toolCalls[i];
            const toolResult = toolUseResult.metadata?.toolResults?.[i];

            yield this.createStep('tool_call', 
              `Calling tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
              {
                tool: toolCall.name,
                metadata: { arguments: toolCall.arguments }
              }
            );

            // Step 3: Observation
            if (toolResult) {
              const observationContent = toolResult.success
                ? `Tool ${toolCall.name} succeeded: ${JSON.stringify(toolResult.data)}`
                : `Tool ${toolCall.name} failed: ${toolResult.error}`;

              yield this.createStep('result', `Observation: ${observationContent}`, {
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
            yield this.createStep('result', `No tools needed: ${toolUseResult.output}`);
            messages.push({
              role: 'assistant',
              content: toolUseResult.output
            });
          }
        }
      }

      // Check for early termination signals
      if (this.shouldTerminate(reasoningResult)) {
        isComplete = true;
        yield this.createStep('result', '\n✓ Task completed');
        break;
      }
    }

    if (!isComplete) {
      yield this.createStep('result', `\n⚠ Reached maximum iterations (${maxIterations})`);
    }

    // Extract final answer from the conversation
    const finalAnswer = this.extractFinalAnswer(messages);
    yield this.createStep('result', `\nFinal Answer: ${finalAnswer}`, {
      metadata: { iterations: iteration, messages }
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
  private shouldTerminate(result: CapabilityResult): boolean {
    // Check nextAction for termination signals
    if (result.nextAction) {
      const nextAction = result.nextAction.toLowerCase();
      if (nextAction.includes('terminate') || nextAction.includes('complete')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract the final answer from the conversation
   */
  private extractFinalAnswer(messages: Message[]): string {
    // Get the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i].content;
      }
    }

    return 'No answer generated';
  }
}
