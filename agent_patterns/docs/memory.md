# Agent Patterns Project - Developer Memory

## Project Overview
TypeScript/Node.js project exploring agentic AI patterns through composable capabilities. Focus on learning and experimentation, not production-grade implementation.

## Current Status (Step 8/13 Complete)
- ✅ Core types and contracts
- ✅ Basic tools (Calculator, FileSystem)
- ✅ LLM providers (Mock, OpenAI)
- ✅ Capabilities (Reasoning, ToolUse, Synthesis)
- ✅ Patterns (ReAct)
- ✅ Orchestrator (AgentOrchestrator)
- ✅ API Layer (Express + SSE)
- ✅ UI Layer (Next.js chat, SSE streaming)

**Tests:** 167 passing across core/API + 2 passing in UI (Vitest)

## Code Organization

### Directory Structure
```
/api                    # Backend workspace
  /src
    /capabilities/      # Agent skills (reasoning, tool-use, etc.)
      base.ts          # BaseCapability abstract class + CapabilityRegistry
      reasoning.ts     # LLM-based logical reasoning
      tool-use.ts      # Execute tools based on LLM decisions
      synthesis.ts     # Combines information into coherent conclusions
      index.ts         # Exports
      
    /patterns/         # Orchestrated workflows
      base.ts          # BasePattern abstract class + PatternRegistry
      react.ts         # Reasoning + Acting loop pattern
      index.ts         # Exports
      
    /tools/            # External functions
      base.ts          # BaseTool abstract class + ToolRegistry
      calculator.ts    # Math calculations with security
      file-system.ts   # File ops in sandboxed workspace
      index.ts         # Exports
      
    /llm/              # LLM provider abstractions
      base.ts          # BaseLLMProvider + LLMProviderRegistry
      mock.ts          # MockLLMProvider for testing
      openai.ts        # OpenAIProvider with streaming
      index.ts         # Exports
      
    /orchestrator/     # Main execution engine
      orchestrator.ts  # AgentOrchestrator class
      index.ts         # Exports
      
    /api/              # HTTP API layer
      server.ts        # Express server setup
      routes.ts        # API endpoints
      middleware.ts    # Logging and error handling
      index.ts         # Exports
      
    types.ts           # All TypeScript interfaces
    config.ts          # Environment variable management

  /scripts/            # CLI test utilities
    test-tool.ts       # Test individual tools
    test-llm.ts        # Test LLM providers
    test-capability.ts # Test capabilities
    test-pattern.ts    # Test patterns
    test-orchestrator.ts # Test orchestrator
    start-api.ts       # Start API server

  /tests/              # Mirrors /src structure
    capabilities/
    patterns/
    tools/
    llm/
    types.test.ts

  package.json
  tsconfig.json
  jest.config.js
  .env / .env.example

/ui                    # Frontend workspace (Next.js)
  /app                 # Next.js app router
  /lib                 # UI utilities (SSE, etc.)
  /__tests__           # Vitest tests
  package.json
  tsconfig.json
  vitest.config.ts

/docs/                 # Documentation
  prd.md            # Product requirements
  architecture.md   # Technical design
  scenario.md       # Use cases and tools
  current_state.md  # Implementation progress
  memory.md         # This file

/workspace/            # Sandboxed directory for file operations

package.json          # Workspace root configuration
```

## Key Design Patterns

### 1. Abstract Base Classes with Registries
**Pattern:** All major components (Tools, Capabilities, Patterns, LLM Providers) follow this structure:
- Abstract base class with common functionality
- Instance-based registry for managing implementations
- Consistent naming: `Base*` and `*Registry`

**Example:**
```typescript
// Base class
export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract execute(params): Promise<ToolResult>;
  
  // Helper methods
  protected success(data): ToolResult { ... }
  protected error(message): ToolResult { ... }
}

// Registry (instance, not static)
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  register(tool: Tool): void { ... }
  get(name: string): Tool | undefined { ... }
}
```

