# Implementation Status

## Testing Directive

**CRITICAL**: At every implementation step, create a test mechanism to verify the implementation is working correctly. Use mocks where dependencies are not yet implemented. Each step must be testable in isolation before proceeding to the next.

## Implementation Plan

**Note:** The project uses a monorepo workspace structure with `api/` and `ui/` at the same level. All backend code is in the `api/` workspace, and frontend code is in the `ui/` workspace. Use workspace commands from the root: `npm run dev:api`, `npm run dev:ui`, `npm run test:api`, `npm run test:ui`.

### 1. Core Types & Contracts
**Status**: ✅ Completed

**Tasks:**
- ✅ Define all TypeScript interfaces (capabilities, patterns, tools, LLM provider)
- ✅ Create shared types for messages, context, results
- ✅ Define API contracts (request/response types)
- ✅ Define visualization manifest types

**Testing:**
- ✅ Type compilation checks
- ✅ Create sample data that matches all interfaces
- ✅ Validate JSON schema for external contracts

**Implementation Details:**
- Created `/src/types.ts` with all core interfaces
- Set up TypeScript project with `tsconfig.json`
- Configured Jest for testing with `jest.config.js`
- Created comprehensive test suite in `/tests/types.test.ts`
- All 31 tests passing
- TypeScript compilation successful

---

### 2. Basic Tools
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement CalculatorTool
- ✅ Implement FileSystemTool (read/write/list)
- ✅ Create base Tool interface and abstract class
- ✅ Add tool result types
- ✅ Add environment-based configuration

**Testing:**
- ✅ Unit tests for each tool
- ✅ Test with various inputs (success and error cases)
- ✅ Verify tool interface compliance
- ✅ Test scripts: `npm run test:tool -- calculator "2+2"`
- ✅ Verify configuration system works

**Implementation Details:**
- Created `/src/tools/base.ts` with BaseTool abstract class and ToolRegistry
- Implemented `/src/tools/calculator.ts` with safe expression evaluation
  - Supports basic arithmetic, powers, square roots, trig functions
  - Security checks prevent code injection
  - 54 passing tests
- Implemented `/src/tools/file-system.ts` with read/write/list/exists operations
  - Directory traversal protection
  - Works within sandboxed workspace directory
  - Configurable via WORKSPACE_DIR environment variable
  - 31 passing tests
- Created `/scripts/test-tool.ts` for manual tool testing
- Created `/src/config.ts` for environment variable management with dotenv
- Created `.env.example` with configuration documentation
- Created comprehensive `README.md` with setup and usage guide
- Created `.gitignore` for proper version control
- All 85 tests passing across all test suites

---

### 3. LLM Provider
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement base LLMProvider interface
- ✅ Create OpenAIProvider with streaming support
- ✅ Add MockLLMProvider for testing
- ✅ Implement streaming response handling

**Testing:**
- ✅ Unit tests with MockLLMProvider
- ✅ Integration test structure for OpenAI (mocked)
- ✅ Test streaming response parsing
- ✅ Test scripts: `npm run test:llm -- mock "Hello, world"`

**Implementation Details:**
- Created `/src/llm/base.ts` with BaseLLMProvider abstract class and LLMProviderRegistry
- Implemented `/src/llm/mock.ts` with configurable mock responses
  - Supports content and tool call responses
  - Simulates streaming by chunking words
  - Configurable delays for testing async behavior
  - 24 passing tests
- Implemented `/src/llm/openai.ts` with OpenAI API integration
  - Full streaming support using async generators
  - Handles both chat and chatWithTools
  - Tool call accumulation from streamed chunks
  - Proper message and tool definition formatting
  - 8 passing tests (with mocked API)
- Created `/scripts/test-llm.ts` for manual provider testing
- All 109 tests passing across all test suites

---

### 4. One Simple Capability
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement ReasoningCapability
- ✅ Create capability context handling
- ✅ Add prompt templates for reasoning
- ✅ Handle LLM responses

**Testing:**
- ✅ Unit tests with MockLLMProvider
- ✅ Test with various reasoning prompts
- ✅ Verify CapabilityResult format
- ✅ Test scripts: `npm run test:capability -- reasoning "What is 2+2?"`

