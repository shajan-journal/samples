/**
 * Tests for ReActPattern
 */

import { ReActPattern } from '../../src/patterns/react';
import { AgentContext, Tool, ToolResult, PatternStep } from '../../src/types';
import { MockLLMProvider } from '../../src/llm/mock';

describe('ReActPattern', () => {
  let pattern: ReActPattern;
  let mockProvider: MockLLMProvider;

  // Mock calculator tool
  const calculatorTool: Tool = {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate'
        }
      },
      required: ['expression']
    },
    async execute(params: Record<string, any>): Promise<ToolResult> {
      try {
        const result = eval(params.expression);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  };

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    pattern = new ReActPattern(mockProvider);
  });

  describe('Basic Functionality', () => {
    test('should have correct name and description', () => {
      expect(pattern.name).toBe('react');
      expect(pattern.description).toContain('Reasoning + Acting');
    });
  });

  describe('Pattern Execution', () => {
    test('should execute single iteration with tool call', async () => {
      // Set up mock responses for reasoning, tool use, and final reasoning
      mockProvider.setResponses([
        // First reasoning step - must indicate next action to trigger tool use
        { content: 'REASONING: The user wants to calculate 2+2.\nCONCLUSION: I need to use the calculator tool.\nNEXT_ACTION: use calculator' },
        // Tool use step returns tool call
        {
          content: 'Calling calculator',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2+2' }
            }
          ]
        },
        // Final reasoning with completion
        { content: 'The calculation is complete. Final answer: 4' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Calculate 2+2', context)) {
        steps.push(step);
      }

      // Verify we got various step types
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some(s => s.type === 'capability')).toBe(true);
      expect(steps.some(s => s.type === 'tool_call')).toBe(true);
      expect(steps.some(s => s.type === 'answer')).toBe(true);

      // Verify final answer
      const finalStep = steps[steps.length - 1];
      expect(finalStep.type).toBe('answer');
    });

    test('should complete when task is finished', async () => {
      mockProvider.setResponses([
        { content: 'Task completed. The answer is 42.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('What is the answer?', context, { maxIterations: 5 })) {
        steps.push(step);
      }

      // Should complete in 1 iteration since "Task completed" is in response
      expect(steps.some(s => s.content.includes('Task completed'))).toBe(true);
    });

    test('should respect max iterations limit', async () => {
      mockProvider.setResponses([
        { content: 'Still working on it...' },
        { content: 'Still working on it...' },
        { content: 'Still working on it...' },
        { content: 'Still working on it...' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const maxIterations = 3;
      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Test', context, { maxIterations })) {
        steps.push(step);
      }

      // Should stop at max iterations
      expect(steps.some(s => s.content.includes('Stopped after'))).toBe(true);
    });

    test('should work without tools', async () => {
      mockProvider.setResponses([
        { content: 'The capital of France is Paris. Final answer: Paris' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('What is the capital of France?', context)) {
        steps.push(step);
      }

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some(s => s.content.includes('Paris'))).toBe(true);
    });
  });

  describe('Tool Call Handling', () => {
    test('should handle tool execution success', async () => {
      mockProvider.setResponses([
        { content: 'REASONING: Need to divide 10 by 2.\nCONCLUSION: Using calculator.\nNEXT_ACTION: use calculator' },
        {
          content: 'Calculating',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '10/2' }
            }
          ]
        },
        { content: 'Result is 5. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Divide 10 by 2', context)) {
        steps.push(step);
      }

      // Verify tool call happened (check for TOOL content in steps)
      const toolSteps = steps.filter(s => s.content.includes('calculator'));
      expect(toolSteps.length).toBeGreaterThan(0);
    });

    test('should handle tool execution failure', async () => {
      mockProvider.setResponses([
        { content: 'REASONING: Need to calculate.\nCONCLUSION: Using calculator.\nNEXT_ACTION: use calculator' },
        {
          content: 'Calculating',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: 'invalid' }
            }
          ]
        },
        { content: 'Error occurred. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Calculate invalid', context)) {
        steps.push(step);
      }

      // Verify failure is mentioned somewhere in steps
      const hasFailure = steps.some(s => s.content.toLowerCase().includes('fail') || s.content.toLowerCase().includes('error'));
      expect(hasFailure).toBe(true);
    });

    test('should handle multiple tool calls in one iteration', async () => {
      mockProvider.setResponses([
        { content: 'REASONING: Need to do multiple calculations.\nCONCLUSION: Using tools.\nNEXT_ACTION: use tools' },
        {
          content: 'Calculating both',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2+2' }
            },
            {
              id: 'call_2',
              name: 'calculator',
              arguments: { expression: '3*3' }
            }
          ]
        },
        { content: 'Got both results. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Calculate 2+2 and 3*3', context)) {
        steps.push(step);
      }

      // Should mention calculator tool and have multiple calls
      const hasCalculator = steps.some(s => s.content.includes('calculator'));
      const toolMentions = steps.filter(s => s.content.includes('calculator')).length;
      expect(hasCalculator).toBe(true);
      expect(toolMentions).toBeGreaterThan(1); // Should mention calculator multiple times for 2 calls
    });
  });

  describe('Completion Detection', () => {
    test('should detect "task completed" signal', async () => {
      mockProvider.setResponses([
        { content: 'I have finished the task. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Test', context)) {
        steps.push(step);
      }

      expect(steps.some(s => s.content.includes('completed'))).toBe(true);
    });

    test('should detect "final answer:" signal', async () => {
      mockProvider.setResponses([
        { content: 'Based on my analysis, the final answer: 42' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Test', context)) {
        steps.push(step);
      }

      expect(steps.some(s => s.content.includes('completed'))).toBe(true);
    });
  });

  describe('Verbose Mode', () => {
    test('should show iteration numbers in verbose mode', async () => {
      mockProvider.setResponses([
        { content: 'Working on it. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Test', context, { verbose: true })) {
        steps.push(step);
      }

      expect(steps.some(s => s.content.includes('Iteration'))).toBe(true);
    });

    test('should hide iteration numbers in non-verbose mode', async () => {
      mockProvider.setResponses([
        { content: 'Working on it. Task completed.' }
      ]);

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const steps: PatternStep[] = [];
      for await (const step of pattern.execute('Test', context, { verbose: false })) {
        steps.push(step);
      }

      expect(steps.some(s => s.content.includes('Iteration'))).toBe(false);
    });
  });
});
