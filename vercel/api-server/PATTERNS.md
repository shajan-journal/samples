# Agentic Patterns with Vercel AI SDK

This API server demonstrates different agentic patterns using the Vercel AI SDK v6.

## Patterns Implemented

### 1. ReAct (Reasoning + Acting)
**Endpoint:** `POST /api/patterns/react`

The ReAct pattern combines reasoning and acting in an interleaved manner. The agent:
1. **Thinks** about what information it needs
2. **Acts** by calling appropriate tools
3. **Observes** the results
4. **Repeats** until the task is complete

```bash
curl -X POST http://localhost:3001/api/patterns/react \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the weather in San Francisco? Also calculate 25 * 4"}'
```

### 2. Plan and Execute
**Endpoint:** `POST /api/patterns/plan-execute`

Creates a detailed plan first, then executes each step sequentially. Best for complex multi-step tasks.

```bash
curl -X POST http://localhost:3001/api/patterns/plan-execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Write a comprehensive guide on TypeScript"}'
```

### 3. Routing
**Endpoint:** `POST /api/patterns/routing`

Classifies input and routes to specialized handlers based on type and complexity.

```bash
curl -X POST http://localhost:3001/api/patterns/routing \
  -H "Content-Type: application/json" \
  -d '{"input": "Calculate compound interest on $1000 at 5% for 3 years"}'
```

### 4. Parallel Processing
**Endpoint:** `POST /api/patterns/parallel`

Runs multiple independent analyses simultaneously (sentiment, key points, summary).

```bash
curl -X POST http://localhost:3001/api/patterns/parallel \
  -H "Content-Type: application/json" \
  -d '{"content": "The AI SDK 6.0 brings significant improvements..."}'
```

### 5. Evaluator-Optimizer
**Endpoint:** `POST /api/patterns/evaluator-optimizer`

Generates output, evaluates quality, and iteratively improves until quality threshold is met.

```bash
curl -X POST http://localhost:3001/api/patterns/evaluator-optimizer \
  -H "Content-Type: application/json" \
  -d '{"task": "Write a haiku about programming", "qualityThreshold": 8, "maxIterations": 3}'
```

### 6. Orchestrator-Worker
**Endpoint:** `POST /api/patterns/orchestrator-worker`

An orchestrator breaks down complex tasks and delegates to specialized workers (researcher, analyzer, writer, reviewer).

```bash
curl -X POST http://localhost:3001/api/patterns/orchestrator-worker \
  -H "Content-Type: application/json" \
  -d '{"task": "Create a blog post about AI in software development"}'
```

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up your environment variables:
```bash
echo "OPENAI_API_KEY=your_api_key" > .env
```

3. Start the server:
```bash
pnpm dev
```

4. Test the patterns:
```bash
# List all patterns
npx tsx scripts/test-patterns.ts list

# Test a specific pattern
npx tsx scripts/test-patterns.ts react

# Test all patterns
npx tsx scripts/test-patterns.ts all
```

## API Reference

### List Available Patterns
```
GET /api/patterns
```

Returns all available patterns with their descriptions and endpoints.

### Original Chat Endpoint
```
POST /api/chat
```

Standard streaming chat endpoint (unchanged from original).

## Architecture

```
src/
├── index.ts              # Main Express server with all endpoints
└── patterns/
    ├── index.ts          # Pattern exports
    ├── tools.ts          # Reusable tools (weather, calculator, search, etc.)
    └── agents.ts         # Pattern implementations
```

## Pattern Selection Guide

| Pattern | Best For | Characteristics |
|---------|----------|-----------------|
| ReAct | Tool-based tasks | Iterative, uses tools, observable steps |
| Plan & Execute | Complex multi-step tasks | Structured, sequential, traceable |
| Routing | Diverse input types | Adaptive, efficient, specialized handlers |
| Parallel | Analysis tasks | Fast, comprehensive, concurrent |
| Evaluator-Optimizer | Quality-sensitive tasks | Iterative improvement, quality-focused |
| Orchestrator-Worker | Large complex tasks | Delegated, specialized, coordinated |

## Learn More

- [AI SDK Documentation](https://ai-sdk.dev/docs)
- [AI SDK Agents Overview](https://ai-sdk.dev/docs/agents/overview)
- [Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)
- [Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
