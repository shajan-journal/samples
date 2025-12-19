/**
 * Reasoning Capability - Performs logical deduction and inference
 */

import { CapabilityResult, AgentContext, Message, LLMProvider } from '../types';
import { BaseCapability } from './base';

/**
 * Reasoning capability that uses an LLM to perform logical inference
 * over available information to reach conclusions
 */
export class ReasoningCapability extends BaseCapability {
  name = 'reasoning';
  description = 'Performs logical deduction and inference over available information to reach conclusions';

  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }

  async execute(context: AgentContext): Promise<CapabilityResult> {
    try {
      // Check if user explicitly asks for tool use or if task is algorithmic
      const userMessage = context.messages.find(m => m.role === 'user')?.content || '';
      const hasCodeExecution = context.tools?.some(t => 
        t.name === 'node_execute' || t.name === 'python_execute'
      );
      
      // Check if we already have tool results in the conversation
      const hasToolResults = context.messages.some(m => m.role === 'tool');
      
      // Detect if user explicitly asks for tools or if task requires code execution
      const explicitlyAsksForTools = /\b(use tools?|try tools?|using tools?|with tools?|tool)\b/i.test(userMessage);
      const isAlgorithmicTask = /\b(reverse|sort|calculate|compute|parse|transform|filter)\b/i.test(userMessage);
      // Only suggest code if we DON'T already have tool results
      const shouldSuggestCode = !hasToolResults && hasCodeExecution && (explicitlyAsksForTools || isAlgorithmicTask);

      console.log('[DEBUG] Reasoning detection:', {
        userMessage: userMessage.substring(0, 100),
        hasCodeExecution,
        hasToolResults,
        explicitlyAsksForTools,
        isAlgorithmicTask,
        shouldSuggestCode
      });

      // Build the reasoning prompt
      const reasoningPrompt = this.buildReasoningPrompt(context, shouldSuggestCode);

      console.log('[DEBUG] Reasoning prompt length:', reasoningPrompt.length);
      console.log('[DEBUG] Prompt includes IMPORTANT:', reasoningPrompt.includes('**IMPORTANT FOR THIS REQUEST**'));

      // Add the reasoning instruction to messages
      // Put system instructions at the BEGINNING so the model sees them first
      const messages: Message[] = [
        {
          role: 'system',
          content: reasoningPrompt,
        },
        ...context.messages,
      ];

      // Log messages for debugging
      console.log('[DEBUG] Reasoning messages count:', messages.length);
      console.log('[DEBUG] Last 2 messages:', JSON.stringify(messages.slice(-2), null, 2));

      // Call the LLM to perform reasoning
      console.log('[DEBUG] About to call LLM chat...');
      const stream = this.llmProvider.chat(messages, context.config);
      console.log('[DEBUG] Stream received, collecting content...');
      const { content, usage } = await this.collectStreamContent(stream);
      console.log('[DEBUG] Content collected');

      // Log raw LLM output for debugging
      console.log('[DEBUG] Raw LLM output:', content);
      console.log('[DEBUG] Content length:', content?.length || 0);

      // Check if content is empty
      if (!content || content.trim().length === 0) {
        console.error('[ERROR] LLM returned empty content!');
        return this.error('LLM returned empty response');
      }

      // Parse the reasoning output
      const { reasoning, conclusion, nextAction } = this.parseReasoningOutput(content);

      return this.success(conclusion, {
        reasoning,
        nextAction,
        metadata: {
          usage,
          capability: this.name,
          debug: {
            messagesCount: messages.length,
            rawLLMOutput: content,
            contentLength: content?.length || 0,
            fullMessages: messages,  // Include ALL messages sent to LLM
            systemPrompt: reasoningPrompt,  // Include the system prompt
            availableTools: context.tools.map(t => ({ name: t.name, description: t.description })),
            detectionFlags: {
              hasCodeExecution,
              explicitlyAsksForTools,
              isAlgorithmicTask,
              shouldSuggestCode
            }
          },
        },
      });
    } catch (error) {
      return this.error(
        `Reasoning failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build the reasoning prompt based on context
   */
  private buildReasoningPrompt(context: AgentContext, shouldSuggestCode: boolean = false): string {
    const hasTools = context.tools && context.tools.length > 0;
    const hasToolResults = context.messages.some(m => m.role === 'tool');
    
    // Identify if code execution tools are available
    const hasCodeExecution = context.tools?.some(t => 
      t.name === 'node_execute' || t.name === 'python_execute'
    );

    let prompt = `You are performing a reasoning task. Analyze the conversation and available information to reach a logical conclusion.

Instructions:
1. Review the conversation history carefully${hasToolResults ? ' including any tool results' : ''}
2. Identify key facts and information
3. Apply logical reasoning to draw conclusions
4. Clearly explain your reasoning process
5. State your final conclusion`;

    if (hasTools) {
      const toolNames = context.tools.map((t) => t.name).join(', ');
      prompt += `\n6. If you need additional information, suggest which tool to use (available tools: ${toolNames})`;
    }

    if (hasCodeExecution) {
      prompt += `

CRITICAL RULE - Code execution vs manual reasoning:
As an AI language model, you are EXCELLENT at:
- Understanding problems and breaking them down
- Writing algorithms and code to solve problems
- Designing logical solutions

However, you are NOT GOOD at:
- Manually executing algorithms step-by-step (error-prone)
- Performing procedural transformations mentally
- Computing exact results for algorithmic tasks

Therefore: If a task is algorithmic or procedural in nature, you MUST:
1. Write code to solve it (using node_execute or python_execute)
2. Execute that code to get the precise answer
3. NEVER attempt to manually compute or guess the result

Tasks requiring code execution include:
- String/array manipulations (reversing, sorting, transforming)
- Mathematical calculations or formula applications
- Data parsing, processing, or analysis
- Pattern matching or text processing
- Any task with deterministic steps that a computer executes better

Rule of thumb: If you would write a function to solve this in real programming, use code execution.
Your job is to WRITE the algorithm, not EXECUTE it mentally.`;

      // Add extra strong guidance if we detected the user wants tools
      if (shouldSuggestCode) {
        prompt += `

**IMPORTANT FOR THIS REQUEST**: The user's request requires code execution. You MUST set NEXT_ACTION to either "node_execute" or "python_execute" - do NOT attempt to solve this manually.`;
      }
    }

    if (hasToolResults) {
      prompt += `

**IMPORTANT - Tool results are available**: Review the tool execution results in the conversation history. If the tool has successfully provided the answer to the user's question, state that in your CONCLUSION and set NEXT_ACTION to "none". Do not request the same tool again.`;
    }

    prompt += `

Format your response as follows:
REASONING: [Your step-by-step reasoning process]
CONCLUSION: [Your final conclusion]`;

    if (hasTools) {
      prompt += `\nNEXT_ACTION: [Which tool to use if needed, or "none" if you can answer directly or if tool results are sufficient]`;
    }

    return prompt;
  }

  /**
   * Parse the structured reasoning output from the LLM
   */
  private parseReasoningOutput(content: string): {
    reasoning: string;
    conclusion: string;
    nextAction?: string;
  } {
    // Extract REASONING section
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?=CONCLUSION:|$)/s);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : content;

    // Extract CONCLUSION section
    const conclusionMatch = content.match(/CONCLUSION:\s*(.+?)(?=NEXT_ACTION:|$)/s);
    const conclusion = conclusionMatch ? conclusionMatch[1].trim() : content;

    // Extract NEXT_ACTION section if present
    const nextActionMatch = content.match(/NEXT_ACTION:\s*(.+?)$/s);
    const nextAction = nextActionMatch ? nextActionMatch[1].trim() : undefined;

    // Filter out "none" (case-insensitive, strip punctuation) and return undefined
    const normalizedAction = nextAction?.toLowerCase().replace(/[.,!?;]+$/g, '').trim();
    const shouldUseAction = normalizedAction && normalizedAction !== 'none';

    return {
      reasoning,
      conclusion,
      nextAction: shouldUseAction ? nextAction : undefined,
    };
  }
}
