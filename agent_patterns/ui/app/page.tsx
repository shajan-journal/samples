"use client";

import React, { FormEvent, useEffect, useMemo, useState, useRef } from 'react';
import { streamExecution, ExecutionEvent } from '../lib/sse';

type ChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  hint?: string;
};

type Session = {
  id: string;
  startedAt: number;
  messageCount: number;
};

const defaultInput = 'Calculate 2+2';
const defaultPatterns = [{ name: 'react', description: 'Reason + Act pattern' }];

export default function HomePage() {
  const [patterns, setPatterns] = useState<Array<{ name: string; description?: string }>>(defaultPatterns);
  const [pattern, setPattern] = useState('react');
  const [input, setInput] = useState(defaultInput);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({
    id: `session-${Date.now()}`,
    startedAt: Date.now(),
    messageCount: 0
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000', []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  function clearChat() {
    if (loading) return;
    
    setMessages([]);
    setEvents([]);
    setError(null);
    setInput(defaultInput);
    setSession({
      id: `session-${Date.now()}`,
      startedAt: Date.now(),
      messageCount: 0
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const runId = `run-${Date.now()}`;
    const userMsg: ChatMessage = { id: `${runId}-user`, role: 'user', content: input };
    const thinkingMsg: ChatMessage = { id: `${runId}-thinking`, role: 'assistant', content: 'Thinking...' };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setEvents([]);
    setError(null);
    setLoading(true);
    
    // Update session message count
    setSession(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));

    try {
      for await (const event of streamExecution({ pattern, input })) {
        applyEvent(runId, event);
      }
    } catch (err) {
      setError((err as Error).message);
      setMessages((prev) => [
        ...prev.filter(m => !m.id.includes('-thinking')),
        { id: `${runId}-error`, role: 'assistant', content: 'Execution failed. See error message for details.' }
      ]);
    } finally {
      // Always remove thinking indicator when done
      setMessages((prev) => prev.filter(m => !m.id.includes('-thinking')));
      setLoading(false);
    }
  }

  function applyEvent(runId: string, event: ExecutionEvent) {
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const { eventType, data } = event;
    
    // Skip unknown or empty events
    if (!eventType || !data) return;
    
    const line = formatEventLine(time, eventType, data);

    setEvents((prev) => [...prev, line]);

    // Show final answer in chat when synthesis produces answer
    if (eventType === 'step' && data.type === 'answer') {
      // Remove thinking indicator and add actual answer
      setMessages((prev) => [
        ...prev.filter(m => !m.id.includes('-thinking')),
        {
          id: `${runId}-answer`,
          role: 'assistant',
          content: data.content
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
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', gap: 12 }}>
        <header style={{ padding: '12px 0', borderBottom: '1px solid rgba(226, 232, 240, 0.1)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: '20px' }}>Agent Patterns</h1>
              <p className="small" style={{ margin: '4px 0 0' }}>
                Pattern: <strong>{pattern}</strong>
                {messages.length > 0 && (
                  <span style={{ marginLeft: '12px', opacity: 0.6 }}>
                    • {session.messageCount} {session.messageCount === 1 ? 'turn' : 'turns'}
                  </span>
                )}
              </p>
            </div>
            <div className="row" style={{ gap: '8px' }}>
              {messages.length > 0 && (
                <button 
                  onClick={clearChat} 
                  disabled={loading}
                  className="secondary-button"
                  title="Start a new conversation"
                >
                  New Chat
                </button>
              )}
              <select 
                value={pattern} 
                onChange={(e) => setPattern(e.target.value)} 
                disabled={loading} 
                style={{ width: 'auto', fontSize: '13px', padding: '6px 10px' }}
              >
                {patterns.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <div className="chat-container">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>Ask a question to get started</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {msg.content === 'Thinking...' ? (
                      <span className="thinking-dots">{msg.content}</span>
                    ) : msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            {error && <div className="error-message">{error}</div>}
            <div className="input-wrapper">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask a question..."
                disabled={loading}
                rows={1}
              />
              <button type="submit" disabled={loading || !input.trim()} className="send-button">
                {loading ? '⏳' : '↑'}
              </button>
            </div>
          </form>
        </div>

        {events.length > 0 && (
          <details className="events-details">
            <summary className="small">Live Events ({events.length})</summary>
            <div className="log" style={{ maxHeight: '200px', marginTop: '8px' }}>
              {events.map((line, idx) => <div key={idx}>{line}</div>)}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}

function formatEventLine(time: string, eventType: ExecutionEvent['eventType'], data: any) {
  switch (eventType) {
    case 'start':
      return `[${time}] START pattern=${data.pattern} input="${data.input}"`;
    case 'step':
      const typeLabel = data.type && data.type !== 'info' ? `${data.type.toUpperCase()} ` : '';
      return `[${time}] ${typeLabel}${data.capability ? `cap=${data.capability} ` : ''}${data.tool ? `tool=${data.tool} ` : ''}${data.content ?? ''}`.trim();
    case 'complete':
      return `[${time}] COMPLETE status=${data.status} duration=${data.duration}ms`;
    case 'error':
      return `[${time}] ❌ ERROR ${data.error || ''}`;
    case 'visualization':
      return `[${time}] VISUALIZATION data available`;
    default:
      // Don't display unknown event types
      return '';
  }
}

function iconFor(type?: string) {
  switch (type) {
    case 'error':
      return '❌';
    default:
      return '';
  }
}
