import { useState, useRef, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Message {
  role: 'user' | 'assistant'
  content: string
  structured?: StructuredResponse
}

interface StructuredResponse {
  type: 'text' | 'table' | 'chart' | 'metric' | 'bar_chart'
  title?: string
  data?: any
  columns?: string[]
  metrics?: { label: string; value: string | number; delta?: string }[]
  chartConfig?: {
    xKey: string
    lines?: { key: string; name: string; color: string }[]
    bars?: { key: string; name: string; color: string }[]
  }
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${data.error}`,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || '',
          structured: data.structured,
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to get response. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const renderStructured = (structured: StructuredResponse) => {
    switch (structured.type) {
      case 'metric':
        return (
          <div className="grid grid-4" style={{ marginTop: 12 }}>
            {structured.metrics?.map((m, i) => (
              <div key={i} className="card stat-card" style={{ margin: 0 }}>
                <div className="stat-value">{m.value}</div>
                <div className="stat-label">{m.label}</div>
                {m.delta && (
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>
                    {m.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )

      case 'table':
        return (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            {structured.title && <h4 style={{ marginBottom: 8 }}>{structured.title}</h4>}
            <table>
              <thead>
                <tr>
                  {structured.columns?.map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {structured.data?.map((row: any, i: number) => (
                  <tr key={i}>
                    {structured.columns?.map((col, j) => (
                      <td key={j}>{row[col] ?? row[col.toLowerCase()] ?? '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'chart':
        return (
          <div style={{ marginTop: 12 }}>
            {structured.title && <h4 style={{ marginBottom: 8 }}>{structured.title}</h4>}
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={structured.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={structured.chartConfig?.xKey || 'x'}
                    stroke="#666"
                    fontSize={11}
                  />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#242424',
                      border: '1px solid #333',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {structured.chartConfig?.lines?.map((line, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={line.key}
                      name={line.name}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )

      case 'bar_chart':
        return (
          <div style={{ marginTop: 12 }}>
            {structured.title && <h4 style={{ marginBottom: 8 }}>{structured.title}</h4>}
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={structured.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey={structured.chartConfig?.xKey || 'x'}
                    stroke="#666"
                    fontSize={11}
                  />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#242424',
                      border: '1px solid #333',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {structured.chartConfig?.bars?.map((bar, i) => (
                    <Bar
                      key={i}
                      dataKey={bar.key}
                      name={bar.name}
                      fill={bar.color}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>AI Assistant</h3>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="btn"
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            Clear Chat
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        Ask questions about your evaluation data. Try: "Show me the trend of correctness over the last 10 runs" or "Compare the latest run with the previous one"
      </p>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, padding: '0 4px' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40 }}>
            Start a conversation by asking a question about your eval data.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--card-bg)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              marginLeft: msg.role === 'user' ? 40 : 0,
              marginRight: msg.role === 'assistant' ? 40 : 0,
            }}
          >
            <div style={{ fontSize: 11, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', marginBottom: 4 }}>
              {msg.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.structured && renderStructured(msg.structured)}
          </div>
        ))}

        {loading && (
          <div style={{ color: 'var(--text-secondary)', padding: 12 }}>
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your evaluation data..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn btn-primary"
          style={{ padding: '10px 20px' }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
