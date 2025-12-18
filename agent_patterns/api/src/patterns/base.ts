/**
 * Base pattern class and registry for agent patterns
 */

import { AgentPattern, AgentContext, PatternStep } from '../types';

/**
 * Base class for all agent patterns
 */
export abstract class BasePattern implements AgentPattern {
  abstract name: string;
  abstract description: string;

  abstract execute(input: string, context: AgentContext): AsyncGenerator<PatternStep>;

  /**
   * Create a pattern step
   */
  protected createStep(
    type: 'capability' | 'tool_call' | 'info' | 'answer' | 'error',
    content: string,
    options?: {
      capability?: string;
      tool?: string;
      metadata?: Record<string, any>;
    }
  ): PatternStep {
    return {
      type,
      content,
      timestamp: Date.now(),
      ...options
    };
  }

  /**
   * Yield a capability step
   */
  protected async *yieldCapabilityStep(
    capabilityName: string,
    content: string,
    metadata?: Record<string, any>
  ): AsyncGenerator<PatternStep> {
    yield this.createStep('capability', content, {
      capability: capabilityName,
      metadata
    });
  }

  /**
   * Yield a tool call step
   */
  protected async *yieldToolCallStep(
    toolName: string,
    content: string,
    metadata?: Record<string, any>
  ): AsyncGenerator<PatternStep> {
    yield this.createStep('tool_call', content, {
      tool: toolName,
      metadata
    });
  }

  /**
   * Yield a result step
   */
  protected async *yieldResultStep(
    content: string,
    metadata?: Record<string, any>
  ): AsyncGenerator<PatternStep> {
    yield this.createStep('info', content, { metadata });
  }

  /**
   * Yield an error step
   */
  protected async *yieldErrorStep(
    content: string,
    metadata?: Record<string, any>
  ): AsyncGenerator<PatternStep> {
    yield this.createStep('error', content, { metadata });
  }
}

/**
 * Registry for managing patterns
 */
export class PatternRegistry {
  private static patterns = new Map<string, AgentPattern>();

  /**
   * Register a pattern
   */
  static register(pattern: AgentPattern): void {
    this.patterns.set(pattern.name, pattern);
  }

  /**
   * Get a pattern by name
   */
  static get(name: string): AgentPattern | undefined {
    return this.patterns.get(name);
  }

  /**
   * Get all registered patterns
   */
  static getAll(): AgentPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Check if a pattern is registered
   */
  static has(name: string): boolean {
    return this.patterns.has(name);
  }

  /**
   * Clear all patterns
   */
  static clear(): void {
    this.patterns.clear();
  }
}
