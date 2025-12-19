/**
 * Tests for conversation management utilities
 */

import {
  summarizePreviousAttempts,
  pruneOldMessages,
  extractRelevantContext,
  createAttemptSummaryMessage,
  extractLearnings,
  estimateConversationTokens,
  needsPruning,
  compressToolResults,
  createFreshContextWithSummary
} from '../../src/utils/conversation';
import { Message, AttemptHistory, ToolResult } from '../../src/types';

describe('Conversation Management Utilities', () => {
  describe('summarizePreviousAttempts', () => {
    it('should handle empty history', () => {
      const summary = summarizePreviousAttempts([]);
      expect(summary).toContain('No previous attempts');
    });

    it('should summarize successful and failed attempts', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'Error 1',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        },
        {
          attemptNumber: 3,
          error: 'Error 3',
          timestamp: Date.now()
        }
      ];
      const summary = summarizePreviousAttempts(history);
      expect(summary).toContain('3');
      expect(summary).toContain('✓ 1 succeeded');
      expect(summary).toContain('✗ 2 failed');
    });

    it('should include recent attempts', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'Error 1',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'Error 2',
          timestamp: Date.now()
        }
      ];
      const summary = summarizePreviousAttempts(history);
      expect(summary).toContain('Attempt 1');
      expect(summary).toContain('Attempt 2');
    });
  });

  describe('pruneOldMessages', () => {
    it('should keep all messages if under limit', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' }
      ];
      const pruned = pruneOldMessages(messages, 5);
      expect(pruned).toHaveLength(2);
    });

    it('should keep system messages and recent messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' }
      ];
      const pruned = pruneOldMessages(messages, 2);
      
      expect(pruned).toHaveLength(3); // 1 system + 2 recent
      expect(pruned[0].role).toBe('system');
      expect(pruned[1].content).toBe('Message 2');
      expect(pruned[2].content).toBe('Response 2');
    });
  });

  describe('extractRelevantContext', () => {
    it('should always include system messages', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' }
      ];
      const extracted = extractRelevantContext(messages, 10);
      expect(extracted[0].role).toBe('system');
    });

    it('should limit by token count', () => {
      const messages: Message[] = [
        { role: 'system', content: 'Short' },
        { role: 'user', content: 'A'.repeat(100) },
        { role: 'assistant', content: 'B'.repeat(100) },
        { role: 'user', content: 'C'.repeat(100) }
      ];
      // With 50 tokens (~200 chars), should not fit all messages
      const extracted = extractRelevantContext(messages, 50);
      expect(extracted.length).toBeLessThan(messages.length);
    });

    it('should maintain chronological order', () => {
      const messages: Message[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Second' }
      ];
      const extracted = extractRelevantContext(messages, 1000);
      expect(extracted[0].content).toBe('System');
      expect(extracted[1].content).toBe('First');
    });
  });

  describe('createAttemptSummaryMessage', () => {
    it('should create a system message with summary', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'Error',
          timestamp: Date.now()
        }
      ];
      const message = createAttemptSummaryMessage(history);
      expect(message.role).toBe('system');
      expect(message.content).toContain('Previous iteration attempts');
      expect(message.content).toContain('Attempt 1');
    });
  });

  describe('extractLearnings', () => {
    it('should identify recurring error patterns', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'SyntaxError: invalid syntax',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'SyntaxError: unexpected token',
          timestamp: Date.now()
        }
      ];
      const learnings = extractLearnings(history);
      expect(learnings.some(l => l.includes('Recurring syntax errors'))).toBe(true);
    });

    it('should identify timeout patterns', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'Execution timeout',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          result: { success: false, errorType: 'timeout' } as ToolResult,
          timestamp: Date.now()
        }
      ];
      const learnings = extractLearnings(history);
      expect(learnings.some(l => l.toLowerCase().includes('timeout'))).toBe(true);
    });

    it('should return empty array for successful history', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        }
      ];
      const learnings = extractLearnings(history);
      expect(learnings).toHaveLength(0);
    });
  });

  describe('estimateConversationTokens', () => {
    it('should estimate tokens from message length', () => {
      const messages: Message[] = [
        { role: 'user', content: 'A'.repeat(400) } // ~100 tokens at 4 chars/token
      ];
      const tokens = estimateConversationTokens(messages);
      expect(tokens).toBeCloseTo(100, -1); // Within 10 tokens
    });

    it('should handle multiple messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'A'.repeat(200) },
        { role: 'assistant', content: 'B'.repeat(200) }
      ];
      const tokens = estimateConversationTokens(messages);
      expect(tokens).toBeCloseTo(100, -1);
    });
  });

  describe('needsPruning', () => {
    it('should detect when pruning is needed', () => {
      const messages: Message[] = [
        { role: 'user', content: 'A'.repeat(1000) } // ~250 tokens
      ];
      expect(needsPruning(messages, 100)).toBe(true);
      expect(needsPruning(messages, 500)).toBe(false);
    });
  });

  describe('compressToolResults', () => {
    it('should truncate long tool results', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          content: 'A'.repeat(1000),
          name: 'calculator'
        }
      ];
      const compressed = compressToolResults(messages);
      expect(compressed[0].content.length).toBeLessThan(600);
      expect(compressed[0].content).toContain('truncated');
    });

    it('should not modify short tool results', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          content: 'Short result',
          name: 'calculator'
        }
      ];
      const compressed = compressToolResults(messages);
      expect(compressed[0].content).toBe('Short result');
    });

    it('should not modify non-tool messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'A'.repeat(1000) }
      ];
      const compressed = compressToolResults(messages);
      expect(compressed[0].content.length).toBe(1000);
    });
  });

  describe('createFreshContextWithSummary', () => {
    it('should create fresh context with user query', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Original question' },
        { role: 'assistant', content: 'Response' }
      ];
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'Error',
          timestamp: Date.now()
        }
      ];
      
      const fresh = createFreshContextWithSummary(messages, history);
      
      // Should have summary, user query
      expect(fresh.length).toBeGreaterThanOrEqual(2);
      expect(fresh.some(m => m.content.includes('Previous iteration attempts'))).toBe(true);
      expect(fresh.some(m => m.content === 'Original question')).toBe(true);
    });

    it('should include learnings if available', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Question' }
      ];
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'SyntaxError: invalid',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'SyntaxError: unexpected',
          timestamp: Date.now()
        }
      ];
      
      const fresh = createFreshContextWithSummary(messages, history);
      expect(fresh.some(m => m.content.includes('Key learnings'))).toBe(true);
    });

    it('should handle messages without user query', () => {
      const messages: Message[] = [
        { role: 'assistant', content: 'Response' }
      ];
      const history: AttemptHistory[] = [];
      
      const fresh = createFreshContextWithSummary(messages, history);
      expect(fresh).toBe(messages);
    });
  });
});
