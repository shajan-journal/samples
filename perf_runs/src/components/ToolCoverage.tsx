import { useState, useEffect } from 'react'

interface CoverageData {
  testedTools: Record<string, number>
  availableTools: string[]
  totalTestCases: number
}

export function ToolCoverage() {
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'covered' | 'missing'>('all')

  useEffect(() => {
    fetch('/api/tool-coverage')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="card">Loading tool coverage...</div>
  }

  if (!data) {
    return <div className="card">Failed to load tool coverage data</div>
  }

  const testedToolNames = Object.keys(data.testedTools)
  const allTools = Array.from(new Set([...testedToolNames, ...data.availableTools]))
  const missingTools = data.availableTools.filter(t => !testedToolNames.includes(t))
  const coveragePercent = (testedToolNames.length / data.availableTools.length) * 100

  const sortedTestedTools = Object.entries(data.testedTools)
    .sort((a, b) => b[1] - a[1])

  const filteredTools = filter === 'all' ? allTools :
                        filter === 'covered' ? testedToolNames :
                        missingTools

  return (
    <>
      <div className="grid grid-3">
        <div className="card stat-card">
          <div className="stat-value">{data.totalTestCases}</div>
          <div className="stat-label">Total Test Cases</div>
        </div>
        <div className="card stat-card">
          <div className={`stat-value ${coveragePercent >= 70 ? 'success' : coveragePercent >= 50 ? 'warning' : 'error'}`}>
            {coveragePercent.toFixed(1)}%
          </div>
          <div className="stat-label">Tool Coverage</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value error">{missingTools.length}</div>
          <div className="stat-label">Untested Tools</div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-4">
          <h3>Coverage Overview</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {testedToolNames.length} / {data.availableTools.length} tools tested
          </div>
        </div>
        <div className="coverage-bar" style={{ height: 24 }}>
          <div
            className="coverage-bar-fill"
            style={{
              width: `${coveragePercent}%`,
              background: coveragePercent >= 70 ? 'var(--success)' :
                         coveragePercent >= 50 ? 'var(--warning)' : 'var(--error)'
            }}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Tool Usage in Test Set</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Sorted by number of test cases using each tool
          </p>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Usage Count</th>
                  <th>% of Tests</th>
                </tr>
              </thead>
              <tbody>
                {sortedTestedTools.map(([tool, count]) => (
                  <tr key={tool}>
                    <td><code>{tool}</code></td>
                    <td>{count}</td>
                    <td>
                      <div className="coverage-bar" style={{ width: 100 }}>
                        <div
                          className="coverage-bar-fill"
                          style={{ width: `${(count / data.totalTestCases) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex-between mb-4">
            <h3>All Tools</h3>
            <div className="flex">
              <button
                className={`tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                All ({allTools.length})
              </button>
              <button
                className={`tab ${filter === 'covered' ? 'active' : ''}`}
                onClick={() => setFilter('covered')}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                Covered ({testedToolNames.length})
              </button>
              <button
                className={`tab ${filter === 'missing' ? 'active' : ''}`}
                onClick={() => setFilter('missing')}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                Missing ({missingTools.length})
              </button>
            </div>
          </div>
          <div className="tool-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredTools.sort().map(tool => (
              <span
                key={tool}
                className={`tool-tag ${testedToolNames.includes(tool) ? 'covered' : 'missing'}`}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Missing Tool Coverage</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          These tools exist in the codebase but have no test coverage in the evaluation dataset
        </p>
        <div className="tool-list">
          {missingTools.sort().map(tool => (
            <span key={tool} className="tool-tag missing">
              {tool}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
