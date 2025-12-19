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
import { NodeExecutionTool } from '../src/tools/node-execution';
import { PythonExecutionTool } from '../src/tools/python-execution';
import { ReActPattern } from '../src/patterns/react';
import { ReasoningCapability } from '../src/capabilities/reasoning';
import { ToolUseCapability } from '../src/capabilities/tool-use';
import { CapabilityRegistry } from '../src/capabilities/base';
import { LLMProvider, Tool } from '../src/types';
import { AgentOrchestrator } from '../src/orchestrator/orchestrator';
import { getConfig } from '../src/config';

export interface ServerSetupConfig {
  port?: number;
  provider?: 'mock' | 'openai';
}

export interface ServerSetup {
  llmProvider: LLMProvider;
  tools: Tool[];
  orchestrator: AgentOrchestrator;
  port: number;
  server: any; // HTTP server instance for cleanup
}

/**
 * Set up the server components (provider, tools, patterns) without starting
 * This is exportable for testing purposes
 */
export async function setupServer(config: ServerSetupConfig = {}): Promise<ServerSetup> {
  const appConfig = getConfig();
  const port = config.port || appConfig.server.port;
  const provider = config.provider || appConfig.llm.provider;

  // Set up LLM provider
  let llmProvider: LLMProvider;
  
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set in environment');
    }
    llmProvider = new OpenAIProvider();
  } else {
    llmProvider = new MockLLMProvider();
    // Set up some default mock responses that demonstrate the full flow
    (llmProvider as MockLLMProvider).setResponses([
      { 
        content: 'I need to calculate this expression.',
        toolCalls: [
          {
            id: 'call_1',
            name: 'calculator',
            arguments: { expression: '2+2' }
          }
        ],
        delayMs: 300 // Add delay to make thinking indicator visible
      },
      { 
        content: 'The calculation is complete. The answer is 4.',
        delayMs: 200
      }
    ]);
  }

  // Set up tools
  const calculatorTool = new CalculatorTool();
  const fileSystemTool = new FileSystemTool();
  const nodeExecutionTool = new NodeExecutionTool();
  const pythonExecutionTool = new PythonExecutionTool();
  const tools = [calculatorTool, fileSystemTool, nodeExecutionTool, pythonExecutionTool];

  // Register capabilities (needed for /api/capabilities endpoint)
  const capabilityRegistry = new CapabilityRegistry();
  const reasoningCapability = new ReasoningCapability(llmProvider);
  const toolUseCapability = new ToolUseCapability(llmProvider);
  capabilityRegistry.register(reasoningCapability);
  capabilityRegistry.register(toolUseCapability);

  // Create LLM config from app config
  const llmConfig = {
    provider: appConfig.llm.provider,
    model: appConfig.llm.model,
    temperature: appConfig.llm.temperature,
    maxTokens: appConfig.llm.maxTokens,
    stream: true
  };

  // Start server with LLM config
  const { orchestrator, server } = await startServer(llmProvider, tools, port, llmConfig);

  // Register patterns with the orchestrator
  const reactPattern = new ReActPattern(llmProvider);
  orchestrator.registerPattern(reactPattern);
  // Register IterativeRefinementPattern
  const { IterativeRefinementPattern } = await import('../src/patterns/iterative-refinement');
  const iterativePattern = new IterativeRefinementPattern(llmProvider);
  orchestrator.registerPattern(iterativePattern);
  // Register PlanAndValidatePattern
  const { PlanAndValidatePattern } = await import('../src/patterns/plan-and-validate');
  const planAndValidatePattern = new PlanAndValidatePattern(llmProvider);
  orchestrator.registerPattern(planAndValidatePattern);

  return { llmProvider, tools, orchestrator, port, server };
}

// Parse command line arguments
function parseArgs(): ServerSetupConfig {
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

  return {
    port: options['port'] ? parseInt(options['port']) : undefined,
    provider: options['provider'] as 'mock' | 'openai' | undefined
  };
}

async function main() {
  const config = parseArgs();
  
  console.log('🚀 Starting Agent Patterns API Server');
  console.log('=====================================');
  console.log(`Port: ${config.port || process.env.PORT || 3000}`);
  console.log(`Provider from config: ${config.provider}`);
  console.log(`Provider from env: ${process.env.LLM_PROVIDER}`);
  console.log(`Final provider: ${config.provider || process.env.LLM_PROVIDER || 'mock'}`);
  console.log('');
  console.log('');

  try {
    const { port, orchestrator, tools, server, llmProvider } = await setupServer(config);
    
    const actualProvider = config.provider || process.env.LLM_PROVIDER || 'mock';
    console.log(`✅ Using ${actualProvider} provider`);
    console.log(`✅ Registered ${tools.length} tools`);
    console.log('✅ Registered capabilities');
    console.log(`✅ Registered ${orchestrator.getPatterns().length} pattern(s)`);
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

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
