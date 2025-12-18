"use client";

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { streamExecution, ExecutionEvent } from '../lib/sse';

type ChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  hint?: string;
};

const defaultInput = 'Calculate 2+2';
const defaultPatterns = [{ name: 'react', description: 'Reason + Act pattern' }];

export default function HomePage() {
  const [patterns, setPatterns] = useState<Array<{ name: string; description?: string }>>(defaultPatterns);
  const [pattern, setPattern] = useState('react');
  const [input, setInput] = useState(defaultInput);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'system',
      content: 'Ready when you are. Choose a pattern and describe the task to execute.'
    }
  ]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000', []);

  useEffect(() => {
    fetch(`${apiBase}/api/patterns`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.patterns?.length) {
          setPatterns(data.patterns);
          if (data.patterns[0]?.name) setPattern(data.patterns[0].name);
        }
      })
      .catch(() => {
        // keep defaults on failure
      });
  }, [apiBase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const runId = `run-${Date.now()}`;
    const userMsg: ChatMessage = { id: `${runId}-user`, role: 'user', content: input };

    setMessages((prev) => [...prev, userMsg]);
    setEvents([]);
    setError(null);
    setLoading(true);

    try {
      for await (const event of streamExecution({ pattern, input })) {
        applyEvent(runId, event);
      }
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => [
        ...prev,
        { id: `${runId}-error`, role: 'assistant', content: 'Execution failed. See error message for details.' }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function applyEvent(runId: string, event: ExecutionEvent) {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const { eventType, data } = event;
    const line = formatEventLine(time, eventType, data);

    setEvents((prev) => [...prev, line]);

    if (eventType === 'start') {
      setMessages((prev) => [
        ...prev,
        {
          id: `${runId}-start`,
          role: 'assistant',
          content: `Starting ${data.pattern} with input: "${data.input}"`,
          hint: 'Streaming live events'
        }
      ]);
    }

    if (eventType === 'step') {
      const detail = [data.type?.toUpperCase(), data.capability && `cap=${data.capability}`, data.tool && `tool=${data.tool}`]
        .filter(Boolean)
        .join(' ');
      setMessages((prev) => [
        ...prev,
        {
          id: `${runId}-step-${prev.length}`,
          role: 'assistant',
          content: `${detail ? detail + ': ' : ''}${data.content ?? ''}`.trim()
        }
      ]);
    }

    if (eventType === 'complete') {
      setMessages((prev) => [
        ...prev,
        {
          id: `${runId}-complete`,
          role: 'assistant',
          content: `Complete: ${data.status} in ${data.duration}ms`
        }
      ]);
    }

    if (eventType === 'error') {
      setMessages((prev) => [
        ...prev,
        { id: `${runId}-err`, role: 'assistant', content: `Error: ${data.error || 'Unknown error'}` }
      ]);
    }
  }

  return (
    <main>
      <div className="card grid" style={{ gap: 20 }}>
        <header className="grid" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h1>Agent Patterns UI</h1>
            <span className="badge">Streaming SSE Client</span>
          </div>
          <p className="small">Run an agentic pattern and watch events stream in real time.</p>
        </header>

        <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div className="grid" style={{ flex: 1, minWidth: 200, gap: 6 }}>
              <label htmlFor="pattern">Pattern</label>
              <select id="pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={loading}>
                {patterns.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.description ? `— ${p.description}` : ''}
                  </option>
                ))}
              </select>
              <p className="small">Available patterns from /api/patterns.</p>
            </div>
            <div className="status-pill" aria-label={loading ? 'Running' : 'Idle'}>
              {loading ? 'Running…' : 'Idle'}
            </div>
          </div>

          <div className="grid" style={{ gap: 6 }}>
            <label htmlFor="input">Input</label>
            <textarea
              id="input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the task..."
              disabled={loading}
            />
          </div>

          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? 'Running...' : 'Run pattern'}
            </button>
            <span className="small">Sends request to `/api/execute` and streams events.</span>
          </div>
        </form>

        {error && <div className="small" style={{ color: '#fca5a5' }}>{error}</div>}

        <div className="chat" aria-label="chat">
          {messages.map((msg) => (
            <div key={msg.id} className={`bubble ${msg.role}`}>
              <div className="bubble-meta">{msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Agent' : 'System'}</div>
              <div>{msg.content}</div>
              {msg.hint && <div className="bubble-hint">{msg.hint}</div>}
            </div>
          ))}
        </div>

        <div className="grid" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Live Events</h3>
            <span className="small">ExecutionEvents stream</span>
          </div>
          <div className="log" aria-label="log">
            {events.length === 0 ? <div className="small">Waiting for events...</div> : events.map((line, idx) => <div key={idx}>{line}</div>)}
          </div>
        </div>
      </div>
    </main>
  );
}

function formatEventLine(time: string, eventType: ExecutionEvent['eventType'], data: any) {
  switch (eventType) {
    case 'start':
      return `[${time}] 🚀 START pattern=${data.pattern} input="${data.input}"`;
    case 'step':
      return `[${time}] ${iconFor(data.type)} ${data.type?.toUpperCase() || 'STEP'} ${data.capability ? `cap=${data.capability}` : ''} ${data.tool ? `tool=${data.tool}` : ''} ${data.content ?? ''}`.trim();
    case 'complete':
      return `[${time}] ✅ COMPLETE status=${data.status} duration=${data.duration}ms`;
    case 'error':
      return `[${time}] ❌ ERROR ${data.error || ''}`;
    case 'visualization':
      return `[${time}] 📊 VISUALIZATION data available`;
    default:
      return `[${time}] EVENT`;
  }
}

function iconFor(type?: string) {
  switch (type) {
    case 'capability':
      return '🧠';
    case 'tool_call':
      return '🔧';
    case 'result':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '📝';
  }
}
