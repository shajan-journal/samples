import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { config } from 'dotenv'
import { spawn } from 'child_process'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

config()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const app = express()
app.use(cors())
app.use(express.json())

const pool = new pg.Pool({
  connectionString: process.env.EVAL_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Get agent evaluation runs
app.get('/api/agent-runs', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50
  try {
    const result = await pool.query(`
      SELECT
        run_id,
        timestamp,
        test_type,
        dataset_file,
        machine_name,
        model,
        prompt_type,
        api_commit_sha,
        total_test_cases,
        avg_faithfulness,
        avg_answer_relevancy,
        avg_correctness,
        avg_tool_call_coverage,
        avg_tool_order_score,
        avg_response_latency_ms,
        faithfulness_pass_pct,
        answer_relevancy_pass_pct,
        correctness_pass_pct,
        tool_coverage_pass_pct,
        tool_order_pass_pct,
        all_metrics_pass_pct
      FROM agent_evaluation_runs
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching agent runs:', err)
    res.status(500).json({ error: 'Failed to fetch agent runs' })
  }
})

// Get retrieval evaluation runs
app.get('/api/retrieval-runs', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50
  try {
    const result = await pool.query(`
      SELECT
        run_id,
        timestamp,
        test_type,
        dataset_file,
        machine_name,
        total_test_cases,
        avg_retrieval_recall,
        avg_context_recall,
        avg_context_precision,
        avg_precision_at_k,
        avg_f1_score,
        retrieval_recall_pass_pct,
        context_recall_pass_pct,
        context_precision_pass_pct,
        precision_at_k_pass_pct,
        f1_score_pass_pct,
        all_metrics_pass_pct
      FROM retrieval_evaluation_runs
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching retrieval runs:', err)
    res.status(500).json({ error: 'Failed to fetch retrieval runs' })
  }
})

// Get latency benchmark runs
app.get('/api/latency-runs', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50
  try {
    const result = await pool.query(`
      SELECT
        run_id,
        timestamp,
        machine_name,
        model,
        prompt_type,
        query,
        iteration_count,
        valid_iterations,
        avg_latency_ms,
        min_latency_ms,
        max_latency_ms,
        p50_latency_ms,
        p95_latency_ms
      FROM agent_latency_runs
      ORDER BY timestamp DESC
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching latency runs:', err)
    res.status(500).json({ error: 'Failed to fetch latency runs' })
  }
})

// Get tool coverage data from dataset
app.get('/api/tool-coverage', async (_req, res) => {
  try {
    const evalDir = process.env.CONTEXT_ENGINE_EVAL_DIR
    const datasetPath = path.join(evalDir || '', 'agent_eval/datasets/journal_agent_dataset_2.json')

    const fs = await import('fs')
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))

    // Count tool usage
    const toolCounts: Record<string, number> = {}
    for (const testCase of dataset) {
      for (const tc of testCase.tool_calls || []) {
        const toolName = tc.toolName
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1
      }
    }

    // Get available tools from Journal
    const journalSrcDir = process.env.JOURNAL_SRC_DIR
    if (!journalSrcDir) {
      return res.status(400).json({ error: 'JOURNAL_SRC_DIR not configured' })
    }
    const journalToolsPath = path.join(journalSrcDir, 'packages/tools/src/definitions')
    const availableTools = new Set<string>()

    const walkDir = (dir: string) => {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const filePath = path.join(dir, file)
          const stat = fs.statSync(filePath)
          if (stat.isDirectory()) {
            walkDir(filePath)
          } else if (file.endsWith('.ts') && !file.includes('.test.')) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const matches = content.match(/name:\s*['"]([a-zA-Z][a-zA-Z0-9]*)['"]/g)
            if (matches) {
              for (const match of matches) {
                const name = match.match(/name:\s*['"]([a-zA-Z][a-zA-Z0-9]*)['"]/)?.[1]
                if (name && name.length > 3) {
                  availableTools.add(name)
                }
              }
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    walkDir(journalToolsPath)

    res.json({
      testedTools: toolCounts,
      availableTools: Array.from(availableTools),
      totalTestCases: dataset.length,
    })
  } catch (err) {
    console.error('Error getting tool coverage:', err)
    res.status(500).json({ error: 'Failed to get tool coverage' })
  }
})

// Get current config
app.get('/api/config', (_req, res) => {
  res.json({
    evalDir: process.env.CONTEXT_ENGINE_EVAL_DIR,
    journalUrl: process.env.JOURNAL_API_URL,
    defaultModel: process.env.DEFAULT_MODEL || 'claude-opus-4-5',
    defaultPromptType: process.env.DEFAULT_PROMPT_TYPE || 'lean',
    hasCookie: !!process.env.JOURNAL_COOKIE,
  })
})

// Active runs tracking
const activeRuns: Map<string, { process: ReturnType<typeof spawn>, output: string[], status: 'running' | 'completed' | 'failed' }> = new Map()

// Trigger a new evaluation run
app.post('/api/trigger-run', (req, res) => {
  const { evalType, model, promptType, limit, caseIndex } = req.body

  const evalDir = process.env.CONTEXT_ENGINE_EVAL_DIR
  if (!evalDir) {
    return res.status(400).json({ error: 'CONTEXT_ENGINE_EVAL_DIR not configured' })
  }

  const cookie = process.env.JOURNAL_COOKIE
  if (!cookie) {
    return res.status(400).json({ error: 'JOURNAL_COOKIE not configured' })
  }

  const runId = `run-${Date.now()}`
  const args = [
    'run',
    'pytest',
    evalType === 'latency' ? 'agent_eval/test_journal_agent_latency.py' : 'agent_eval/test_journal_agent.py',
    '-v',
    '--journal-cookie', cookie,
    '--agent-model', model || process.env.DEFAULT_MODEL || 'claude-opus-4-5',
    '--agent-prompt-type', promptType || process.env.DEFAULT_PROMPT_TYPE || 'lean',
  ]

  if (limit) {
    args.push('--eval-limit', String(limit))
  }

  if (caseIndex !== undefined && caseIndex !== null) {
    args.push('--case-index', String(caseIndex))
  }

  const child = spawn('uv', args, {
    cwd: evalDir,
    env: { ...process.env },
  })

  const output: string[] = []
  activeRuns.set(runId, { process: child, output, status: 'running' })

  child.stdout.on('data', (data) => {
    output.push(data.toString())
  })

  child.stderr.on('data', (data) => {
    output.push(data.toString())
  })

  child.on('close', (code) => {
    const run = activeRuns.get(runId)
    if (run) {
      run.status = code === 0 ? 'completed' : 'failed'
    }
  })

  res.json({ runId, message: 'Run started' })
})

// Get run status
app.get('/api/run-status/:runId', (req, res) => {
  const run = activeRuns.get(req.params.runId)
  if (!run) {
    return res.status(404).json({ error: 'Run not found' })
  }
  res.json({
    status: run.status,
    output: run.output.join(''),
  })
})

// Stop a running evaluation
app.post('/api/stop-run/:runId', (req, res) => {
  const run = activeRuns.get(req.params.runId)
  if (!run) {
    return res.status(404).json({ error: 'Run not found' })
  }
  run.process.kill()
  run.status = 'failed'
  res.json({ message: 'Run stopped' })
})

// AI Assistant endpoint
app.post('/api/ask', async (req, res) => {
  const { question } = req.body

  if (!question) {
    return res.status(400).json({ error: 'Question is required' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    // Fetch recent evaluation data for context
    const [agentRuns, latencyRuns] = await Promise.all([
      pool.query(`
        SELECT
          run_id, timestamp, model, prompt_type, total_test_cases,
          avg_faithfulness, avg_correctness, avg_tool_call_coverage,
          avg_response_latency_ms, all_metrics_pass_pct, api_commit_sha
        FROM agent_evaluation_runs
        ORDER BY timestamp DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT
          run_id, timestamp, model, prompt_type, query,
          avg_latency_ms, min_latency_ms, max_latency_ms, p50_latency_ms, p95_latency_ms
        FROM agent_latency_runs
        ORDER BY timestamp DESC
        LIMIT 20
      `),
    ])

    const systemPrompt = `You are an AI assistant for a Journal agent evaluation dashboard. You help users analyze evaluation metrics and performance data.

You have access to the following evaluation data:

## Recent Agent Evaluation Runs (last 20):
${JSON.stringify(agentRuns.rows, null, 2)}

## Recent Latency Benchmark Runs (last 20):
${JSON.stringify(latencyRuns.rows, null, 2)}

## Key Metrics Explained:
- avg_faithfulness: How faithful the agent's response is to the context (0-1)
- avg_correctness: How correct/accurate the response is (0-1)
- avg_tool_call_coverage: Percentage of expected tools that were called (0-1)
- all_metrics_pass_pct: Percentage of test cases passing all metrics
- avg_response_latency_ms: Average response time in milliseconds

When answering questions, you MUST respond with a JSON object containing:
1. "text": A brief text explanation (1-3 sentences)
2. "structured": A structured response for rich visual display

IMPORTANT: Always prefer visual responses (tables, charts, metrics) over plain text when the data supports it.

VISUALIZATION RULES (follow strictly):
- If the user asks about "trend", "over time", "history", "progression", or "change" → ALWAYS use "chart" (line chart)
- If the user asks to "compare" models, categories, or options → use "bar_chart"
- If the user asks for a "summary", "overview", or key numbers → use "metric"
- If the user asks to "list" or "show all" or wants detailed rows → use "table"
- Only omit "structured" for simple yes/no or factual questions

When data has timestamps/dates and user asks about trends, YOU MUST use a chart, not a table.

The "structured" field should be one of these types:

For metrics/KPIs:
{
  "type": "metric",
  "metrics": [{ "label": "Label", "value": "Value", "delta": "+/-X vs previous" }]
}

For tables:
{
  "type": "table",
  "title": "Table Title",
  "columns": ["Column1", "Column2"],
  "data": [{ "Column1": "val1", "Column2": "val2" }]
}

For line charts (trends over time):
{
  "type": "chart",
  "title": "Chart Title",
  "data": [{ "x": "label", "y1": 10, "y2": 20 }],
  "chartConfig": {
    "xKey": "x",
    "lines": [{ "key": "y1", "name": "Series 1", "color": "#3b82f6" }]
  }
}

For bar charts (comparisons):
{
  "type": "bar_chart",
  "title": "Chart Title",
  "data": [{ "x": "Category", "value": 10 }],
  "chartConfig": {
    "xKey": "x",
    "bars": [{ "key": "value", "name": "Value", "color": "#22c55e" }]
  }
}

Always respond with valid JSON only. No markdown, no extra text outside the JSON.
Use colors: blue (#3b82f6), green (#22c55e), yellow (#f59e0b), pink (#ec4899), purple (#8b5cf6).`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: question }
      ],
      system: systemPrompt,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return res.status(500).json({ error: 'Unexpected response type' })
    }

    try {
      // Strip markdown code blocks if present
      let jsonText = content.text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7)
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }
      jsonText = jsonText.trim()

      const parsed = JSON.parse(jsonText)
      res.json(parsed)
    } catch (parseErr) {
      // If JSON parsing fails, return as plain text
      console.error('JSON parse error:', parseErr, 'Raw:', content.text.slice(0, 200))
      res.json({ text: content.text })
    }
  } catch (err) {
    console.error('Error in AI assistant:', err)
    res.status(500).json({ error: 'Failed to get AI response' })
  }
})

const PORT = 3333
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