### 2. Constructor Injection for Dependencies
**Pattern:** Capabilities and Patterns receive LLMProvider in constructor:

```typescript
export class ReasoningCapability extends BaseCapability {
  private llmProvider: LLMProvider;
  
  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }
}
```

### 3. AsyncGenerator for Streaming
**Pattern:** Patterns return `AsyncGenerator<PatternStep>` for progressive output:

```typescript
async *execute(input: string, context: AgentContext): AsyncGenerator<PatternStep> {
  yield this.createStep('result', 'Starting...');
  // ... work ...
  yield this.createStep('tool_call', 'Calling tool...');
  // ... more work ...
}
```

### 4. Result Objects with Success/Error States
**Pattern:** Tools and Capabilities return structured results:

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

interface CapabilityResult {
  output: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  nextAction?: string;
  metadata?: Record<string, any>;
}
```

## Critical Implementation Details

### Import Conventions
**IMPORTANT:** Do NOT use `.js` extensions in imports
```typescript
// ✅ Correct
import { BaseTool } from './base';
import { AgentContext } from '../types';

// ❌ Wrong - causes test failures
import { BaseTool } from './base.js';
```

### LLM Provider Usage
**Pattern:** Capabilities interact with LLM through streaming:

```typescript
// For content only
const stream = this.llmProvider.chat(messages, config);
const { content, usage } = await this.collectStreamContent(stream);

// For content + tool calls
const stream = this.llmProvider.chatWithTools(messages, tools, config);
const { content, toolCalls } = await this.collectStreamWithToolCalls(stream);
```

### Mock Provider Setup for Tests
**Pattern:** Use `setResponses([...])` not `setMockResponse(...)`:

```typescript
beforeEach(() => {
  mockProvider = new MockLLMProvider();
  capability = new SomeCapability(mockProvider);
});

test('should work', async () => {
  mockProvider.setResponses([
    { content: 'Response 1' },
    { content: 'Response 2', toolCalls: [...] }
  ]);
  // ... test code ...
});
```

### Error Handling Convention
**Pattern:** BaseCapability.error() puts message in `reasoning` field, not `output`:

```typescript
// In capability
return this.error('Something went wrong');

// In test
expect(result.reasoning).toContain('Something went wrong');
expect(result.metadata?.error).toBe(true);
```

### File System Security
**Key:** All file operations are sandboxed to `WORKSPACE_DIR`:
- Paths are normalized and validated
- Directory traversal (`../`) is blocked
- Defaults to `./workspace` relative to project root

### Calculator Security
**Key:** Expression evaluation uses Function constructor, not eval():
- Blocks dangerous patterns (require, import, process, etc.)
- Allows math functions and constants
- Safe for user input

## Type System Overview

### Core Interfaces (src/types.ts)

```typescript
// Messages
Message { role, content, name?, toolCallId? }

// Tools
Tool { name, description, parameters, execute() }
ToolCall { id, name, arguments }
ToolResult { success, data?, error?, metadata? }

// Capabilities
Capability { name, description, execute() }
AgentContext { messages, tools, config, state? }
CapabilityResult { output, toolCalls?, reasoning?, nextAction?, metadata? }

// Patterns
AgentPattern { name, description, execute() }
PatternStep { type, capability?, tool?, content, metadata?, timestamp? }

// LLM
LLMProvider { chat(), chatWithTools() }
LLMChunk { type, content?, toolCall?, usage?, finishReason? }
LLMConfig { provider, model, temperature?, maxTokens?, stream?, apiKey? }
```

## Testing Approach

### Test Structure
- Tests mirror src/ structure exactly
- Each component has comprehensive unit tests
- Use MockLLMProvider for deterministic testing
- Test scripts allow manual testing with real APIs

### Running Tests
```bash
# From root (workspace)
npm run test:all          # All tests (both workspaces)
npm run test:api          # API tests (Jest)
npm run test:ui           # UI tests (Vitest)

