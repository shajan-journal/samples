# Agentic AI Patterns Exploration

A collection of simple, illustrative samples demonstrating different agentic AI patterns using composable agent capabilities. Focus is on quick exploration and learning, not production-grade implementation.

## Overview

This project demonstrates core agent capabilities (planning, reasoning, reflection, tool use, etc.) and how to compose them into standard agentic patterns like ReAct, Plan-and-Execute, Reflection, Tree-of-Thoughts, and more.

**Tech Stack**: Node.js / TypeScript (core + API), Next.js / React / TypeScript (UI)

## Quick Start (full product)

1) Install all dependencies (from root)
```bash
npm install
```

2) Start API server (mock provider, port 3000)
```bash
npm run dev:api
```

3) In a new terminal, start UI (default port 3001)
```bash
npm run dev:ui
```

4) Open http://localhost:3001 and run the `react` pattern with any prompt:
   - Try: "Calculate 2+2" (uses calculator tool)
   - Try: "Reverse the string hello" (uses code execution)
   - Multi-turn: Continue the conversation with follow-up questions

5) CLI alternative (skip UI) - test orchestrator directly:
```bash
cd api
npm run test:orchestrator -- react "Calculate 2+2"
```

## Setup and Operations

### Prerequisites
- Node.js 18+ (for running the project and NodeExecutionTool)
- npm or yarn
- Python 3.8+ (required for PythonExecutionTool - automatically detects and wraps expressions)

