/**
 * Tests for MockLLMProvider
 */

import { MockLLMProvider } from '../../src/llm/mock';
import { Message, LLMConfig, LLMChunk } from '../../src/types';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;
  let config: LLMConfig;

  beforeEach(() => {
    provider = new MockLLMProvider();
    config = {
      provider: 'mock',
      model: 'test-model',
      temperature: 0.7,
    };
  });

  describe('Basic functionality', () => {
    it('should return default response when no responses configured', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
      ];

      const chunks: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.type).toBe('done');
    });

    it('should stream configured content response', async () => {
      provider.setResponses([
        { content: 'Hello world' },
      ]);

      const messages: Message[] = [
        { role: 'user', content: 'Say hello' },
      ];

      const chunks: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === 'content');
      expect(contentChunks.length).toBeGreaterThan(0);

      const fullContent = contentChunks.map((c) => c.content).join('');
      expect(fullContent.trim()).toBe('Hello world');
    });

    it('should return tool calls when configured', async () => {
      provider.setResponses([
        {
          content: 'I will use the calculator',
          toolCalls: [
            {
              id: 'call_123',
              name: 'calculator',
              arguments: { expression: '2+2' },
            },
          ],
        },
      ]);

      const messages: Message[] = [
        { role: 'user', content: 'Calculate 2+2' },
      ];

      const chunks: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks.push(chunk);
      }

      const toolCallChunks = chunks.filter((c) => c.type === 'tool_call');
      expect(toolCallChunks).toHaveLength(1);
      expect(toolCallChunks[0].toolCall?.name).toBe('calculator');

      const doneChunk = chunks.find((c) => c.type === 'done');
      expect(doneChunk?.finishReason).toBe('tool_calls');
    });

    it('should handle multiple responses in sequence', async () => {
      provider.setResponses([
        { content: 'First response' },
        { content: 'Second response' },
      ]);

      const messages: Message[] = [
        { role: 'user', content: 'Test' },
      ];

      // First call
      const chunks1: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks1.push(chunk);
      }
      const content1 = chunks1
        .filter((c) => c.type === 'content')
        .map((c) => c.content)
        .join('')
        .trim();
      expect(content1).toBe('First response');

      // Second call
      const chunks2: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks2.push(chunk);
      }
      const content2 = chunks2
        .filter((c) => c.type === 'content')
        .map((c) => c.content)
        .join('')
        .trim();
      expect(content2).toBe('Second response');
    });
  });

  describe('Response management', () => {
    it('should track current response index', () => {
      provider.setResponses([
        { content: 'One' },
        { content: 'Two' },
      ]);

      expect(provider.getCurrentIndex()).toBe(0);
      expect(provider.getResponseCount()).toBe(2);
    });

    it('should increment index after each call', async () => {
      provider.setResponses([
        { content: 'First' },
        { content: 'Second' },
      ]);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];

      await consumeStream(provider.chat(messages, config));
      expect(provider.getCurrentIndex()).toBe(1);

      await consumeStream(provider.chat(messages, config));
      expect(provider.getCurrentIndex()).toBe(2);
    });

    it('should reset state when reset() is called', () => {
      provider.setResponses([
        { content: 'Test' },
      ]);
      provider.reset();

      expect(provider.getCurrentIndex()).toBe(0);
      expect(provider.getResponseCount()).toBe(0);
    });

    it('should add responses with addResponse()', async () => {
      provider.addResponse({ content: 'Response 1' });
      provider.addResponse({ content: 'Response 2' });

      expect(provider.getResponseCount()).toBe(2);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      
      const chunks = await collectChunks(provider.chat(messages, config));
      const content = chunks
        .filter((c) => c.type === 'content')
        .map((c) => c.content)
        .join('')
        .trim();
      
      expect(content).toBe('Response 1');
    });
  });

  describe('Configuration validation', () => {
    it('should accept valid configuration', async () => {
      const validConfig: LLMConfig = {
        provider: 'mock',
        model: 'test-model',
        temperature: 0.5,
        maxTokens: 100,
      };

      provider.setResponses([{ content: 'Test' }]);
      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      await expect(
        consumeStream(provider.chat(messages, validConfig))
      ).resolves.not.toThrow();
    });

    it('should reject invalid temperature', async () => {
      const invalidConfig: LLMConfig = {
        provider: 'mock',
        model: 'test-model',
        temperature: 3.0, // Invalid: > 2
      };

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      await expect(
        consumeStream(provider.chat(messages, invalidConfig))
      ).rejects.toThrow('Temperature must be between 0 and 2');
    });

    it('should reject invalid maxTokens', async () => {
      const invalidConfig: LLMConfig = {
        provider: 'mock',
        model: 'test-model',
        maxTokens: -1, // Invalid: negative
      };

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      await expect(
        consumeStream(provider.chat(messages, invalidConfig))
      ).rejects.toThrow('Max tokens must be positive');
    });
  });

  describe('chatWithTools', () => {
    it('should behave like chat() for mock provider', async () => {
      provider.setResponses([
        { content: 'Using tools' },
      ]);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const tools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: {
            type: 'object' as const,
            properties: {},
          },
        },
      ];

      const chunks: LLMChunk[] = [];
      for await (const chunk of provider.chatWithTools(messages, tools, config)) {
        chunks.push(chunk);
      }

      const content = chunks
        .filter((c) => c.type === 'content')
        .map((c) => c.content)
        .join('')
        .trim();

      expect(content).toBe('Using tools');
    });
  });

  describe('Token usage', () => {
    it('should include usage information in done chunk', async () => {
      provider.setResponses([
        { content: 'Test response' },
      ]);

      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
      ];

      const chunks: LLMChunk[] = [];
      for await (const chunk of provider.chat(messages, config)) {
        chunks.push(chunk);
      }

      const doneChunk = chunks.find((c) => c.type === 'done');
      expect(doneChunk?.usage).toBeDefined();
      expect(doneChunk?.usage?.promptTokens).toBeGreaterThan(0);
      expect(doneChunk?.usage?.completionTokens).toBeGreaterThan(0);
    });
  });

  describe('Simulated delay', () => {
    it('should delay response when delayMs is specified', async () => {
      const delayMs = 100;
      provider.setResponses([
        { content: 'Delayed response', delayMs },
      ]);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      
      const startTime = Date.now();
      await consumeStream(provider.chat(messages, config));
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 10); // Allow some tolerance
    });
  });
});

// Helper functions
async function consumeStream(generator: AsyncGenerator<LLMChunk>): Promise<void> {
  for await (const _ of generator) {
    // Just consume the stream
  }
}

async function collectChunks(generator: AsyncGenerator<LLMChunk>): Promise<LLMChunk[]> {
  const chunks: LLMChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}
