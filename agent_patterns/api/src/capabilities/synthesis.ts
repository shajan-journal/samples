/**
 * Synthesis Capability - Combines information into coherent conclusions
 * 
 * Synthesizes information from conversation history, tool results, and reasoning
 * to produce a clear, concise final answer or conclusion.
 */

import { CapabilityResult, AgentContext, Message, LLMProvider } from '../types';
import { BaseCapability } from './base';

/**
 * Synthesis capability that uses an LLM to intelligently combine
 * information from multiple sources into a coherent final answer
 */
export class SynthesisCapability extends BaseCapability {
  name = 'synthesis';
  description = 'Combines information from conversation, tool results, and reasoning into a coherent final answer';

  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }

  async execute(context: AgentContext): Promise<CapabilityResult> {
    try {
      // Build the synthesis prompt
      const synthesisPrompt = this.buildSynthesisPrompt(context);

      // Add the synthesis instruction to messages
      const messages: Message[] = [
        ...context.messages,
        {
          role: 'system',
          content: synthesisPrompt,
        },
      ];

      // Log messages for debugging
      console.log('[DEBUG] Synthesis messages count:', messages.length);

      // Call the LLM to synthesize the final answer
      const stream = this.llmProvider.chat(messages, context.config);
      const { content, usage } = await this.collectStreamContent(stream);

      // Log raw LLM output for debugging
      console.log('[DEBUG] Synthesis raw output:', content);

      if (!content || content.trim().length === 0) {
        return this.error('Failed to synthesize answer - no output generated');
      }

      // Extract the synthesized answer
      const answer = this.extractAnswer(content);

      return this.success(answer, {
        metadata: {
          usage,
          capability: this.name,
          sources: this.identifySources(context.messages),
        },
      });
    } catch (error) {
      return this.error(
        `Synthesis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build the synthesis prompt based on context
   */
  private buildSynthesisPrompt(context: AgentContext): string {
    const hasToolResults = context.messages.some(m => m.role === 'tool');
    const hasReasoningSteps = context.messages.some(
      m => m.role === 'assistant' && (m.content.includes('REASONING:') || m.content.includes('CONCLUSION:'))
    );

    let prompt = `You are synthesizing a final answer from the conversation history.

Review the entire conversation carefully, including:`;

    if (hasReasoningSteps) {
      prompt += `\n- Reasoning steps and conclusions`;
    }
    if (hasToolResults) {
      prompt += `\n- Tool execution results`;
    }
    prompt += `\n- All assistant responses
- The original user question

Your task:
1. Identify the key information that answers the user's question
2. Synthesize this information into a clear, concise final answer
3. Provide ONLY the final answer - no meta-commentary, no explanation of your process
4. Be direct and specific
5. If the answer involves a calculation or data, state it clearly

Format your response as a complete, standalone answer that directly addresses the user's question.`;

    return prompt;
  }

  /**
   * Extract the synthesized answer from LLM response
   */
  private extractAnswer(content: string): string {
    // Clean up the response - remove any meta-commentary
    let answer = content.trim();

    // Remove common prefixes if present
    const prefixes = [
      /^(the\s+)?(final\s+)?answer\s+(is|:)\s*/i,
      /^(in\s+)?conclusion[,:]?\s*/i,
      /^(to\s+)?summarize[,:]?\s*/i,
      /^based\s+on\s+(the\s+)?(conversation|discussion|analysis)[,:]?\s*/i,
    ];

    for (const prefix of prefixes) {
      answer = answer.replace(prefix, '');
    }

    return answer.trim();
  }

  /**
   * Identify which messages contributed to the synthesis
   */
  private identifySources(messages: Message[]): string[] {
    const sources: string[] = [];

    for (let i = messages.length - 1; i >= 0 && sources.length < 5; i--) {
      const msg = messages[i];
      if (msg.role === 'tool' && msg.name) {
        sources.push(`tool:${msg.name}`);
      } else if (msg.role === 'assistant' && msg.content.includes('CONCLUSION:')) {
        sources.push('reasoning');
      }
    }

    return sources;
  }
}
