#!/usr/bin/env node
/**
 * Manual test script for LLM providers
 * Usage: npm run test:llm -- <provider> <prompt>
 * Examples:
 *   npm run test:llm -- mock "Hello, world"
 *   npm run test:llm -- openai "What is 2+2?"
 */

import { MockLLMProvider, OpenAIProvider } from '../src/llm';
import { Message, LLMConfig } from '../src/types';
import { getConfig } from '../src/config';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: test-llm <provider> <prompt>');
    console.error('Examples:');
    console.error('  test-llm mock "Hello, world"');
    console.error('  test-llm openai "What is 2+2?"');
    console.error('\nProviders: mock, openai');
    process.exit(1);
  }

  const providerName = args[0];
  const prompt = args[1];

  console.log(`\n=== Testing ${providerName} Provider ===`);
  console.log('Prompt:', prompt);
  console.log('\n--- Response ---\n');

  const config = getConfig();
  const llmConfig: LLMConfig = {
    provider: providerName as any,
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
  };

  const messages: Message[] = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  try {
    let provider;

    switch (providerName) {
      case 'mock':
        provider = new MockLLMProvider();
        // Set a default response for the mock
        provider.setResponses([
          {
            content: 'This is a mock response. The actual LLM would respond here.',
          },
        ]);
        break;

      case 'openai':
        if (!config.llm.apiKey) {
          console.error('Error: OPENAI_API_KEY not found in environment');
          console.error('Please set it in your .env file or environment variables');
          process.exit(1);
        }
        provider = new OpenAIProvider(config.llm.apiKey);
        break;

      default:
        console.error(`Unknown provider: ${providerName}`);
        console.error('Available providers: mock, openai');
        process.exit(1);
    }

    let fullContent = '';
    let tokenUsage;
    let completionShown = false;

    for await (const chunk of provider.chat(messages, llmConfig)) {
      if (chunk.type === 'content') {
        process.stdout.write(chunk.content || '');
        fullContent += chunk.content || '';
      } else if (chunk.type === 'tool_call') {
        console.log('\n\n[Tool Call]');
        console.log('Name:', chunk.toolCall?.name);
        console.log('Arguments:', JSON.stringify(chunk.toolCall?.arguments, null, 2));
      } else if (chunk.type === 'done') {
        // Update token usage if provided
        if (chunk.usage) {
          tokenUsage = chunk.usage;
        }
        
        // Only show completion header once
        if (!completionShown) {
          console.log('\n\n--- Completion ---');
          console.log('Finish Reason:', chunk.finishReason);
          completionShown = true;
        }
      }
    }

    // Show token usage at the end if available
    if (tokenUsage) {
      console.log('\n--- Token Usage ---');
      console.log('Prompt Tokens:', tokenUsage.promptTokens);
      console.log('Completion Tokens:', tokenUsage.completionTokens);
      console.log('Total Tokens:', tokenUsage.totalTokens);
    }

    console.log('\n');
  } catch (error) {
    console.error('\n--- Error ---');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
