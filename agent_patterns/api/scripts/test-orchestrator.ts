#!/usr/bin/env ts-node
/**
 * Test script for the orchestrator
 * Usage: npm run test:orchestrator -- <pattern-name> <input> [options]
 * 
 * Examples:
 *   npm run test:orchestrator -- react "Calculate 10 factorial"
 *   npm run test:orchestrator -- react "What is 2+2?" --provider=openai --debug
 */

import { AgentOrchestrator } from '../src/orchestrator/orchestrator';
import { ExecutionEvent } from '../src/types';
import { MockLLMProvider } from '../src/llm/mock';
import { OpenAIProvider } from '../src/llm/openai';
import { ReActPattern } from '../src/patterns/react';
import { CalculatorTool } from '../src/tools/calculator';
import { FileSystemTool } from '../src/tools/file-system';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npm run test:orchestrator -- <pattern-name> <input> [options]');
  console.log('');
  console.log('Patterns:');
  console.log('  react  - Reasoning + Acting loop');
  console.log('');
  console.log('Options:');
  console.log('  --provider=<mock|openai>  - LLM provider to use (default: mock)');
  console.log('  --max-steps=<n>           - Maximum steps (default: 1000)');
  console.log('  --timeout=<ms>            - Execution timeout in ms');
  console.log('  --debug                   - Enable debug mode');
  console.log('  --visualizations          - Enable visualizations');
  console.log('');
  console.log('Examples:');
  console.log('  npm run test:orchestrator -- react "Calculate 2+2"');
  console.log('  npm run test:orchestrator -- react "What is 5*5?" --provider=openai --debug');
  process.exit(1);
}

const patternName = args[0];
const input = args[1];

// Parse options
const options: Record<string, string | boolean> = {};
args.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const match = arg.match(/^--([^=]+)(?:=(.+))?$/);
    if (match) {
      const key = match[1];
      const value = match[2] || 'true';
      options[key] = value === 'true' ? true : value === 'false' ? false : value;
    }
  }
});

const provider = (options['provider'] as string) || 'mock';
const maxSteps = options['max-steps'] ? parseInt(options['max-steps'] as string) : undefined;
const timeout = options['timeout'] ? parseInt(options['timeout'] as string) : undefined;
const debug = options['debug'] === true;
const visualizations = options['visualizations'] === true;

async function main() {
  console.log('='.repeat(80));
  console.log(`Testing Orchestrator with ${patternName} pattern`);
  console.log('='.repeat(80));
  console.log(`Input: ${input}`);
  console.log(`Provider: ${provider}`);
  if (maxSteps) console.log(`Max Steps: ${maxSteps}`);
  if (timeout) console.log(`Timeout: ${timeout}ms`);
  console.log(`Debug: ${debug}`);
  console.log(`Visualizations: ${visualizations}`);
  console.log('='.repeat(80));
  console.log('');

  // Set up LLM provider
  let llmProvider;
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      console.error('Error: OPENAI_API_KEY not set in environment');
      process.exit(1);
    }
    llmProvider = new OpenAIProvider();
    console.log('Using OpenAI provider');
  } else {
    llmProvider = new MockLLMProvider();
    // Set up mock responses for a simple calculation
    llmProvider.setResponses([
      { content: 'I need to calculate this using the calculator tool.' },
      {
        content: 'Using calculator',
        toolCalls: [
          {
            id: 'call_1',
            name: 'calculator',
            arguments: { expression: input.match(/\d+[\+\-\*\/\%]\d+/)?.[0] || '2+2' }
          }
        ]
      },
      { content: 'The calculation is complete. Task completed.' }
    ]);
    console.log('Using mock provider with predefined responses');
  }

  // Set up tools
  const calculatorTool = new CalculatorTool();
  const fileSystemTool = new FileSystemTool();

  // Create orchestrator
  const orchestrator = new AgentOrchestrator(
    llmProvider,
    [calculatorTool, fileSystemTool]
  );

  // Register patterns
  if (patternName === 'react') {
    const reactPattern = new ReActPattern(llmProvider);
    orchestrator.registerPattern(reactPattern);
  } else {
    console.error(`Unknown pattern: ${patternName}`);
    console.log('Available patterns: react');
    process.exit(1);
  }

  // Execute pattern
  try {
    console.log('Starting execution...\n');

    const executionOptions = {
      maxSteps,
      timeout,
      debug,
      visualizations
    };

    for await (const event of orchestrator.executePattern(patternName, input, executionOptions)) {
      displayEvent(event);
    }

    console.log('\n' + '='.repeat(80));
    console.log('Execution completed');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\nExecution failed:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Display an execution event
 */
function displayEvent(event: ExecutionEvent) {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  switch (event.eventType) {
    case 'start':
      console.log(`[${timestamp}] 🚀 START`);
      console.log(`   Pattern: ${event.data.pattern}`);
      console.log(`   Input: ${event.data.input}`);
      if (event.data.options) {
        console.log(`   Options: ${JSON.stringify(event.data.options)}`);
      }
      break;

    case 'step':
      const stepIcon = getStepIcon(event.data.type);
      console.log(`[${timestamp}] ${stepIcon} ${event.data.type.toUpperCase()}`);
      if (event.data.capability) {
        console.log(`   Capability: ${event.data.capability}`);
      }
      if (event.data.tool) {
        console.log(`   Tool: ${event.data.tool}`);
      }
      if (event.data.content) {
        console.log(`   ${event.data.content}`);
      }
      
      // Show debug info if available
      if (event.debug) {
        console.log(`   🐛 Debug:`);
        if (event.debug.prompt) {
          console.log(`      Prompt: ${event.debug.prompt.substring(0, 100)}...`);
        }
        if (event.debug.tokens) {
          console.log(`      Tokens: ${event.debug.tokens.totalTokens}`);
        }
        if (event.debug.latency) {
          console.log(`      Latency: ${event.debug.latency}ms`);
        }
      }
      break;

    case 'complete':
      console.log(`[${timestamp}] ✅ COMPLETE`);
      console.log(`   Duration: ${event.data.duration}ms`);
      console.log(`   Status: ${event.data.status}`);
      break;

    case 'error':
      console.log(`[${timestamp}] ❌ ERROR`);
      console.log(`   ${event.data.error}`);
      if (event.data.stepCount) {
        console.log(`   Steps completed: ${event.data.stepCount}`);
      }
      break;

    case 'visualization':
      console.log(`[${timestamp}] 📊 VISUALIZATION`);
      console.log(`   Data available for rendering`);
      break;
  }

  console.log('');
}

/**
 * Get icon for step type
 */
function getStepIcon(type: string): string {
  switch (type) {
    case 'capability': return '🧠';
    case 'tool_call': return '🔧';
    case 'result': return '✅';
    case 'error': return '❌';
    default: return '📝';
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
