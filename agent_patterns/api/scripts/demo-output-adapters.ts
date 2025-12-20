#!/usr/bin/env ts-node
/**
 * Demo script showing output adapters in action
 * Usage: npm run demo:output-adapters
 */

import { AgentOrchestrator } from '../src/orchestrator/orchestrator';
import { MockLLMProvider } from '../src/llm/mock';
import { ReActPattern } from '../src/patterns/react';
import { CalculatorTool } from '../src/tools/calculator';
import { ExecutionEvent } from '../src/types';
import { outputAdapterRegistry } from '../src/output';

async function demo() {
  console.log('='.repeat(80));
  console.log('Output Adapter Demo');
  console.log('='.repeat(80));
  console.log('\nDemonstrating how the same execution events can be formatted');
  console.log('for different output targets without additional LLM calls.\n');

  // Set up orchestrator with mock provider
  const mockProvider = new MockLLMProvider();
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

  const orchestrator = new AgentOrchestrator(
    mockProvider,
    [new CalculatorTool()],
    { provider: 'mock', model: 'mock' }
  );

  orchestrator.registerPattern(new ReActPattern(mockProvider));

  // Collect execution events
  console.log('🚀 Executing pattern...\n');
  const events: ExecutionEvent[] = [];
  
  for await (const event of orchestrator.executePattern('react', 'Calculate 2+2')) {
    events.push(event);
  }

  console.log('✅ Execution complete. Collected', events.length, 'events.\n');
  console.log('='.repeat(80));
  console.log('Formatting for different targets:');
  console.log('='.repeat(80));

  // Format 1: API / JSON
  console.log('\n📦 API/JSON Format:');
  console.log('-'.repeat(80));
  const apiAdapter = outputAdapterRegistry.get('api');
  const apiResult = apiAdapter.format(events);
  console.log(JSON.stringify(apiResult, null, 2));

  // Format 2: Terminal
  console.log('\n💻 Terminal Format:');
  console.log('-'.repeat(80));
  const terminalAdapter = outputAdapterRegistry.get('terminal');
  const terminalResult = terminalAdapter.format(events);
  console.log(terminalResult);

  // Format 3: Markdown
  console.log('\n📝 Markdown Format:');
  console.log('-'.repeat(80));
  const markdownAdapter = outputAdapterRegistry.get('markdown');
  const markdownResult = markdownAdapter.format(events);
  console.log(markdownResult);

  // Performance demo
  console.log('\n⚡ Performance Comparison:');
  console.log('-'.repeat(80));
  
  const iterations = 1000;
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    apiAdapter.format(events);
    terminalAdapter.format(events);
    markdownAdapter.format(events);
  }
  
  const duration = Date.now() - start;
  const perOperation = (duration / (iterations * 3)).toFixed(3);
  
  console.log(`Formatted ${iterations * 3} outputs in ${duration}ms`);
  console.log(`Average: ${perOperation}ms per format operation`);
  console.log(`\nCompare to LLM-based formatting:`);
  console.log(`  - ~1000ms per LLM call`);
  console.log(`  - Would take ~${((iterations * 3 * 1000) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`  - Adapter approach is ~${(1000 / parseFloat(perOperation)).toFixed(0)}x faster!`);

  console.log('\n' + '='.repeat(80));
  console.log('Summary:');
  console.log('='.repeat(80));
  console.log('✅ Zero additional LLM calls for formatting');
  console.log('✅ Instant formatting (microseconds vs seconds)');
  console.log('✅ Same events, multiple formats');
  console.log('✅ Easy to add new formats');
  console.log('✅ Type-safe and testable');
  console.log('\n✨ This is the Output Adapter Pattern in action!\n');
}

demo().catch(console.error);
