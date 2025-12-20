/**
 * Integration test demonstrating output adapters with real pattern execution
 */

import { AgentOrchestrator } from '../../src/orchestrator/orchestrator';
import { MockLLMProvider } from '../../src/llm/mock';
import { ReActPattern } from '../../src/patterns/react';
import { CalculatorTool } from '../../src/tools/calculator';
import { ExecutionEvent } from '../../src/types';
import { outputAdapterRegistry } from '../../src/output';
import { PatternRegistry } from '../../src/patterns/base';

describe('Output Adapters - Integration', () => {
  let orchestrator: AgentOrchestrator;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    PatternRegistry.clear();
    
    mockProvider = new MockLLMProvider();
    mockProvider.setResponses([
      { content: 'I need to calculate 2+2. NEXT_ACTION: use calculator' },
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
      { content: 'The calculation is complete. CONCLUSION: The result is 4. NEXT_ACTION: none' }
    ]);

    orchestrator = new AgentOrchestrator(
      mockProvider,
      [new CalculatorTool()],
      { provider: 'mock', model: 'mock' }
    );

    orchestrator.registerPattern(new ReActPattern(mockProvider));
  });

  async function collectEvents(): Promise<ExecutionEvent[]> {
    const events: ExecutionEvent[] = [];
    
    for await (const event of orchestrator.executePattern('react', 'Calculate 2+2')) {
      events.push(event);
    }
    
    return events;
  }

  test('should format same events in different ways', async () => {
    const events = await collectEvents();

    // Format as API response
    const apiAdapter = outputAdapterRegistry.get('api');
    const apiResult = apiAdapter.format(events);

    // Format as terminal output
    const terminalAdapter = outputAdapterRegistry.get('terminal');
    const terminalResult = terminalAdapter.format(events);

    // Format as markdown
    const markdownAdapter = outputAdapterRegistry.get('markdown');
    const markdownResult = markdownAdapter.format(events);

    // All should be different formats
    expect(typeof apiResult).toBe('object');
    expect(typeof terminalResult).toBe('string');
    expect(typeof markdownResult).toBe('string');

    // API result should have structure
    expect(apiResult).toHaveProperty('answer');
    expect(apiResult).toHaveProperty('metadata');
    expect(apiResult.metadata.tools).toContain('calculator');

    // Terminal should be plain text
    expect(terminalResult).toContain('calculator');
    expect(terminalResult).not.toContain('**'); // No markdown

    // Markdown should have formatting
    expect(markdownResult).toContain('##'); // Headers
    expect(markdownResult).toContain('**'); // Bold
  });

  test('API format should be JSON-serializable', async () => {
    const events = await collectEvents();
    const adapter = outputAdapterRegistry.get('api');
    const result = adapter.format(events);

    // Should serialize without errors
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(result);
  });

  test('Terminal format should be readable', async () => {
    const events = await collectEvents();
    const adapter = outputAdapterRegistry.get('terminal');
    const result = adapter.format(events);

    // Should not be too long
    const lines = result.split('\n');
    expect(lines.length).toBeLessThan(10);

    // Should be plain text (no HTML or special chars)
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  test('Markdown format should have proper structure', async () => {
    const events = await collectEvents();
    const adapter = outputAdapterRegistry.get('markdown');
    const result = adapter.format(events);

    // Should have main sections
    expect(result).toContain('## Response');
    expect(result).toContain('### Execution Details');

    // Should use markdown syntax
    expect(result).toContain('**Tools Used:**');
    expect(result).toContain('- `calculator`');
  });

  test('should demonstrate performance advantage', async () => {
    const events = await collectEvents();

    // Measure formatting time (should be instant)
    const start = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      outputAdapterRegistry.get('api').format(events);
      outputAdapterRegistry.get('terminal').format(events);
      outputAdapterRegistry.get('markdown').format(events);
    }
    
    const duration = Date.now() - start;

    // 3000 formatting operations should complete in under 100ms
    // (vs 3000 LLM calls which would take hours)
    expect(duration).toBeLessThan(100);
    
    console.log(`✅ Formatted 3000 outputs in ${duration}ms (vs ~3000+ seconds with LLM calls)`);
  });

  test('should allow custom format selection at runtime', async () => {
    const events = await collectEvents();

    // Simulate different clients requesting different formats
    const formats = ['api', 'terminal', 'markdown', 'json', 'cli', 'web'];

    formats.forEach(format => {
      const adapter = outputAdapterRegistry.get(format);
      const result = adapter.format(events);

      expect(result).toBeDefined();
      
      // Each format should produce different output
      if (format === 'api' || format === 'json') {
        expect(typeof result).toBe('object');
      } else {
        expect(typeof result).toBe('string');
      }
    });
  });
});
