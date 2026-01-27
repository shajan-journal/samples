import { useState, useEffect } from 'react'

interface AgentRun {
  run_id: string
  timestamp: string
  test_type: string
  dataset_file: string
  machine_name: string
  model: string
  prompt_type: string
  api_commit_sha: string
  total_test_cases: number
  avg_faithfulness: number
  avg_answer_relevancy: number
  avg_correctness: number
  avg_tool_call_coverage: number
  avg_tool_order_score: number
  avg_response_latency_ms: number
  faithfulness_pass_pct: number
  answer_relevancy_pass_pct: number
  correctness_pass_pct: number
  tool_coverage_pass_pct: number
  tool_order_pass_pct: number
  all_metrics_pass_pct: number
}

export function AgentRuns() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agent-runs?limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        setRuns(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [limit])

  const getStatusClass = (value: number, threshold: number) => {
    if (value >= threshold) return 'success'
    if (value >= threshold * 0.8) return 'warning'
    return 'error'
  }

  if (loading) {
    return <div className="card">Loading agent runs...</div>
  }

  return (
    <>
      <div className="card">
        <div className="flex-between mb-4">
          <h3>Agent Evaluation Runs</h3>
          <div className="flex">
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={10}>10 runs</option>
              <option value={20}>20 runs</option>
              <option value={50}>50 runs</option>
              <option value={100}>100 runs</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Model</th>
                <th>Prompt</th>
                <th>Tests</th>
                <th>All Pass %</th>
                <th>Correctness</th>
                <th>Faithfulness</th>
                <th>Relevancy</th>
                <th>Tool Cov.</th>
                <th>Tool Order</th>
                <th>Avg Latency</th>
                <th>Commit</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={run.run_id || i}>
                  <td>{new Date(run.timestamp).toLocaleString()}</td>
                  <td><code style={{ fontSize: 11 }}>{run.model}</code></td>
                  <td><code style={{ fontSize: 11 }}>{run.prompt_type}</code></td>
                  <td>{run.total_test_cases}</td>
                  <td>
                    <span className={`badge ${getStatusClass(run.all_metrics_pass_pct, 60)}`}>
                      {run.all_metrics_pass_pct?.toFixed(1)}%
                    </span>
                  </td>
                  <td className={getStatusClass(run.avg_correctness * 100, 70)}>
                    {(run.avg_correctness * 100).toFixed(1)}%
                  </td>
                  <td className={getStatusClass(run.avg_faithfulness * 100, 80)}>
                    {(run.avg_faithfulness * 100).toFixed(1)}%
                  </td>
                  <td className={getStatusClass(run.avg_answer_relevancy * 100, 80)}>
                    {(run.avg_answer_relevancy * 100).toFixed(1)}%
                  </td>
                  <td className={getStatusClass(run.avg_tool_call_coverage * 100, 70)}>
                    {(run.avg_tool_call_coverage * 100).toFixed(1)}%
                  </td>
                  <td className={getStatusClass(run.avg_tool_order_score * 100, 90)}>
                    {(run.avg_tool_order_score * 100).toFixed(1)}%
                  </td>
                  <td>{(run.avg_response_latency_ms / 1000).toFixed(1)}s</td>
                  <td>
                    <code style={{ fontSize: 10 }}>{run.api_commit_sha?.slice(0, 7) || '-'}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Metric Pass Rates (Latest Run)</h3>
          {runs[0] && (
            <div className="mt-4">
              {[
                { label: 'Faithfulness', value: runs[0].faithfulness_pass_pct },
                { label: 'Answer Relevancy', value: runs[0].answer_relevancy_pass_pct },
                { label: 'Correctness', value: runs[0].correctness_pass_pct },
                { label: 'Tool Coverage', value: runs[0].tool_coverage_pass_pct },
                { label: 'Tool Order', value: runs[0].tool_order_pass_pct },
              ].map(metric => (
                <div key={metric.label} style={{ marginBottom: 12 }}>
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{metric.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{metric.value?.toFixed(1)}%</span>
                  </div>
                  <div className="coverage-bar">
                    <div
                      className="coverage-bar-fill"
                      style={{
                        width: `${metric.value}%`,
                        background: metric.value >= 80 ? 'var(--success)' :
                                   metric.value >= 60 ? 'var(--warning)' : 'var(--error)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Run Details</h3>
          {runs[0] && (
            <div style={{ fontSize: 13 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Dataset:</strong><br />
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {runs[0].dataset_file?.split('/').pop()}
                </code>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Machine:</strong> {runs[0].machine_name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Test Type:</strong> {runs[0].test_type}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Run ID:</strong><br />
                <code style={{ fontSize: 10 }}>{runs[0].run_id}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
