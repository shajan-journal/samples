import { useState, useEffect } from 'react'
import { AgentRuns } from './components/AgentRuns'
import { ToolCoverage } from './components/ToolCoverage'
import { TriggerRun } from './components/TriggerRun'
import { TrendChart } from './components/TrendChart'

type Tab = 'overview' | 'agent' | 'coverage' | 'trigger'

interface Config {
  evalDir: string
  journalUrl: string
  defaultModel: string
  defaultPromptType: string
  hasCookie: boolean
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(setConfig)
      .catch(console.error)
  }, [])

  return (
    <div className="container">
      <div className="flex-between mb-4">
        <h1>Journal Eval Dashboard</h1>
        {config && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {config.hasCookie ? '🟢 Auth configured' : '🔴 No auth cookie'}
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab ${tab === 'agent' ? 'active' : ''}`} onClick={() => setTab('agent')}>
          Agent Runs
        </button>
        <button className={`tab ${tab === 'coverage' ? 'active' : ''}`} onClick={() => setTab('coverage')}>
          Tool Coverage
        </button>
        <button className={`tab ${tab === 'trigger' ? 'active' : ''}`} onClick={() => setTab('trigger')}>
          Trigger Run
        </button>
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'agent' && <AgentRuns />}
      {tab === 'coverage' && <ToolCoverage />}
      {tab === 'trigger' && <TriggerRun config={config} />}
    </div>
  )
}

function Overview() {
  const [agentRuns, setAgentRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/agent-runs?limit=20').then(r => r.json()),
    ])
      .then(([agent]) => {
        setAgentRuns(agent)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="card">Loading...</div>
  }

  const latestRun = agentRuns[0]
  const previousRun = agentRuns[1]

  const getDelta = (current: number, previous: number) => {
    if (!previous) return null
    const delta = current - previous
    return delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)
  }

  const getStatusClass = (value: number, threshold: number) => {
    if (value >= threshold) return 'success'
    if (value >= threshold * 0.8) return 'warning'
    return 'error'
  }

  return (
    <>
      <div className="grid grid-4">
        <div className="card stat-card">
          <div className={`stat-value ${latestRun ? getStatusClass(latestRun.all_metrics_pass_pct, 60) : ''}`}>
            {latestRun ? `${latestRun.all_metrics_pass_pct?.toFixed(1)}%` : '-'}
          </div>
          <div className="stat-label">All Metrics Pass %</div>
          {previousRun && (
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>
              {getDelta(latestRun?.all_metrics_pass_pct, previousRun?.all_metrics_pass_pct)}% vs prev
            </div>
          )}
        </div>
        <div className="card stat-card">
          <div className={`stat-value ${latestRun ? getStatusClass(latestRun.avg_correctness * 100, 70) : ''}`}>
            {latestRun ? `${(latestRun.avg_correctness * 100).toFixed(1)}%` : '-'}
          </div>
          <div className="stat-label">Avg Correctness</div>
        </div>
        <div className="card stat-card">
          <div className={`stat-value ${latestRun ? getStatusClass(latestRun.avg_tool_call_coverage * 100, 70) : ''}`}>
            {latestRun ? `${(latestRun.avg_tool_call_coverage * 100).toFixed(1)}%` : '-'}
          </div>
          <div className="stat-label">Tool Coverage</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">
            {latestRun ? `${(latestRun.avg_response_latency_ms / 1000).toFixed(1)}s` : '-'}
          </div>
          <div className="stat-label">Avg Response Time</div>
        </div>
      </div>

      <div className="card">
        <h3>Performance Trend (Last 20 Runs)</h3>
        <TrendChart data={agentRuns} />
      </div>

      <div className="card">
        <h3>Recent Agent Runs</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Model</th>
              <th>Tests</th>
              <th>All Pass %</th>
              <th>Correctness</th>
              <th>Faithfulness</th>
              <th>Tool Coverage</th>
              <th>Commit</th>
            </tr>
          </thead>
          <tbody>
            {agentRuns.slice(0, 10).map((run, i) => (
              <tr key={run.run_id || i}>
                <td>{new Date(run.timestamp).toLocaleDateString()}</td>
                <td><code>{run.model}</code></td>
                <td>{run.total_test_cases}</td>
                <td>
                  <span className={`badge ${getStatusClass(run.all_metrics_pass_pct, 60)}`}>
                    {run.all_metrics_pass_pct?.toFixed(1)}%
                  </span>
                </td>
                <td>{(run.avg_correctness * 100).toFixed(1)}%</td>
                <td>{(run.avg_faithfulness * 100).toFixed(1)}%</td>
                <td>{(run.avg_tool_call_coverage * 100).toFixed(1)}%</td>
                <td><code>{run.api_commit_sha?.slice(0, 7)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
