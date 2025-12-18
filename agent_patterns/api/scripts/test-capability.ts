#!/usr/bin/env tsx
/**
 * Manual test script for capabilities
 * Usage: npm run test:capability -- <capability-name> "<query>" [--provider=openai]
 */

import { ReasoningCapability } from '../src/capabilities/reasoning';
import { MockLLMProvider } from '../src/llm/mock';
import { OpenAIProvider } from '../src/llm/openai';
import { BaseTool } from '../src/tools/base';
import { CalculatorTool } from '../src/tools/calculator';
import { FileSystemTool } from '../src/tools/file-system';
import { AgentContext, LLMConfig, LLMProvider } from '../src/types';
import { getConfig } from '../src/config';

const config = getConfig();

// Get command line arguments
const args = process.argv.slice(2);
const capabilityName = args[0];
const query = args[1];
const useOpenAI = args.some(arg => arg.includes('--provider=openai'));

if (!capabilityName || !query) {
  console.log('Usage: npm run test:capability -- <capability-name> "<query>" [--provider=openai]');
  console.log('\nAvailable capabilities:');
  console.log('  reasoning - Perform logical reasoning and inference');
  console.log('\nExamples:');
  console.log('  npm run test:capability -- reasoning "What is 2 + 2?"');
  console.log('  npm run test:capability -- reasoning "Should I use tool X?" --provider=openai');
  process.exit(1);
}

async function testCapability() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Capability: ${capabilityName}`);
  console.log(`Query: "${query}"`);
  console.log(`Provider: ${useOpenAI ? 'OpenAI' : 'Mock'}`);
  console.log('='.repeat(60));

  // Setup LLM provider
  let provider: LLMProvider;
  const llmConfig: LLMConfig = {
    provider: useOpenAI ? 'openai' : 'mock',
    model: useOpenAI ? config.llm.model : 'test-model',
    temperature: 0.7,
  };

  if (useOpenAI) {
    if (!config.llm.apiKey) {
      console.error('\nError: LLM_API_KEY not found in .env file');
      process.exit(1);
    }
    provider = new OpenAIProvider(config.llm.apiKey);
    console.log(`Using OpenAI model: ${config.llm.model}`);
  } else {
    provider = new MockLLMProvider();
    console.log('Using Mock provider with default responses');
  }

  // Setup tools (available for the capability to reference)
  const calculator = new CalculatorTool();
  const fileSystem = new FileSystemTool(config.workspace.baseDir);
  const tools: BaseTool[] = [calculator, fileSystem];

  console.log(`\nAvailable tools: ${tools.map(t => t.name).join(', ')}`);

  // Create capability
  let capability;
  switch (capabilityName.toLowerCase()) {
    case 'reasoning':
      capability = new ReasoningCapability(provider);
      break;
    default:
      console.error(`\nError: Unknown capability "${capabilityName}"`);
      console.log('Available: reasoning');
      process.exit(1);
  }

  // Build context
  const context: AgentContext = {
    messages: [
      { role: 'user', content: query },
    ],
    tools,
    config: llmConfig,
  };

  console.log(`\nExecuting ${capability.name} capability...`);
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    const result = await capability.execute(context);
    const duration = Date.now() - startTime;

    console.log('\n✓ Capability execution completed');
    console.log(`Duration: ${duration}ms\n`);

    if (result.reasoning) {
      console.log('REASONING:');
      console.log(result.reasoning);
      console.log();
    }

    console.log('OUTPUT:');
    console.log(result.output);

    if (result.nextAction) {
      console.log('\nNEXT ACTION:');
      console.log(result.nextAction);
    }

    if (result.metadata) {
      console.log('\nMETADATA:');
      console.log(JSON.stringify(result.metadata, null, 2));
    }

    console.log('\n' + '='.repeat(60));
  } catch (error) {
    console.error('\n✗ Error executing capability:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

testCapability().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
