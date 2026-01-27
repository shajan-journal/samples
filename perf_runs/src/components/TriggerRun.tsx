import { useState, useEffect, useRef } from 'react'

interface Config {
  evalDir: string
  journalUrl: string
  defaultModel: string
  defaultPromptType: string
  hasCookie: boolean
}

interface TriggerRunProps {
  config: Config | null
}

export function TriggerRun({ config }: TriggerRunProps) {
  const [evalType, setEvalType] = useState<'agent' | 'latency'>('agent')
  const [model, setModel] = useState('')
  const [promptType, setPromptType] = useState('')
  const [limit, setLimit] = useState<string>('')
  const [caseIndex, setCaseIndex] = useState<string>('')
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [output, setOutput] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (config) {
      setModel(config.defaultModel)
      setPromptType(config.defaultPromptType)
    }
  }, [config])

  useEffect(() => {
    if (!runId || status === 'completed' || status === 'failed') return

    const interval = setInterval(() => {
      fetch(`/api/run-status/${runId}`)
        .then(res => res.json())
        .then(data => {
          setOutput(data.output)
          if (data.status !== 'running') {
            setStatus(data.status)
            clearInterval(interval)
          }
        })
        .catch(console.error)
    }, 2000)

    return () => clearInterval(interval)
  }, [runId, status])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const handleStart = async () => {
    if (!config?.hasCookie) {
      alert('No auth cookie configured. Please set JOURNAL_COOKIE in .env')
      return
    }

    setStatus('running')
    setOutput('')

    try {
      const res = await fetch('/api/trigger-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalType,
          model,
          promptType,
          limit: limit ? parseInt(limit) : undefined,
          caseIndex: caseIndex ? parseInt(caseIndex) : undefined,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setStatus('failed')
        setOutput(data.error)
      } else {
        setRunId(data.runId)
      }
    } catch (err) {
      setStatus('failed')
      setOutput(String(err))
    }
  }

  const handleStop = async () => {
    if (!runId) return

    try {
      await fetch(`/api/stop-run/${runId}`, { method: 'POST' })
      setStatus('failed')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      <div className="grid grid-2">
        <div className="card">
          <h3>Trigger New Evaluation</h3>

          {!config?.hasCookie && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
            }}>
              No auth cookie configured. Set <code>JOURNAL_COOKIE</code> in <code>.env</code> and restart the server.
            </div>
          )}

          <div className="form-group">
            <label>Evaluation Type</label>
            <select value={evalType} onChange={e => setEvalType(e.target.value as 'agent' | 'latency')} style={{ width: '100%' }}>
              <option value="agent">Agent Evaluation</option>
              <option value="latency">Latency Benchmark</option>
            </select>
          </div>

          <div className="form-group">
            <label>Model</label>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ width: '100%' }}>
              <option value="claude-opus-4-5">claude-opus-4-5</option>
              <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
              <option value="claude-sonnet-4">claude-sonnet-4</option>
            </select>
          </div>

          <div className="form-group">
            <label>Prompt Type</label>
            <select value={promptType} onChange={e => setPromptType(e.target.value)} style={{ width: '100%' }}>
              <option value="lean">lean</option>
              <option value="default">default</option>
              <option value="detective">detective</option>
            </select>
          </div>

          <div className="grid grid-2">
            <div className="form-group">
              <label>Limit (optional)</label>
              <input
                type="number"
                value={limit}
                onChange={e => setLimit(e.target.value)}
                placeholder="All test cases"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label>Case Index (optional)</label>
              <input
                type="number"
                value={caseIndex}
                onChange={e => setCaseIndex(e.target.value)}
                placeholder="Run all"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="flex mt-4">
            {status === 'running' ? (
              <button onClick={handleStop} style={{ background: 'var(--error)' }}>
                Stop Run
              </button>
            ) : (
              <button onClick={handleStart} disabled={!config?.hasCookie}>
                Start Evaluation
              </button>
            )}
            {status !== 'idle' && (
              <span style={{ marginLeft: 12, fontSize: 13 }}>
                {status === 'running' && '🔄 Running...'}
                {status === 'completed' && '✅ Completed'}
                {status === 'failed' && '❌ Failed'}
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Configuration</h3>
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>
              <strong>Eval Directory:</strong><br />
              <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{config?.evalDir}</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Journal API:</strong><br />
              <code style={{ fontSize: 11 }}>{config?.journalUrl}</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Auth Status:</strong><br />
              {config?.hasCookie ? (
                <span style={{ color: 'var(--success)' }}>Cookie configured</span>
              ) : (
                <span style={{ color: 'var(--error)' }}>No cookie set</span>
              )}
            </div>
          </div>

          <h3 className="mt-4">Quick Commands</h3>
          <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--bg-primary)', padding: 12, borderRadius: 6 }}>
            <div style={{ marginBottom: 8 }}>
              <strong># Run single test case</strong><br />
              uv run pytest agent_eval/test_journal_agent.py --case-index 0
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong># Run with limit</strong><br />
              uv run pytest agent_eval/test_journal_agent.py --eval-limit 5
            </div>
            <div>
              <strong># Query results</strong><br />
              uv run ./query_eval_runs.py --eval-type agent
            </div>
          </div>
        </div>
      </div>

      {(status !== 'idle' || output) && (
        <div className="card">
          <h3>Run Output</h3>
          <div ref={outputRef} className="output-box">
            {output || 'Waiting for output...'}
          </div>
        </div>
      )}
    </>
  )
}
