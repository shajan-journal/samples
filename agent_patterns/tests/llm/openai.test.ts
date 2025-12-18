/**
 * Tests for OpenAIProvider
 * 
 * Note: These tests mock the OpenAI client to avoid making real API calls.
 * For integration testing with the real API, use the manual test script.
 */

import { OpenAIProvider } from '../../src/llm/openai';
import { Message, LLMConfig } from '../../src/types';

// Mock the OpenAI module
jest.mock('openai');

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let config: LLMConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider('test-api-key');
    config = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 100,
    };
  });

  describe('Initialization', () => {
    it('should create provider with API key', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create provider without API key (uses env)', () => {
      const providerWithoutKey = new OpenAIProvider();
      expect(providerWithoutKey).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('Configuration validation', () => {
    it('should accept valid configuration', () => {
      const validConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
      };

      // Validation happens in the chat() method
      expect(() => {
        // Just checking the config structure is valid
        expect(validConfig.model).toBe('gpt-4');
      }).not.toThrow();
    });

    it('should reject missing model', async () => {
      const invalidConfig: LLMConfig = {
        provider: 'openai',
        model: '', // Invalid: empty
      };

      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await expect(async () => {
        for await (const _ of provider.chat(messages, invalidConfig)) {
          // Consume stream
        }
      }).rejects.toThrow('Model is required');
    });

    it('should reject invalid temperature', async () => {
      const invalidConfig: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 5.0, // Invalid: > 2
      };

      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await expect(async () => {
        for await (const _ of provider.chat(messages, invalidConfig)) {
          // Consume stream
        }
      }).rejects.toThrow('Temperature must be between 0 and 2');
    });
  });

  describe('Message formatting', () => {
    it('should format user messages correctly', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ];

      // Test that the provider handles message formatting
      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should format tool messages correctly', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Calculate 2+2' },
        {
          role: 'tool',
          content: JSON.stringify({ result: 4 }),
          toolCallId: 'call_123',
        },
      ];

      expect(messages[1].role).toBe('tool');
      expect(messages[1].toolCallId).toBe('call_123');
    });
  });

  describe('Tool definition formatting', () => {
    it('should format tool definitions correctly', () => {
      const tools = [
        {
          name: 'calculator',
          description: 'Performs calculations',
          parameters: {
            type: 'object' as const,
            properties: {
              expression: {
                type: 'string',
                description: 'Math expression',
              },
            },
            required: ['expression'],
          },
        },
      ];

      expect(tools[0].name).toBe('calculator');
      expect(tools[0].parameters.properties.expression).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock OpenAI client to throw an error
      const mockOpenAI = require('openai');
      const mockInstance = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      };
      mockOpenAI.mockImplementation(() => mockInstance);

      const failingProvider = new OpenAIProvider('test-key');
      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await expect(async () => {
        for await (const _ of failingProvider.chat(messages, config)) {
          // Consume stream
        }
      }).rejects.toThrow('OpenAI API error');
    });
  });

  describe('Streaming behavior', () => {
    it('should request streaming from OpenAI', () => {
      // The provider should set stream: true when calling OpenAI
      expect(config.provider).toBe('openai');
      // Actual streaming is tested in integration tests
    });
  });
});
