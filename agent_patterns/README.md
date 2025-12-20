# Agentic AI Patterns Exploration

A TypeScript/Node.js exploration of agentic AI patterns with composable agent capabilities and a Web UI.

**Tech Stack**: Node.js / TypeScript (API), Next.js / React (UI)  
**Status**: Actively developed — see [current_state.md](docs/current_state.md)

## Quick Start

```bash
# Install dependencies
npm install

# Start API (port 3000, mock LLM provider)
npm run dev:api

# In another terminal, start UI (port 3001)
npm run dev:ui

# Open http://localhost:3001
```

Try the default example: "Calculate 2+2" uses the calculator tool via ReAct pattern.

## Requirements

- **Node.js 18+**
- **Python 3.8+** (for Python code execution tool)

## Documentation

- **[Getting Started](docs/getting-started.md)** — Quick 5-minute setup and first steps
- **[Patterns](docs/patterns.md)** — Available agentic patterns (ReAct, Plan-and-Validate)
- **[Tools](docs/tools.md)** — Available tools and how to create custom tools
- **[Architecture & Design](docs/architecture.md)** — Three-layer pattern, data flow, extending the system
- **[Configuration](docs/config.md)** — Environment variables and configuration options
- **[Testing](docs/testing.md)** — How to test patterns, tools, and capabilities
- **[Current Implementation](docs/current_state.md)** — Completed features, test coverage, known limitations

## Project Structure

```
/api              Backend (API + core orchestrator)
  /src
    /patterns     Agentic patterns (ReAct, Plan-and-Validate)
    /capabilities Agent skills (reasoning, tool-use, validation)
    /tools        External tools (calculator, file-system, code execution)
    /llm          LLM provider abstractions (mock, OpenAI)
    /api          HTTP API (Express + SSE)
/ui               Frontend (Next.js with SSE streaming)
/docs             Detailed documentation
```

## Key Features

- **Composable Capabilities**: Chain reasoning, planning, tool-use, and validation
- **Multiple Tools**: Math calculations, file I/O, Node.js and Python code execution
- **Streaming API**: Server-sent events for real-time agent execution visibility
- **Web UI**: Interactive pattern testing with streaming output
- **Type-safe**: Full TypeScript implementation
- **Safe Execution**: Sandboxed file operations and code execution

## Common Tasks

```bash
# Run all tests
npm run test:all

# Test a specific tool
npm run test:tool -- calculator '{"expression":"2+2"}'

# Test the ReAct pattern
npm run test:orchestrator -- react "Calculate 2+2"

# Run the API server
npm run dev:api

# Run the UI
npm run dev:ui
```

See [docs/tools.md](docs/tools.md) for complete tool reference and examples.

## License

MIT
