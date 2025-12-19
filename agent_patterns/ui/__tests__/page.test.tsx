import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../app/page';

const mockStream = vi.fn();

vi.mock('../lib/sse', () => ({
  streamExecution: (...args: unknown[]) => mockStream(...args)
}));

describe('HomePage', () => {
  beforeEach(() => {
    mockStream.mockImplementation(async function* () {
      yield { 
        timestamp: Date.now(), 
        eventType: 'start', 
        data: { pattern: 'react', input: 'Test question' } 
      };
      yield { 
        timestamp: Date.now(), 
        eventType: 'step', 
        data: { type: 'reasoning', content: 'Thinking about the question...' } 
      };
      yield { 
        timestamp: Date.now(), 
        eventType: 'step', 
        data: { type: 'answer', content: 'Here is the answer to your question.' } 
      };
      yield { 
        timestamp: Date.now(), 
        eventType: 'complete', 
        data: { status: 'success', duration: 123 } 
      };
    });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ patterns: [{ name: 'react', description: 'Reason + Act' }] })
      } as Response)
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockStream.mockReset();
  });

  it('renders title and form', async () => {
    render(<HomePage />);

    // Wait for the page to load
    await screen.findByText(/Agent Patterns/i);
    
    // Check for pattern selector
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    
    // Check for input textarea
    const textarea = screen.getByPlaceholderText(/Ask a question/i);
    expect(textarea).toBeInTheDocument();
    
    // Check for send button
    const sendButton = screen.getByRole('button', { name: '↑' });
    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toBeDisabled(); // Should be disabled when empty
  });

  it('streams events into chat and log', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    // Type a message
    const textarea = screen.getByPlaceholderText(/Ask a question/i);
    await user.type(textarea, 'Test question');

    // Send button should now be enabled
    const sendButton = screen.getByRole('button', { name: '↑' });
    expect(sendButton).not.toBeDisabled();

    // Click send button
    await user.click(sendButton);

    // Wait for stream to be called
    await waitFor(() => expect(mockStream).toHaveBeenCalled());

    // Check that the answer appears in the UI
    await waitFor(() => {
      expect(screen.getByText(/Here is the answer to your question/i)).toBeInTheDocument();
    });

    // Check that events were collected (logs button should appear)
    expect(screen.getByText(/Show Logs/i)).toBeInTheDocument();
  });
});
