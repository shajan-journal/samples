# Technical Architecture

## System Overview

Three-layer architecture with clear separation between UI, API, and core agent logic. All functionality is accessible via API and can be tested independently through scripts.

```
┌─────────────────────────────────────────────┐
│            UI Layer (Implemented)           │
│  (Web Interface + Debug View)               │
└─────────────────┬───────────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────────┐
│         API Layer (Implemented)             │
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
- ✅ Core Agent Layer: Tools (4 total), LLM Providers, Capabilities (4 total), Patterns (ReAct), Orchestrator
- ✅ API Layer: Express server with SSE streaming and multi-turn conversation support
- ✅ UI Layer: Next.js interface with split-panel debug views, expandable events, and JSON export

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
- ✅ `ReasoningCapability` - Logical inference with algorithmic task detection and code execution guidance (IMPLEMENTED)
- 🚧 `ReflectionCapability` - Analyzes past actions (Planned)
- 🚧 `CritiqueCapability` - Evaluates outputs (Planned)
- ✅ `ToolUseCapability` - Executes external functions with full debug metadata (IMPLEMENTED)
- 🚧 `MemoryCapability` - Context management (Planned)
- 🚧 `JITCapability` - Dynamic pattern composition (Planned)
- 🚧 `SummarizationCapability` - Condenses information to key points (Planned)
- 🚧 `ExtractionCapability` - Pulls structured data from text (Planned)
- ✅ `ValidationCapability` - Checks against rules and constraints (IMPLEMENTED)
- 🚧 `ComparisonCapability` - Analyzes similarities and differences (Planned)
- ✅ `SynthesisCapability` - Combines multiple sources into unified output (IMPLEMENTED)

**Reasoning Capability Enhancements:**
- **Algorithmic detection**: Regex patterns identify tasks requiring code execution (reverse, sort, calculate, etc.)
- **Smart prompting**: System message prepended to conversation with CRITICAL RULE about when to use code vs manual reasoning
- **State-aware suggestions**: Only suggests code execution before tools run, not after
- **Post-tool guidance**: Instructs LLM to synthesize results after tool execution
- **Full debug metadata**: Captures fullMessages, systemPrompt, availableTools, detectionFlags, toolDefinitions

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
- ✅ `NodeExecutionTool` - Execute JavaScript/Node.js code in sandboxed vm with direct expression result capture (IMPLEMENTED)
- ✅ `PythonExecutionTool` - Execute Python code in subprocess with automatic expression wrapping in print() for output capture (IMPLEMENTED)
- ✅ `FileSystemTool` - Read/write files for data persistence (IMPLEMENTED)
- 🚧 `WebFetchTool` - Download content from URLs (Planned)
- ✅ `CalculatorTool` - Mathematical calculations (IMPLEMENTED)
- ✅ Mock tools for testing (IMPLEMENTED)

**Code Execution Tools:**
The Node and Python execution tools enable the LLM to write and execute code for algorithmic tasks:
- **Auto-detection**: Reasoning capability detects algorithmic keywords (reverse, sort, calculate, etc.) and suggests code execution
- **Expression handling**: Python tool automatically wraps expressions like `"string"[::-1]` in `print()` to capture output
- **Sandboxing**: Node uses vm.Script, Python uses subprocess with 5-second timeout
- **System guidance**: CRITICAL RULE in system prompt distinguishes writing algorithms (good) vs executing mentally (bad)

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
- ✅ `PlanAndValidatePattern` - Lightweight upfront plan, tool execution, then validation gate (IMPLEMENTED)
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

#### Plan-and-Validate Pattern

Flow: (1) prompt the LLM for a numbered plan that references concrete tools, (2) execute each step through `requestToolExecution()` so the LLM must emit runnable tool calls, (3) run `ValidationCapability` after every tool output, optionally refine the failed step, and (4) synthesize the final answer.

Current limitation: the validation stage does **not** loop back through `requestToolExecution()`. `ValidationCapability` ([api/src/capabilities/validation.ts](../api/src/capabilities/validation.ts)) only inspects the latest tool result, applies rule-based checks, and if needed asks the LLM for a textual verdict. It cannot ask the LLM to design or run additional validation tools, so validation steps are observational rather than executable. When stricter validation is required, provide explicit validation steps in the original plan (e.g., "Call node_execute to reverse the string again and compare") so they are treated as regular tool-using steps before the passive validation gate.

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

Note: This section shows the target structure, including some planned modules that are not yet implemented. For the authoritative, up-to-date status of what exists today, see [docs/current_state.md](docs/current_state.md). Implemented components are called out in the Implementation Status above; unimplemented items here are aspirational.

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

---

## Visualization Pipeline (Planned - Step 12)

The system will support generating data visualizations from Python code execution, completing the core data analysis scenario.

### Architecture Flow

```
User Prompt: "Create a chart showing monthly revenue"
    ↓
