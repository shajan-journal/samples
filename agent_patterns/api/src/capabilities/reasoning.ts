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
      // Build the reasoning prompt
      const reasoningPrompt = this.buildReasoningPrompt(context);

      // Add the reasoning instruction to messages
      const messages: Message[] = [
        ...context.messages,
        {
          role: 'system',
          content: reasoningPrompt,
        },
      ];

      // Log messages for debugging
      console.log('[DEBUG] Reasoning messages count:', messages.length);
      console.log('[DEBUG] Last 2 messages:', JSON.stringify(messages.slice(-2), null, 2));

      // Call the LLM to perform reasoning
      const stream = this.llmProvider.chat(messages, context.config);
      const { content, usage } = await this.collectStreamContent(stream);

      // Log raw LLM output for debugging
      console.log('[DEBUG] Raw LLM output:', content);
      console.log('[DEBUG] Content length:', content?.length || 0);

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
  private buildReasoningPrompt(context: AgentContext): string {
    const hasTools = context.tools && context.tools.length > 0;

    let prompt = `You are performing a reasoning task. Analyze the conversation and available information to reach a logical conclusion.

Instructions:
1. Review the conversation history carefully
2. Identify key facts and information
3. Apply logical reasoning to draw conclusions
4. Clearly explain your reasoning process
5. State your final conclusion`;

    if (hasTools) {
      const toolNames = context.tools.map((t) => t.name).join(', ');
      prompt += `\n6. If you need additional information, suggest which tool to use (available tools: ${toolNames})`;
    }

    prompt += `

Format your response as follows:
REASONING: [Your step-by-step reasoning process]
CONCLUSION: [Your final conclusion]`;

    if (hasTools) {
      prompt += `\nNEXT_ACTION: [What should be done next, or which tool to use if needed, or "none" if complete]`;
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

    return {
      reasoning,
      conclusion,
      nextAction: nextAction && nextAction !== 'none' ? nextAction : undefined,
    };
  }
}