# From api/ directory (if working in API workspace)
npm test                  # All API tests
npm test -- <filename>    # Specific test file (Jest)
npm run test:watch        # Watch mode (Jest)

# UI (Next.js) tests
cd ui && npm test           # Vitest run (non-watch)
cd ui && npm run test:watch # Vitest watch

# Manual testing (from api/ directory)
npm run test:tool -- calculator "2+2"
npm run test:llm -- openai "Hello"
npm run test:capability -- reasoning "What is 2+2?"
npm run test:pattern -- react "Calculate factorial of 5"
npm run test:orchestrator -- react "What is sqrt(144)?" --debug

# Start API server (from root)
npm run dev:api  # Starts on port 3000 by default
```

### Test Organization
- `describe()` blocks organize by feature area
- Each test is self-contained
- Mock providers reset between tests
- All 170 core/API tests pass; UI has 2 passing Vitest specs

## Configuration Management

### Environment Variables (api/src/config.ts)
```typescript
WORKSPACE_DIR    # Default: ./workspace (relative to repo root)
LLM_PROVIDER     # Default: mock
LLM_API_KEY      # Required for OpenAI
LLM_MODEL        # Default: gpt-4
LLM_TEMPERATURE  # Default: 0.7
LLM_MAX_TOKENS   # Default: 2000
PORT             # Default: 3000
```

Configuration file: `api/.env` (copy from `api/.env.example`)
All have sensible defaults; project works without `.env` file.

## Implementation Status Detail

### Completed Components

**Tools (2/2):**
- ✅ CalculatorTool: Math with security (54 tests)
- ✅ FileSystemTool: CRUD in workspace (31 tests)

**LLM Providers (2/3):**
- ✅ MockLLMProvider: Testing (24 tests)
- ✅ OpenAIProvider: Real API (8 tests)
- ⏳ AnthropicProvider: Not started

**Capabilities (2/12):**
- ✅ ReasoningCapability: Logical inference (12 tests)
- ✅ ToolUseCapability: Execute tools (10 tests)
- ⏳ PlanningCapability: Not started
- ⏳ ReflectionCapability: Not started
- ⏳ CritiqueCapability: Not started
- ⏳ MemoryCapability: Not started
- ⏳ Others: Not started

**Patterns (1/12):**
- ✅ ReActPattern: Reasoning + Acting (12 tests)
- ⏳ Plan-and-Execute: Not started
- ⏳ Reflection: Not started
- ⏳ Others: Not started

**Orchestrator (1/1):**
- ✅ AgentOrchestrator: Unified execution engine (17 tests)
  - Pattern registration and execution
  - Streaming ExecutionEvents
  - Options: maxSteps, timeout, debug, visualizations
  - Error handling and recovery

**UI (1/1):**
- ✅ Next.js chat UI with SSE streaming, pattern selector, chat bubbles, and live event log (2 Vitest tests)

### Next Steps (in order)
1. ~~**Orchestrator**~~ ✅ COMPLETE - Entry point managing pattern execution
2. ~~**API Layer**~~ ✅ COMPLETE - Express server with SSE streaming
3. **UI Layer** - Next.js chat interface
4. **More Patterns** - Plan-Execute, Reflection, etc.
5. **More Capabilities** - Planning, Critique, etc.

## Common Patterns and Idioms

### Adding a New Tool
1. Create `/api/src/tools/new-tool.ts`
2. Extend `BaseTool`
3. Implement required methods
4. Create `/api/tests/tools/new-tool.test.ts`
5. Export from `/api/src/tools/index.ts`
6. Register in test scripts if needed

### Adding a New Capability
1. Create `/api/src/capabilities/new-capability.ts`
2. Extend `BaseCapability`
3. Accept `LLMProvider` in constructor
4. Use `collectStreamContent()` or `collectStreamWithToolCalls()`
5. Return via `this.success()` or `this.error()`
6. Create comprehensive tests
7. Export from index

### Adding a New Pattern
1. Create `/api/src/patterns/new-pattern.ts`
2. Extend `BasePattern`
3. Accept `LLMProvider` in constructor
4. Instantiate needed capabilities with provider
5. Use `async *execute()` with AsyncGenerator
6. Yield steps via helper methods
7. Create tests with mock provider
8. Add to test script

### Using the Orchestrator
The orchestrator is the entry point for executing any registered pattern:

```typescript
import { AgentOrchestrator } from './orchestrator/orchestrator';
import { ReActPattern } from './patterns/react';

