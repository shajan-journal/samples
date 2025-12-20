# LLM Integration Test Helpers

This directory contains test helpers that simplify writing integration tests for the agent patterns system.

## Overview

Integration tests with real LLM APIs can be verbose and repetitive. The helpers in this directory provide:

1. **Easy orchestrator setup** - Create fully-configured orchestrators with one function call
2. **Event collection** - Automatically collect and categorize execution events
3. **Common assertions** - Pre-built assertions for typical test scenarios
4. **API key handling** - Graceful test skipping when API keys aren't available

## Quick Start

### Basic Test Structure

```typescript
import {
  createTestOrchestrator,
  executeAndCollect,
  assertions,
  describeIfApiKey
} from '../helpers/llm-integration-helpers';

describeIfApiKey('My Integration Test', () => {
  const orchestrator = createTestOrchestrator();
  
  it('should do something', async () => {
    const result = await executeAndCollect(orchestrator, 'react', 'test prompt');
    
    expect(assertions.usedCodeTool(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);
});
```

### Before Refactoring (38 lines)

```typescript
import { AgentOrchestrator } from '../../src/orchestrator/orchestrator';
import { OpenAIProvider } from '../../src/llm/openai';
import { ReActPattern } from '../../src/patterns/react';
import { NodeExecutionTool } from '../../src/tools/node-execution';
import { PythonExecutionTool } from '../../src/tools/python-execution';

const hasApiKey = !!process.env.OPENAI_API_KEY;
const describeIfApiKey = hasApiKey ? describe : describe.skip;

describeIfApiKey('Tool Selection', () => {
  let orchestrator: AgentOrchestrator;

  beforeAll(() => {
    if (!hasApiKey) return;
    
    const llm = new OpenAIProvider(process.env.OPENAI_API_KEY!);
    orchestrator = new AgentOrchestrator(
      llm,
      [new NodeExecutionTool(), new PythonExecutionTool()],
      { provider: 'openai', model: 'gpt-4o-mini' }
    );
    orchestrator.registerPattern(new ReActPattern(llm));
  });

  it('should use code tool', async () => {
    const events = [];
    let toolsUsed = [];
    
    for await (const event of orchestrator.executePattern('react', 'test')) {
      events.push(event);
      if (event.eventType === 'step' && event.data.type === 'tool_call') {
        if (event.data.tool) toolsUsed.push(event.data.tool);
      }
    }
    
    const usedCodeTool = toolsUsed.some(t => t === 'node_execute' || t === 'python_execute');
    expect(usedCodeTool).toBe(true);
  }, 60000);
});
```

### After Refactoring (13 lines)

```typescript
import {
  createTestOrchestrator,
  executeAndCollect,
  assertions,
  describeIfApiKey
} from '../helpers/llm-integration-helpers';

describeIfApiKey('Tool Selection', () => {
  const orchestrator = createTestOrchestrator();
  
  it('should use code tool', async () => {
    const result = await executeAndCollect(orchestrator, 'react', 'test');
    expect(assertions.usedCodeTool(result)).toBe(true);
  }, 60000);
});
```

**Result**: 65% reduction in code, much clearer intent.

## API Reference

### Setup Functions

#### `createTestOrchestrator(options?)`
Creates an orchestrator configured for integration testing.

```typescript
const orchestrator = createTestOrchestrator({
  apiKey: 'custom-key',           // Default: process.env.OPENAI_API_KEY
  model: 'gpt-4',                 // Default: 'gpt-4o-mini'
  tools: [customTool1, customTool2], // Default: [NodeExecution, PythonExecution]
  patterns: ['react']             // Default: all patterns
});
```

#### `createFullOrchestrator(apiKey?)`
Creates an orchestrator with all available tools.

```typescript
const orchestrator = createFullOrchestrator();
// Includes: NodeExecution, PythonExecution, Calculator, FileSystem
```

### Execution Functions

#### `executeAndCollect(orchestrator, patternName, prompt)`
Executes a pattern and collects all events with metadata.

```typescript
const result = await executeAndCollect(orchestrator, 'react', 'Calculate 2+2');
// Returns: EventCollector with events, toolsUsed, visualizations, capabilities, errors
```

### Assertions

All assertions return boolean values for use with `expect()`.

