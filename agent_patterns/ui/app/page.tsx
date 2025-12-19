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

const defaultInput = '';
const defaultPatterns = [{ name: 'react', description: 'Reason + Act pattern' }];

export default function HomePage() {
  const [patterns, setPatterns] = useState<Array<{ name: string; description?: string }>>(defaultPatterns);
  const [pattern, setPattern] = useState('react');
  const [input, setInput] = useState(defaultInput);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showLogsPanel, setShowLogsPanel] = useState(false);
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

    // Build conversation history (exclude thinking messages and IDs)
    // Note: Don't add current input here - the pattern will add it to avoid duplicates
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      for await (const event of streamExecution({ 
        pattern, 
        input,
        messages: conversationHistory 
      })) {
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
    // Skip unknown or empty events
    if (!event.eventType || !event.data) return;
    
    // Store the full event object
    setEvents((prev) => [...prev, event]);

    // Show final answer in chat when synthesis produces answer
    if (event.eventType === 'step' && event.data.type === 'answer') {
      // Remove thinking indicator and add actual answer
      setMessages((prev) => [
        ...prev.filter(m => !m.id.includes('-thinking')),
        {
          id: `${runId}-answer`,
          role: 'assistant',
          content: event.data.content
        }
      ]);
    }

    if (event.eventType === 'error') {
      setMessages((prev) => [
        ...prev,
        { id: `${runId}-err`, role: 'assistant', content: `Error: ${event.data.error || 'Unknown error'}` }
      ]);
    }
  }

  function downloadLogs() {
    const logData = JSON.stringify(events, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div style={{ display: 'flex', height: 'calc(100vh - 32px)', gap: 12 }}>
        {/* Main chat area */}
        <div className="card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flex: showLogsPanel ? '0 0 50%' : '1',
          transition: 'flex 0.3s ease'
        }}>
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
                {events.length > 0 && (
                  <button 
                    onClick={() => setShowLogsPanel(!showLogsPanel)}
                    className="secondary-button"
                    title="Toggle logs panel"
                  >
                    {showLogsPanel ? 'Hide Logs' : `Show Logs (${events.length})`}
                  </button>
                )}
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
        </div>

        {/* Logs panel */}
        {showLogsPanel && (
          <div className="card" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            flex: '0 0 50%',
            maxHeight: 'calc(100vh - 32px)',
            overflow: 'hidden'
          }}>
            <header style={{ padding: '12px 0', borderBottom: '1px solid rgba(226, 232, 240, 0.1)', marginBottom: '12px' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px' }}>Execution Logs ({events.length})</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={downloadLogs}
                    className="secondary-button"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                    title="Download logs as JSON"
                  >
                    ⬇ Download
                  </button>
                  <button 
                    onClick={() => setExpandedEvents(new Set())}
                    className="secondary-button"
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </header>
            <div style={{ flex: 1, overflowY: 'auto', fontSize: '12px', fontFamily: 'monospace' }}>
              {events.map((event, idx) => {
                const isExpanded = expandedEvents.has(idx);
                const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';
                const summary = formatEventSummary(event);
                
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      borderBottom: '1px solid rgba(226, 232, 240, 0.05)',
                      padding: '8px',
                      backgroundColor: isExpanded ? 'rgba(226, 232, 240, 0.03)' : 'transparent'
                    }}
                  >
                    <div 
                      style={{ 
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: isExpanded ? 'clip' : 'ellipsis',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const newExpanded = new Set(expandedEvents);
                        if (isExpanded) {
                          newExpanded.delete(idx);
                        } else {
                          newExpanded.add(idx);
                        }
                        setExpandedEvents(newExpanded);
                      }}
                    >
                      <span style={{ opacity: 0.5 }}>[{time}]</span> {summary}
                    </div>
                    {isExpanded && (
                      <pre style={{ 
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        cursor: 'text',
                        userSelect: 'text'
                      }}>
                        {JSON.stringify(event, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function formatEventSummary(event: ExecutionEvent): string {
  const { eventType, data } = event;
  
  switch (eventType) {
    case 'start':
      return `▶ START pattern=${data.pattern} input="${data.input?.substring(0, 50)}${data.input?.length > 50 ? '...' : ''}"`;
    case 'step':
      const typeLabel = data.type && data.type !== 'info' ? `[${data.type.toUpperCase()}] ` : '';
      const capLabel = data.capability ? `cap=${data.capability} ` : '';
      const toolLabel = data.tool ? `tool=${data.tool} ` : '';
      const content = data.content?.substring(0, 100) ?? '';
      return `${typeLabel}${capLabel}${toolLabel}${content}`.trim();
    case 'complete':
      return `✓ COMPLETE status=${data.status} duration=${data.duration}ms`;
    case 'error':
      return `✗ ERROR ${data.error || ''}`;
    case 'visualization':
      return `📊 VISUALIZATION data available`;
    default:
      return `${eventType}: ${JSON.stringify(data).substring(0, 100)}`;
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
