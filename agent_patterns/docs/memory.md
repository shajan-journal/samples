# Agent Patterns Project - Developer Memory

## Project Overview
TypeScript/Node.js project exploring agentic AI patterns through composable capabilities. Focus on learning and experimentation, not production-grade implementation.

## Current Status (Step 11 Complete, Step 12 Planning)
- ✅ Core types and contracts
- ✅ Basic tools (Calculator, FileSystem)
- ✅ Code execution tools (NodeExecution, PythonExecution)
- ✅ LLM providers (Mock, OpenAI)
- ✅ Capabilities (Reasoning, ToolUse, Synthesis, Validation)
- ✅ Patterns (ReAct, IterativeRefinement, PlanAndValidate)
- ✅ Orchestrator (AgentOrchestrator)
- ✅ API Layer (Express + SSE)
- ✅ UI Layer (Next.js chat with split-panel debug view)
- ✅ Refactoring (Error analysis, iteration state, pattern utils, conversation management)
- ✅ Self-correcting patterns (IterativeRefinement, PlanAndValidate)
- ✅ Multi-turn conversations with context retention

**Tests:** 311 passing (17 test suites)
**Next Phase:** Visualization Support (see [next_step.md](next_step.md))

## Code Organization

### Directory Structure
```
/api                    # Backend workspace
  /src with algorithmic detection
      tool-use.ts      # Execute tools based on LLM decisions
      synthesis.ts     # Combines information into coherent conclusions
      validation.ts    # Validates outputs against criteria
      index.ts         # Exports
      
    /patterns/         # Orchestrated workflows
      base.ts          # BasePattern abstract class + PatternRegistry
      react.ts         # Reasoning + Acting loop pattern
      iterative-refinement.ts  # Generate → validate → refine loop
      plan-and-validate.ts     # Plan → execute → validate
    /patterns/         # Orchestrated workflows
      base.ts          # BasePattern abstract class + PatternRegistry
      react.ts         # Reasoning + Acting loop pattern
      utils.ts         # Shared pattern utilities (completion detection, convergence)
      index.ts         # Exports
      
    /tools/            # External functions
      base.ts          # BaseTool abstract class + ToolRegistry
      calculator.ts    # Math calculations with security
      file-system.ts   # File ops in sandboxed workspace
      node-execution.ts # Execute JavaScript/Node.js code in vm sandbox
      python-execution.ts # Execute Python code in subprocess
      index.ts         # Exports
      
    /llm/              # LLM provider abstractions
      base.ts          # BaseLLMProvider + LLMProviderRegistry
      mock.ts          # MockLLMProvider for testing
      openai.ts        # OpenAIProvider with streaming
      index.ts         # Exports
      
      # Planned for Step 12:
      # file-parser.ts        # CSV/JSON parsing
      # visualization-validator.ts  # Manifest validation
      # workspace-manager.ts  # Centralized file operations
    /utils/            # Shared utilities
      error-analysis.ts # Error categorization and analysis
      conversation.ts   # Conversation management and pruning
      
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
    orchestrator/
    api/
    utils/
    integration/
    start-api.ts       # Start API server

  /tests/              # Mirrors /src structure
    capabilities/
    patterns/
    page.tsx           # Main chat interface with split-panel layout
    layout.tsx
    globals.css
  /lib                 # UI utilities (SSE, etc.)
    sse.ts             # Server-Sent Events client
    # Planned for Step 12:
    # /visualizations/ # Chart components
    llm/   # Product requirements
  architecture.md      # Technical design
  scenario.md          # Use cases and tools
  current_state.md     # Implementation progress
  next_step.md         # Next phase implementation plan
  memory.md            # This file

/workspace/            # Sandboxed directory for file operations
/test-workspace/       # Separate workspace for test

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
**errorType?: 'syntax' | 'runtime' | 'timeout' | 'validation' | 'logical';
  errorDetails?: {
    message: string;
    lineNumber?: number;
    stackTrace?: string;
  };
  metadata?: Record<string, any>;
}

interface CapabilityResult {
  output: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  nextAction?: string;
  metadata?: Record<string, any>;
}

interface ValidationResult extends CapabilityResult {
  isValid: boolean;
  validationIssues: string[];
  suggestedFixes: string[]
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
- DIteration and Validation (for Self-Correcting Patterns)
IterationState { attemptNumber, maxAttempts, previousAttempts, converged, startTime }
AttemptHistory { attemptNumber, code?, result?, error?, timestamp, duration? }
ValidationResult { isValid, validationIssues, suggestedFixes, ...CapabilityResult }
ValidationCriteria { expectedOutput?, outputPattern?, shouldNotContain?, customValidator? }

// Orchestrator
ExecutionOptions { maxSteps?, timeout?, debug?, visualizations?, messages? }
ExecutionEvent { timestamp, eventType, data, visualizations?, debug? }

// irectory traversal (`../`) is blocked
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

# UI (Nex4/4 Core):**
- ✅ CalculatorTool: Math with security (54 tests)
- ✅ FileSystemTool: CRUD in workspace (31 tests)
- ✅ NodeExecutionTool: JavaScript/Node.js code execution in vm sandbox (20 tests)
- ✅ PythonExecutionTool: Python code execution in subprocess (20 tests)

**LLM Providers (2/3):**
- ✅ MockLLMProvider: Testing (24 tests)
- ✅ OpenAIProvider: Real API integration (8 tests)
- ⏳ AnthropicProvider: Not started

**Capabilities (4/12):**
- ✅ ReasoningCapability: Logical inference with algorithmic detection (12 tests)
- ✅ ToolUseCapability: Execute tools based on LLM decisions (10 tests)
- ✅ SynthesisCapability: Combines information into unified output (implemented)
- ✅ ValidationCapability: Validates outputs against criteria (22 tests)
- ⏳ PlanningCapability: Task breakdown - planned
- ⏳ ReflectionCapability: Analyze past actions - planned
- ⏳ CritiqueCapability: Evaluate outputs - planned
- ⏳ MemoryCapability: Context management - planned
- ⏳ Others: Not started

**Patterns (3/12):**
- ✅ ReActPattern: Reasoning + Acting loop (12 tests)
- ✅ IterativeRefinementPattern: Generate → validate → refine (2 tests)
- ✅ PlanAndValidatePattern: Plan → execute → validate (7 tests)
- ⏳ Reflection: Generate → critique → refine - planned
- ⏳ Chain-of-Thought: Explicit reasoning - planned
- ⏳ Tree-of-Thoughts: Parallel path exploration - planned
- ⏳ Others: Not started

**Orchestrator (1/1):**
- ✅ AgentOrchestrator: Unified execution engine (17 tests)
  - Pattern registration and execution
  - Streaming ExecutionEvents
  - Options: maxSteps, timeout, debug, visualizations, messages
  - Error handling and recovery
  - Multi-turn conversation support

**API Layer (1/1):**
- ✅ Express server with SSE streaming (10 tests)
  - GET /api/patterns, /api/capabilities, /api/tools
  - POST /api/execute with SSE streaming
  - CORS and error handling middleware
  - Request logging

**UI Layer (1/1):**
- ✅ Next.js chat interface (2 Vitest tests)
  - Split-panel layout (chat + logs)
  - Pattern selector
  - Real-time SSE streaming
  - Expandable event viewer with full JSON
  - Download logs functionality
  - Multi-turn conversation support

**Utilities (3/3 Current, 3 Planned):**
- ✅ error-analysis.ts: Error categorization and analysis (25 tests)
- ✅ conversation.ts: Conversation management and pruning (23 tests)
- ✅ patterns/utils.ts: Shared pattern utilities (25 tests)
- 📋 file-parser.ts: CSV/JSON parsing - planned for Step 12
- 📋 visualization-validator.ts: Manifest validation - planned for Step 12
- 📋 workspace-manager.ts: File operations - planned for Step 12

### Next Steps (in order)
1. ~~**Orchestrator**~~ ✅ COMPLETE
2. ~~**API Layer**~~ ✅ COMPLETE
3. ~~**UI Layer**~~ ✅ COMPLETE
4. ~~**Self-Correcting Patterns**~~ ✅ COMPLETE
5. **Visualization Support** 📋 PLANNING COMPLETE (see [next_step.md](next_step.md))
   - Create utility modules (file-parser, visualization-validator, workspace-manager)
   - Enhance PythonExecutionTool to detect and parse visualization manifests
   - Create UI components for rendering charts and tables
   - End-to-end integration testing
6. **WebFetch Tool** - Download data from URLs
7. **More Patterns** - Reflection, Chain-of-Thought, Tree-of-Thoughts
8. **More Capabilities** - Planning, Reflection, Memory
import { IterativeRefinementPattern } from './patterns/iterative-refinement';

// Create orchestrator with LLM provider and tools
const orchestrator = new AgentOrchestrator(llmProvider, tools);

// Register patterns
const reactPattern = new ReActPattern(llmProvider);
const refinementPattern = new IterativeRefinementPattern(llmProvider);
orchestrator.registerPattern(reactPattern);
orchestrator.registerPattern(refinementPattern);

// Execute pattern with streaming
for await (const event of orchestrator.executePattern('react', input, options)) {
  // Handle ExecutionEvent
  // event.eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization'
}

// Multi-turn conversation
const options = {
  messages: [
    { role: 'user', content: 'Calculate 2+2' },
    { role: 'assistant', content: 'The answer is 4.' },
  ],
};
for await (const event of orchestrator.executePattern('react', 'Now multiply that by 3', options)) {
  // Agent has context from previous messages
}
```

