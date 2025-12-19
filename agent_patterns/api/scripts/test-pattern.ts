#!/usr/bin/env ts-node
/**
 * Test script for manually testing agent patterns
 * Usage: npm run test:pattern -- <pattern-name> <input> [options]
 * 
 * Examples:
 *   npm run test:pattern -- react "Calculate 10 factorial"
 *   npm run test:pattern -- react "What is 2+2?" --provider=openai
 */

import { ReActPattern } from '../src/patterns/react';
import { IterativeRefinementPattern } from '../src/patterns/iterative-refinement';
import { PlanAndValidatePattern } from '../src/patterns/plan-and-validate';
import { AgentContext, PatternStep } from '../src/types';
import { MockLLMProvider } from '../src/llm/mock';
import { OpenAIProvider } from '../src/llm/openai';
import { CalculatorTool } from '../src/tools/calculator';
import { FileSystemTool } from '../src/tools/file-system';
import { NodeExecutionTool } from '../src/tools/node-execution';
import { PythonExecutionTool } from '../src/tools/python-execution';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npm run test:pattern -- <pattern-name> <input> [options]');
  console.log('');
  console.log('Patterns:');
  console.log('  react                - Reasoning + Acting loop');
  console.log('  iterative-refinement - Generate → Execute → Validate → Refine');
  console.log('  plan-and-validate    - Plan → Execute Steps → Validate → Refine');
  console.log('');
  console.log('Options:');
  console.log('  --provider=<mock|openai>  - LLM provider to use (default: mock)');
  console.log('  --max-iterations=<n>      - Maximum iterations (default: 10)');
  console.log('  --verbose=<true|false>    - Show iteration details (default: true)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run test:pattern -- react "Calculate 2+2"');
  console.log('  npm run test:pattern -- react "What is 5*5?" --provider=openai');
  process.exit(1);
}

const patternName = args[0];
const input = args[1];

// Parse options
const options: Record<string, string> = {};
args.slice(2).forEach(arg => {
  const match = arg.match(/^--([^=]+)=(.+)$/);
  if (match) {
    options[match[1]] = match[2];
  }
});

const provider = options['provider'] || 'mock';
const maxIterations = parseInt(options['max-iterations'] || '10');
const verbose = options['verbose'] !== 'false';

async function main() {
  console.log('='.repeat(80));
  console.log(`Testing ${patternName} pattern`);
  console.log('='.repeat(80));
  console.log(`Input: ${input}`);
  console.log(`Provider: ${provider}`);
  console.log(`Max Iterations: ${maxIterations}`);
  console.log(`Verbose: ${verbose}`);
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
  const nodeExecutionTool = new NodeExecutionTool();
  const pythonExecutionTool = new PythonExecutionTool();

  // Create pattern
  let pattern;
  if (patternName === 'react') {
    pattern = new ReActPattern(llmProvider);
  } else if (patternName === 'iterative-refinement') {
    pattern = new IterativeRefinementPattern(llmProvider);
  } else if (patternName === 'plan-and-validate') {
    pattern = new PlanAndValidatePattern(llmProvider);
  } else {
    console.error(`Unknown pattern: ${patternName}`);
    process.exit(1);
  }

  // Set up context
  const context: AgentContext = {
    messages: [],
    tools: [calculatorTool, fileSystemTool, nodeExecutionTool, pythonExecutionTool],
    config: {
      provider: provider as 'openai' | 'mock',
      model: provider === 'openai' ? 'gpt-4' : 'mock',
      temperature: 0.7
    }
  };

  // Execute pattern
  try {
    console.log('Starting execution...\n');

    for await (const step of pattern.execute(input, context, { maxIterations, verbose })) {
      displayStep(step);
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
 * Display a pattern step
 */
function displayStep(step: PatternStep) {
  const timestamp = new Date(step.timestamp || Date.now()).toLocaleTimeString();
  
  switch (step.type) {
    case 'capability':
      console.log(`[${timestamp}] 🧠 CAPABILITY: ${step.capability}`);
      if (step.content) {
        console.log(`   ${step.content}`);
      }
      break;

    case 'tool_call':
      console.log(`[${timestamp}] 🔧 TOOL CALL: ${step.tool}`);
      console.log(`   ${step.content}`);
      if (step.metadata) {
        console.log(`   Arguments: ${JSON.stringify(step.metadata.arguments, null, 2)}`);
      }
      break;

    case 'result':
      console.log(`[${timestamp}] ✅ RESULT:`);
      console.log(`   ${step.content}`);
      if (step.metadata?.reasoning) {
        console.log(`   Reasoning: ${step.metadata.reasoning}`);
      }
      if (step.metadata?.nextAction) {
        console.log(`   Next Action: ${step.metadata.nextAction}`);
      }
      break;

    case 'error':
      console.log(`[${timestamp}] ❌ ERROR:`);
      console.log(`   ${step.content}`);
      break;
  }

  console.log('');
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
