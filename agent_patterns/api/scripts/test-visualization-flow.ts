/**
 * Debug script to test visualization flow
 */

import { AgentOrchestrator } from '../src/orchestrator';
import { OpenAIProvider } from '../src/llm/openai';
import { ReActPattern } from '../src/patterns/react';
import { PythonExecutionTool } from '../src/tools/python-execution';
import * as dotenv from 'dotenv';

dotenv.config();

async function testVisualizationFlow() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found');
    process.exit(1);
  }

  const llm = new OpenAIProvider(apiKey);
  const orchestrator = new AgentOrchestrator(
    llm,
    [new PythonExecutionTool()],
    { provider: 'openai', model: 'gpt-4o-mini' }
  );

  orchestrator.registerPattern(new ReActPattern(llm));

  const prompt = `Create a bar chart showing Q1 2024 sales:
- January: $45,000
- February: $52,000  
- March: $48,000`;

  console.log('=== Testing Visualization Flow ===');
  console.log('Prompt:', prompt);
  console.log('\n=== Events ===\n');

  let hasVisualization = false;
  let usedPythonTool = false;

  for await (const event of orchestrator.executePattern('react', prompt)) {
    // Log key events
    if (event.eventType === 'step') {
      if (event.data.type === 'tool_call' && event.data.tool === 'python_execute') {
        console.log('✓ Python tool called');
        usedPythonTool = true;
      }
      
      if (event.data.type === 'tool_result') {
        console.log('Tool result:', JSON.stringify(event.data.content).substring(0, 200));
      }
    }

    // Check for visualizations
    if (event.visualizations) {
      console.log('\n✓✓✓ VISUALIZATION FOUND ✓✓✓');
      console.log('Visualization data:', JSON.stringify(event.visualizations, null, 2));
      hasVisualization = true;
    }

    // Log errors
    if (event.eventType === 'error' && event.data) {
      console.error('ERROR:', event.data);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Used Python tool:', usedPythonTool);
  console.log('Has visualization:', hasVisualization);
  
  if (!hasVisualization) {
    console.log('\n❌ VISUALIZATION NOT CAPTURED - This is the bug!');
  } else {
    console.log('\n✅ SUCCESS - Visualization properly captured');
  }
}

testVisualizationFlow().catch(console.error);
