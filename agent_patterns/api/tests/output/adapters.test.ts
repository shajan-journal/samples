/**
 * Tests for Output Adapters
 */

import { APIAdapter } from '../../src/output/api-adapter';
import { TerminalAdapter } from '../../src/output/terminal-adapter';
import { MarkdownAdapter } from '../../src/output/markdown-adapter';
import { OutputAdapterRegistry } from '../../src/output/registry';
import { ExecutionEvent } from '../../src/types';

describe('Output Adapters', () => {
  // Sample execution events for testing
  const mockEvents: ExecutionEvent[] = [
    {
      timestamp: 1000,
      eventType: 'start',
      data: {
        pattern: 'react',
        input: 'Calculate 2+2'
      }
    },
    {
      timestamp: 1100,
      eventType: 'step',
      data: {
        type: 'capability',
        capability: 'reasoning',
        content: 'I need to use the calculator'
      }
    },
    {
      timestamp: 1200,
      eventType: 'step',
      data: {
        type: 'tool_call',
        tool: 'calculator',
        content: 'Calling calculator'
      }
    },
    {
      timestamp: 1300,
      eventType: 'step',
      data: {
        type: 'result',
        content: 'Tool executed successfully'
      }
    },
    {
      timestamp: 1400,
      eventType: 'step',
      data: {
        type: 'answer',
        content: 'The result is 4'
      }
    },
    {
      timestamp: 2000,
      eventType: 'complete',
      data: {
        status: 'success',
        duration: 1000
      }
    }
  ];

  describe('APIAdapter', () => {
    let adapter: APIAdapter;

    beforeEach(() => {
      adapter = new APIAdapter();
    });

    test('should support api and json targets', () => {
      expect(adapter.supports('api')).toBe(true);
      expect(adapter.supports('json')).toBe(true);
      expect(adapter.supports('terminal')).toBe(false);
    });

    test('should format events as structured JSON', () => {
      const result = adapter.format(mockEvents);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
    });

    test('should extract answer correctly', () => {
      const result = adapter.format(mockEvents);
      expect(result.answer).toBe('The result is 4');
    });

    test('should extract tools used', () => {
      const result = adapter.format(mockEvents);
      expect(result.metadata.tools).toContain('calculator');
      expect(result.metadata.tools).toHaveLength(1);
    });

    test('should extract capabilities', () => {
      const result = adapter.format(mockEvents);
      expect(result.metadata.capabilities).toContain('reasoning');
    });

    test('should calculate duration', () => {
      const result = adapter.format(mockEvents);
      expect(result.metadata.duration).toBe(1000);
    });

    test('should detect successful execution', () => {
      const result = adapter.format(mockEvents);
      expect(result.success).toBe(true);
    });

    test('should handle errors', () => {
      const eventsWithError: ExecutionEvent[] = [
        ...mockEvents,
        {
          timestamp: 2100,
          eventType: 'error',
          data: {
            error: 'Something went wrong'
          }
        }
      ];

      const result = adapter.format(eventsWithError);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Something went wrong');
    });

    test('should handle visualizations', () => {
      const eventsWithViz: ExecutionEvent[] = [
        ...mockEvents.slice(0, 4),
        {
          timestamp: 1350,
          eventType: 'step',
          data: {
            type: 'result',
            content: 'Chart generated'
          },
          visualizations: {
            version: '1.0',
            outputs: []
          }
        },
        ...mockEvents.slice(4)
      ];

      const result = adapter.format(eventsWithViz);
      expect(result.metadata.visualizations).toHaveLength(1);
    });
  });

  describe('TerminalAdapter', () => {
    let adapter: TerminalAdapter;

    beforeEach(() => {
      adapter = new TerminalAdapter();
    });

    test('should support terminal, cli, and text targets', () => {
      expect(adapter.supports('terminal')).toBe(true);
      expect(adapter.supports('cli')).toBe(true);
      expect(adapter.supports('text')).toBe(true);
      expect(adapter.supports('api')).toBe(false);
    });

    test('should format as plain text', () => {
      const result = adapter.format(mockEvents);
      
      expect(typeof result).toBe('string');
      expect(result).toContain('The result is 4');
    });

    test('should include tools used', () => {
      const result = adapter.format(mockEvents);
      expect(result).toContain('calculator');
    });

    test('should format multiline output', () => {
      const result = adapter.format(mockEvents);
      const lines = result.split('\n');
      
      expect(lines.length).toBeGreaterThan(1);
    });

    test('should handle errors in text', () => {
      const eventsWithError: ExecutionEvent[] = [
        ...mockEvents,
        {
          timestamp: 2100,
          eventType: 'error',
          data: {
            error: 'Test error'
          }
        }
      ];

      const result = adapter.format(eventsWithError);
      expect(result).toContain('Errors:');
      expect(result).toContain('Test error');
    });
  });

  describe('MarkdownAdapter', () => {
    let adapter: MarkdownAdapter;

    beforeEach(() => {
      adapter = new MarkdownAdapter();
    });

    test('should support markdown, md, and web targets', () => {
      expect(adapter.supports('markdown')).toBe(true);
      expect(adapter.supports('md')).toBe(true);
      expect(adapter.supports('web')).toBe(true);
      expect(adapter.supports('api')).toBe(false);
    });

    test('should format as markdown', () => {
      const result = adapter.format(mockEvents);
      
      expect(result).toContain('## Response');
      expect(result).toContain('The result is 4');
    });

    test('should include execution details section', () => {
      const result = adapter.format(mockEvents);
      
      expect(result).toContain('### Execution Details');
      expect(result).toContain('**Tools Used:**');
      expect(result).toContain('`calculator`');
    });

    test('should include duration', () => {
      const result = adapter.format(mockEvents);
      expect(result).toContain('**Duration:**');
      expect(result).toContain('1.00s');
    });

    test('should format errors with emoji', () => {
      const eventsWithError: ExecutionEvent[] = [
        ...mockEvents,
        {
          timestamp: 2100,
          eventType: 'error',
          data: {
            error: 'Test error'
          }
        }
      ];

      const result = adapter.format(eventsWithError);
      expect(result).toContain('### Errors');
      expect(result).toContain('⚠️');
      expect(result).toContain('Test error');
    });
  });

  describe('OutputAdapterRegistry', () => {
    let registry: OutputAdapterRegistry;

    beforeEach(() => {
      registry = new OutputAdapterRegistry();
    });

    test('should have default adapters registered', () => {
      const adapters = registry.getAll();
      expect(adapters.length).toBeGreaterThanOrEqual(3);
    });

    test('should get correct adapter for target', () => {
      const apiAdapter = registry.get('api');
      const terminalAdapter = registry.get('terminal');
      const markdownAdapter = registry.get('markdown');

      expect(apiAdapter).toBeInstanceOf(APIAdapter);
      expect(terminalAdapter).toBeInstanceOf(TerminalAdapter);
      expect(markdownAdapter).toBeInstanceOf(MarkdownAdapter);
    });

    test('should return default adapter for unknown target', () => {
      const adapter = registry.get('unknown-format');
      expect(adapter).toBeInstanceOf(APIAdapter);
    });

    test('should list supported formats', () => {
      const formats = registry.getSupportedFormats();
      
      expect(formats).toContain('api');
      expect(formats).toContain('terminal');
      expect(formats).toContain('markdown');
    });

    test('should allow registering custom adapters', () => {
      class CustomAdapter extends APIAdapter {
        supports(target: string): boolean {
          return target === 'custom';
        }
      }

      const customAdapter = new CustomAdapter();
      registry.register(customAdapter);

      const adapter = registry.get('custom');
      expect(adapter).toBe(customAdapter);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle empty events', () => {
      const emptyEvents: ExecutionEvent[] = [];
      
      const apiAdapter = new APIAdapter();
      const terminalAdapter = new TerminalAdapter();
      const markdownAdapter = new MarkdownAdapter();

      expect(() => apiAdapter.format(emptyEvents)).not.toThrow();
      expect(() => terminalAdapter.format(emptyEvents)).not.toThrow();
      expect(() => markdownAdapter.format(emptyEvents)).not.toThrow();

      const apiResult = apiAdapter.format(emptyEvents);
      expect(apiResult.success).toBe(false);
      expect(apiResult.answer).toBeNull();
    });

    test('should handle events without answer', () => {
      const noAnswerEvents: ExecutionEvent[] = [
        {
          timestamp: 1000,
          eventType: 'start',
          data: { pattern: 'react', input: 'test' }
        },
        {
          timestamp: 2000,
          eventType: 'complete',
          data: { status: 'success' }
        }
      ];

      const apiAdapter = new APIAdapter();
      const result = apiAdapter.format(noAnswerEvents);
      
      expect(result.answer).toBeNull();
      expect(result.success).toBe(true);
    });

    test('should handle multiple tool calls', () => {
      const multiToolEvents: ExecutionEvent[] = [
        {
          timestamp: 1000,
          eventType: 'start',
          data: { pattern: 'react', input: 'test' }
        },
        {
          timestamp: 1100,
          eventType: 'step',
          data: { type: 'tool_call', tool: 'calculator', content: 'Using calculator' }
        },
        {
          timestamp: 1200,
          eventType: 'step',
          data: { type: 'tool_call', tool: 'file_system', content: 'Reading file' }
        },
        {
          timestamp: 1300,
          eventType: 'step',
          data: { type: 'tool_call', tool: 'calculator', content: 'Using calculator again' }
        },
        {
          timestamp: 2000,
          eventType: 'complete',
          data: { status: 'success' }
        }
      ];

      const apiAdapter = new APIAdapter();
      const result = apiAdapter.format(multiToolEvents);
      
      expect(result.metadata.tools).toContain('calculator');
      expect(result.metadata.tools).toContain('file_system');
      expect(result.metadata.tools).toHaveLength(2); // Should deduplicate
    });
  });
});
