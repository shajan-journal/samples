# Technical Architecture

## System Overview

Three-layer architecture with clear separation between UI, API, and core agent logic. All functionality is accessible via API and can be tested independently through scripts.

```
┌─────────────────────────────────────────────┐
│              UI Layer (Planned)             │
│  (Web Interface + Debug View)               │
└─────────────────┬───────────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────────┐
│            API Layer (Planned)              │
│  (REST endpoints + SSE for streaming)       │
└─────────────────┬───────────────────────────┘
                  │ Function calls
┌─────────────────▼───────────────────────────┐
│         Core Agent Layer (Implemented)      │
│  Tools → Capabilities → Patterns            │
│         ↓                                   │
│    Orchestrator (Entry Point)               │
└─────────────────────────────────────────────┘
```

**Implementation Status:**
- ✅ Core Agent Layer: Tools, LLM Providers, Capabilities, Patterns, Orchestrator
- 🚧 API Layer: Express server with SSE streaming
- 🚧 UI Layer: Next.js interface with debug views

## Core Components

### 1. Capabilities (Building Blocks)
Individual agent skills that can be composed together.

```typescript
interface Capability {
  name: string;
  execute(context: AgentContext): Promise<CapabilityResult>;
}

interface AgentContext {
  messages: Message[];
  tools: Tool[];
  config: LLMConfig;
  state?: Record<string, any>;
}

interface CapabilityResult {
  output: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  nextAction?: string;
}
```

**Implementations:**
- 🚧 `PlanningCapability` - Breaks tasks into steps (Planned)
- ✅ `ReasoningCapability` - Logical inference over information (IMPLEMENTED)
- 🚧 `ReflectionCapability` - Analyzes past actions (Planned)
- 🚧 `CritiqueCapability` - Evaluates outputs (Planned)
- ✅ `ToolUseCapability` - Executes external functions (IMPLEMENTED)
- 🚧 `MemoryCapability` - Context management (Planned)
- 🚧 `JITCapability` - Dynamic pattern composition (Planned)
- 🚧 `SummarizationCapability` - Condenses information to key points (Planned)
- 🚧 `ExtractionCapability` - Pulls structured data from text (Planned)
- 🚧 `ValidationCapability` - Checks against rules and constraints (Planned)
- 🚧 `ComparisonCapability` - Analyzes similarities and differences (Planned)
- 🚧 `SynthesisCapability` - Combines multiple sources into unified output (Planned)

### 2. Tools
External functions agents can call.

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: Record<string, any>): Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
```

**Implementations:**
- 🚧 `NodeExecutionTool` - Execute JavaScript/Node.js code in sandboxed vm (Planned)
- 🚧 `PythonExecutionTool` - Execute Python code in isolated virtual environment (Planned)
- ✅ `FileSystemTool` - Read/write files for data persistence (IMPLEMENTED)
- 🚧 `WebFetchTool` - Download content from URLs (Planned)
- ✅ `CalculatorTool` - Mathematical calculations (IMPLEMENTED)
- ✅ Mock tools for testing (IMPLEMENTED)

See [scenario.md](scenario.md) for detailed tool specifications.

### 3. Patterns (Orchestration)
Compose capabilities into agentic workflows.

```typescript
interface AgentPattern {
  name: string;
  description: string;
  execute(input: string, context: AgentContext): AsyncGenerator<PatternStep>;
}

interface PatternStep {
  type: 'capability' | 'tool_call' | 'result' | 'error';
  capability?: string;
  tool?: string;
  content: string;
  metadata?: Record<string, any>;
}
```

**Implementations:**
- ✅ `ReActPattern` - Reasoning + Acting loop (IMPLEMENTED)
- 🚧 `PlanAndExecutePattern` - Upfront planning (Planned)
- 🚧 `ReWOOPattern` - Parallel tool execution (Planned)
- 🚧 `ReflectionPattern` - Generate + critique + refine (Planned)
- 🚧 `SelfCritiquePattern` - Iterative self-improvement (Planned)
- 🚧 `MultiAgentPattern` - Multiple specialized agents (Planned)
- 🚧 `JITPattern` - Dynamic pattern selection (Planned)
- 🚧 `ChainOfThoughtPattern` - Explicit step-by-step reasoning (Planned)
- 🚧 `TreeOfThoughtsPattern` - Explore multiple reasoning paths (Planned)
- 🚧 `IterativeRefinementPattern` - Multiple refinement passes (Planned)
- 🚧 `EnsemblePattern` - Aggregate multiple agent outputs (Planned)
- 🚧 `RetrievalAugmentedPattern` - Context retrieval then reasoning (Planned)

### 4. Orchestrator
Entry point that manages pattern execution and streaming.

```typescript
class AgentOrchestrator {
  async executePattern(
    patternName: string,
    input: string,
    options: ExecutionOptions
  ): AsyncGenerator<ExecutionEvent> {
    // Load pattern
    // Initialize context
    // Stream execution events
    // Handle errors
  }
}

