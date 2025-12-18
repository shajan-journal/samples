/**
 * Tests for AgentOrchestrator
 */

import { AgentOrchestrator } from '../../src/orchestrator/orchestrator';
import { AgentPattern, PatternStep, AgentContext, ExecutionEvent } from '../../src/types';
import { MockLLMProvider } from '../../src/llm/mock';
import { CalculatorTool } from '../../src/tools/calculator';
import { ReActPattern } from '../../src/patterns/react';
import { PatternRegistry } from '../../src/patterns/base';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockProvider: MockLLMProvider;
  let calculatorTool: CalculatorTool;

  // Mock pattern for testing
  class MockPattern implements AgentPattern {
    name = 'mock_pattern';
    description = 'A mock pattern for testing';

    async *execute(input: string, context: AgentContext): AsyncGenerator<PatternStep> {
      yield {
        type: 'result',
        content: `Processing: ${input}`,
        timestamp: Date.now()
      };
      
      yield {
        type: 'capability',
        capability: 'reasoning',
        content: 'Thinking about the problem',
        timestamp: Date.now()
      };
      
      yield {
        type: 'result',
        content: 'Task completed',
        timestamp: Date.now()
      };
    }
  }

  // Error pattern for testing error handling
  class ErrorPattern implements AgentPattern {
    name = 'error_pattern';
    description = 'A pattern that throws errors';

    async *execute(input: string, context: AgentContext): AsyncGenerator<PatternStep> {
      yield {
        type: 'result',
        content: 'Starting...',
        timestamp: Date.now()
      };
      
      throw new Error('Pattern execution failed');
    }
  }

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    calculatorTool = new CalculatorTool();
    orchestrator = new AgentOrchestrator(mockProvider, [calculatorTool]);
    
    // Clear pattern registry before each test
    PatternRegistry.clear();
  });

  describe('Pattern Registration', () => {
    test('should register a pattern', () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const retrieved = orchestrator.getPattern('mock_pattern');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('mock_pattern');
    });

    test('should get all registered patterns', () => {
      const pattern1 = new MockPattern();
      orchestrator.registerPattern(pattern1);

      const patterns = orchestrator.getPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].name).toBe('mock_pattern');
    });

    test('should return undefined for non-existent pattern', () => {
      const pattern = orchestrator.getPattern('non_existent');
      expect(pattern).toBeUndefined();
    });
  });

  describe('Pattern Execution', () => {
    test('should execute a registered pattern', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('mock_pattern', 'Test input')) {
        events.push(event);
      }

      // Should have start, steps, and complete events
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('start');
      expect(events[events.length - 1].eventType).toBe('complete');
      
      // Should have step events
      const stepEvents = events.filter(e => e.eventType === 'step');
      expect(stepEvents.length).toBe(3); // 3 steps in MockPattern
    });

    test('should emit error for non-existent pattern', async () => {
      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('non_existent', 'Test')) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('error');
      expect(events[0].data.error).toContain('not found');
    });

    test('should include pattern name and input in start event', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('mock_pattern', 'Test input')) {
        events.push(event);
      }

      const startEvent = events[0];
      expect(startEvent.data.pattern).toBe('mock_pattern');
      expect(startEvent.data.input).toBe('Test input');
    });

    test('should include duration in complete event', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('mock_pattern', 'Test')) {
        events.push(event);
      }

      const completeEvent = events[events.length - 1];
      expect(completeEvent.data.duration).toBeGreaterThanOrEqual(0);
      expect(completeEvent.data.status).toBe('success');
    });
  });

  describe('Step Conversion', () => {
    test('should convert pattern steps to execution events', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('mock_pattern', 'Test')) {
        events.push(event);
      }

      const stepEvents = events.filter(e => e.eventType === 'step');
      
      // First step should be a result
      expect(stepEvents[0].data.type).toBe('result');
      expect(stepEvents[0].data.content).toContain('Processing');
      
      // Second step should be a capability
      expect(stepEvents[1].data.type).toBe('capability');
      expect(stepEvents[1].data.capability).toBe('reasoning');
    });

    test('should preserve step timestamps', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('mock_pattern', 'Test')) {
        events.push(event);
      }

      const stepEvents = events.filter(e => e.eventType === 'step');
      stepEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThan(0);
      });
    });
  });

  describe('Options Handling', () => {
    test('should respect maxSteps option', async () => {
      // Create a pattern with many steps
      class ManyStepsPattern implements AgentPattern {
        name = 'many_steps';
        description = 'Pattern with many steps';

        async *execute(): AsyncGenerator<PatternStep> {
          for (let i = 0; i < 100; i++) {
            yield {
              type: 'result',
              content: `Step ${i}`,
              timestamp: Date.now()
            };
          }
        }
      }

      const pattern = new ManyStepsPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('many_steps', 'Test', { maxSteps: 5 })) {
        events.push(event);
      }

      const stepEvents = events.filter(e => e.eventType === 'step');
      // Should stop at maxSteps
      expect(stepEvents.length).toBeLessThanOrEqual(5);
      
      // Should have an error event about max steps
      const hasMaxStepsError = events.some(e => 
        e.eventType === 'error' && e.data.error?.includes('Maximum step limit')
      );
      expect(hasMaxStepsError).toBe(true);
    });

    test('should include options in start event', async () => {
      const pattern = new MockPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      const options = {
        maxSteps: 10,
        debug: true,
        visualizations: true
      };

      for await (const event of orchestrator.executePattern('mock_pattern', 'Test', options)) {
        events.push(event);
      }

      const startEvent = events[0];
      expect(startEvent.data.options.maxSteps).toBe(10);
      expect(startEvent.data.options.debug).toBe(true);
      expect(startEvent.data.options.visualizations).toBe(true);
    });

    test('should handle timeout option', async () => {
      // Create a slow pattern
      class SlowPattern implements AgentPattern {
        name = 'slow_pattern';
        description = 'A slow pattern';

        async *execute(): AsyncGenerator<PatternStep> {
          yield {
            type: 'result',
            content: 'Starting...',
            timestamp: Date.now()
          };
          
          // Simulate slow operation
          await new Promise(resolve => setTimeout(resolve, 200));
          
          yield {
            type: 'result',
            content: 'Done',
            timestamp: Date.now()
          };
        }
      }

      const pattern = new SlowPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('slow_pattern', 'Test', { timeout: 100 })) {
        events.push(event);
      }

      // Should have timeout error
      const hasTimeoutError = events.some(e => 
        e.eventType === 'error' && e.data.error?.includes('timeout')
      );
      expect(hasTimeoutError).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle pattern execution errors', async () => {
      const pattern = new ErrorPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('error_pattern', 'Test')) {
        events.push(event);
      }

      // Should have start, step, and error events
      expect(events.length).toBeGreaterThan(0);
      
      const errorEvents = events.filter(e => e.eventType === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].data.error).toContain('Pattern execution failed');
    });

    test('should continue after step error', async () => {
      const pattern = new ErrorPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('error_pattern', 'Test')) {
        events.push(event);
      }

      // Should still emit start event before error
      expect(events[0].eventType).toBe('start');
    });
  });

  describe('Real Pattern Integration', () => {
    test('should work with ReAct pattern', async () => {
      mockProvider.setResponses([
        { content: 'I need to calculate 2+2. NEXT_ACTION: use calculator tool' },
        {
          content: 'Using calculator',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2+2' }
            }
          ]
        },
        { content: 'The answer is 4. Task completed.' }
      ]);

      const reactPattern = new ReActPattern(mockProvider);
      orchestrator.registerPattern(reactPattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('react', 'Calculate 2+2')) {
        events.push(event);
      }

      // Should have complete workflow
      expect(events[0].eventType).toBe('start');
      expect(events[events.length - 1].eventType).toBe('complete');
      
      // Should have various step types
      const stepEvents = events.filter(e => e.eventType === 'step');
      expect(stepEvents.length).toBeGreaterThan(0);
      
      // Should have capability and tool_call steps
      const hasCapability = stepEvents.some(e => e.data.type === 'capability');
      const hasToolCall = stepEvents.some(e => e.data.type === 'tool_call');
      expect(hasCapability).toBe(true);
      expect(hasToolCall).toBe(true);
    });
  });

  describe('Debug Mode', () => {
    test('should include debug info when enabled', async () => {
      // Create pattern with debug metadata
      class DebugPattern implements AgentPattern {
        name = 'debug_pattern';
        description = 'Pattern with debug info';

        async *execute(): AsyncGenerator<PatternStep> {
          yield {
            type: 'result',
            content: 'Test',
            metadata: {
              prompt: 'Test prompt',
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
              latency: 100
            },
            timestamp: Date.now()
          };
        }
      }

      const pattern = new DebugPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('debug_pattern', 'Test', { debug: true })) {
        events.push(event);
      }

      const stepEvents = events.filter(e => e.eventType === 'step');
      const debugEvent = stepEvents.find(e => e.debug);
      
      expect(debugEvent).toBeDefined();
      expect(debugEvent?.debug?.prompt).toBe('Test prompt');
      expect(debugEvent?.debug?.tokens?.totalTokens).toBe(15);
      expect(debugEvent?.debug?.latency).toBe(100);
    });

    test('should not include debug info when disabled', async () => {
      class DebugPattern implements AgentPattern {
        name = 'debug_pattern';
        description = 'Pattern with debug info';

        async *execute(): AsyncGenerator<PatternStep> {
          yield {
            type: 'result',
            content: 'Test',
            metadata: {
              prompt: 'Test prompt',
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
            },
            timestamp: Date.now()
          };
        }
      }

      const pattern = new DebugPattern();
      orchestrator.registerPattern(pattern);

      const events: ExecutionEvent[] = [];
      for await (const event of orchestrator.executePattern('debug_pattern', 'Test', { debug: false })) {
        events.push(event);
      }

      const stepEvents = events.filter(e => e.eventType === 'step');
      stepEvents.forEach(event => {
        expect(event.debug).toBeUndefined();
      });
    });
  });
});