```typescript
assertions.usedCodeTool(result)              // Used node_execute or python_execute
assertions.usedTool(result, 'calculator')    // Used specific tool
assertions.hasVisualizations(result)         // Generated visualizations
assertions.usedCapability(result, 'reasoning') // Used specific capability
assertions.completedSuccessfully(result)     // No errors, completed normally
assertions.hasMinimumSteps(result, 5)        // At least N steps executed
```

### Utility Functions

#### `describeIfApiKey(name, fn)`
Conditional test suite that skips if OPENAI_API_KEY is not set.

```typescript
describeIfApiKey('My Tests', () => {
  // Tests here will skip gracefully without API key
});
```

#### `getFinalAnswer(result)`
Extracts the final answer from execution events.

```typescript
const answer = getFinalAnswer(result);
expect(answer).toContain('4');
```

#### `getExecutionTiming(result)`
Gets timing information for performance tests.

```typescript
const timing = getExecutionTiming(result);
expect(timing.duration).toBeLessThan(30000); // 30 seconds
```

## EventCollector Structure

The `executeAndCollect` function returns an `EventCollector` with:

```typescript
{
  events: ExecutionEvent[],      // All execution events
  toolsUsed: string[],           // Unique tool names used
  visualizations: any[],         // Visualization manifests generated
  capabilities: string[],        // Unique capabilities invoked
  errors: any[]                  // Any errors encountered
}
```

## Best Practices

### 1. Use Descriptive Test Names

```typescript
it('should use calculator for mathematical operations', async () => {
  // Test code
});
```

### 2. Set Appropriate Timeouts

LLM calls can be slow. Set realistic timeouts:

```typescript
it('complex task', async () => {
  // Test code
}, 90000); // 90 seconds for complex tasks
```

### 3. Test One Behavior Per Test

```typescript
// Good
it('should use code tool', async () => { ... });
it('should complete successfully', async () => { ... });

// Avoid
it('should use code tool and complete successfully and use reasoning', async () => { ... });
```

### 4. Use Selective Pattern Registration

Only register patterns you need:

```typescript
const orchestrator = createTestOrchestrator({
  patterns: ['react'] // Only test ReAct pattern
});
```

### 5. Group Related Tests

```typescript
describeIfApiKey('Code Execution', () => {
  describe('with JavaScript', () => { ... });
  describe('with Python', () => { ... });
});
```

## Testing Strategies

### Unit Tests (mocked LLM)
- Fast, no API costs
- Test code logic and structure
- Use `MockLLMProvider`
- Location: `tests/*/` (patterns, capabilities, tools)

### LLM Integration Tests (real API)
- Verify actual LLM behavior
- Test tool selection, reasoning quality
- Require API key
- Location: `tests/llm-integration/`

### When to Use Each

| Scenario | Test Type |
|----------|-----------|
| Code path coverage | Unit |
| Error handling | Unit |
| LLM tool selection | Integration |
| Visualization generation | Integration |
| End-to-end workflow | Integration |
| Performance benchmarks | Integration |

## Running Tests

```bash
# Run all LLM integration tests
npm run test:llm-integration

# Run specific test file
npx jest --testPathPattern=llm-integration/tool-selection

# Run with verbose output
npx jest --testPathPattern=llm-integration --verbose

# Run single test
npx jest -t "should use code generation tool with ReAct pattern"
```

## Environment Setup

Tests automatically load `.env` file. Create one with:

```bash
# api/.env
OPENAI_API_KEY=sk-...
```

Tests will skip gracefully if the key is missing.

## Examples

See existing test files for examples:
- `tool-selection.test.ts` - Basic tool usage verification
- `visualization.test.ts` - Visualization generation testing

## Contributing

When adding new integration tests:

1. Use the helpers to reduce boilerplate
2. Add new assertions to `llm-integration-helpers.ts` if needed
3. Document new patterns in this README
4. Ensure tests skip gracefully without API keys

## Troubleshooting

### Tests are skipped
- Check that `OPENAI_API_KEY` is set in `.env`
- Verify dotenv is loading: You should see `[dotenv] injecting env` in output

### Tests timeout
- Increase timeout: `}, 120000);` for 2 minutes
- Check API rate limits
- Verify network connectivity

### Unexpected tool usage
- Check the prompt wording
- Review debug output with `--verbose`
- Verify tool descriptions are clear

### Assertions fail unexpectedly
- Use `console.log(result)` to inspect the EventCollector
- Check `result.errors` for execution errors
- Verify the pattern completed: `result.events[last].eventType === 'complete'`