// Create orchestrator with LLM provider and tools
const orchestrator = new AgentOrchestrator(llmProvider, tools);

// Register patterns
const reactPattern = new ReActPattern(llmProvider);
orchestrator.registerPattern(reactPattern);

// Execute pattern with streaming
for await (const event of orchestrator.executePattern('react', input, options)) {
  // Handle ExecutionEvent
  // event.eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization'
}
```

Note: All imports are relative to `api/src/` when working in the API workspace.

**Event Types:**
- `start` - Execution begins
- `step` - Progress update (capability/tool_call/result/error)
- `complete` - Execution finished successfully
- `error` - Execution failed
- `visualization` - Visualization data available

**Options:**
- `maxSteps` - Maximum execution steps (default: 1000)
- `timeout` - Execution timeout in ms (optional)
- `debug` - Include debug info (default: false)
- `visualizations` - Enable visualization output (default: false)

## Key Files to Reference

- **types.ts** - All interfaces, single source of truth
- **base classes** - Common functionality in capabilities/base.ts, patterns/base.ts, tools/base.ts
- **current_state.md** - Implementation progress and details
- **architecture.md** - Overall system design
- **test files** - Show correct usage patterns

## Gotchas and Pitfalls

1. **Don't use .js extensions** in imports
2. **Registry is STATIC** - Use `PatternRegistry.register()` not instance methods (updated in Step 6)
3. **Mock provider API** - `setResponses([...])` takes array
4. **Error messages** - Check `reasoning` field, not `output`
5. **Async generators** - Must use `for await` or manual iteration
6. **Tool validation** - Always validate params before execution
7. **Constructor injection** - Capabilities need LLMProvider passed in
8. **File paths** - Use absolute paths in config and relative in workspace
9. **PatternRegistry cleanup** - Call `PatternRegistry.clear()` in test `beforeEach` blocks

## Useful Commands Reference

```bash
# Development
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test            # Run all tests
npm run test:watch  # Watch mode

# Testing individual components
npm run test:tool -- calculator "2+2"
npm run test:llm -- mock "Hello"
npm run test:capability -- reasoning "Think about X"
npm run test:pattern -- react "Do task X"
npm run test:orchestrator -- react "Calculate sqrt(144)" --debug

# With options
npm run test:pattern -- react "Calculate 10!" --provider=openai --max-iterations=5
npm run test:orchestrator -- react "Complex task" --provider=openai --max-steps=20 --timeout=30000

# Environment
cp .env.example .env   # Create config
code .env              # Edit settings
```

## Quick Reference: File Locations

Need to add/modify:
- New tool: `src/tools/` + `tests/tools/`
- New capability: `src/capabilities/` + `tests/capabilities/`
- New pattern: `src/patterns/` + `tests/patterns/`
- Orchestrator: `src/orchestrator/` + `tests/orchestrator/`
- Types: `src/types.ts`
- Config: `src/config.ts` and `.env.example`
- Docs: `docs/*.md`
- Test scripts: `scripts/test-*.ts`

## Project Philosophy

1. **Simplicity over complexity** - Clear, readable code
2. **Testing is essential** - Every component has tests
3. **Composability** - Build complex from simple pieces
4. **Learning-focused** - Not production-ready, but educational
5. **TypeScript-first** - Strong typing catches errors early
6. **Stream by default** - Progressive output for better UX

---

**Last Updated:** Step 5 completed - ReAct pattern with ToolUse capability
**Total Tests:** 143 passing
**Next Milestone:** Orchestrator implementation
