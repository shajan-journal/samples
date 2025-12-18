# Agentic AI Patterns Exploration

A collection of simple, illustrative samples demonstrating different agentic AI patterns using composable agent capabilities. Focus is on quick exploration and learning, not production-grade implementation.

## Overview

This project demonstrates core agent capabilities (planning, reasoning, reflection, tool use, etc.) and how to compose them into standard agentic patterns like ReAct, Plan-and-Execute, Reflection, Tree-of-Thoughts, and more.

**Tech Stack**: Node.js / TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Python 3.8+ (optional, for Python execution tool)

### Installation

```bash
# Clone or navigate to the project
cd agent-patterns

# Install dependencies
npm install

# (Optional) Copy environment configuration to customize settings
cp .env.example .env
# Edit .env with your preferences

# Build the project
npm run build

# Run tests
npm test
```

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
  /ui                # User interface
  config.ts          # Configuration management
  types.ts           # TypeScript type definitions

/scripts
  test-tool.ts       # CLI for testing individual tools

/tests
  # Test files mirror src structure
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
- Directory traversal protection prevents access outside workspace
- Automatically creates nested directories when needed
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
- Type validation tests (31 tests)
- Calculator tool tests (54 tests)  
- File system tool tests (31 tests)
- LLM provider tests (32 tests)
- Capability tests (22 tests)
- Pattern tests (12 tests)
- Orchestrator tests (17 tests)
- API server tests (10 tests)
- **Total: 170 tests, all passing ✅**

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
- ✅ LLM providers (Mock, OpenAI)
- ✅ Agent capabilities (Reasoning, ToolUse)
- ✅ Agentic patterns (ReAct)
- ✅ Orchestrator
- ✅ API Layer (Express + SSE)
- 🚧 UI Layer (next)
- 🚧 Code Execution Tools

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
