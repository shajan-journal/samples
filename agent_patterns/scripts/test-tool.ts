#!/usr/bin/env node
/**
 * Manual test script for tools
 * Usage: npm run test:tool -- <tool_name> <params_json>
 * Examples:
 *   npm run test:tool -- calculator '{"expression":"2+2"}'
 *   npm run test:tool -- file_system '{"action":"write","path":"test.txt","content":"Hello"}'
 */

import { CalculatorTool, FileSystemTool } from '../src/tools';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: test-tool <tool_name> <params_json>');
    console.error('Examples:');
    console.error('  test-tool calculator \'{"expression":"2+2"}\'');
    console.error('  test-tool file_system \'{"action":"list","path":"."}\'');
    process.exit(1);
  }

  const toolName = args[0];
  const paramsJson = args[1];

  let params: Record<string, any>;
  try {
    params = JSON.parse(paramsJson);
  } catch (error) {
    console.error('Invalid JSON parameters:', paramsJson);
    process.exit(1);
  }

  console.log(`\n=== Testing ${toolName} ===`);
  console.log('Parameters:', JSON.stringify(params, null, 2));
  console.log('\n--- Executing ---');

  let tool;
  switch (toolName) {
    case 'calculator':
      tool = new CalculatorTool();
      break;
    case 'file_system':
      tool = new FileSystemTool();
      break;
    default:
      console.error(`Unknown tool: ${toolName}`);
      console.error('Available tools: calculator, file_system');
      process.exit(1);
  }

  try {
    const result = await tool.execute(params);
    
    console.log('\n--- Result ---');
    if (result.success) {
      console.log('✓ Success');
      console.log('Data:', JSON.stringify(result.data, null, 2));
      if (result.metadata) {
        console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
      }
    } else {
      console.log('✗ Error');
      console.log('Error:', result.error);
      if (result.metadata) {
        console.log('Metadata:', JSON.stringify(result.metadata, null, 2));
      }
    }
  } catch (error) {
    console.error('\n--- Unexpected Error ---');
    console.error(error);
    process.exit(1);
  }
}

main();
