/**
 * Conversation Management Utilities
 * 
 * Utilities for managing long conversation histories in iterative patterns,
 * including summarization, pruning, and context extraction.
 */

import { Message, AttemptHistory } from '../types';

/**
 * Summarize previous attempts into a concise description
 */
export function summarizePreviousAttempts(history: AttemptHistory[]): string {
  if (history.length === 0) {
    return 'No previous attempts.';
  }

  const summary: string[] = [];
  summary.push(`Previous attempts: ${history.length}`);

  // Count successes and failures
  const successful = history.filter(a => a.result?.success && !a.error).length;
  const failed = history.length - successful;

  if (successful > 0) {
    summary.push(`✓ ${successful} succeeded`);
  }
  if (failed > 0) {
    summary.push(`✗ ${failed} failed`);
  }

  // Summarize last few attempts
  const recentCount = Math.min(3, history.length);
  summary.push(`\nLast ${recentCount} attempts:`);

  for (let i = history.length - recentCount; i < history.length; i++) {
    const attempt = history[i];
    const status = attempt.result?.success && !attempt.error ? '✓' : '✗';
    const errorMsg = attempt.error ? ` (${attempt.error.substring(0, 50)}...)` : '';
    summary.push(`  ${status} Attempt ${attempt.attemptNumber}${errorMsg}`);
  }

  return summary.join('\n');
}

/**
 * Prune old messages, keeping only the most recent ones
 */
export function pruneOldMessages(messages: Message[], keepLast: number): Message[] {
  if (messages.length <= keepLast) {
    return messages;
  }

  // Always keep system messages at the start
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  // Keep the last N non-system messages
  const recentMessages = otherMessages.slice(-keepLast);

  return [...systemMessages, ...recentMessages];
}

/**
 * Extract relevant context from messages based on token limit
 * (Simplified version - assumes ~4 chars per token)
 */
export function extractRelevantContext(
  messages: Message[],
  maxTokens: number
): Message[] {
  const CHARS_PER_TOKEN = 4;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  // Always include system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  let totalChars = systemMessages.reduce((sum, m) => sum + m.content.length, 0);
  const selectedMessages: Message[] = [...systemMessages];

  // Add messages from most recent backwards until we hit the limit
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const msgLength = msg.content.length;

    if (totalChars + msgLength > maxChars) {
      break;
    }

    selectedMessages.unshift(msg);
    totalChars += msgLength;
  }

  // Ensure messages are in chronological order
  return selectedMessages.sort((a, b) => {
    const aIndex = messages.indexOf(a);
    const bIndex = messages.indexOf(b);
    return aIndex - bIndex;
  });
}

/**
 * Create a summary message from attempt history for context
 */
export function createAttemptSummaryMessage(history: AttemptHistory[]): Message {
  const summary = summarizePreviousAttempts(history);
  
  return {
    role: 'system',
    content: `Context: Previous iteration attempts:\n${summary}\n\nUse this information to inform your next attempt. Avoid repeating the same mistakes.`
  };
}

/**
 * Extract key learnings from failed attempts
 */
export function extractLearnings(history: AttemptHistory[]): string[] {
  const learnings: string[] = [];
  const errorPatterns = new Map<string, number>();

  // Categorize errors
  for (const attempt of history) {
    if (attempt.error) {
      const errorType = categorizeErrorType(attempt.error);
      errorPatterns.set(errorType, (errorPatterns.get(errorType) || 0) + 1);
    }
  }

  // Generate learnings based on patterns
  for (const [errorType, count] of errorPatterns.entries()) {
    if (count >= 2) {
      learnings.push(`Recurring ${errorType} errors (${count}x) - needs different approach`);
    }
  }

  // Check for timeout patterns
  const timeouts = history.filter(a => 
    a.error?.toLowerCase().includes('timeout') || 
    a.result?.errorType === 'timeout'
  ).length;

  if (timeouts >= 2) {
    learnings.push('Multiple timeouts - code may be too slow or have infinite loops');
  }

  // Check for syntax errors
  const syntaxErrors = history.filter(a => 
    a.error?.toLowerCase().includes('syntax') || 
    a.result?.errorType === 'syntax'
  ).length;

  if (syntaxErrors >= 2) {
    learnings.push('Repeated syntax errors - need to be more careful with code syntax');
  }

  return learnings;
}

/**
 * Categorize error type from error message
 */
function categorizeErrorType(error: string): string {
  const lower = error.toLowerCase();
  
  if (lower.includes('syntax')) return 'syntax';
  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('undefined') || lower.includes('not defined')) return 'undefined variable';
  if (lower.includes('type')) return 'type error';
  if (lower.includes('index') || lower.includes('key')) return 'index/key error';
  if (lower.includes('division')) return 'division error';
  
  return 'runtime';
}

/**
 * Get conversation size estimate in tokens
 */
export function estimateConversationTokens(messages: Message[]): number {
  const CHARS_PER_TOKEN = 4;
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * Check if conversation needs pruning based on token limit
 */
export function needsPruning(messages: Message[], maxTokens: number): boolean {
  return estimateConversationTokens(messages) > maxTokens;
}

/**
 * Compress tool results in messages to save context
 */
export function compressToolResults(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (msg.role === 'tool') {
      // Truncate long tool results
      const maxLength = 500;
      if (msg.content.length > maxLength) {
        return {
          ...msg,
          content: msg.content.substring(0, maxLength) + '... (truncated)'
        };
      }
    }
    return msg;
  });
}

/**
 * Create a fresh context with summary of previous work
 */
export function createFreshContextWithSummary(
  messages: Message[],
  history: AttemptHistory[],
  maxTokens: number = 2000
): Message[] {
  // Extract the original user query
  const userQuery = messages.find(m => m.role === 'user');
  if (!userQuery) {
    return messages;
  }

  // Create summary of previous attempts
  const summaryMsg = createAttemptSummaryMessage(history);
  const learnings = extractLearnings(history);
  
  const learningsMsg: Message = {
    role: 'system',
    content: `Key learnings from previous attempts:\n${learnings.map(l => `- ${l}`).join('\n')}`
  };

  // Build fresh context
  const freshContext: Message[] = [summaryMsg];
  
  if (learnings.length > 0) {
    freshContext.push(learningsMsg);
  }
  
  freshContext.push(userQuery);

  // Add recent relevant messages if space allows
  const recentMessages = extractRelevantContext(
    messages.slice(1), // Skip first user message (already included)
    maxTokens - estimateConversationTokens(freshContext)
  );

  return [...freshContext, ...recentMessages];
}
