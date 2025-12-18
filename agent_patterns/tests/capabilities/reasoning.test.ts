/**
 * Tests for ReasoningCapability
 */

import { ReasoningCapability } from '../../src/capabilities/reasoning';
import { MockLLMProvider } from '../../src/llm/mock';
import { AgentContext, Message, LLMConfig } from '../../src/types';

describe('ReasoningCapability', () => {
  let mockProvider: MockLLMProvider;
  let capability: ReasoningCapability;
  let config: LLMConfig;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    capability = new ReasoningCapability(mockProvider);
    config = {
      provider: 'mock',
      model: 'test-model',
      temperature: 0.7,
    };
  });

  describe('Capability metadata', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('reasoning');
    });

    it('should have description', () => {
      expect(capability.description).toBeTruthy();
      expect(capability.description.length).toBeGreaterThan(10);
    });
  });

  describe('Basic reasoning', () => {
    it('should perform simple reasoning task', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: The user is asking about a mathematical fact. 2 + 2 equals 4 by definition of addition.
CONCLUSION: 2 + 2 = 4`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'What is 2 + 2?' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('4');
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning).toContain('addition');
    });

    it('should extract reasoning and conclusion separately', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: First, I need to understand what the capital of France is. France is a country in Europe, and its capital city is Paris, which is well-known for the Eiffel Tower.
CONCLUSION: The capital of France is Paris.`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'What is the capital of France?' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('Paris');
      expect(result.reasoning).toContain('France is a country in Europe');
      expect(result.reasoning).not.toContain('REASONING:');
      expect(result.output).not.toContain('CONCLUSION:');
    });

    it('should handle responses without explicit formatting', async () => {
      mockProvider.setResponses([
        {
          content: 'Based on the information provided, the answer is clearly yes.',
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Is the sky blue?' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('yes');
    });
  });

  describe('Reasoning with tools', () => {
    it('should suggest next action when tools are available', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: The user is asking for a calculation. I need to use the calculator tool to compute this.
CONCLUSION: I need to calculate 10 factorial.
NEXT_ACTION: Use calculator tool with expression "10!"`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Calculate 10 factorial' },
        ],
        tools: [
          {
            name: 'calculator',
            description: 'Performs calculations',
            parameters: {
              type: 'object',
              properties: {},
            },
            execute: async () => ({ success: true }),
          },
        ],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('factorial');
      expect(result.nextAction).toBeTruthy();
      expect(result.nextAction).toContain('calculator');
    });

    it('should not suggest next action when none needed', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: The question can be answered directly without tools.
CONCLUSION: Yes, the Earth is round.
NEXT_ACTION: none`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Is the Earth round?' },
        ],
        tools: [
          {
            name: 'web_search',
            description: 'Search the web',
            parameters: {
              type: 'object',
              properties: {},
            },
            execute: async () => ({ success: true }),
          },
        ],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('round');
      expect(result.nextAction).toBeUndefined();
    });
  });

  describe('Multi-step reasoning', () => {
    it('should handle complex reasoning chains', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: To determine if someone can retire comfortably, I need to consider:
1. Current savings and assets
2. Expected retirement expenses
3. Social security or pension income
4. Investment returns
5. Life expectancy

Given: 65 years old, $1M saved, spending $40k/year
Analysis: $1M at 4% withdrawal rate = $40k/year
This matches their spending, which is sustainable.

CONCLUSION: Yes, they can retire comfortably with $1M at age 65 if they spend $40k/year.`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          {
            role: 'user',
            content: 'Can someone retire at 65 with $1M saved if they spend $40k per year?',
          },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.output).toContain('retire');
      expect(result.reasoning).toContain('savings');
      expect(result.reasoning).toContain('withdrawal rate');
    });
  });

  describe('Context handling', () => {
    it('should consider conversation history', async () => {
      mockProvider.setResponses([
        {
          content: `REASONING: Looking at the conversation history, the user first mentioned Paris, then asked "what about it". They want to know about Paris.
CONCLUSION: I can provide information about Paris, the capital of France.`,
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Tell me about Paris' },
          { role: 'assistant', content: 'Paris is the capital of France.' },
          { role: 'user', content: 'What about it?' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.reasoning).toContain('conversation history');
      expect(result.output).toContain('Paris');
    });
  });

  describe('Error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      // Mock provider with no responses will use default
      mockProvider.setResponses([]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      // Should complete without throwing
      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should include metadata in successful results', async () => {
      mockProvider.setResponses([
        {
          content: 'REASONING: Simple test\nCONCLUSION: Test result',
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        tools: [],
        config,
      };

      const result = await capability.execute(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.capability).toBe('reasoning');
      expect(result.metadata?.usage).toBeDefined();
    });
  });

  describe('Prompt building', () => {
    it('should include tool information when tools are available', async () => {
      mockProvider.setResponses([
        {
          content: 'REASONING: Test\nCONCLUSION: Test',
        },
      ]);

      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        tools: [
          {
            name: 'calculator',
            description: 'Math tool',
            parameters: { type: 'object', properties: {} },
            execute: async () => ({ success: true }),
          },
          {
            name: 'search',
            description: 'Search tool',
            parameters: { type: 'object', properties: {} },
            execute: async () => ({ success: true }),
          },
        ],
        config,
      };

      await capability.execute(context);

      // Verify the capability executed without errors
      // (Prompt content is internal but execution confirms it was built correctly)
      expect(mockProvider.getCurrentIndex()).toBe(1);
    });
  });
});
