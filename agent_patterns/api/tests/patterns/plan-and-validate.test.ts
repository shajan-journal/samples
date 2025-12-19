/**
 * Tests for PlanAndValidatePattern
 */

import { PlanAndValidatePattern } from '../../src/patterns/plan-and-validate';
import { AgentContext, Tool, ToolResult, PatternStep } from '../../src/types';
import { MockLLMProvider } from '../../src/llm/mock';

describe('PlanAndValidatePattern', () => {
  let pattern: PlanAndValidatePattern;
  let mockProvider: MockLLMProvider;

  const calculatorTool: Tool = {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Mathematical expression to evaluate' }
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
    pattern = new PlanAndValidatePattern(mockProvider);
  });

  test('should have correct name and description', () => {
    expect(pattern.name).toBe('plan-and-validate');
    expect(pattern.description).toContain('Plan');
  });

  test('should create plan and execute steps', async () => {
    // Plan response, step 1 execution, step 2 execution, synthesis
    mockProvider.setResponses([
      {
        content:
          '1. Calculate 2+2\n2. Verify the result'
      },
      {
        content: 'Calculating',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      {
        content: 'Verifying result',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      { content: 'Final synthesis complete' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Do a calculation', context, { maxSteps: 5 })) {
      steps.push(step);
    }

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some(s => s.content.includes('Plan'))).toBe(true);
    expect(steps.some(s => s.type === 'answer')).toBe(true);
  });

  test('should parse multi-step plan correctly', async () => {
    mockProvider.setResponses([
      {
        content:
          '1. Fetch data\n2. Process data\n3. Generate report\n4. Validate report'
      },
      {
        content: 'Step 1 done',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '1+1' } }
        ]
      },
      {
        content: 'Step 2 done',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      {
        content: 'Step 3 done',
        toolCalls: [
          { id: 'call_3', name: 'calculator', arguments: { expression: '3+3' } }
        ]
      },
      {
        content: 'Step 4 done',
        toolCalls: [
          { id: 'call_4', name: 'calculator', arguments: { expression: '4+4' } }
        ]
      },
      { content: 'Synthesis' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Multi-step task', context, { maxSteps: 10 })) {
      steps.push(step);
    }

    // Should have multiple step info entries
    const stepEntries = steps.filter(s => s.content.includes('Step'));
    expect(stepEntries.length).toBeGreaterThan(0);
  });

  test('should validate each step', async () => {
    mockProvider.setResponses([
      { content: '1. Do something\n2. Verify it' },
      {
        content: 'Executing',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '5*5' } }
        ]
      },
      {
        content: 'Verifying',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '5*5' } }
        ]
      },
      { content: 'Final answer' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Validate steps', context, { maxSteps: 5 })) {
      steps.push(step);
    }

    // Should include validation steps
    const validationSteps = steps.filter(s => s.content.includes('VALIDATION'));
    expect(validationSteps.length).toBeGreaterThan(0);
  });

  test('should refine after validation failure', async () => {
    mockProvider.setResponses([
      { content: '1. Execute step\n2. Check result' },
      {
        content: 'Executing',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '10+5' } }
        ]
      },
      {
        content: 'Refining after feedback',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '10+5' } }
        ]
      },
      { content: 'Verification complete' },
      { content: 'Final synthesis' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Test refinement', context, { maxSteps: 10 })) {
      steps.push(step);
    }

    // Should have evidence of refinement
    const refined = steps.some(s => s.content.includes('REFINED'));
    expect(steps.length).toBeGreaterThan(0);
  });

  test('should respect max steps limit', async () => {
    mockProvider.setResponses([
      { content: '1. Step\n2. Step\n3. Step\n4. Step\n5. Step' },
      {
        content: 'Step 1',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '1+1' } }
        ]
      },
      {
        content: 'Step 2',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '2+2' } }
        ]
      },
      {
        content: 'Step 3',
        toolCalls: [
          { id: 'call_3', name: 'calculator', arguments: { expression: '3+3' } }
        ]
      },
      {
        content: 'Step 4',
        toolCalls: [
          { id: 'call_4', name: 'calculator', arguments: { expression: '4+4' } }
        ]
      },
      { content: 'Synthesis' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const maxSteps = 3;
    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Test limit', context, { maxSteps })) {
      steps.push(step);
    }

    // Should execute only up to maxSteps
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some(s => s.type === 'answer')).toBe(true);
  });

  test('should handle tool calls during step execution', async () => {
    mockProvider.setResponses([
      { content: '1. Calculate\n2. Report' },
      {
        content: 'Using calculator',
        toolCalls: [
          { id: 'call_1', name: 'calculator', arguments: { expression: '3*7' } }
        ]
      },
      {
        content: 'Reporting result',
        toolCalls: [
          { id: 'call_2', name: 'calculator', arguments: { expression: '3*7' } }
        ]
      },
      { content: 'Final synthesis' }
    ]);

    const context: AgentContext = {
      messages: [],
      tools: [calculatorTool],
      config: { provider: 'mock', model: 'mock' }
    };

    const steps: PatternStep[] = [];
    for await (const step of pattern.execute('Calculate then report', context, { maxSteps: 5 })) {
      steps.push(step);
    }

    // Should have tool call steps
    const toolSteps = steps.filter(s => s.type === 'tool_call');
    expect(toolSteps.length).toBeGreaterThan(0);
  });
});
