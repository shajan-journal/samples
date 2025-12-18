export type ExecutionEvent = {
  timestamp: number;
  eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization';
  data: any;
  debug?: any;
};

export type ExecuteOptions = {
  pattern: string;
  input: string;
  options?: Record<string, any>;
  apiBase?: string;
};

const decoder = new TextDecoder();

/**
 * Stream execution events from the API via SSE using fetch + ReadableStream.
 */
export async function* streamExecution({ pattern, input, options, apiBase }: ExecuteOptions) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${base}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern, input, options })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Split on SSE message boundary (blank line)
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const chunk of parts) {
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.replace('data: ', '');
          try {
            const event: ExecutionEvent = JSON.parse(payload);
            yield event;
          } catch {
            // ignore malformed chunk
          }
        }
      }
    }
  }
}
