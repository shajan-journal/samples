import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface Pattern {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  streaming: boolean;
}

interface PatternResult {
  pattern: string;
  [key: string]: unknown;
}

interface StatusUpdate {
  status: string;
  data?: {
    phase?: string;
    [key: string]: unknown;
  };
}

export default function App() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string>('chat');
  const [input, setInput] = useState('');
  const [patternResult, setPatternResult] = useState<PatternResult | null>(null);
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const statusContainerRef = useRef<HTMLDivElement>(null);

  // Original chat hook
  const { messages, status, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3002/api/chat',
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming' || patternLoading;

  // Auto-scroll status updates
  useEffect(() => {
    if (statusContainerRef.current) {
      statusContainerRef.current.scrollTop = statusContainerRef.current.scrollHeight;
    }
  }, [statusUpdates]);

  // Fetch available patterns on mount
  useEffect(() => {
    fetch('http://localhost:3002/api/patterns')
      .then(res => res.json())
      .then(data => setPatterns(data.patterns))
      .catch(err => console.error('Failed to load patterns:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (selectedPattern === 'chat') {
      sendMessage({ text: input });
      setInput('');
      return;
    }

    // Handle pattern-specific requests with streaming
    setPatternLoading(true);
    setPatternError(null);
    setPatternResult(null);
    setStatusUpdates([]);

    const pattern = patterns.find(p => p.id === selectedPattern);
    if (!pattern) return;

    try {
      // Map input to the correct field based on pattern
      const bodyField = selectedPattern === 'routing' ? 'input' 
        : selectedPattern === 'parallel' ? 'content' 
        : selectedPattern === 'react' ? 'prompt'
        : 'task';

      // Use streaming endpoint
      const streamEndpoint = `http://localhost:3002${pattern.endpoint}/stream`;
      
      const response = await fetch(streamEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyField]: input }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'status') {
                setStatusUpdates(prev => [...prev, { status: parsed.status, data: parsed.data }]);
              } else if (parsed.type === 'result') {
                setPatternResult(parsed as PatternResult);
              } else if (parsed.type === 'error') {
                setPatternError(parsed.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setPatternError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPatternLoading(false);
      setInput('');
    }
  };

  const renderPatternResult = () => {
    if (!patternResult) return null;

    return (
      <div className="pattern-result">
        <div className="pattern-result-header">
          <span className="pattern-badge">{patternResult.pattern}</span>
        </div>
        
        {/* ReAct Pattern */}
        {patternResult.pattern === 'react' && (
          <div className="result-section">
            <h4>Response</h4>
            <div className="markdown-content">
              <ReactMarkdown>{patternResult.text as string}</ReactMarkdown>
            </div>
            {patternResult.steps && (
              <>
                <h4>Steps Taken</h4>
                <div className="steps-list">
                  {(patternResult.steps as Array<{stepNumber: number; type?: string; toolCalls?: Array<{tool: string; args: unknown}>; toolResults?: Array<{tool: string; result: unknown}>}>).map((step, i) => (
                    <div key={i} className="step-item">
                      <div className="step-header">
                        <strong>Step {step.stepNumber}</strong>
                        {step.type && <span className="step-type">{step.type}</span>}
                      </div>
                      {step.toolCalls && step.toolCalls.length > 0 && (
                        <div className="tool-calls-section">
                          {step.toolCalls.map((tc, j) => (
                            <div key={j} className="tool-call">
                              <div className="tool-label">🔧 Called <code>{tc.tool}</code></div>
                              {tc.args && Object.keys(tc.args as object).length > 0 && (
                                <pre className="tool-data">{JSON.stringify(tc.args, null, 2)}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {step.toolResults && step.toolResults.length > 0 && (
                        <div className="tool-results-section">
                          {step.toolResults.map((tr, j) => (
                            <div key={j} className="tool-result">
                              <div className="tool-label">📤 Result from <code>{tr.tool}</code></div>
                              {tr.result && (
                                <pre className="tool-data">{JSON.stringify(tr.result, null, 2)}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {(!step.toolCalls || step.toolCalls.length === 0) && (!step.toolResults || step.toolResults.length === 0) && (
                        <div className="step-empty">Final response generated</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Plan & Execute Pattern */}
        {patternResult.pattern === 'plan-execute' && (
          <div className="result-section">
            <h4>Plan</h4>
            <div className="plan-info">
              <p><strong>Goal:</strong> {(patternResult.plan as {goal: string})?.goal}</p>
              <p><strong>Complexity:</strong> <span className="tag">{(patternResult.plan as {estimatedComplexity: string})?.estimatedComplexity}</span></p>
            </div>
            <h4>Steps Executed</h4>
            <div className="steps-list">
              {(patternResult.stepResults as Array<{stepId: number; action: string; result: string}>)?.map((step, i) => (
                <div key={i} className="step-item">
                  <div className="step-header">
                    <strong>Step {step.stepId}</strong>
                    <span className="step-action">{step.action}</span>
                  </div>
                  <div className="markdown-content">
                    <ReactMarkdown>{step.result}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <h4>Final Result</h4>
            <div className="markdown-content final-output">
              <ReactMarkdown>{patternResult.finalResult as string}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Routing Pattern */}
        {patternResult.pattern === 'routing' && (
          <div className="result-section">
            <h4>Classification</h4>
            <div className="classification-info">
              <span className="tag type-tag">{(patternResult.classification as {type: string})?.type}</span>
              <span className="tag complexity-tag">{(patternResult.classification as {complexity: string})?.complexity}</span>
            </div>
            <p className="reasoning">💭 {(patternResult.classification as {reasoning: string})?.reasoning}</p>
            <h4>Response</h4>
            <div className="markdown-content">
              <ReactMarkdown>{patternResult.response as string}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Parallel Pattern */}
        {patternResult.pattern === 'parallel' && (
          <div className="result-section">
            <div className="parallel-grid">
              <div className="parallel-card">
                <h4>😊 Sentiment Analysis</h4>
                <div className="sentiment-info">
                  <span className={`tag sentiment-${(patternResult.sentiment as {sentiment: string})?.sentiment}`}>
                    {(patternResult.sentiment as {sentiment: string})?.sentiment}
                  </span>
                  <span className="confidence">
                    {((patternResult.sentiment as {confidence: number})?.confidence * 100).toFixed(0)}% confident
                  </span>
                </div>
                <p className="emotional-tones">
                  Tones: {(patternResult.sentiment as {emotionalTones: string[]})?.emotionalTones?.join(', ') || 'None detected'}
                </p>
              </div>
              
              <div className="parallel-card">
                <h4>📌 Key Points</h4>
                <ul className="key-points">
                  {(patternResult.keyPoints as Array<{point: string; importance: string}>)?.map((kp, i) => (
                    <li key={i}>
                      <span className={`importance importance-${kp.importance}`}>{kp.importance}</span>
                      {kp.point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <h4>📝 Summary</h4>
            <div className="markdown-content summary-box">
              <ReactMarkdown>{patternResult.summary as string}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Evaluator-Optimizer Pattern */}
        {patternResult.pattern === 'evaluator-optimizer' && (
          <div className="result-section">
            <h4>Final Output</h4>
            <div className="markdown-content final-output">
              <ReactMarkdown>{patternResult.finalOutput as string}</ReactMarkdown>
            </div>
            <div className="optimization-info">
              <div className="opt-stat">
                <span className="opt-label">Iterations</span>
                <span className="opt-value">{patternResult.iterations as number}</span>
              </div>
              <div className="opt-stat">
                <span className="opt-label">Quality Score</span>
                <span className="opt-value">{patternResult.finalScore as number}/10</span>
              </div>
            </div>
            {patternResult.feedback && (patternResult.feedback as string[]).length > 0 && (
              <>
                <h4>Feedback Applied</h4>
                <ul className="feedback-list">
                  {(patternResult.feedback as string[]).map((f, i) => (
                    <li key={i}>💡 {f}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Orchestrator-Worker Pattern */}
        {patternResult.pattern === 'orchestrator-worker' && (
          <div className="result-section">
            <h4>Work Plan</h4>
            <div className="subtasks-list">
              {(patternResult.subtaskResults as Array<{id: number; task: string; workerType: string; result: string}>)?.map((task, i) => (
                <div key={i} className="subtask-item">
                  <div className="subtask-header">
                    <span className="worker-badge">{task.workerType}</span>
                    <span>{task.task}</span>
                  </div>
                  <div className="subtask-result markdown-content">
                    <ReactMarkdown>{task.result}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <h4>Final Result</h4>
            <div className="markdown-content final-output">
              <ReactMarkdown>{patternResult.finalResult as string}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>AI Patterns Explorer</h1>
        <select 
          value={selectedPattern} 
          onChange={(e) => {
            setSelectedPattern(e.target.value);
            setPatternResult(null);
            setPatternError(null);
            setStatusUpdates([]);
          }}
          className="pattern-select"
        >
          <option value="chat">💬 Standard Chat</option>
          {patterns.map(p => (
            <option key={p.id} value={p.id}>
              {p.id === 'react' ? '🔄' : 
               p.id === 'plan-execute' ? '📋' :
               p.id === 'routing' ? '🔀' :
               p.id === 'parallel' ? '⚡' :
               p.id === 'evaluator-optimizer' ? '✨' :
               p.id === 'orchestrator-worker' ? '👷' : '🤖'} {p.name}
            </option>
          ))}
        </select>
      </header>

      {selectedPattern !== 'chat' && (
        <div className="pattern-info">
          <p>{patterns.find(p => p.id === selectedPattern)?.description}</p>
        </div>
      )}

      <div className="messages">
        {selectedPattern === 'chat' ? (
          <>
            {messages.length === 0 && (
              <div className="empty-state">
                <p>Send a message to start chatting!</p>
              </div>
            )}
            {messages.map(message => (
              <div
                key={message.id}
                className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="message-role">
                  {message.role === 'user' ? 'You' : 'AI'}
                </div>
                <div className="message-content">
                  {message.parts.map((part, index) =>
                    part.type === 'text' ? <span key={index}>{part.text}</span> : null
                  )}
                </div>
              </div>
            ))}
            {status === 'submitted' && (
              <div className="message assistant">
                <div className="message-role">AI</div>
                <div className="message-content typing">Thinking...</div>
              </div>
            )}
          </>
        ) : (
          <>
            {!patternResult && !patternLoading && statusUpdates.length === 0 && (
              <div className="empty-state">
                <p>Enter your prompt below to test the {patterns.find(p => p.id === selectedPattern)?.name} pattern</p>
              </div>
            )}
            {(patternLoading || statusUpdates.length > 0) && !patternResult && (
              <div className="status-container" ref={statusContainerRef}>
                <div className="status-header">
                  <span className="status-indicator"></span>
                  <span>Processing with {patterns.find(p => p.id === selectedPattern)?.name}</span>
                </div>
                <div className="status-updates">
                  {statusUpdates.map((update, i) => (
                    <div key={i} className="status-item">
                      <span className="status-text">{update.status}</span>
                      {update.data?.phase && (
                        <span className="status-phase">{update.data.phase}</span>
                      )}
                    </div>
                  ))}
                  {patternLoading && (
                    <div className="status-item current">
                      <span className="status-dots">
                        <span></span><span></span><span></span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {renderPatternResult()}
          </>
        )}
      </div>

      {(error || patternError) && (
        <div className="error">
          {error?.message || patternError || 'An error occurred. Please try again.'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            selectedPattern === 'chat' ? 'Say something...' :
            selectedPattern === 'react' ? 'Ask a question (can use weather, calculator, search)...' :
            selectedPattern === 'routing' ? 'Enter any query to classify and route...' :
            selectedPattern === 'parallel' ? 'Enter content to analyze...' :
            'Enter a task to process...'
          }
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