**Implementation Details:**
- Created `/src/capabilities/base.ts` with BaseCapability abstract class and CapabilityRegistry
  - Provides reusable helper methods: collectStreamContent(), collectStreamWithToolCalls()
  - Includes success() and error() result builders
- Implemented `/src/capabilities/reasoning.ts` with LLM-based logical reasoning
  - buildReasoningPrompt() creates structured prompts with REASONING/CONCLUSION/NEXT_ACTION sections
  - parseReasoningOutput() extracts structured sections from LLM responses
  - Includes conversation history in reasoning context
  - Describes available tools when present
  - 12 passing tests
- Created `/scripts/test-capability.ts` for manual capability testing with both mock and OpenAI providers
- All 121 tests passing across all test suites
- Real OpenAI API verification successful:
  - Complex reasoning: "If I have 5 apples and eat 2, then buy 3 more, how many do I have?"
  - Correct output: "You have 6 apples."
  - Proper reasoning breakdown with step-by-step logic
  - Token usage tracking: 169 prompt + 83 completion = 252 total tokens

---

### 5. One Simple Pattern
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement ToolUseCapability
- ✅ Implement ReActPattern
- ✅ Create pattern execution loop
- ✅ Integrate ReasoningCapability and ToolUseCapability
- ✅ Implement streaming of pattern steps

**Testing:**
- ✅ Unit tests with mock capabilities and tools
- ✅ Test reasoning → action → observation loop
- ✅ Test early termination conditions
- ✅ Test scripts: `npm run test:pattern -- react "Calculate 2+2"`

**Implementation Details:**
- Created `/src/capabilities/tool-use.ts` with LLM-based tool execution
  - Presents available tools to LLM and executes based on decisions
  - Handles tool call execution and result collection
  - Supports multiple tool calls in one step
  - 10 passing tests
- Created `/src/patterns/base.ts` with BasePattern abstract class and PatternRegistry
  - Provides helper methods for yielding different step types
  - createStep(), yieldCapabilityStep(), yieldToolCallStep(), yieldResultStep(), yieldErrorStep()
  - Registry for pattern management
- Implemented `/src/patterns/react.ts` with full ReAct pattern
  - Interleaves reasoning and action in a loop until task completion
  - Configurable max iterations and verbosity
  - Detects completion signals in LLM responses
  - Handles tool execution success and failure
  - Streams execution steps progressively via AsyncGenerator
  - 12 passing tests
- Created `/scripts/test-pattern.ts` for manual pattern testing
  - Supports both mock and OpenAI providers
  - Configurable options (max-iterations, verbose)
  - Clear step-by-step output with timestamps and icons
- All 143 tests passing across all test suites
- Manual test verification successful:
  - Pattern: react
  - Input: "Calculate 2+2"
  - Proper reasoning → tool call → observation loop
  - Correct completion detection and final answer extraction

---

### 6. Orchestrator
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement AgentOrchestrator class
- ✅ Add pattern registry and loading
- ✅ Implement streaming event emission
- ✅ Add error handling and recovery

**Testing:**
- ✅ Unit tests with mock patterns
- ✅ Test streaming event flow
- ✅ Test error propagation
- ✅ Test scripts: `npm run test:orchestrator -- react "Test query"`

**Implementation Details:**
- Created `/src/orchestrator/orchestrator.ts` with AgentOrchestrator class
  - Entry point for executing patterns with unified interface
  - registerPattern() method to register patterns by name
  - executePattern() returns AsyncGenerator<ExecutionEvent> for streaming
  - Converts PatternSteps to ExecutionEvents with proper formatting
  - Supports maxSteps, timeout, debug, and visualizations options
  - Comprehensive error handling with proper event emission
  - 17 passing tests
- Created `/scripts/test-orchestrator.ts` for manual orchestrator testing
  - Supports pattern selection and input
  - Configurable provider (mock/openai), maxSteps, timeout, debug mode
  - Clear event display with timestamps and icons
  - Example usage: `npm run test:orchestrator -- react "Calculate 2+2"`
- All 160 tests passing across all test suites
- Manual test verification successful:
  - Orchestrator → ReAct pattern execution
  - Proper event streaming (start, steps, complete)
  - Correct step type conversions and formatting
  - Debug mode support for internal details
  - Error handling with graceful degradation

---

### 7. API Layer
**Status**: ✅ Completed

