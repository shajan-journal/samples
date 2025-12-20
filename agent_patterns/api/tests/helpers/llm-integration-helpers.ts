/**
 * Test helpers for LLM integration tests
 * 
 * Provides utilities to simplify setup and assertions for tests
 * that require real LLM API calls.
 */

import { AgentOrchestrator } from '../../src/orchestrator/orchestrator';
import { OpenAIProvider } from '../../src/llm/openai';
import { ReActPattern } from '../../src/patterns/react';
import { PlanAndValidatePattern } from '../../src/patterns/plan-and-validate';
import { IterativeRefinementPattern } from '../../src/patterns/iterative-refinement';
import { NodeExecutionTool } from '../../src/tools/node-execution';
import { PythonExecutionTool } from '../../src/tools/python-execution';
import { CalculatorTool } from '../../src/tools/calculator';
import { FileSystemTool } from '../../src/tools/file-system';
import { Tool, ExecutionEvent } from '../../src/types';

export interface OrchestratorSetupOptions {
  apiKey?: string;
  model?: string;
  tools?: Tool[];
  patterns?: ('react' | 'plan-and-validate' | 'iterative-refinement')[];
}

export interface EventCollector {
  events: ExecutionEvent[];
  toolsUsed: string[];
  visualizations: any[];
  capabilities: string[];
  errors: any[];
}

/**
 * Create and configure an orchestrator for integration testing
 */
export function createTestOrchestrator(options: OrchestratorSetupOptions = {}): AgentOrchestrator {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    model = 'gpt-4o-mini',
    tools = [new NodeExecutionTool(), new PythonExecutionTool()],
    patterns = ['react', 'plan-and-validate', 'iterative-refinement']
  } = options;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for integration tests');
  }

  const llm = new OpenAIProvider(apiKey);
  const orchestrator = new AgentOrchestrator(
    llm,
    tools,
    { provider: 'openai', model }
  );

  // Register requested patterns
  if (patterns.includes('react')) {
    orchestrator.registerPattern(new ReActPattern(llm));
  }
  if (patterns.includes('plan-and-validate')) {
    orchestrator.registerPattern(new PlanAndValidatePattern(llm));
  }
  if (patterns.includes('iterative-refinement')) {
    orchestrator.registerPattern(new IterativeRefinementPattern(llm));
  }

  return orchestrator;
}

/**
 * Create a full-featured orchestrator with all tools
 */
export function createFullOrchestrator(apiKey?: string): AgentOrchestrator {
  return createTestOrchestrator({
    apiKey,
    tools: [
      new NodeExecutionTool(),
      new PythonExecutionTool(),
      new CalculatorTool(),
      new FileSystemTool()
    ]
  });
}

/**
 * Execute a pattern and collect all events with metadata
 */
export async function executeAndCollect(
  orchestrator: AgentOrchestrator,
  patternName: string,
  prompt: string
): Promise<EventCollector> {
  const collector: EventCollector = {
    events: [],
    toolsUsed: [],
    visualizations: [],
    capabilities: [],
    errors: []
  };

  for await (const event of orchestrator.executePattern(patternName, prompt)) {
    collector.events.push(event);

    // Collect tool usage
    if (event.eventType === 'step' && event.data.type === 'tool_call') {
      const toolName = event.data.tool;
      if (toolName && !collector.toolsUsed.includes(toolName)) {
        collector.toolsUsed.push(toolName);
      }
    }

    // Collect visualizations
    if (event.visualizations) {
      collector.visualizations.push(event.visualizations);
    }

    // Collect capabilities
    if (event.eventType === 'step' && event.data.type === 'capability') {
      const capability = event.data.capability;
      if (capability && !collector.capabilities.includes(capability)) {
        collector.capabilities.push(capability);
      }
    }

    // Collect errors
    if (event.eventType === 'error') {
      collector.errors.push(event.data);
    }
  }

  return collector;
}

/**
 * Common assertions for integration tests
 */
export const assertions = {
  /**
   * Assert that at least one code generation tool was used
   */
  usedCodeTool(collector: EventCollector): boolean {
    return collector.toolsUsed.some(
      tool => tool === 'node_execute' || tool === 'python_execute'
    );
  },

  /**
   * Assert that a specific tool was used
   */
  usedTool(collector: EventCollector, toolName: string): boolean {
    return collector.toolsUsed.includes(toolName);
  },

  /**
   * Assert that visualizations were generated
   */
  hasVisualizations(collector: EventCollector): boolean {
    return collector.visualizations.length > 0;
  },

  /**
   * Assert that specific capability was used
   */
  usedCapability(collector: EventCollector, capability: string): boolean {
    return collector.capabilities.includes(capability);
  },

  /**
   * Assert that execution completed without errors
   */
  completedSuccessfully(collector: EventCollector): boolean {
    return collector.errors.length === 0 && 
           collector.events.length > 0 &&
           collector.events[collector.events.length - 1].eventType === 'complete';
  },

  /**
   * Assert minimum number of steps
   */
  hasMinimumSteps(collector: EventCollector, minSteps: number): boolean {
    const steps = collector.events.filter(e => e.eventType === 'step');
    return steps.length >= minSteps;
  }
};

/**
 * Skip helper for tests requiring API key
 */
export function describeIfApiKey(name: string, fn: () => void): void {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  if (hasApiKey) {
    describe(name, fn);
  } else {
    describe.skip(name, () => {
      it('skipped - OPENAI_API_KEY not set', () => {
        console.log('⚠️  Skipping LLM integration tests - OPENAI_API_KEY not set');
      });
    });
  }
}

/**
 * Get the final answer from execution events
 */
export function getFinalAnswer(collector: EventCollector): string | null {
  // Look for answer or result step types
  const answerEvent = collector.events
    .filter(e => e.eventType === 'step')
    .find(e => e.data.type === 'answer' || e.data.type === 'result');
  
  return answerEvent?.data.content || null;
}

/**
 * Get execution timing information
 */
export function getExecutionTiming(collector: EventCollector): {
  startTime: number;
  endTime: number;
  duration: number;
} | null {
  if (collector.events.length < 2) return null;

  const startEvent = collector.events.find(e => e.eventType === 'start');
  const endEvent = collector.events.find(e => 
    e.eventType === 'complete' || e.eventType === 'error'
  );

  if (!startEvent || !endEvent) return null;

  return {
    startTime: startEvent.timestamp,
    endTime: endEvent.timestamp,
    duration: endEvent.timestamp - startEvent.timestamp
  };
}
