/**
 * Mock LLM Provider for testing
 */

import { LLMChunk, Message, LLMConfig, ToolDefinition, ToolCall } from '../types';
import { BaseLLMProvider } from './base';

export interface MockResponse {
  content?: string;
  toolCalls?: ToolCall[];
  delayMs?: number;
}

/**
 * Mock LLM provider that returns predefined responses
 * Useful for testing without making real API calls
 */
export class MockLLMProvider extends BaseLLMProvider {
  private responses: MockResponse[] = [];
  private currentResponseIndex = 0;

  /**
   * Set predefined responses for the mock provider
   */
  setResponses(responses: MockResponse[]): void {
    this.responses = responses;
    this.currentResponseIndex = 0;
  }

  /**
   * Add a single response to the queue
   */
  addResponse(response: MockResponse): void {
    this.responses.push(response);
  }

  /**
   * Reset the provider to initial state
   */
  reset(): void {
    this.responses = [];
    this.currentResponseIndex = 0;
  }

  async *chat(
    messages: Message[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk> {
    this.validateConfig(options);

    if (this.currentResponseIndex >= this.responses.length) {
      // Default response if no more responses configured
      yield {
        type: 'content',
        content: 'Mock response',
      };
      yield {
        type: 'done',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };
      return;
    }

    const response = this.responses[this.currentResponseIndex++];

    // Simulate delay if specified
    if (response.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, response.delayMs));
    }

    // Stream content if provided
    if (response.content) {
      // Simulate streaming by chunking the content
      const words = response.content.split(' ');
      for (const word of words) {
        yield {
          type: 'content',
          content: word + ' ',
        };
      }
    }

    // Send tool calls if provided
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        yield {
          type: 'tool_call',
          toolCall,
        };
      }
    }

    // Send completion
    yield {
      type: 'done',
      finishReason: response.toolCalls ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: this.estimateTokens(messages),
        completionTokens: this.estimateTokens([
          { role: 'assistant', content: response.content || '' },
        ]),
        totalTokens: 0, // Will be calculated
      },
    };
  }

  async *chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk> {
    // For mock provider, chatWithTools behaves the same as chat
    // Tool calls are determined by the configured responses
    yield* this.chat(messages, options);
  }

  /**
   * Simple token estimation (roughly 1 token per 4 characters)
   */
  private estimateTokens(messages: Message[]): number {
    const text = messages.map((m) => m.content).join(' ');
    return Math.ceil(text.length / 4);
  }

  /**
   * Get the current response index (useful for testing)
   */
  getCurrentIndex(): number {
    return this.currentResponseIndex;
  }

  /**
   * Get the total number of configured responses
   */
  getResponseCount(): number {
    return this.responses.length;
  }
}