**Tasks:**
- ✅ Set up Express.js server
- ✅ Implement /api/execute endpoint with SSE
- ✅ Implement /api/patterns, /api/capabilities, /api/tools endpoints
- ✅ Add middleware (CORS, error handling, logging)

**Testing:**
- ✅ API endpoint tests with supertest
- ✅ SSE stream parsing tests
- ✅ Mock orchestrator for API tests
- ✅ Test scripts: `npm run start:api`

**Implementation Details:**
- Created `/src/api/server.ts` with server creation and startup
  - createServer() configures Express with middleware and routes
  - startServer() initializes orchestrator and starts listening
  - Graceful error handling for port conflicts
  - 10 passing tests
- Created `/src/api/routes.ts` with API endpoints
  - GET /api/patterns - List all registered patterns
  - GET /api/capabilities - List available capabilities
  - GET /api/tools - List available tools
  - POST /api/execute - Execute pattern with SSE streaming
  - Proper request validation and error responses
- Created `/src/api/middleware.ts`
  - requestLogger - Logs all requests with duration
  - errorHandler - Catches and formats errors
- Created `/scripts/start-api.ts` for server startup
  - Supports --port and --provider options
  - Registers all patterns and capabilities
  - Displays helpful startup information
  - Example: `npm run start:api -- --port=3000 --provider=mock`
- All 170 tests passing across all test suites
- Manual verification successful:
  - Server starts successfully on port 3000
  - Quick start:
    - Start server: `npm run start:api`
    - List patterns: `curl http://localhost:3000/api/patterns`
    - Execute ReAct (SSE): `curl -X POST http://localhost:3000/api/execute -H "Content-Type: application/json" -d '{"pattern":"react","input":"Calculate 2+2"}'`
  - All endpoints return proper JSON responses
  - SSE streaming works correctly
  - CORS headers included

---

### 8. UI - Main View
**Status**: ✅ Completed

**Tasks:**
- ✅ Set up Next.js project (app router, TS, styling)
- ✅ Create chat interface component with streaming timeline
- ✅ Implement SSE client for streaming events
- ✅ Add pattern selector wired to `/api/patterns`
- ✅ Create message display + event log components

**Testing:**
- ✅ Component tests with React Testing Library (mocked SSE + fetch)
- ✅ Message and log rendering verified
- ✅ Manual testing via `npm run dev` against mock API

---

### 9. Code Execution Tools
**Status**: ✅ Completed

**Rationale**: Code execution tools unlock advanced agentic patterns (iterative refinement, self-correction, data analysis loops) that can't be demonstrated with basic tools. Simple sandbox approach for learning/exploration.

**Tasks:**
- ✅ Implement NodeExecutionTool (simple vm-based sandbox)
  - Use vm.Script for sandboxing
  - Built-in timeout and memory limits
  - Capture stdout/stderr and expression results
  - No external package installation
- ✅ Implement PythonExecutionTool (subprocess-based sandbox)
  - Execute Python code in subprocess with timeout
  - Capture stdout/stderr with proper error handling
  - **Auto-wrap expressions**: Automatically detects simple expressions and wraps in print() for output
  - No external package installation (uses system Python)
- ✅ Add comprehensive tests for both tools
- ✅ Register tools in server startup

**Implementation Details:**
- NodeExecutionTool: Returns expression results directly (e.g., `"hello".split("").reverse().join("")` returns reversed string)
- PythonExecutionTool: `wrapCodeForOutput()` method automatically wraps expressions like `"string"[::-1]` in `print()` to capture output
- Both tools have configurable timeouts and comprehensive error handling
- 20 passing tests for NodeExecutionTool
- 20 passing tests for PythonExecutionTool
- All 216 tests passing across all test suites

---

### 10. Multi-Turn Conversations
**Status**: ✅ Completed

**Tasks:**
- ✅ Add conversation history support to ExecutionOptions
- ✅ Update API routes to accept messages array
- ✅ Update orchestrator to pass messages to patterns
- ✅ Update UI to track and send conversation history
- ✅ Test multi-turn conversations with context retention

**Implementation Details:**
- Added `messages?: Message[]` to ExecutionOptions type
- API route now accepts and forwards messages array
- Orchestrator initializes context with conversation history
- UI tracks all user/assistant messages and includes them in subsequent requests
- Enables true multi-turn conversations where agent remembers prior context
- Tested with follow-up questions successfully maintaining context

