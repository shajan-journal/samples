/**
 * PlanAndValidatePattern: Plan → Execute Steps → Validate → Refine
 *
 * This pattern asks the LLM to create a plan upfront (breaking task into steps),
 * then executes each step with validation, using validation feedback to refine
 * and continue. Demonstrates structured planning + iterative validation.
 */

import { BasePattern } from './base';
import { AgentContext, PatternStep, Message, CapabilityResult, LLMProvider, Tool } from '../types';
import { ToolUseCapability } from '../capabilities/tool-use';
import { ValidationCapability } from '../capabilities/validation';
import { SynthesisCapability } from '../capabilities/synthesis';

export interface PlanAndValidateOptions {
  maxSteps?: number;
  verbose?: boolean;
}

interface Step {
  number: number;
  description: string;
  completed: boolean;
  result?: string;
}

export class PlanAndValidatePattern extends BasePattern {
  name = 'plan-and-validate';
  description = 'Plan steps upfront, execute with validation gates, refine as needed';

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
    options: PlanAndValidateOptions = {}
  ): AsyncGenerator<PatternStep> {
    const maxSteps = options.maxSteps || 10;
    const verbose = options.verbose ?? true;

    const messages: Message[] = [
      ...context.messages,
      { role: 'user', content: input }
    ];

    yield this.createStep('info', `AGENT: Starting Plan-and-Validate for: "${input}"`);

    // Step 1: Ask LLM to create a plan
    yield this.createStep('capability', 'AGENT: Creating plan...', { capability: 'planning' });

    const toolListDescription = this.describeTools(context.tools);

    const planPrompt = `You are planning how to solve a task. Break it down into clear, executable steps.
Task: ${input}

Available tools (use exact names and respect required parameters):
${toolListDescription}

Create a numbered plan with 2-5 concrete, actionable steps. Each step must:
- Reference one of the tools above by name
- Provide any required parameters or runnable code blocks (e.g., include full JavaScript for node_execute)
- Produce an explicit output that can be validated
- When possible, include a tool-based validation action that confirms the result (e.g., compute an inverse transformation, compare against expected data, or run assertions)

Format:
1. Use [tool name] to [specific action] and output the result
2. Use [tool name] to [specific action] and output the result
...`;

    messages.push({ role: 'user', content: planPrompt });

    // For now, use a simple planning approach: ask tool-use to generate a plan
    // In practice, you'd have a dedicated PlanningCapability
    const planContext: AgentContext = { ...context, messages };
    const toolUseResult = await this.toolUseCapability.execute(planContext);

    if (!toolUseResult.output) {
      yield this.createStep('error', 'AGENT: Failed to create plan');
      return;
    }

    const planText = toolUseResult.output;
    yield this.createStep('info', `PLAN:\n${planText}`);

    // Remove the plan request from messages; keep user's original input
    messages.pop();
    // Re-add the original user input if needed
    if (!messages.some(m => m.role === 'user' && m.content === input)) {
      messages[messages.length - 1] = { role: 'user', content: input };
    }

    // Step 2: Execute each step with validation
    let steps = this.parsePlan(planText);
    if (steps.length === 0) {
      yield this.createStep('info', 'AGENT: Plan has no steps; using original input');
      steps.push({ number: 1, description: input, completed: false });
    }
    let failedStepsCount = 0;

    for (let i = 0; i < steps.length && i < maxSteps; i++) {
      const step = steps[i];

      if (verbose) {
        yield this.createStep('info', `\n[Step ${step.number}] Executing: ${step.description}`);
      }

      // Execute this step
      yield this.createStep('capability', `AGENT-TOOL-USE: Executing step ${step.number}...`, {
        capability: 'tool_use'
      });

      const executionPrompt = `Plan step ${step.number}: ${step.description}\nConvert this step into a concrete tool call and execute it.`;
      const stepResult = await this.requestToolExecution(
        executionPrompt,
        context,
        messages,
        toolListDescription
      );

      if (!stepResult) {
        yield this.createStep('error', `AGENT: Step ${step.number} failed - no executable action generated`);
        failedStepsCount++;

        if (failedStepsCount >= 2) {
          yield this.createStep('info', 'AGENT: Multiple steps failing; requesting refined plan...');
          const replanPrompt = `The previous plan caused execution failures. Provide a revised plan with explicit tool usage for: ${input}`;
          messages.push({ role: 'user', content: replanPrompt });

          const replanContext: AgentContext = { ...context, messages };
          const replanResult = await this.toolUseCapability.execute(replanContext);

          if (replanResult.output) {
            yield this.createStep('info', `NEW PLAN:\n${replanResult.output}`);
            steps = this.parsePlan(replanResult.output);
            failedStepsCount = 0;

            if (steps.length === 0) {
              yield this.createStep('info', 'AGENT: Revised plan is empty; stopping execution');
              break;
            }

            i = -1;
            continue;
          }
        }

        continue;
      }

      // Check if visualizations were generated and update context state
      if (stepResult.metadata?.visualizations) {
        if (!context.state) {
          context.state = {};
        }
        context.state.visualizations = stepResult.metadata.visualizations;
        console.log('[PlanAndValidatePattern] Captured visualization data from tool execution');
      }

      const stepOutput = this.deriveToolOutput(stepResult);
      yield this.createStep('info', `STEP ${step.number} RESULT: ${stepOutput}`, {
        metadata: { stepNumber: step.number }
      });

      // Surface tool call details
      if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
        for (let j = 0; j < stepResult.toolCalls.length; j++) {
          const call = stepResult.toolCalls[j];
          const result = stepResult.metadata?.toolResults?.[j];

          yield this.createStep('tool_call', `TOOL: ${call.name}(${JSON.stringify(call.arguments)})`, {
            tool: call.name
          });

          if (result) {
            const resultOutput = result.success ? `${JSON.stringify(result.data)}` : `ERROR: ${result.error}`;
            yield this.createStep('info', `TOOL: ${call.name} -> ${resultOutput}`, {
              metadata: { toolResult: result }
            });
          }
        }
      }

      this.recordToolMessages(stepResult, messages);

      // Validate this step
      yield this.createStep('capability', `AGENT-VALIDATION: Validating step ${step.number}...`, {
        capability: 'validation'
      });

      const valContext: AgentContext = { ...context, messages };
      const validation = await this.validationCapability.execute(valContext);

      if (validation.isValid) {
        yield this.createStep('info', `STEP ${step.number} VALIDATION: Passed`);
        steps[i].completed = true;
        steps[i].result = stepOutput;
        failedStepsCount = 0;
      } else {
        const issues = (validation.validationIssues || []).join('; ');
        const fixes = (validation.suggestedFixes || []).join('; ');
        yield this.createStep('info', `STEP ${step.number} VALIDATION: Failed - ${issues}`, {
          metadata: { issues: validation.validationIssues, fixes: validation.suggestedFixes }
        });

        // Feed validation back for refinement
        const feedback = `Validation feedback for step ${step.number}: ${issues}. Please refine: ${fixes}`;
        messages.push({ role: 'user', content: feedback });

        // Re-execute this step with feedback
        if (verbose) {
          yield this.createStep('info', `[Step ${step.number}] Refining after validation feedback...`);
        }

        const refineInstruction = `Refine step ${step.number} using this validation feedback: ${feedback}\nOriginal step: ${step.description}\nGenerate a corrected tool call and execute it.`;
        const refineResult = await this.requestToolExecution(
          refineInstruction,
          context,
          messages,
          toolListDescription
        );

        if (refineResult) {
          const refinedOutput = this.deriveToolOutput(refineResult);
          yield this.createStep('info', `STEP ${step.number} REFINED: ${refinedOutput}`, {
            metadata: { refined: true }
          });

          if (refineResult.toolCalls && refineResult.toolCalls.length > 0) {
            for (let j = 0; j < refineResult.toolCalls.length; j++) {
              const call = refineResult.toolCalls[j];
              const result = refineResult.metadata?.toolResults?.[j];

              yield this.createStep('tool_call', `TOOL: ${call.name}(${JSON.stringify(call.arguments)})`, {
                tool: call.name
              });

              if (result) {
                const resultOutput = result.success ? `${JSON.stringify(result.data)}` : `ERROR: ${result.error}`;
                yield this.createStep('info', `TOOL: ${call.name} -> ${resultOutput}`, {
                  metadata: { toolResult: result }
                });
              }
            }
          }

          this.recordToolMessages(refineResult, messages);

          // Re-validate after refinement
          const revalContext: AgentContext = { ...context, messages };
          const revalidation = await this.validationCapability.execute(revalContext);

          if (revalidation.isValid) {
            yield this.createStep('info', `STEP ${step.number} VALIDATION: Passed after refinement`);
            steps[i].completed = true;
            steps[i].result = refinedOutput;
            failedStepsCount = 0;
          } else {
            yield this.createStep('info', `STEP ${step.number} VALIDATION: Still failing; continuing to next step`);
            failedStepsCount++;

            if (failedStepsCount >= 2) {
              yield this.createStep('info', 'AGENT: Validation continuing to fail; requesting refined plan...');
              const replanPrompt = `Validation failures persist. Provide a revised plan with explicit tool usage for: ${input}`;
              messages.push({ role: 'user', content: replanPrompt });

              const replanContext: AgentContext = { ...context, messages };
              const replanResult = await this.toolUseCapability.execute(replanContext);

              if (replanResult.output) {
                yield this.createStep('info', `NEW PLAN:\n${replanResult.output}`);
                steps = this.parsePlan(replanResult.output);
                failedStepsCount = 0;

                if (steps.length === 0) {
                  yield this.createStep('info', 'AGENT: Revised plan is empty; stopping execution');
                  break;
                }

                i = -1;
                continue;
              }
            }
          }
        } else {
          failedStepsCount++;

          if (failedStepsCount >= 2) {
            yield this.createStep('info', 'AGENT: Refinement failed to produce output; requesting refined plan...');
            const replanPrompt = `Refinement produced no actionable output. Provide a revised plan with explicit tool usage for: ${input}`;
            messages.push({ role: 'user', content: replanPrompt });

            const replanContext: AgentContext = { ...context, messages };
            const replanResult = await this.toolUseCapability.execute(replanContext);

            if (replanResult.output) {
              yield this.createStep('info', `NEW PLAN:\n${replanResult.output}`);
              steps = this.parsePlan(replanResult.output);
              failedStepsCount = 0;

              if (steps.length === 0) {
                yield this.createStep('info', 'AGENT: Revised plan is empty; stopping execution');
                break;
              }

              i = -1;
              continue;
            }
          }
        }
      }
    }

    // Final synthesis
    yield this.createStep('capability', 'AGENT-SYNTHESIS: Synthesizing final answer...', { capability: 'synthesis' });

    const synthesisContext: AgentContext = { ...context, messages };
    const synthesis = await this.synthesisCapability.execute(synthesisContext);

    if (!synthesis.output) {
      yield this.createStep('error', 'AGENT-SYNTHESIS: Failed to synthesize');
      return;
    }

    // Log step completion summary for debugging but don't include in answer
    const completedCount = steps.filter(s => s.completed).length;
    const totalSteps = steps.length > 0 ? steps.length : 1;
    if (options.verbose) {
      yield this.createStep('info', `Execution summary: ${completedCount}/${totalSteps} steps completed`);
    }
    
    // Extract visualizations from synthesis metadata if present
    const answerMetadata: any = {};
    if (synthesis.metadata?.visualizations) {
      answerMetadata.visualizations = synthesis.metadata.visualizations;
      console.log('[PlanAndValidatePattern] Including visualization data in final answer step');
    }
    
    yield this.createStep('answer', synthesis.output, {
      metadata: Object.keys(answerMetadata).length > 0 ? answerMetadata : undefined
    });
  }

  private describeTools(tools?: Tool[]): string {
    if (!tools || tools.length === 0) {
      return 'No tools are currently available.';
    }

    return tools
      .map(tool => {
        const paramEntries = Object.entries(tool.parameters?.properties || {});
        const paramLines = paramEntries
          .map(
            ([paramName, param]) =>
              `    - ${paramName} (${param.type}): ${param.description || 'No description provided'}`
          )
          .join('\n');
        const requiredLine = tool.parameters?.required && tool.parameters.required.length > 0
          ? `  Required parameters: ${tool.parameters.required.join(', ')}`
          : '';

        return [`- ${tool.name}: ${tool.description}`, paramLines ? `  Parameters:\n${paramLines}` : '', requiredLine]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');
  }

  private async requestToolExecution(
    instruction: string,
    context: AgentContext,
    baseMessages: Message[],
    toolListDescription: string
  ): Promise<CapabilityResult | null> {
    if (!context.tools || context.tools.length === 0) {
      return null;
    }

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptWarning =
        attempt === 1
          ? ''
          : '\nPREVIOUS RESPONSE DID NOT INCLUDE A TOOL CALL. RESPOND ONLY BY CALLING A TOOL NOW.';
      const executionMessage = `${instruction}

Available tools:
${toolListDescription}

Requirements:
1. Respond by calling an available tool.
2. Provide runnable code for code-execution tools.
3. Do not return plain-language answers.
${attemptWarning}`.trim();

      const stepContext: AgentContext = {
        ...context,
        messages: [
          ...baseMessages,
          { role: 'user', content: executionMessage }
        ]
      };

      const result = await this.toolUseCapability.execute(stepContext);
      if (result.toolCalls && result.toolCalls.length > 0) {
        return result;
      }
    }

    return null;
  }

  private deriveToolOutput(stepResult: CapabilityResult): string {
    if (stepResult.output && stepResult.output.trim().length > 0) {
      return stepResult.output;
    }

    const toolResults = stepResult.metadata?.toolResults;
    if (toolResults && toolResults.length > 0) {
      const primary = toolResults[0];
      if (primary.success) {
        return this.formatToolData(primary.data);
      }
      return primary.error || 'Tool execution failed';
    }

    return '(no output)';
  }

  private recordToolMessages(stepResult: CapabilityResult, messages: Message[]): void {
    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      const assistantContent =
        stepResult.output && stepResult.output.trim().length > 0
          ? stepResult.output
          : `Executed ${stepResult.toolCalls.map(tc => tc.name).join(', ')}.`;

      messages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: stepResult.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
        }))
      });

      stepResult.toolCalls.forEach((call, index) => {
        const result = stepResult.metadata?.toolResults?.[index];
        if (!result) {
          return;
        }

        const toolMsgContent = result.success
          ? `Tool ${call.name} succeeded: ${this.formatToolData(result.data)}`
          : `Tool ${call.name} failed: ${result.error}`;
        messages.push({
          role: 'tool',
          content: toolMsgContent,
          name: call.name,
          toolCallId: call.id
        });
      });
    } else if (stepResult.output && stepResult.output.trim().length > 0) {
      messages.push({ role: 'assistant', content: stepResult.output });
    }
  }

  private formatToolData(data: any): string {
    if (data === null || data === undefined) {
      return '';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return data.toString();
    }
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  /**
   * Parse a plan from LLM output into numbered steps
   */
  private parsePlan(planText: string): Step[] {
    const steps: Step[] = [];
    const lines = planText.split('\n');

    for (const line of lines) {
      // Match lines like "1. Step description" or "1) Step description"
      const match = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
      if (match) {
        steps.push({
          number: parseInt(match[1], 10),
          description: match[2].trim(),
          completed: false
        });
      }
    }

    return steps;
  }
}
