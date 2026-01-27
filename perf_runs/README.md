# Journal Eval Dashboard

A minimal React app for visualizing Journal agent evaluation results, tool coverage, and triggering new evaluation runs.

## Quick Start

```bash
cd ~/src/sdasan/samples/perf_runs
cp .env.example .env
# Edit .env with your credentials
pnpm install
pnpm dev
```

Open http://localhost:5173

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# .env

# Evaluation Database Connection (Neon PostgreSQL)
EVAL_DATABASE_URL="postgresql://neondb_owner:npg_f5Hoz7mNicrd@ep-tiny-heart-a4x4jz59-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Context Engine Eval Directory (where the python eval code lives)
CONTEXT_ENGINE_EVAL_DIR="/Users/shajandasan/src/context-engine/context-engine/python/eval"

# Journal API Configuration (for triggering runs)
JOURNAL_API_URL="http://localhost:3001"
JOURNAL_COOKIE="your-session-cookie-here"

# Optional: Neon branch reset configuration
NEON_API_KEY=""
NEON_PROJECT_ID=""
NEON_BRANCH_ID=""

# Default eval settings
DEFAULT_MODEL="claude-opus-4-5"
DEFAULT_PROMPT_TYPE="lean"

# Anthropic API Key (for AI Assistant)
ANTHROPIC_API_KEY="sk-ant-..."
```

### Getting the Auth Cookie

1. Open Journal in your browser
2. Open DevTools > Application > Cookies
3. Copy the session cookie value
4. Set it in `.env` as `JOURNAL_COOKIE`

## Features

### Overview Dashboard
- Key metrics at a glance (All Pass %, Correctness, Tool Coverage, Latency)
- Performance trend chart across runs
- Recent run history table

### Agent Runs
- Detailed table of all agent evaluation runs
- Metric pass rates visualization
- Filter by number of runs

### Tool Coverage
- Visual breakdown of tested vs untested tools
- Tool usage frequency in test set
- Missing coverage identification

### Trigger Run
- Start new evaluation runs from the UI
- Configure model, prompt type, and limits
- Real-time output streaming
- Stop running evaluations

### AI Assistant
- Chat interface for querying evaluation data
- Powered by Claude API
- Structured responses rendered as:
  - Metric cards with KPIs
  - Data tables
  - Line charts (trends)
  - Bar charts (comparisons)
- Context-aware: has access to last 20 agent and latency runs

## Architecture

```
perf_runs/
├── server/
│   └── index.ts        # Express API server (port 3333)
├── src/
│   ├── App.tsx         # Main app with tabs
│   ├── components/
│   │   ├── AgentRuns.tsx
│   │   ├── AIAssistant.tsx
│   │   ├── ToolCoverage.tsx
│   │   ├── TriggerRun.tsx
│   │   └── TrendChart.tsx
│   ├── index.css
│   └── main.tsx
├── .env                # Configuration
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/agent-runs` | List agent evaluation runs |
| `GET /api/retrieval-runs` | List retrieval evaluation runs |
| `GET /api/latency-runs` | List latency benchmark runs |
| `GET /api/tool-coverage` | Get tool coverage analysis |
| `GET /api/config` | Get current configuration |
| `POST /api/trigger-run` | Start a new evaluation |
| `GET /api/run-status/:runId` | Get status of running evaluation |
| `POST /api/stop-run/:runId` | Stop a running evaluation |
| `POST /api/ask` | AI Assistant - ask questions about eval data |

---

# Evaluation System Reference

## Datasets

Located in: `$CONTEXT_ENGINE_EVAL_DIR/agent_eval/datasets/`

| Dataset | Test Cases | Status | Notes |
|---------|------------|--------|-------|
| `journal_agent_dataset_2.json` | 43 | **Active** | Default dataset, uses current tools |
| `journal_agent_dataset.json` | 78 | Deprecated | Uses old tool names (e.g., `analyzeGitHubCode`) |

### Dataset 2 Structure

```json
{
  "session_id": "uuid",
  "user_query": "User's question",
  "tool_calls": [
    {
      "toolCallId": "...",
      "toolName": "lookupTasks",
      "input": "{...}",
      "success": true,
      "message": "{...}"
    }
  ],
  "agent_response": "Expected response",
  "session_title": "...",
  "session_type": "web",
  "user_id": "...",
  "organization_id": "...",
  "queried_at": "timestamp"
}
```

## Tool Coverage (as of Jan 2026)

### Tested Tools (26 tools in dataset_2)

| Tool | Usage Count | Category |
|------|-------------|----------|
| sandboxRead | 71 | Code Analysis |
| sandboxRipgrep | 53 | Code Analysis |
| sandboxBash | 49 | Code Analysis |
| lookupDocumentContent | 15 | Documents |
| listGitHubRepositories | 13 | Integrations |
| lookupTasks | 13 | Tasks |
| contextSearch | 12 | Context |
| lookupProjects | 8 | Organization |
| exploreCodebase | 6 | Code Analysis |
| lookupDocuments | 5 | Documents |
| completePlanningPhase | 4 | Planning |
| documentWrite | 3 | Documents |
| documentCreate | 2 | Documents |
| documentUpdate | 2 | Documents |
| fetchContent | 2 | Web |
| lookupTaskResources | 2 | Tasks |
| lookupUsers | 2 | Organization |
| codeSearch | 1 | Code Analysis |
| getCurrentUser | 1 | Organization |
| listCodeDefinitions | 1 | Code Analysis |
| lookupOrganization | 1 | Organization |
| lookupTaskComments | 1 | Tasks |
| prepareImplementationPlan | 1 | Planning |
| webSearch | 1 | Web |

### Untested Tools (24+ tools)

- `addTaskComment` - Task management
- `completeContentPhase` / `completeStructurePhase` - KB workflows
- `contextQuery` - Context engine
- `continueExploration` - Code exploration
- `councilFeedback` - Multi-agent
- `createMeetingBot` / `getMeetingBotStatus` - Meetings
- `createTask` - Task creation
- `fetchFigmaFrame` - Figma integration
- `getCurrentBuild` - Build info
- `getProjectStats` - Analytics
- `ingestGranolaTranscript` - Transcripts
- `insertText` - Document editing
- `lookupLabels` - Labels
- `lookupSubTasks` - Subtasks
- `lookupWorkspaces` - Workspaces
- `makeCodeChanges` - Code changes
- `prepareSlackResponse` / `submitSlackResponse` - Slack
- `saveExplorationContext` - Exploration
- `submitPr` - PRs
- `updateTask` - Task updates

## Evaluation Metrics

### Agent Evaluation Metrics

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Faithfulness | 0.5 | Response supported by retrieved context |
| Answer Relevancy | 0.6 | Response relevance to the question |
| Correctness | 0.6 | Claims grounded in retrieval context |
| Tool Coverage | 0.5 | % of expected tools called |
| Tool Order | 0.5 | Logical ordering of tool calls |

### Retrieval Evaluation Metrics

| Metric | Description |
|--------|-------------|
| Retrieval Recall | % of relevant docs retrieved |
| Context Recall | % of necessary context retrieved |
| Context Precision | Precision of retrieved context |
| Precision@K | Precision at K results |
| F1 Score | Harmonic mean of precision/recall |

## Running Evaluations Manually

```bash
cd $CONTEXT_ENGINE_EVAL_DIR