---

### 11. Enhanced UI Features
**Status**: ✅ Completed

**Tasks:**
- ✅ Implement split-panel layout (chat + logs)
- ✅ Add expandable event viewer with full JSON details
- ✅ Add download logs functionality
- ✅ Fix text selection in expanded JSON views
- ✅ Full-width layout for better space utilization
- ✅ Session tracking with turn counter

**Implementation Details:**
- Chat area now takes 50% width when logs panel is visible
- Logs panel shows event summaries with click-to-expand for full JSON
- Download button exports all events as timestamped JSON file
- Removed onClick from JSON content area to enable text selection
- Changed layout max-width from 960px to 100% for full screen
- All events stored as full ExecutionEvent objects with complete metadata
- ✅ Implement PythonExecutionTool (simple subprocess-based)
  - Spawn python subprocess with timeout
  - Capture stdout/stderr and return code
  - File output capture (CSV, JSON, images)

**Testing:**
- ✅ Unit tests for NodeExecutionTool
  - Test sandboxing and isolation
  - Test timeout enforcement
  - Test memory limits
  - Test scripts: `npm run test:tool -- node_execute "console.log('hello')"`
- ✅ Unit tests for PythonExecutionTool
  - Test code execution and output capture
  - Test stdout/stderr capture
  - Test timeout enforcement
  - Test error handling
  - Test scripts: `npm run test:tool -- python_execute "print('hello')"`

**Implementation Details:**
- Created `/src/tools/node-execution.ts` with NodeExecutionTool
  - Uses Node.js vm module for sandboxed execution
  - Captures console.log/error/warn/info output
  - Disables require, process, setTimeout, setInterval for safety
  - Configurable timeout (default: 5000ms)
  - Returns result value, stdout, and stderr
  - 21 passing tests
- Created `/src/tools/python-execution.ts` with PythonExecutionTool
  - Spawns Python subprocess with child_process
  - Creates temporary files for code execution
  - Captures stdout and stderr streams
  - Enforces timeout with SIGTERM → SIGKILL escalation
  - Tracks execution time
  - Returns stdout, stderr, return code, and execution time
  - 20 passing tests
- Added exports to `/src/tools/index.ts`
- All 208 tests passing (41 new tests added)

---

### 10. Self-Correcting Patterns (Enabled by Code Execution)
**Status**: Not Started

**Rationale**: With code execution, we can demonstrate patterns that iterate on failures - a key capability of advanced agents.

**Tasks:**
- Implement IterativeRefinementPattern
  - Generate code → Execute → Analyze errors → Refine → Repeat
  - Demonstrates self-correction based on execution feedback
- Implement PlanAndValidatePattern
  - Plan approach → Generate code → Execute tests → Fix issues
  - Shows test-driven development pattern
- Add ValidationCapability
  - Checks code execution results against expected outcomes
  - Identifies errors and suggests corrections

**Testing:**
- Test iterative refinement with intentionally buggy code prompts
- Test convergence to correct solution
- Test max iteration limits
- Integration test: "Write Python code to calculate factorial" → self-correcting loop
- Test scripts: `npm run test:pattern -- iterative-refinement "Generate function with bug"`

---

### 11. Visualization
**Status**: Not Started

**Tasks:**
- Update PythonExecutionTool to detect visualization outputs
- Implement data file reading (CSV, JSON)
- Add visualization components (Table, Chart renderers)
- Integrate with chat UI to display execution results

**Testing:**
- Unit tests for data parsing
- Component tests for each visualization type
- Test with mock data
- Integration test: Python code → data output → UI rendering
- Test scripts: `npm run test:tool -- python_execute "import pandas; df.to_csv('output.csv')"`

---

### 12. Additional Patterns & Capabilities
**Status**: Not Started

**Tasks:**
- Implement PlanningCapability (breaks tasks into steps)
- Implement ReflectionCapability (analyzes past actions)
- Implement Plan-Execute pattern (plan upfront, execute sequentially)
- Implement Reflection pattern (generate → critique → refine)
- Implement Tree-of-Thoughts pattern (explore multiple paths)
- Implement EnsemblePattern (run multiple approaches, aggregate)

**Testing:**
- Unit tests for each capability
- Unit tests for each pattern
- Integration tests showing pattern differences
- Test scripts for each: `npm run test:pattern -- plan-execute "Complex task"`

