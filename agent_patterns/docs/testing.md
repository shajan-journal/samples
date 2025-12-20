# Testing Guide

Comprehensive guide to testing the agent patterns system.

## Test Types

### Unit Tests
Test individual components in isolation.

```bash
npm run test:api
```

**Location:** `api/tests/`

**Examples:**
- Capability tests: `tests/capabilities/`
- Tool tests: `tests/tools/`
- Pattern tests: `tests/patterns/`

### Integration Tests
Test the complete system flow.

```bash
npm run test:orchestrator -- react "Calculate 2+2"
```

**Location:** `scripts/` (CLI helpers)

**Tests:**
- Server startup (`tests/integration/startup.test.ts`)
- Pattern execution
- Tool integration

### End-to-End Tests
Test through the HTTP API with real LLM.

```bash
# Requires OPENAI_API_KEY
npm run test:api -- --testPathPattern=llm-integration
```

**Location:** `tests/llm-integration/`

**Tests:**
- Real API calls
- Tool selection
- Visualization generation

### UI Tests
Test React components.

```bash
npm run test:ui
```

**Location:** `ui/__tests__/`

## Running Tests

### All Tests
```bash
npm run test:all
```

### API Tests Only
```bash
npm run test:api

# With specific pattern
npm run test:api -- tests/patterns/react.test.ts

# Watch mode
npm run test:api -- --watch
```

### UI Tests Only
```bash
npm run test:ui
```

### Specific Test File
```bash
npm run test:api -- tests/capabilities/tool-use.test.ts
```

### With Coverage
```bash
npm run test:api -- --coverage
```

## Test Helpers

The project provides helpers to simplify integration testing.

### Setup Orchestrator

```typescript
import { createTestOrchestrator } from '../helpers/llm-integration-helpers';

describe('My Test', () => {
  it('should work', async () => {
    const orchestrator = createTestOrchestrator();
    // Use orchestrator...
  });
});
```

### Execute and Collect Events

```typescript
import { executeAndCollect } from '../helpers/llm-integration-helpers';

it('should execute pattern', async () => {
  const orchestrator = createTestOrchestrator();
  const result = await executeAndCollect(
    orchestrator, 
    'react', 
    'Calculate 2+2',
    { workspaceDir: './test-workspace' }
  );
});
```

### Assert Results

```typescript
import { assertions } from '../helpers/llm-integration-helpers';

it('should use calculator', async () => {
  const result = await executeAndCollect(...);
  
  expect(assertions.usedTool(result, 'calculator')).toBe(true);
  expect(assertions.completedSuccessfully(result)).toBe(true);
  expect(assertions.hasVisualizations(result)).toBe(false);
});
```

### Conditional Tests (API Key)

```typescript
import { describeIfApiKey } from '../helpers/llm-integration-helpers';

describeIfApiKey('With OpenAI', () => {
  it('should call real LLM', async () => {
    // Only runs if OPENAI_API_KEY is set
  });
});
```

## Writing Tests

### Basic Pattern Test

```typescript
import { ReActPattern } from '../../src/patterns/react';
import { createTestOrchestrator } from '../helpers/llm-integration-helpers';

describe('ReAct Pattern', () => {
  it('should solve a problem', async () => {
    const orchestrator = createTestOrchestrator();
    
    const events = [];
    for await (const event of orchestrator.execute('react', 'Calculate 2+2')) {
      events.push(event);
    }
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].eventType).toBe('complete');
  });
});
```

### Tool Test

```typescript
import { CalculatorTool } from '../../src/tools/calculator';

describe('Calculator Tool', () => {
  it('should calculate 2+2', async () => {
    const tool = new CalculatorTool();
    const result = await tool.execute({ expression: '2+2' });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ expression: '2+2', result: 4 });
  });
});
```

### Pattern Composition Test

```typescript
describe('Pattern Composition', () => {
  it('should use correct capabilities', async () => {
    const orchestrator = createTestOrchestrator();
    const events = await executeAndCollect(
      orchestrator,
      'react',
      'Do something'
    );
    
    // Verify it used reasoning
    expect(events.some(e => e.data?.capability === 'reasoning')).toBe(true);
    
    // Verify it used tool use
    expect(events.some(e => e.data?.capability === 'tool_use')).toBe(true);
    
    // Verify it synthesized answer
    expect(events.some(e => e.eventType === 'answer')).toBe(true);
  });
});
```

## Test Coverage

View coverage report:

```bash
npm run test:api -- --coverage
```

Current coverage targets:
- Capabilities: >90%
- Tools: >85%
- Patterns: >80%
- Utilities: >75%

## Debugging Tests

### Verbose Output

```bash
npm run test:api -- --verbose
```

### Single Test

```bash
npm run test:api -- -t "should calculate"
```

### Debug Mode

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

### Print Events

```typescript
const result = await executeAndCollect(...);
console.log(JSON.stringify(result.events, null, 2));
```

## Troubleshooting Tests

### Tests Timeout
- Increase timeout: `jest.setTimeout(30000)`
- Check for infinite loops in code
- Verify LLM API is responsive

### API Key Not Found
- Set `OPENAI_API_KEY` environment variable
- Tests with `describeIfApiKey` will skip gracefully

### Files Not Found
- Verify workspace directory exists
- Check path is relative to project root
- Use `path.resolve()` for absolute paths

### Mock LLM Issues
- Mock provider doesn't call real APIs
- Check mock responses in `api/src/llm/mock.ts`
- Use OpenAI provider for real LLM tests

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:all
```

## Performance Testing

Test execution speed:

```bash
npm run test:api -- --detectOpenHandles
```

Check for memory leaks:

```bash
npm run test:api -- --detectLeaks
```