Note: All imports are relative to `api/src/` when working in the API workspace.

**Event Types:**
- `start` - Execution begins
- `step` - Progress update (capability/tool_call/result/info/answer/error)
- `complete` - Execution finished successfully
- `error` - Execution failed
- `visualization` - Visualization data available (planned)

**Options:**
- `maxSteps` - Maximum execution steps (default: 1000)
- `timeout` - Execution timeout in ms (opt - TypeScript handles this
2. **PatternRegistry is instance-based** - Use `orchestrator.registerPattern()` or `PatternRegistry.register()`
3. **Mock provider API** - `setResponses([...])` takes an array
4. **Error messages** - Check `reasoning` field for capability errors, not `output`
5. **Async generators** - Must use `for await` or manual iteration
6. **Tool validation** - Always validate params before execution
7. **Constructor injection** - Capabilities and Patterns need LLMProvider passed in
8. **File paths** - Use absolute paths in config and relative in workspace
9. **PatternRegistry cleanup** - Call `PatternRegistry.clear()` in test `beforeEach` blocks
10. **Multi-turn conversations** - Include `messages` array in ExecutionOptions for context
11. **Code execution** - Python auto-wraps expressions in print(); Node returns expression results
12. **Workspace security** - All file operations restricted to WORKSPACE_DIR (default: ./workspace)(2 Vitest tests)

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
6. Register in test scripts if needed --debug

# Start servers (from root)
npm run dev:api   # API server on port 3000
npm run dev:ui    # UI server on port 3001

# Environment
cp api/.env.example api/.env   # Create config
code api/.env     `BaseCapability`
3. Accept `LLMProvider` in constructor
4. Use `collectStreamContent()` or `collectStreamWithToolCalls()`
5. Return via `this.success()` or `this.error()`
6. Create comprehensive tests
7. Export froapi/src/tools/` + `api/tests/tools/`
- New capability: `api/src/capabilities/` + `api/tests/capabilities/`
- New pattern: `api/src/patterns/` + `api/tests/patterns/`
- New utility: `api/src/utils/` + `api/tests/utils/`
- Orchestrator: `api/src/orchestrator/` + `api/tests/orchestrator/`
- API layer: `api/src/api/` + `api/tests/api/`
- Types: `api/src/types.ts` + `api/tests/types.test.ts`
- Config: `api/src/config.ts` and `api/.env.example`
- Docs: `docs/*.md`
- Test scripts: `api/scripts/test-*.ts`
- UI components: `ui/app/` and `ui/lib/`
- UI tests: `ui/__tests__/ncGenerator
6. Yield steps via helper methods
7. Create tests with mock provider
8. Add to test script

### Using the Orchestrator
7. **Iterative refinement** - Self-correcting patterns improve results
8. **Context-aware** - Multi-turn conversations maintain history

---

**Last Updated:** December 19, 2025 - Step 11 completed
**Total Tests:** 311 passing (17 test suites)
**Current Milestone:** Step 11 complete - Self-correcting patterns fully implemented
**Next Milestone:** Step 12 - Visualization Support (planning complete, see [next_step.md](next_step.md))
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