---

### 13. UI Enhancements & Testing
**Status**: Not Started

**Tasks:**
- Add UI debug view (prompts, tool calls, tokens, timing)
- Add execution history and replay
- Create comprehensive test suite
- Add integration tests for full workflows
- Add example prompts and expected outputs
- Performance and load testing

**Testing:**
- Component tests for debug panel
- Run full test suite: `npm test`
- Run integration tests: `npm run test:integration`
- Performance testing for streaming
- Load testing for API endpoints

---

---

### 10. Refactoring for Self-Correcting Patterns
**Status**: ✅ Completed

**Rationale**: Before implementing self-correcting patterns, foundational utilities and types were needed to support error analysis, iteration tracking, and validation logic.

**Tasks:**
- ✅ Create error analysis utilities module
- ✅ Add iteration state types and interfaces
- ✅ Enhance tool result structures with error metadata
- ✅ Extract completion detection to shared utils
- ✅ Create conversation management utilities
- ✅ Add comprehensive tests for all new utilities

**Implementation Details:**
- Created `/src/utils/error-analysis.ts` with comprehensive error analysis
  - Categorizes errors (syntax, runtime, timeout, logical)
  - Extracts error messages, line numbers, and stack traces
  - Suggests context-aware fixes
  - Detects error convergence and similarity
  - 25 passing tests
- Created `/src/utils/conversation.ts` for conversation management
  - Summarizes previous attempts
  - Prunes old messages to manage context size
  - Extracts relevant context based on token limits
  - Identifies learnings from failed attempts
  - 23 passing tests
- Created `/src/patterns/utils.ts` for shared pattern utilities
  - Extracted completion detection from ReActPattern
  - Added convergence checking for iterative patterns
  - Success rate calculation and best attempt selection
  - Iteration control logic
  - 25 passing tests
- Added new types to `/src/types.ts`:
  - `IterationState` - Tracks attempts and convergence
  - `AttemptHistory` - Records each iteration attempt
  - `ValidationResult` - Extends CapabilityResult with validation info
  - `ValidationCriteria` and `ValidationMetrics` - Define validation rules
  - `ToolExecutionContext` - Tracks tool execution metadata
- Enhanced `ToolResult` with `errorType` and `errorDetails`
- Enhanced `AgentContext` with optional `iterationState`
- All 289 tests passing (73 new tests added)

---

### 11. Self-Correcting Patterns Implementation
**Status**: ✅ Completed

**Rationale**: Implement intelligent validation and iterative refinement capabilities to enable agents to detect and fix errors automatically.

**Completed Tasks:**
- ✅ Implement ValidationCapability (22 tests)
  - Analyzes code execution results with error-analysis utilities
  - Supports validation against custom criteria and LLM-based validation
  - Located in `/src/capabilities/validation.ts`
  
- ✅ Implement IterativeRefinementPattern (2 tests)
  - Generate → execute (Node/Python) → validate → analyze errors → refine → repeat
  - Uses ValidationCapability, utils/error-analysis, utils/conversation, patterns/utils
  - Tracks iterationState and records attempts with metadata
  - Detects convergence and prevents infinite loops
  - Located in `/src/patterns/iterative-refinement.ts`
  - Key features:
    - Progressive streaming of steps via AsyncGenerator
    - Validation-gated iteration with feedback loops
    - Max attempt caps and convergence detection
    - Full debug metadata collection
  
- ✅ Implement PlanAndValidatePattern (7 tests)
  - Plan → Execute Steps → Validate → Refine
  - Lightweight planning step followed by step-wise execution
  - Validates each step and triggers refinement on failure
  - Supports optional re-validation after refinement
  - Located in `/src/patterns/plan-and-validate.ts`
  - Key features:
    - Parses numbered plan into Step objects
    - Executes each step with tool-use and validation gates
    - Feeds validation feedback for refinement iterations
    - Reports completion summary with step metrics
  - **Known limitation:** ValidationCapability simply inspects the latest tool output; it does not request additional tool calls, so validation steps in the plan must already contain executable tool usage if code-based verification is required.

**Test Results**: 321 tests passing (9 self-correcting tests added)
- All ValidationCapability tests passing (22)
- All IterativeRefinementPattern tests passing (2)
- All PlanAndValidatePattern tests passing (7)
- No regressions in existing tests

