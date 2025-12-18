/**
 * Base capability implementation and utilities
 */

import { Capability, CapabilityResult, AgentContext, LLMChunk, LLMProvider } from '../types';

/**
 * Abstract base class for capabilities with common functionality
 */
export abstract class BaseCapability implements Capability {
  abstract name: string;
  abstract description: string;

  abstract execute(context: AgentContext): Promise<CapabilityResult>;

  /**
   * Helper to collect all chunks from an LLM stream into a single string
   */
  protected async collectStreamContent(
    stream: AsyncGenerator<LLMChunk>
  ): Promise<{ content: string; reasoning?: string; usage?: any }> {
    let content = '';
    let reasoning = '';
    let usage;

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        content += chunk.content || '';
      } else if (chunk.type === 'done') {
        usage = chunk.usage;
      }
    }

    return { content: content.trim(), usage };
  }

  /**
   * Helper to extract tool calls from an LLM stream
   */
  protected async collectStreamWithToolCalls(
    stream: AsyncGenerator<LLMChunk>
  ): Promise<{ content: string; toolCalls: any[]; usage?: any }> {
    let content = '';
    const toolCalls: any[] = [];
    let usage;

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        content += chunk.content || '';
      } else if (chunk.type === 'tool_call') {
        if (chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
        }
      } else if (chunk.type === 'done') {
        usage = chunk.usage;
      }
    }

    return { content: content.trim(), toolCalls, usage };
  }

  /**
   * Helper to create a success result
   */
  protected success(
    output: string,
    options?: {
      reasoning?: string;
      nextAction?: string;
      toolCalls?: any[];
      metadata?: Record<string, any>;
    }
  ): CapabilityResult {
    return {
      output,
      reasoning: options?.reasoning,
      nextAction: options?.nextAction,
      toolCalls: options?.toolCalls,
      metadata: options?.metadata,
    };
  }

  /**
   * Helper to create an error result
   */
  protected error(message: string, metadata?: Record<string, any>): CapabilityResult {
    return {
      output: '',
      reasoning: `Error: ${message}`,
      metadata: { ...metadata, error: true },
    };
  }

  /**
   * Helper to get the LLM provider from context
   */
  protected getLLMProvider(context: AgentContext): LLMProvider {
    // In a full implementation, this would be injected or retrieved from context
    // For now, we'll throw an error if not provided
    throw new Error('LLM provider must be provided in context.state.llmProvider');
  }
}

/**
 * Registry for capabilities
 */
export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();

  register(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  getAllInfo(): Array<{ name: string; description: string }> {
    return this.getAll().map((cap) => ({
      name: cap.name,
      description: cap.description,
    }));
  }
}
