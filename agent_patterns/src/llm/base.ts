/**
 * Base LLM Provider implementation
 */

import { LLMProvider, LLMChunk, Message, LLMConfig, ToolDefinition } from '../types';

/**
 * Abstract base class for LLM providers with common functionality
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract chat(
    messages: Message[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk>;

  abstract chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk>;

  /**
   * Helper to format messages for display
   */
  protected formatMessages(messages: Message[]): string {
    return messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
  }

  /**
   * Helper to validate configuration
   */
  protected validateConfig(options: LLMConfig): void {
    if (!options.model) {
      throw new Error('Model is required');
    }
    if (options.temperature !== undefined && 
        (options.temperature < 0 || options.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2');
    }
    if (options.maxTokens !== undefined && options.maxTokens < 1) {
      throw new Error('Max tokens must be positive');
    }
  }
}

/**
 * Registry for LLM providers
 */
export class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  register(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  getAll(): Map<string, LLMProvider> {
    return new Map(this.providers);
  }
}