**Files Modified/Created:**
- ✅ `/src/patterns/iterative-refinement.ts` - IterativeRefinementPattern
- ✅ `/src/patterns/plan-and-validate.ts` - PlanAndValidatePattern
- ✅ `/src/patterns/index.ts` - Export both new patterns
- ✅ `/scripts/test-pattern.ts` - Added support for new patterns
- ✅ `/scripts/start-api.ts` - Register both patterns with orchestrator
- ✅ `/tests/patterns/iterative-refinement.test.ts` - Tests for iterative refinement
- ✅ `/tests/patterns/plan-and-validate.test.ts` - Tests for plan-and-validate
  - Metadata and metrics tracking
  - Edge cases and error handling

**Files Modified/Created:**
- ✅ `/src/capabilities/validation.ts` - New ValidationCapability implementation
- ✅ `/src/capabilities/index.ts` - Export ValidationCapability
- ✅ `/tests/capabilities/validation.test.ts` - Comprehensive test suite

---

## Current Status Summary

**Completed Steps**: 10/13 (plus partial Step 11)  
**In Progress**: Step 11 (ValidationCapability complete, remaining patterns pending)  
**Blocked**: None  

**Test Results**: 311 tests passing
- Types: Tests passing
- Tools (Calculator + FileSystem + NodeExecution + PythonExecution): Tests passing
- LLM Providers (Mock + OpenAI): Tests passing
- Capabilities (Reasoning + ToolUse + Synthesis + Validation): Tests passing
- Patterns (ReAct): Tests passing
- Orchestrator: Tests passing
- API: Tests passing
- Utils (Error Analysis + Conversation + Pattern Utils): Tests passing

## Next Action

### Prioritized Implementation Plan

1) Implement IterativeRefinementPattern (highest priority)
- Summary: Generate → execute (Node/Python) → validate → analyze errors → refine → repeat until converge/max-iterations.
- Implementation Notes:
  - Use async generator pattern from `BasePattern` to yield steps progressively.
  - Leverage `ValidationCapability`, `utils/error-analysis`, `utils/conversation`, and `patterns/utils` for convergence and iteration control.
  - Track `iterationState` in `AgentContext` and record attempts with metadata.
- Acceptance Criteria:
  - Unit tests cover: syntax/runtime/timeout errors, convergence detection, max-iteration cap, success path with refinement.
  - Integration test with Mock LLM: first attempts fail, later succeeds; emits correct step sequence and final result.
  - Registered with orchestrator; appears in `/api/patterns` and streams via `/api/execute` (SSE).

2) Implement PlanAndValidatePattern
- Summary: Lightweight planning step → execute steps sequentially → validate after each step → refine and continue.
- Implementation Notes:
  - Start with minimal planning prompt or stub `PlanningCapability` that outputs ordered steps.
  - Reuse `ValidationCapability` to gate progress and trigger refinements.
  - Maintain simple step state and emit clear streaming events per step.
- Acceptance Criteria:
  - Unit tests for plan parsing, step execution order, validation gating, and refinement behavior.
  - Exposed via orchestrator and `/api/patterns`; SSE verified in API tests.

3) Wire-up and Tests
- Extend `scripts/test-pattern.ts` to run new patterns with options (iterations, debug).
- Add API SSE tests to cover new patterns’ event shapes and error handling.

4) Documentation Updates
- Update this file and `architecture.md` with new patterns, flow diagrams, and usage examples.
- Add brief examples to `prd.md` showing when to choose each pattern.

### Fast-Follow (enables richer demos)

- WebFetch Tool
  - Minimal `web_fetch` tool supporting GET for JSON/text with timeout, size limits, and content-type handling.
  - Unit tests: success/timeout/error cases, content-type branching, size limit enforcement.

- Visualization Manifest Plumbing
  - PythonExecutionTool: detect `visualization_manifest.json`, parse it, and include referenced CSV/JSON files in tool result.
  - UI: render at least Table + Line/Bar chart types based on the manifest; keep components lightweight.
  - Tests: manifest parsing unit tests; UI component tests for basic render and error states.

**Why This Order**
- Self-correcting patterns immediately leverage the completed `ValidationCapability` and iteration utilities, delivering visible capability gains.
- WebFetch + Visualization unlock the scenario breadth (data → analysis → charts) and can follow once patterns are in place.
