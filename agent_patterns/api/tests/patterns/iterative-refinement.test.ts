/**
 * Tests for IterativeRefinementPattern
 */

import { IterativeRefinementPattern } from '../../src/patterns/iterative-refinement';
import { AgentContext, Tool, ToolResult, PatternStep } from '../../src/types';
import { MockLLMProvider } from '../../src/llm/mock';

describe('IterativeRefinementPattern', () => {
  let pattern: IterativeRefinementPattern;
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
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  };

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    pattern = new IterativeRefinementPattern(mockProvider);
  });

  test('should have correct name and description', () => {
    expect(pattern.name).toBe('iterative-refinement');
    expect(pattern.description).toContain('Generate');
  });

  test('should iterate then pass validation', async () => {
    // 1) Tool-use (produce tool call), 2) Validation feedback, 3) Tool-use again, 4) Validation success
    mockProvider.setResponses([
      // Attempt 1: tool use proposes calculator on wrong expression to simulate a refinement
      {
        content: 'Using calculator for an initial attempt',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      // Validation LLM may be called in nuanced paths; keep a generic content here if needed later
      { content: 'Reviewing result for validation' },
      // Attempt 2: tool use again (same is fine; validation will accept)
      {
        content: 'Using calculator for refined attempt',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      { content: 'Synthesis of final answer' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' },
      state: { validationCriteria: { expectedOutput: '4', allowPartialMatch: false } }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Calculate 2+2', context, { maxAttempts: 3 })) {
      steps.push(step);
    }

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some(s => s.type === 'capability' && s.capability === 'validation')).toBe(true);
    expect(steps.some(s => s.type === 'answer')).toBe(true);
  });

  test('should stop at max attempts with message when stuck', async () => {
    // Only content, no tool calls to force no progress; validation will fail due to no tool results
    mockProvider.setResponses([
      { content: 'Thinking…' },
      { content: 'Still thinking…' },
      { content: 'Still thinking…' },
      { content: 'Synthesizing' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Do something', context, { maxAttempts: 2 })) {
      steps.push(step);
    }

    // Should include a stop reason
    expect(steps.some(s => s.content.includes('Stopping'))).toBe(true);
  });
});
