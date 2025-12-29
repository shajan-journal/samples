#!/usr/bin/env node
/**
 * Test script for different agentic patterns
 * 
 * Usage: npx tsx scripts/test-patterns.ts [pattern]
 * 
 * Available patterns:
 *   - react: ReAct (Reasoning + Acting) pattern
 *   - plan-execute: Plan and Execute pattern
 *   - routing: Routing pattern
 *   - parallel: Parallel Processing pattern
 *   - evaluator-optimizer: Evaluator-Optimizer pattern
 *   - orchestrator-worker: Orchestrator-Worker pattern
 */

const BASE_URL = 'http://localhost:3001';

async function testReAct() {
  console.log('\n🔄 Testing ReAct Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'What is the weather in San Francisco? Also calculate 25 * 4 + 100',
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testPlanExecute() {
  console.log('\n📋 Testing Plan and Execute Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/plan-execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Write a comprehensive guide on getting started with TypeScript',
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testRouting() {
  console.log('\n🔀 Testing Routing Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/routing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'Calculate the compound interest on $1000 at 5% for 3 years',
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testParallel() {
  console.log('\n⚡ Testing Parallel Processing Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/parallel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `The new AI SDK 6.0 release brings significant improvements to the developer experience. 
      With the introduction of the ToolLoopAgent class, building agents is now simpler than ever. 
      The SDK supports multiple providers and offers excellent TypeScript support. 
      However, migration from previous versions may require some effort.`,
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testEvaluatorOptimizer() {
  console.log('\n✨ Testing Evaluator-Optimizer Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/evaluator-optimizer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Write a haiku about programming',
      qualityThreshold: 7,
      maxIterations: 2,
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testOrchestratorWorker() {
  console.log('\n👷 Testing Orchestrator-Worker Pattern...\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns/orchestrator-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Create a blog post about the benefits of using AI in software development',
    }),
  });
  
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function listPatterns() {
  console.log('\n📋 Available Patterns:\n');
  
  const response = await fetch(`${BASE_URL}/api/patterns`);
  const result = await response.json();
  
  for (const pattern of result.patterns) {
    console.log(`  ${pattern.id}:`);
    console.log(`    Name: ${pattern.name}`);
    console.log(`    Description: ${pattern.description}`);
    console.log(`    Endpoint: ${pattern.endpoint}`);
    console.log('');
  }
}

async function main() {
  const pattern = process.argv[2];
  
  try {
    switch (pattern) {
      case 'react':
        await testReAct();
        break;
      case 'plan-execute':
        await testPlanExecute();
        break;
      case 'routing':
        await testRouting();
        break;
      case 'parallel':
        await testParallel();
        break;
      case 'evaluator-optimizer':
        await testEvaluatorOptimizer();
        break;
      case 'orchestrator-worker':
        await testOrchestratorWorker();
        break;
      case 'list':
        await listPatterns();
        break;
      case 'all':
        await listPatterns();
        await testReAct();
        await testRouting();
        await testParallel();
        await testEvaluatorOptimizer();
        await testPlanExecute();
        await testOrchestratorWorker();
        break;
      default:
        console.log('Usage: npx tsx scripts/test-patterns.ts [pattern]');
        console.log('\nAvailable patterns:');
        console.log('  react              - ReAct (Reasoning + Acting) pattern');
        console.log('  plan-execute       - Plan and Execute pattern');
        console.log('  routing            - Routing pattern');
        console.log('  parallel           - Parallel Processing pattern');
        console.log('  evaluator-optimizer - Evaluator-Optimizer pattern');
        console.log('  orchestrator-worker - Orchestrator-Worker pattern');
        console.log('  list               - List all available patterns');
        console.log('  all                - Run all pattern tests');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\nMake sure the API server is running: npm run dev');
  }
}

main();