# Run full agent evaluation
uv run pytest agent_eval/test_journal_agent.py \
  --journal-cookie "your-cookie" \
  --agent-model claude-opus-4-5 \
  --agent-prompt-type lean

# Run single test case
uv run pytest agent_eval/test_journal_agent.py \
  --journal-cookie "your-cookie" \
  --case-index 0

# Run with limit
uv run pytest agent_eval/test_journal_agent.py \
  --journal-cookie "your-cookie" \
  --eval-limit 5

# Run latency benchmark
uv run pytest agent_eval/test_journal_agent_latency.py \
  --journal-cookie "your-cookie" \
  --latency-iterations 3

# Query results
EVAL_DATABASE_URL="..." uv run ./query_eval_runs.py --eval-type agent --limit 10
```

## Database Schema

### agent_eval_runs

```sql
run_id, timestamp, test_type, dataset_file, machine_name,
model, prompt_type, api_commit_sha, total_test_cases,
avg_faithfulness, avg_answer_relevancy, avg_correctness,
avg_tool_call_coverage, avg_tool_order_score, avg_response_latency_ms,
faithfulness_pass_pct, answer_relevancy_pass_pct, correctness_pass_pct,
tool_coverage_pass_pct, tool_order_pass_pct, all_metrics_pass_pct
```

### retrieval_eval_runs

```sql
run_id, timestamp, test_type, dataset_file, machine_name,
total_test_cases, avg_retrieval_recall, avg_context_recall,
avg_context_precision, avg_precision_at_k, avg_f1_score,
retrieval_recall_pass_pct, context_recall_pass_pct, context_precision_pass_pct,
precision_at_k_pass_pct, f1_score_pass_pct, all_metrics_pass_pct
```

### latency_benchmark_runs

```sql
run_id, timestamp, machine_name, model, prompt_type,
query, iteration_count, valid_iterations,
avg_latency_ms, min_latency_ms, max_latency_ms,
p50_latency_ms, p95_latency_ms, latencies_ms
```

## Key Findings (Jan 2026)

1. **Dataset Coverage Gap**: Only ~50% of available tools are tested
2. **Session Type Gap**: All test cases are "web" sessions (no mobile, Slack, API)
3. **Operation Gap**: Heavy on reads, light on creates/updates
4. **Dataset 1 Deprecated**: Uses old tool names (`analyzeGitHubCode` → sandbox tools)
5. **Recent Performance**: all_metrics_pass_pct ranging 51-70% across runs

## Recommendations

1. **Expand tool coverage**: Add test cases for untested tools
2. **Diversify sessions**: Add mobile, Slack session test cases
3. **Add CRUD coverage**: Test create/update/delete operations
4. **Consider migrating dataset 1**: 78 test cases with different scenarios

## Related Paths

```
# Evaluation code
~/src/context-engine/context-engine/python/eval/

# Journal tools definitions
~/src/journal/packages/tools/src/definitions/

# Agent configuration
~/src/journal/apps/api/src/ai/agents/
```