**Install Node.js:**
- macOS: `brew install node` or download from [nodejs.org](https://nodejs.org/)
- Linux: `sudo apt install nodejs npm` or use [nvm](https://github.com/nvm-sh/nvm)
- Windows: Download installer from [nodejs.org](https://nodejs.org/)

**Install Python 3:**
- macOS: `brew install python3` or download from [python.org](https://www.python.org/)
- Linux: `sudo apt install python3` (usually pre-installed)
- Windows: Download installer from [python.org](https://www.python.org/)
- Verify: `python3 --version` should show Python 3.8 or higher

### Configure (optional)
```bash
cp api/.env.example api/.env
# Edit values if you want OpenAI, different workspace dir, or API port
```

### Run API (mock by default)
```bash
npm run dev:api
# For OpenAI, set LLM_PROVIDER=openai and LLM_API_KEY in api/.env, then restart
```

### Run UI
```bash
npm run dev:ui
# Change PORT via environment: PORT=3002 npm run dev:ui
# Point to different API: NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 npm run dev:ui
```

### Tests
```bash
# All tests (both workspaces)
npm run test:all

# API only (Jest)
npm run test:api
- Python not found: Make sure `python3` command works in your terminal. On some systems, you may need to create a symlink or use `python` instead.
- Code execution timeouts: Increase timeout values in tool parameters if needed for longer-running code.
- Expression results not showing: The Python tool automatically wraps simple expressions in print() - just write the expression like "hello"[::-1]

# UI only (Vitest)
npm run test:ui
```

### Troubleshooting
- Ports in use: API runs on port 3000 by default (edit `api/.env` to change PORT); UI on 3001 (override with `PORT=3002 npm run dev:ui`).
- CORS/errors hitting API: verify UI `NEXT_PUBLIC_API_BASE_URL` matches the running API origin (default http://localhost:3000).
- OpenAI usage: set `LLM_PROVIDER=openai` and `LLM_API_KEY` in `api/.env`, then restart API with `npm run dev:api`.
- Env not picked up: restart the API process after editing `api/.env`.
- Workspace install issues: delete `node_modules`, `package-lock.json` at root and in workspaces, then `npm install` from root.

## Quick Example

Try the agent immediately with no API key required:

```bash
# Run the ReAct agent to solve a math problem
npm run test:orchestrator -- react "Calculate 2+2"
```

This demonstrates:
- ✅ Reasoning capability (agent thinks about the problem)
- ✅ Tool use capability (agent calls the calculator tool)
- ✅ Complete workflow (from input to final answer)
- ✅ Streaming output (see each step as it happens)

**Sample Output:**
```
🚀 START - Pattern: react, Input: Calculate 2+2
🧠 CAPABILITY: reasoning - Reasoning about the problem...
✅ RESULT: I need to calculate this using the calculator tool.
🧠 CAPABILITY: tool_use - Deciding if tools are needed...
🔧 TOOL_CALL: calculator - Calling tool: calculator({"expression":"2+2"})
✅ RESULT: Tool calculator succeeded: {"expression":"2+2","result":4}
🧠 CAPABILITY: reasoning - Reasoning about the problem...
✅ RESULT: The calculation is complete. Task completed.
✅ COMPLETE - Duration: 9ms, Status: success
```

## Configuration

Configuration is managed through environment variables. All settings have sensible defaults and work without a `.env` file.

To customize settings, copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

### Workspace Configuration

```bash
# Directory where agent tools can read/write files
# Default: ./workspace (relative to project root)
WORKSPACE_DIR=./workspace

# Or use an absolute path:
# WORKSPACE_DIR=/tmp/agent-workspace
```

The workspace directory is a sandboxed location where:
- Agents can create, read, update, and delete files
- All file operations are restricted to this directory for security
- Directory traversal attacks (e.g., `../../etc/passwd`) are prevented
- Generated files are isolated from your project code

### LLM Provider Configuration

```bash
# Provider options: openai, anthropic, mock
LLM_PROVIDER=mock

# API key for your chosen provider
LLM_API_KEY=your-api-key-here

# Model to use
LLM_MODEL=gpt-4

# Temperature (0.0 - 1.0)
LLM_TEMPERATURE=0.7

# Maximum tokens per response
LLM_MAX_TOKENS=2000
```

### Server Configuration

```bash
# Port for the API server
PORT=3000
```

## Project Structure

```
/api                   # Backend workspace (API + core)
  /src
    /capabilities      # Individual agent capabilities
    /patterns          # Composed agentic patterns
    /tools             # External tool implementations
      base.ts          # Base tool class and utilities
      calculator.ts    # Mathematical calculations
      file-system.ts   # File read/write/list operations
    /llm               # LLM provider abstractions
    /orchestrator      # Main execution engine
    /api               # HTTP API layer
    config.ts          # Configuration management
    types.ts           # TypeScript type definitions
  /tests               # Test files mirror src structure
  /scripts             # CLI test utilities
  package.json         # API dependencies and scripts
  tsconfig.json
  jest.config.js
  .env / .env.example

/ui                    # Frontend workspace (Next.js)
  /app                 # Next.js app router pages
  /lib                 # UI utilities (SSE client, etc.)
  /__tests__           # Vitest tests
  package.json         # UI dependencies and scripts
  tsconfig.json
  vitest.config.ts

/docs                  # Documentation
/workspace             # Sandboxed directory for file operations
package.json           # Workspace root config
```

## Available Tools

### Calculator Tool

Performs mathematical calculations with security protections.

**Usage:**
```bash
npm run test:tool -- calculator '{"expression":"2+2"}'
npm run test:tool -- calculator '{"expression":"sqrt(16) * 2 + 3"}'
npm run test:tool -- calculator '{"expression":"sin(pi/2)"}'
```

**Supported operations:**
- Basic arithmetic: `+`, `-`, `*`, `/`, `**` (power)
- Functions: `sqrt()`, `abs()`, `floor()`, `ceil()`, `round()`, `max()`, `min()`
- Trigonometry: `sin()`, `cos()`, `tan()`, `log()`, `exp()`
- Constants: `pi`, `e`

### File System Tool

Read and write files within the workspace directory.

**Usage:**
```bash
# Write a file
npm run test:tool -- file_system '{"action":"write","path":"test.txt","content":"Hello World"}'

# Read a file
npm run test:tool -- file_system '{"action":"read","path":"test.txt"}'

# List directory contents
npm run test:tool -- file_system '{"action":"list","path":"."}'

# Check if file exists
npm run test:tool -- file_system '{"action":"exists","path":"test.txt"}'
```

**Security Features:**
- All paths are relative to the configured workspace directory
- Directory traversal (`../`) is blocked
- Cannot access files outside workspace

### Node Execution Tool

Execute JavaScript/Node.js code in a sandboxed environment.

**Usage:**
```bash
# Simple execution
npm run test:tool -- node_execute '{"code":"console.log(2 + 2)"}'

# With custom timeout
npm run test:tool -- node_execute '{"code":"console.log(Math.sqrt(16))","timeout":3000}'
```

**Features:**
- Sandboxed execution using Node.js vm module
- Captures console.log/error/warn/info output
- Configurable timeout (default: 5000ms)
- Returns result value and captured output

**Security:**
- Disabled: `require`, `process`, `setTimeout`, `setInterval`
- No file system or network access
- Timeout enforcement prevents infinite loops

### Python Execution Tool

Execute Python code in a subprocess with timeout. **Supports automatic visualization detection** - creates charts and tables by generating manifest files.

**Usage:**
```bash
# Simple execution
npm run test:tool -- python_execute '{"code":"print(2 + 2)"}'

# With custom timeout
npm run test:tool -- python_execute '{"code":"import math\\nprint(math.sqrt(16))","timeout":5000}'

# Test visualization detection
npm run test:tool -- python_execute '{"code":"import json,csv\\ndata=[{\"x\":1,\"y\":2}]\\nwith open(\"data.csv\",\"w\") as f: csv.DictWriter(f,[\"x\",\"y\"]).writeheader();csv.DictWriter(f,[\"x\",\"y\"]).writerows(data)\\nwith open(\"visualization_manifest.json\",\"w\") as f: json.dump({\"version\":\"1.0\",\"outputs\":[{\"id\":\"c1\",\"type\":\"bar_chart\",\"title\":\"Test\",\"dataFile\":\"data.csv\",\"config\":{\"xColumn\":\"x\",\"yColumns\":[\"y\"]}}]},f)","workspaceDir":"./api/test-workspace"}'
```

**Features:**
- Spawns Python subprocess for execution
- Captures stdout and stderr separately
- Configurable timeout (default: 10000ms)
- **Automatic visualization detection and parsing**
- Supports workspace directory for file operations
- Returns exit code and all output

**Visualization Support:**
When Python code creates these files in the workspace:
1. `visualization_manifest.json` - Chart configuration
2. `data.csv` or `data.json` - Data file

The tool automatically:
- Detects the manifest file
- Validates the structure
- Parses the data file
- Includes visualization in the result

**Supported chart types:** `table`, `line_chart`, `bar_chart`, `scatter`, `pie_chart`

**Example visualization prompt (for ReAct pattern):**
```
Create a bar chart showing monthly sales: Jan=$10000, Feb=$12000, Mar=$15000
```

The LLM will generate Python code that creates the manifest and CSV files, which are automatically detected and rendered in the UI.

**Requirements:**
- Python 3.8+ must be installed
- `python3` command must be available in PATH

**Security Features:**
- Directory traversal protection prevents access outside workspace
- Python executes in specified workspace directory
- Returns detailed error messages for debugging

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Test individual tools
npm run test:tool -- <tool_name> <params_json>

# Test LLM providers
npm run test:llm -- <provider> "<message>"

# Test capabilities
npm run test:capability -- <capability> "<query>" [--provider=openai]

# Test patterns
npm run test:pattern -- <pattern> "<input>" [--provider=openai]

# Test orchestrator
npm run test:orchestrator -- <pattern> "<input>" [--provider=openai] [--debug]
```

**Test Coverage:**
- All API tests passing: 311 tests, 17 suites ✅
- Includes tools, LLM providers, capabilities (Reasoning, ToolUse, Validation), patterns (ReAct), orchestrator, API, and utilities
  
Note: Detailed per-suite counts evolve frequently; see docs/current_state.md for up-to-date breakdowns.

## Examples

### Testing Tools

```bash
# Calculator - basic arithmetic
npm run test:tool -- calculator "2 + 2 * 5"

# Calculator - advanced math
npm run test:tool -- calculator "sqrt(16) * sin(pi/2)"

# File system - list workspace
npm run test:tool -- file_system list

# File system - write and read
npm run test:tool -- file_system write test.txt "Hello from agent!"
npm run test:tool -- file_system read test.txt
```

### Testing LLM Providers

```bash
# Mock provider (no API key needed)
npm run test:llm -- mock "Hello, how are you?"

# OpenAI provider (requires LLM_API_KEY in .env)
npm run test:llm -- openai "What is 2 + 2?"
npm run test:llm -- openai "Explain quantum computing in one sentence"
```

### Testing Reasoning Capability

```bash
# Simple reasoning with mock provider
npm run test:capability -- reasoning "What is 2 + 2?"

# Complex multi-step reasoning with OpenAI
npm run test:capability -- reasoning "If I have 10 apples and give away 3, then buy 5 more, how many do I have?" --provider=openai

# Tool-aware reasoning
npm run test:capability -- reasoning "Should I use the calculator tool to compute 15 * 23?" --provider=openai

# Contextual reasoning
npm run test:capability -- reasoning "A train leaves at 3pm going 60mph. Another train leaves at 4pm going 80mph. When does the second train catch up?" --provider=openai
```

### Testing ReAct Pattern

```bash
# Simple calculation with mock provider
npm run test:pattern -- react "Calculate 2+2"

# Complex reasoning and tool use with OpenAI
npm run test:pattern -- react "Calculate the factorial of 5" --provider=openai

# Multi-step problem solving
npm run test:pattern -- react "If sqrt(16) equals X, what is X * 3 + 7?" --provider=openai --max-iterations=5

# With verbose output (shows iteration details)
npm run test:pattern -- react "Solve: 15 * 23 + 100" --provider=openai --verbose=true
```

### Testing Orchestrator

The orchestrator provides a unified interface for executing any registered pattern with streaming events:

```bash
# Simple calculation
npm run test:orchestrator -- react "Calculate 2+2"

# Complex multi-step problem
npm run test:orchestrator -- react "Calculate factorial of 5" --provider=openai

# With debug mode (shows internal details)
npm run test:orchestrator -- react "What is sqrt(144) * 3?" --provider=openai --debug

# With execution limits
npm run test:orchestrator -- react "Solve complex problem" --max-steps=20 --timeout=30000
```

**Example Output:**
```
================================================================================
Testing Orchestrator with react pattern
================================================================================
Input: Calculate 2+2
Provider: mock
Debug: false
Visualizations: false
================================================================================

Using mock provider with predefined responses
Starting execution...

[11:43:27 AM] 🚀 START
   Pattern: react
   Input: Calculate 2+2
   Options: {"debug":false,"visualizations":false}

[11:43:27 AM] ✅ RESULT
   Starting ReAct pattern for: "Calculate 2+2"

[11:43:27 AM] ✅ RESULT
   
--- Iteration 1 ---

[11:43:27 AM] 🧠 CAPABILITY
   Capability: reasoning
   Reasoning about the problem...

[11:43:27 AM] ✅ RESULT
   I need to calculate this using the calculator tool.

[11:43:27 AM] 🧠 CAPABILITY
   Capability: tool_use
   Deciding if tools are needed...

[11:43:27 AM] 🔧 TOOL_CALL
   Tool: calculator
   Calling tool: calculator({"expression":"2+2"})

[11:43:27 AM] ✅ RESULT
   Observation: Tool calculator succeeded: {"expression":"2+2","result":4}

[11:43:27 AM] ✅ RESULT
   
--- Iteration 2 ---

[11:43:27 AM] 🧠 CAPABILITY
   Capability: reasoning
   Reasoning about the problem...

[11:43:27 AM] ✅ RESULT
   The calculation is complete. Task completed.

[11:43:27 AM] ✅ RESULT
   
✓ Task completed successfully

[11:43:27 AM] ✅ RESULT
   
Final Answer: The calculation is complete. Task completed.

[11:43:27 AM] ✅ COMPLETE
   Duration: 9ms
   Status: success


================================================================================
Execution completed
================================================================================
```

**Old Pattern Test Output:**
```
================================================================================
Testing react pattern
================================================================================
Input: Calculate 2+2
Provider: mock
Max Iterations: 10
Verbose: true
================================================================================

Starting execution...

[11:33:17 AM] ✅ RESULT:
   Starting ReAct pattern for: "Calculate 2+2"

[11:33:17 AM] ✅ RESULT:
   --- Iteration 1 ---

[11:33:17 AM] 🧠 CAPABILITY: reasoning
   Reasoning about the problem...

[11:33:17 AM] ✅ RESULT:
   I need to calculate this using the calculator tool.

[11:33:17 AM] 🧠 CAPABILITY: tool_use
   Deciding if tools are needed...

[11:33:17 AM] 🔧 TOOL CALL: calculator
   Calling tool: calculator({"expression":"2+2"})

[11:33:17 AM] ✅ RESULT:
   Observation: Tool calculator succeeded: {"expression":"2+2","result":4}

[11:33:17 AM] ✅ RESULT:
   --- Iteration 2 ---

[11:33:17 AM] 🧠 CAPABILITY: reasoning
   Reasoning about the problem...

[11:33:17 AM] ✅ RESULT:
   The calculation is complete. Task completed.

[11:33:17 AM] ✅ RESULT:
   ✓ Task completed successfully

[11:33:17 AM] ✅ RESULT:
   Final Answer: The calculation is complete. Task completed.

================================================================================
Execution completed
================================================================================
```

### Starting the API Server

Run the HTTP API server to access agent patterns via REST endpoints:

```bash
# Start with mock provider (no API key needed)
npm run start:api

# Start with OpenAI provider
npm run start:api -- --provider=openai

# Use custom port
npm run start:api -- --port=8080
```

**Available Endpoints:**

```bash
# List available patterns
curl http://localhost:3000/api/patterns

# List available capabilities
curl http://localhost:3000/api/capabilities

# List available tools
curl http://localhost:3000/api/tools

# Execute a pattern (with SSE streaming)
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"pattern": "react", "input": "Calculate 2+2"}'
```

**Example Response (SSE Stream):**
```
data: {"timestamp":1702915407000,"eventType":"start","data":{"pattern":"react","input":"Calculate 2+2"}}

data: {"timestamp":1702915407001,"eventType":"step","data":{"type":"capability","capability":"reasoning","content":"Reasoning about the problem..."}}

data: {"timestamp":1702915407002,"eventType":"step","data":{"type":"tool_call","tool":"calculator","content":"Calling tool: calculator({\"expression\":\"2+2\"})"}}

data: {"timestamp":1702915407003,"eventType":"complete","data":{"status":"success","duration":16}}

event: done
data: {}
```

## Development

### Building

```bash
# Compile TypeScript
npm run build

# Output goes to ./dist directory
```

### Adding New Tools

1. Create a new file in `/src/tools/`
2. Extend `BaseTool` class
3. Implement `name`, `description`, `parameters`, and `execute()` method
4. Add tests in `/tests/tools/`
5. Export from `/src/tools/index.ts`

Example:
```typescript
import { BaseTool } from './base';
import { ToolResult } from '../types';

export class MyTool extends BaseTool {
  name = 'my_tool';
  description = 'What my tool does';
  parameters = {
    type: 'object' as const,
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) return validationError;

    try {
      // Your tool logic here
      return this.success({ result: 'output' });
    } catch (error) {
      return this.error(`Error: ${error.message}`);
    }
  }
}
```

## Architecture

The system uses a three-layer architecture:

1. **Tools Layer**: External functions (calculator, file system, etc.)
2. **Capabilities Layer**: Agent skills that compose tools (reasoning, planning, reflection)
3. **Patterns Layer**: Orchestrated workflows (ReAct, Plan-Execute, Reflection, etc.)

See [architecture.md](architecture.md) for detailed design documentation.

## Implementation Status

See [current_state.md](current_state.md) for the current implementation progress.

**Completed:**
- ✅ Core types and contracts
- ✅ Basic tools (Calculator, File System)
- ✅ Code execution tools (Node.js, Python)
- ✅ LLM providers (Mock, OpenAI)
- ✅ Agent capabilities (Reasoning, ToolUse, Synthesis)
- ✅ Agentic patterns (ReAct)
- ✅ Orchestrator
- ✅ API Layer (Express + SSE)
- ✅ UI Layer (Next.js with SSE streaming)
- 🚧 Self-correcting patterns (next)
- 🚧 Additional patterns and capabilities

### Known Limitations

- Plan-and-Validate currently relies on `ValidationCapability` to judge each step after tool execution. The capability inspects the latest tool output but does not ask the LLM to design or run validation-specific tools, so "validation" steps are descriptive checks rather than executable tool calls. See [docs/architecture.md](docs/architecture.md#plan-and-validate-pattern) for more detail and mitigation ideas.

## Documentation

- [PRD](docs/prd.md) - Product requirements and goals
- [Architecture](docs/architecture.md) - Technical design and data flow
- [Scenario](docs/scenario.md) - Code generation use cases and tools
- [Current State](docs/current_state.md) - Implementation progress

## Security Considerations

- **File System**: Sandboxed to workspace directory with path validation
- **Calculator**: Expression evaluation with dangerous pattern detection
- **No eval()**: Safe expression evaluation using Function constructor with restricted scope
- **Tool Validation**: All parameters validated before execution

## License

MIT
