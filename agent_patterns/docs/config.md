# Configuration Guide

All settings are configured via environment variables. Sensible defaults work out of the box.

## Quick Setup

```bash
# Copy template
cp api/.env.example api/.env

# Edit as needed
nano api/.env

# Restart API
npm run dev:api
```

## Environment Variables

### LLM Provider

Choose which LLM service to use.

```bash
# Provider: mock (default), openai, anthropic
LLM_PROVIDER=mock

# API key for provider (not needed for mock)
LLM_API_KEY=sk-...

# Model to use (provider-specific)
LLM_MODEL=gpt-4

# Response settings
LLM_TEMPERATURE=0.7           # 0.0 (deterministic) to 1.0 (creative)
LLM_MAX_TOKENS=2000          # Max tokens per response
```

### Server

```bash
# API server port
PORT=3000

# Optional: API host (default: localhost)
HOST=0.0.0.0
```

### Workspace

```bash
# Directory for file operations (relative or absolute)
# Default: ./workspace
WORKSPACE_DIR=./workspace

# Or use absolute path:
# WORKSPACE_DIR=/tmp/agent-workspace
```

### Frontend (UI only)

In `ui/.env.local`:

```bash
# API base URL (where the API is running)
# Default: http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Provider-Specific Configuration

### Mock Provider (Default)

No configuration needed. Returns canned responses for testing.

```bash
LLM_PROVIDER=mock
# No API key required
```

Use for:
- Development
- Testing without API costs
- Demos
- Learning the system

### OpenAI

Requires API key from https://platform.openai.com

```bash
LLM_PROVIDER=openai
LLM_API_KEY=sk-proj-...
LLM_MODEL=gpt-4                 # or gpt-4-turbo, gpt-3.5-turbo
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2000
```

Models available:
- `gpt-4` (most capable, $0.03/$0.06 per 1K tokens)
- `gpt-4-turbo-preview` (faster, $0.01/$0.03 per 1K tokens)
- `gpt-3.5-turbo` (cheapest, $0.0005/$0.0015 per 1K tokens)

### Anthropic

Requires API key from https://console.anthropic.com

```bash
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-sonnet      # or claude-3-opus, claude-3-haiku
```

Models available:
- `claude-3-opus` (most capable)
- `claude-3-sonnet` (balanced)
- `claude-3-haiku` (fast, cheaper)

## Port Configuration

### API Port

```bash
# In api/.env
PORT=3000
```

Override via environment:
```bash
PORT=3001 npm run dev:api
```

### UI Port

```bash
# In shell
PORT=3002 npm run dev:ui
```

Next.js UI automatically uses next available port if configured port is busy.

## Workspace Directory

### Purpose

Isolated directory where agents can safely read/write files.

### Configuration

```bash
# Relative to project root
WORKSPACE_DIR=./workspace

# Or absolute path
WORKSPACE_DIR=/tmp/agent-workspace

# Or user home directory
WORKSPACE_DIR=~/agent-workspace
```

### Security

- All file operations restricted to this directory
- Directory traversal (`../`) is blocked
- Cannot access files outside workspace
- Perfect for sandboxed execution

### Workspace Isolation

Each workspace is independent:

```bash
# Test workspace
WORKSPACE_DIR=./test-workspace npm run dev:api

# Production workspace
WORKSPACE_DIR=/var/agent/data npm run dev:api
```

## Temperature Explanation

Affects LLM response randomness:

```bash
LLM_TEMPERATURE=0.0   # Deterministic, same answer every time
LLM_TEMPERATURE=0.5   # Balanced (recommended)
LLM_TEMPERATURE=1.0   # Creative, varies each time
```

**When to use:**
- Math/logic problems: Low (0.0-0.3)
- Code generation: Medium (0.5-0.7)
- Creative writing: High (0.7-1.0)

## Max Tokens

Controls response length:

```bash
LLM_MAX_TOKENS=500    # Short responses
LLM_MAX_TOKENS=2000   # Medium (recommended)
LLM_MAX_TOKENS=4000   # Long, detailed responses
```

**Cost considerations:**
- Longer responses = higher API costs
- Most tasks need <2000 tokens
- Visualization generation is typically <500 tokens

## Troubleshooting

### API Server Won't Start

Check port is available:
```bash
# Find what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 npm run dev:api
```

### Can't Connect to API from UI

Verify `NEXT_PUBLIC_API_BASE_URL` matches running API:

```bash
# UI
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 npm run dev:ui

# API
npm run dev:api
```

### API Key Not Working

Verify:
1. API key is correct and active
2. Key is set in `.env` file
3. API server was restarted after changing `.env`
4. Provider matches key (OpenAI key with OpenAI provider)

```bash
# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Workspace Permission Error

Ensure directory is writable:

```bash
# Create directory if needed
mkdir -p ./workspace

# Fix permissions
chmod 755 ./workspace
```

## Environment Variables Reference

| Variable | Default | Example | Purpose |
|----------|---------|---------|---------|
| `LLM_PROVIDER` | `mock` | `openai` | Which LLM to use |
| `LLM_API_KEY` | none | `sk-...` | API authentication |
| `LLM_MODEL` | `gpt-4` | `gpt-3.5-turbo` | Model selection |
| `LLM_TEMPERATURE` | `0.7` | `0.5` | Response randomness |
| `LLM_MAX_TOKENS` | `2000` | `4000` | Response length limit |
| `PORT` | `3000` | `3001` | API server port |
| `WORKSPACE_DIR` | `./workspace` | `/tmp/agent-ws` | File operation directory |

## Advanced Configuration

### Custom LLM Provider

Extend `BaseLLM`:

```typescript
// api/src/llm/custom.ts
export class CustomProvider extends BaseLLM {
  async call(messages: Message[]): Promise<string> {
    // Your implementation
  }
}
```

Register in `orchestrator.ts`:

```typescript
import { CustomProvider } from '../llm/custom';

const provider = new CustomProvider(config);
```

### Load Balancing

Run multiple API instances:

```bash
# Terminal 1
PORT=3000 npm run dev:api

# Terminal 2
PORT=3001 npm run dev:api

# Point UI to load balancer
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002 npm run dev:ui
```

## Performance Tuning

### Faster Responses

```bash
LLM_MODEL=gpt-3.5-turbo      # Faster model
LLM_MAX_TOKENS=1000          # Shorter responses
LLM_TEMPERATURE=0.3          # Deterministic
```

### Better Quality

```bash
LLM_MODEL=gpt-4              # Most capable
LLM_MAX_TOKENS=4000          # Longer responses
LLM_TEMPERATURE=0.7          # Balanced
```

## Production Deployment

See [Architecture](./architecture.md) for deployment guidance.
