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
      yield { timestamp: Date.now(), eventType: 'start', data: { pattern: 'react', input: 'hello' } };
      yield { timestamp: Date.now(), eventType: 'step', data: { type: 'result', content: 'Working...' } };
      yield { timestamp: Date.now(), eventType: 'complete', data: { status: 'success', duration: 12 } };
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

    await screen.findByText(/Agent Patterns UI/i);
    expect(screen.getByLabelText(/Pattern/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Input/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run pattern/i })).toBeInTheDocument();
  });

  it('streams events into chat and log', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('button', { name: /Run pattern/i }));

    await waitFor(() => expect(mockStream).toHaveBeenCalled());
    expect(await screen.findByText(/Starting react/i)).toBeInTheDocument();
    const chat = screen.getByLabelText(/chat/i);
    expect(within(chat).getAllByText(/Working/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Complete: success/i)).toBeInTheDocument();
    expect(screen.getByText(/🚀 START/)).toBeInTheDocument();
  });
});
