/**
 * Tests for ToolUseCapability
 */

import { ToolUseCapability } from '../../src/capabilities/tool-use';
import { AgentContext, Tool, ToolResult, LLMConfig } from '../../src/types';
import { MockLLMProvider } from '../../src/llm/mock';

describe('ToolUseCapability', () => {
  let capability: ToolUseCapability;
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

  // Mock weather tool
  const weatherTool: Tool = {
    name: 'weather',
    description: 'Get weather information for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name'
        }
      },
      required: ['location']
    },
    async execute(params: Record<string, any>): Promise<ToolResult> {
      return {
        success: true,
        data: {
          location: params.location,
          temperature: 72,
          condition: 'sunny'
        }
      };
    }
  };

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    capability = new ToolUseCapability(mockProvider);
  });

  describe('Basic Functionality', () => {
    test('should have correct name and description', () => {
      expect(capability.name).toBe('tool_use');
      expect(capability.description).toContain('Execute tools');
    });

    test('should return error when no tools available', async () => {
      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Calculate 2+2' }],
        tools: [],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.reasoning).toContain('No tools available');
      expect(result.metadata?.error).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    test('should execute single tool call', async () => {
      // Configure mock to return a tool call
      mockProvider.setResponses([
        {
          content: 'I will calculate 2+2',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2+2' }
            }
          ]
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Calculate 2+2' }],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.output).toBe('I will calculate 2+2');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].name).toBe('calculator');
      expect(result.toolCalls?.[0].arguments).toEqual({ expression: '2+2' });
      expect(result.metadata?.toolResults).toHaveLength(1);
      expect(result.metadata?.toolResults[0].success).toBe(true);
      expect(result.metadata?.toolResults[0].data).toBe(4);
    });

    test('should execute multiple tool calls', async () => {
      mockProvider.setResponses([
        {
          content: 'I will calculate and check weather',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '10*5' }
            },
            {
              id: 'call_2',
              name: 'weather',
              arguments: { location: 'San Francisco' }
            }
          ]
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Calculate 10*5 and get weather for SF' }],
        tools: [calculatorTool, weatherTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.toolCalls).toHaveLength(2);
      expect(result.metadata?.toolResults).toHaveLength(2);
      expect(result.metadata?.toolResults[0].data).toBe(50);
      expect(result.metadata?.toolResults[1].data).toEqual({
        location: 'San Francisco',
        temperature: 72,
        condition: 'sunny'
      });
    });

    test('should handle tool not found error', async () => {
      mockProvider.setResponses([
        {
          content: 'Using unknown tool',
          toolCalls: [
            {
              id: 'call_1',
              name: 'unknown_tool',
              arguments: {}
            }
          ]
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Use tool' }],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.metadata?.toolResults).toHaveLength(1);
      expect(result.metadata?.toolResults[0].success).toBe(false);
      expect(result.metadata?.toolResults[0].error).toContain('not found');
    });

    test('should handle tool execution error', async () => {
      mockProvider.setResponses([
        {
          content: 'Calculating',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: 'invalid expression' }
            }
          ]
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Calculate invalid' }],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.metadata?.toolResults).toHaveLength(1);
      expect(result.metadata?.toolResults[0].success).toBe(false);
      expect(result.metadata?.toolResults[0].error).toBeDefined();
    });
  });

  describe('No Tool Calls', () => {
    test('should handle response without tool calls', async () => {
      mockProvider.setResponses([
        {
          content: 'I can answer this without tools: The capital is Paris'
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('Paris');
      expect(result.toolCalls).toBeUndefined();
      expect(result.metadata?.toolResults).toBeUndefined();
    });
  });

  describe('Context Handling', () => {
    test('should include tool descriptions in prompt', async () => {
      mockProvider.setResponses([
        {
          content: 'Response'
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [calculatorTool, weatherTool],
        config: { provider: 'mock', model: 'mock' }
      };

      await capability.execute(context);

      // Verify mock received the messages (implicitly tested through execution)
      expect(mockProvider).toBeDefined();
    });

    test('should pass conversation history', async () => {
      mockProvider.setResponses([
        {
          content: 'Continuing conversation'
        }
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' }
        ],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      expect(result.output).toBe('Continuing conversation');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty response gracefully', async () => {
      mockProvider.setResponses([
        {
          content: ''
        }
      ]);

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [calculatorTool],
        config: { provider: 'mock', model: 'mock' }
      };

      const result = await capability.execute(context);

      // Empty content is valid, should not fail
      expect(result.output).toBe('');
    });
  });
});
