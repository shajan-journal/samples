# Getting Started

## Quick Start (5 minutes)

### Prerequisites
- Node.js 18+
- Python 3.8+ (for visualization and Python code execution)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start API server (port 3000)
npm run dev:api

# 3. In another terminal, start UI (port 3001)
npm run dev:ui

# 4. Open http://localhost:3001
```

### First Steps

Try these in the UI:
- **Math**: "Calculate 2+2" → uses calculator tool
- **Code**: "Reverse the string 'hello'" → uses code execution
- **Visualization**: "Create a bar chart showing Q1 2024 sales: January $45k, February $52k, March $48k"

Or from CLI:
```bash
npm run test:orchestrator -- react "Calculate 2+2"
```

## What Just Happened?

The system executed this flow:
1. **Reasoning** - Agent analyzed your request
2. **Tool Selection** - Agent chose the right tool
3. **Execution** - Tool ran (calculator, code, or visualization)
4. **Response** - Agent synthesized the final answer

## Configuration

Default configuration works without `.env`. To customize:

```bash
cp api/.env.example api/.env
```

**Common settings:**
```bash
# Use OpenAI instead of mock
LLM_PROVIDER=openai
LLM_API_KEY=sk-...

# Change API port
PORT=3000

# Workspace for file operations
WORKSPACE_DIR=./workspace
```

## Next Steps

- **Learn Patterns**: See [Available Patterns](./patterns.md)
- **Build Tools**: See [Tool Development](./tools.md)
- **Write Tests**: See [Testing Guide](./testing.md)
- **Architecture**: See [System Architecture](./architecture.md)
- **Visualizations**: See [Visualization Contract](./visualization-contract.md)