interface ExecutionEvent {
  timestamp: number;
  eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization';
  data: any;
  visualizations?: VisualizationManifest;
  debug?: DebugInfo;
}

interface VisualizationManifest {
  version: string;
  outputs: VisualizationOutput[];
}

interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];  // Parsed CSV/JSON data
  config?: Record<string, any>;
}

interface DebugInfo {
  prompt?: string;
  modelResponse?: string;
  toolCalls?: ToolCall[];
  tokens?: TokenUsage;
  latency?: number;
}
```

### 5. LLM Provider
Abstraction over different LLM APIs.

```typescript
interface LLMProvider {
  chat(
    messages: Message[],
    options: LLMOptions
  ): AsyncGenerator<LLMChunk>;
  
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    options: LLMOptions
  ): AsyncGenerator<LLMChunk>;
}

interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}
```

**Implementations:**
- ✅ `OpenAIProvider` (IMPLEMENTED)
- 🚧 `AnthropicProvider` (Planned)
- ✅ `MockLLMProvider` (IMPLEMENTED for testing)

## Data Flow

### 1. Typical Execution Flow
```
User Input
  ↓
API Endpoint (/execute)
  ↓
AgentOrchestrator.executePattern()
  ↓
Pattern.execute() ← composes capabilities
  ↓
Capability.execute() ← calls LLM
  ↓
LLMProvider.chatWithTools() ← includes tools
  ↓
Tool.execute() ← if tool calls needed
  ↓
PythonExecutionTool ← generates code + visualization manifest
  ↓
Stream results back (SSE)
  ↓
UI renders visualizations + Debug view updates
```

### 3. Visualization Flow
```
LLM generates Python code
  ↓
Code includes:
  - Data processing logic
  - CSV/data file output
  - visualization_manifest.json creation
  ↓
PythonExecutionTool executes code
  ↓
Tool reads visualization_manifest.json
  ↓
Tool loads referenced data files
  ↓
Result includes:
  - stdout/stderr
  - Raw files
  - Parsed VisualizationManifest
  ↓
API sends visualization data via SSE
  ↓
UI receives manifest + data
  ↓
Frontend renders based on type:
  - table → HTML table component
  - *_chart → Chart.js/Recharts component
```

### 2. Streaming Events
```typescript
// Client receives these progressively:
{ eventType: 'start', data: { pattern: 'react', input: '...' } }
{ eventType: 'step', data: { capability: 'reasoning', content: 'Thinking...' } }
{ eventType: 'step', data: { tool: 'wikipedia', params: {...} } }
{ eventType: 'step', data: { capability: 'reasoning', content: 'Based on...' } }
{ eventType: 'complete', data: { result: '...' } }
```

## API Layer

### REST Endpoints

```typescript
POST   /api/execute
  Body: { pattern: string, input: string, options?: {} }
  Returns: SSE stream of ExecutionEvent

GET    /api/patterns
  Returns: List of available patterns with descriptions

GET    /api/capabilities
  Returns: List of available capabilities

GET    /api/tools
  Returns: List of available tools

POST   /api/test-tool
  Body: { toolName: string, params: {} }
  Returns: Tool execution result
