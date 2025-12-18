#!/usr/bin/env ts-node
/**
 * Start the API server
 * Usage: npm run start:api [-- --port=3000 --provider=mock]
 */

import { startServer } from '../src/api/server';
import { MockLLMProvider } from '../src/llm/mock';
import { OpenAIProvider } from '../src/llm/openai';
import { CalculatorTool } from '../src/tools/calculator';
import { FileSystemTool } from '../src/tools/file-system';
import { ReActPattern } from '../src/patterns/react';
import { ReasoningCapability } from '../src/capabilities/reasoning';
import { ToolUseCapability } from '../src/capabilities/tool-use';
import { CapabilityRegistry } from '../src/capabilities/base';
import { LLMProvider } from '../src/types';

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string> = {};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const match = arg.match(/^--([^=]+)(?:=(.+))?$/);
    if (match) {
      const key = match[1];
      const value = match[2] || 'true';
      options[key] = value;
    }
  }
});

const port = parseInt(options['port'] || process.env.PORT || '3000');
const provider = options['provider'] || 'mock';

async function main() {
  console.log('🚀 Starting Agent Patterns API Server');
  console.log('=====================================');
  console.log(`Port: ${port}`);
  console.log(`Provider: ${provider}`);
  console.log('');

  // Set up LLM provider
  let llmProvider: LLMProvider;
  
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Error: OPENAI_API_KEY not set in environment');
      process.exit(1);
    }
    llmProvider = new OpenAIProvider();
    console.log('✅ Using OpenAI provider');
  } else {
    llmProvider = new MockLLMProvider();
    // Set up some default mock responses
    (llmProvider as MockLLMProvider).setResponses([
      { content: 'I will help you with that task.' },
      {
        content: 'Let me use the calculator',
        toolCalls: [
          {
            id: 'call_1',
            name: 'calculator',
            arguments: { expression: '2+2' }
          }
        ]
      },
      { content: 'Task completed successfully.' }
    ]);
    console.log('✅ Using mock provider');
  }

  // Set up tools
  const calculatorTool = new CalculatorTool();
  const fileSystemTool = new FileSystemTool();
  const tools = [calculatorTool, fileSystemTool];
  console.log(`✅ Registered ${tools.length} tools`);

  // Register capabilities (needed for /api/capabilities endpoint)
  const reasoningCapability = new ReasoningCapability(llmProvider);
  const toolUseCapability = new ToolUseCapability(llmProvider);
  CapabilityRegistry.register(reasoningCapability);
  CapabilityRegistry.register(toolUseCapability);
  console.log('✅ Registered capabilities');

  try {
    // Start server
    const { app, server } = await startServer(llmProvider, tools, port);

    // Register patterns (after orchestrator is created in startServer)
    console.log('✅ Registered patterns');
    console.log('');
    console.log('📡 Available endpoints:');
    console.log(`   GET  http://localhost:${port}/api/patterns`);
    console.log(`   GET  http://localhost:${port}/api/capabilities`);
    console.log(`   GET  http://localhost:${port}/api/tools`);
    console.log(`   POST http://localhost:${port}/api/execute`);
    console.log('');
    console.log('💡 Example curl command:');
    console.log(`   curl http://localhost:${port}/api/patterns`);
    console.log('');
    console.log('   curl -X POST http://localhost:${port}/api/execute \\');
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d \'{"pattern": "react", "input": "Calculate 2+2"}\'');
    console.log('');
    console.log('✨ Server ready! Press Ctrl+C to stop.');

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.close(() => {
        console.log('👋 Server stopped');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