Agent generates Python code
    ↓
PythonExecutionTool executes code
    ↓
Python script creates:
  - revenue.csv (data file)
  - visualization_manifest.json (configuration)
    ↓
PythonExecutionTool post-execution:
  1. WorkspaceManager scans for generated files
  2. Detects visualization_manifest.json
  3. FileParser parses CSV/JSON data files
  4. VisualizationValidator validates manifest schema
    ↓
Tool returns ToolResult with:
  - stdout/stderr (execution logs)
  - files[] (file metadata)
  - visualizations (parsed manifest + data)
    ↓
Orchestrator emits ExecutionEvent with visualizations
    ↓
API streams event via Server-Sent Events
    ↓
UI VisualizationRenderer displays charts
```

### New Utility Modules

**FileParser** (`utils/file-parser.ts`)
- Parse CSV files using `csv-parse` library
- Parse JSON files with validation
- Detect file types from extensions
- Handle encoding and malformed data gracefully

**VisualizationValidator** (`utils/visualization-validator.ts`)
- Validate manifest JSON schema
- Check referenced data files exist
- Verify column references are valid
- Type-specific configuration validation

**WorkspaceManager** (`utils/workspace-manager.ts`)
- Centralized file operations within workspace
- Path resolution with security checks
- File scanning and metadata extraction
- Temporary file cleanup

### UI Components

```
/ui/lib/visualizations/
  VisualizationRenderer.tsx  # Main dispatcher component
  Table.tsx                  # Tabular data display
  LineChart.tsx              # Time series and trends
  BarChart.tsx               # Category comparisons
  ScatterChart.tsx           # Correlation analysis
  PieChart.tsx               # Proportion display
```

**Visualization Types:**
- **Table**: Tabular data with columns and rows
- **Line Chart**: Trends over time or continuous variables
- **Bar Chart**: Comparing values across categories
- **Scatter Plot**: Analyzing correlations between variables
- **Pie Chart**: Showing proportions of a whole

### Manifest Format

```json
{
  "version": "1.0",
  "outputs": [
    {
      "id": "revenue_chart",
      "type": "bar_chart",
      "title": "Monthly Revenue",
      "dataFile": "revenue.csv",
      "config": {
        "xColumn": "month",
        "yColumn": "revenue",
        "xLabel": "Month",
        "yLabel": "Revenue ($)"
      }
    }
  ]
}
```

### Python Code Example

```python
import pandas as pd
import json

# Create and save data
df = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar'],
    'revenue': [10000, 12000, 15000]
})
df.to_csv('revenue.csv', index=False)

# Create visualization manifest
manifest = {
    "version": "1.0",
    "outputs": [{
        "id": "revenue_chart",
        "type": "bar_chart",
        "title": "Monthly Revenue",
        "dataFile": "revenue.csv",
        "config": {
            "xColumn": "month",
            "yColumn": "revenue"
        }
    }]
}

with open('visualization_manifest.json', 'w') as f:
    json.dump(manifest, f)

print("Visualization created")
```

See [next_step.md](next_step.md) for the detailed implementation plan with phases, tasks, testing strategy, and timeline.
