/**
 * Agent Orchestrator - Entry point for executing agent patterns
 * 
 * The orchestrator manages pattern execution, streaming events, and error handling.
 * It provides a unified interface for running different agentic patterns with
 * consistent event streaming and debugging support.
 */

import { 
  AgentPattern, 
  PatternStep, 
  ExecutionEvent, 
  ExecutionOptions, 
  AgentContext,
  LLMProvider,
  Tool,
  LLMConfig,
  DebugInfo
} from '../types';
import { PatternRegistry } from '../patterns/base';

/**
 * Main orchestrator class that manages pattern execution
 */
export class AgentOrchestrator {
  private llmProvider: LLMProvider;
  private tools: Tool[];
  private defaultConfig: LLMConfig;

  constructor(
    llmProvider: LLMProvider,
    tools: Tool[] = [],
    defaultConfig?: Partial<LLMConfig>
  ) {
    this.llmProvider = llmProvider;
    this.tools = tools;
    this.defaultConfig = {
      provider: 'mock',
      model: 'mock',
      temperature: 0.7,
      maxTokens: 2000,
      stream: true,
      ...defaultConfig
    };
  }

  /**
   * Register a pattern with the orchestrator
   */
  registerPattern(pattern: AgentPattern): void {
    PatternRegistry.register(pattern);
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): AgentPattern[] {
    return PatternRegistry.getAll();
  }

  /**
   * Get a specific pattern by name
   */
  getPattern(name: string): AgentPattern | undefined {
    return PatternRegistry.get(name);
  }

  /**
   * Execute a pattern and stream execution events
   */
  async *executePattern(
    patternName: string,
    input: string,
    options: ExecutionOptions = {}
  ): AsyncGenerator<ExecutionEvent> {
    const startTime = Date.now();

    try {
      // Load pattern
      const pattern = PatternRegistry.get(patternName);
      if (!pattern) {
        yield this.createErrorEvent(
          `Pattern '${patternName}' not found. Available patterns: ${PatternRegistry.getAll().map(p => p.name).join(', ')}`,
          { availablePatterns: PatternRegistry.getAll().map(p => p.name) }
        );
        return;
      }

      // Emit start event
      yield this.createStartEvent(patternName, input, options);

      // Initialize context
      const context = this.createContext(options);

      // Execute pattern with timeout if specified
      if (options.timeout) {
        yield* this.executeWithTimeout(pattern, input, context, options);
      } else {
        yield* this.executePatternSteps(pattern, input, context, options);
      }

      // Emit complete event
      const duration = Date.now() - startTime;
      yield this.createCompleteEvent(duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      yield this.createErrorEvent(
        `Pattern execution failed: ${(error as Error).message}`,
        { 
          error: (error as Error).stack,
          duration 
        }
      );
    }
  }

  /**
   * Execute pattern steps and stream them as events
   */
  private async *executePatternSteps(
    pattern: AgentPattern,
    input: string,
    context: AgentContext,
    options: ExecutionOptions
  ): AsyncGenerator<ExecutionEvent> {
    let stepCount = 0;
    const maxSteps = options.maxSteps || 1000;

    try {
      for await (const step of pattern.execute(input, context)) {
        stepCount++;

        // Check max steps limit
        if (stepCount > maxSteps) {
          yield this.createErrorEvent(
            `Maximum step limit (${maxSteps}) exceeded`,
            { stepCount }
          );
          break;
        }

        // Convert pattern step to execution event
        yield this.convertStepToEvent(step, options);
      }
    } catch (error) {
      yield this.createErrorEvent(
        `Step execution failed: ${(error as Error).message}`,
        { 
          stepCount,
          error: (error as Error).stack 
        }
      );
    }
  }

  /**
   * Execute pattern with timeout
   */
  private async *executeWithTimeout(
    pattern: AgentPattern,
    input: string,
    context: AgentContext,
    options: ExecutionOptions
  ): AsyncGenerator<ExecutionEvent> {
    const timeout = options.timeout!;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timeout (${timeout}ms)`)), timeout);
    });

    try {
      // Race between pattern execution and timeout
      const iterator = pattern.execute(input, context);
      let stepCount = 0;
      const maxSteps = options.maxSteps || 1000;

      while (stepCount < maxSteps) {
        const result = await Promise.race([
          iterator.next(),
          timeoutPromise
        ]);

        if (result.done) break;

        stepCount++;
        yield this.convertStepToEvent(result.value, options);
      }

      if (stepCount >= maxSteps) {
        yield this.createErrorEvent(
          `Maximum step limit (${maxSteps}) exceeded`,
          { stepCount }
        );
      }
    } catch (error) {
      if ((error as Error).message.includes('timeout')) {
        yield this.createErrorEvent(
          `Execution timeout after ${timeout}ms`,
          { timeout }
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Create agent context for pattern execution
   */
  private createContext(options: ExecutionOptions): AgentContext {
    return {
      messages: [],
      tools: this.tools,
      config: this.defaultConfig,
      state: {
        debug: options.debug || false,
        visualizations: options.visualizations || false
      }
    };
  }

  /**
   * Convert a pattern step to an execution event
   */
  private convertStepToEvent(
    step: PatternStep,
    options: ExecutionOptions
  ): ExecutionEvent {
    const event: ExecutionEvent = {
      timestamp: step.timestamp || Date.now(),
      eventType: 'step',
      data: {
        type: step.type,
        content: step.content,
        capability: step.capability,
        tool: step.tool,
        metadata: step.metadata
      }
    };

    // Add debug info if enabled
    if (options.debug && step.metadata) {
      event.debug = this.extractDebugInfo(step.metadata);
    }

    return event;
  }

  /**
   * Extract debug information from step metadata
   */
  private extractDebugInfo(metadata: Record<string, any>): DebugInfo | undefined {
    const debug: DebugInfo = {};

    if (metadata.prompt) debug.prompt = metadata.prompt;
    if (metadata.modelResponse) debug.modelResponse = metadata.modelResponse;
    if (metadata.toolCalls) debug.toolCalls = metadata.toolCalls;
    if (metadata.usage) debug.tokens = metadata.usage;
    if (metadata.latency) debug.latency = metadata.latency;

    return Object.keys(debug).length > 0 ? debug : undefined;
  }

  /**
   * Create a start event
   */
  private createStartEvent(
    patternName: string,
    input: string,
    options: ExecutionOptions
  ): ExecutionEvent {
    return {
      timestamp: Date.now(),
      eventType: 'start',
      data: {
        pattern: patternName,
        input,
        options: {
          maxSteps: options.maxSteps,
          timeout: options.timeout,
          debug: options.debug,
          visualizations: options.visualizations
        }
      }
    };
  }

  /**
   * Create a complete event
   */
  private createCompleteEvent(duration: number): ExecutionEvent {
    return {
      timestamp: Date.now(),
      eventType: 'complete',
      data: {
        duration,
        status: 'success'
      }
    };
  }

  /**
   * Create an error event
   */
  private createErrorEvent(
    message: string,
    metadata?: Record<string, any>
  ): ExecutionEvent {
    return {
      timestamp: Date.now(),
      eventType: 'error',
      data: {
        error: message,
        ...metadata
      }
    };
  }
}