```

### Server Setup
- Express.js for HTTP server
- Server-Sent Events (SSE) for streaming
- Simple middleware for error handling and logging

## UI Layer

### Main Interface
- React/Next.js for UI framework
- Pattern selector dropdown
- Chat interface component
- SSE client for streaming updates
- Message history display

### Debug Interface
- Split-pane or tabbed view
- Real-time event log
- Collapsible sections for:
  - Prompts sent to LLM
  - Model responses
  - Tool definitions
  - Tool calls and results
  - Token usage
  - Timing information
- JSON view for detailed inspection

## Project Structure

```
/src
  /capabilities          # Individual agent capabilities
    /planning.ts
    /reasoning.ts
    /reflection.ts
    /critique.ts
    /tool-use.ts
    /memory.ts
    /jit.ts
    /summarization.ts
    /extraction.ts
    /validation.ts
    /comparison.ts
    /synthesis.ts
    
  /patterns             # Composed agentic patterns
    /react.ts
    /plan-execute.ts
    /rewoo.ts
    /reflection.ts
    /self-critique.ts
    /multi-agent.ts
    /jit.ts
    /chain-of-thought.ts
    /tree-of-thoughts.ts
    /iterative-refinement.ts
    /ensemble.ts
    /retrieval-augmented.ts
    
  /tools                # External tool implementations
    /wikipedia.ts
    /calculator.ts
    /yahoo-finance.ts
    /base.ts
    
  /llm                  # LLM provider abstractions
    /provider.ts
    /openai.ts
    /anthropic.ts
    /mock.ts
    
  /orchestrator         # Main execution engine
    /orchestrator.ts
    /context.ts
    /types.ts
    
  /api                  # HTTP API layer
    /server.ts
    /routes.ts
    /middleware.ts
    
  /ui                   # User interface
    /app                # Next.js app router
    /components         # React components
      /chat             # Chat interface components
      /visualizations   # Visualization renderers (Table, Chart, etc.)
      /debug            # Debug view components
    /hooks              # Custom hooks for SSE, etc.
    
  /scripts              # CLI testing scripts
    /run-pattern.ts
    /test-capability.ts
    /test-tool.ts
    
  /utils                # Shared utilities
    /logger.ts
    /config.ts
    
/tests                  # Test files mirror src structure
  /capabilities
  /patterns
  /tools
  /integration
```

## Key Design Decisions

### 1. Async Generators for Streaming
All patterns and the orchestrator return `AsyncGenerator` to enable progressive streaming of results without buffering.

### 2. Capability Composition Over Inheritance
Patterns compose capabilities via function calls rather than class hierarchies, keeping code simple and flexible.

### 3. Tool Standardization
All tools implement the same `Tool` interface, making them interchangeable and easy to mock for testing.

### 4. Context as Plain Objects
`AgentContext` is a simple object passed through the execution chain, avoiding complex state management.

### 5. Separate Debug Channel
Debug information flows alongside user-facing output but in separate fields, keeping concerns separated.

### 6. Provider-Agnostic Design
LLM provider interface allows swapping between OpenAI, Anthropic, or others without changing agent code.

## Testing Strategy

### Unit Tests
- Each capability testable in isolation with mock LLM provider
- Each tool testable with mock external APIs
- Pattern logic testable with mock capabilities

### Integration Tests
- End-to-end pattern execution with real LLM (optional)
- API endpoints with mock orchestrator
- Full flow with test fixtures

### Script-Based Testing
```bash
# Test individual tools
npm run test:tool -- calculator "2+2"
npm run test:tool -- file_system read test.txt

# Test LLM providers
npm run test:llm -- mock "Hello, world"
npm run test:llm -- openai "What is 2+2?"

# Test individual capabilities
npm run test:capability -- reasoning "Analyze this data..."

# Test pattern execution
npm run test:pattern -- react "Calculate 2+2"

# Test orchestrator (unified entry point)
npm run test:orchestrator -- react "What is sqrt(144)?" --debug
```

### Mock Strategy
- `MockLLMProvider` returns predefined responses for deterministic tests
- `MockTool` simulates external API responses
- Test fixtures define common scenarios

## Configuration

Simple environment-based config:

```typescript
interface Config {
  llm: {
    provider: 'openai' | 'anthropic' | 'mock';
    apiKey?: string;
    model: string;
  };
  tools: {
    enabled: string[];
  };
  server: {
    port: number;
  };
}
```

Loaded from `.env` or environment variables, with sensible defaults.

## Error Handling

- Capabilities catch errors and return `CapabilityResult` with error info
- Tools return `ToolResult.success: false` with error message
- Patterns handle capability/tool errors and decide whether to retry or fail
- API layer catches uncaught errors and returns proper HTTP status
- Streaming events include error type for UI to display appropriately
