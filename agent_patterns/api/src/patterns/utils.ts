/**
 * Pattern Utilities
 * 
 * Shared utility functions for agent patterns, including completion detection,
 * termination logic, and convergence checking.
 */

import { CapabilityResult, Message, AttemptHistory } from '../types';

/**
 * Check if a task is complete based on capability result
 */
export function isTaskComplete(result: CapabilityResult): boolean {
  if (!result.output) return false;

  const output = result.output.toLowerCase();
  const completionSignals = [
    'task completed',
    'task complete',
    'finished',
    'done',
    'final answer:',
    'in conclusion',
    'therefore, the answer is',
    'the result is',
    'completed successfully'
  ];

  return completionSignals.some(signal => output.includes(signal));
}

/**
 * Check if we should terminate execution early
 */
export function shouldTerminate(result: CapabilityResult, messages: Message[]): boolean {
  // Check nextAction for termination signals
  if (result.nextAction) {
    const nextAction = result.nextAction.toLowerCase();
    if (nextAction.includes('terminate') || 
        nextAction.includes('complete') ||
        nextAction.includes('finish')) {
      return true;
    }
    // If nextAction is 'none', it means the reasoning is complete
    if (nextAction === 'none') {
      return true;
    }
  }
  
  // Check if we have tool results in conversation (indicates we're post-tool execution)
  const hasToolResultsInConversation = messages.some(m => m.role === 'tool');
  
  // After tool execution, if there's no nextAction, the LLM probably said "none" 
  // which was filtered out by parseReasoningOutput()
  if (hasToolResultsInConversation && !result.nextAction) {
    // After tool execution with no next action, task is likely complete
    return true;
  }

  return false;
}

/**
 * Check if a result contains a definitive answer
 */
export function hasDefinitiveAnswer(result: CapabilityResult): boolean {
  if (!result.output) return false;

  const output = result.output.toLowerCase();
  
  // Check for definitive answer patterns
  const answerPatterns = [
    'the answer is',
    'the result is',
    'the solution is',
    'therefore',
    'in conclusion',
    'to summarize',
    'final answer',
    'calculated result'
  ];

  // Also check if nextAction is 'none' which indicates completion
  const hasAnswerPattern = answerPatterns.some(pattern => output.includes(pattern));
  const hasNoNextAction = !result.nextAction || result.nextAction.toLowerCase() === 'none';

  return hasAnswerPattern || (hasNoNextAction && output.length > 20);
}

/**
 * Check if validation was successful based on capability result
 */
export function isValidationSuccessful(result: CapabilityResult): boolean {
  // If it's a ValidationResult, check the isValid field
  if ('isValid' in result) {
    return (result as any).isValid === true;
  }

  // Otherwise, check for success indicators in the output
  if (!result.output) return false;

  const output = result.output.toLowerCase();
  const successPatterns = [
    'validation passed',
    'validation successful',
    'all checks passed',
    'no errors found',
    'valid',
    'correct',
    'success'
  ];

  const failurePatterns = [
    'validation failed',
    'error',
    'invalid',
    'incorrect',
    'failed'
  ];

  const hasSuccess = successPatterns.some(pattern => output.includes(pattern));
  const hasFailure = failurePatterns.some(pattern => output.includes(pattern));

  // Success patterns and no failure patterns
  return hasSuccess && !hasFailure;
}

/**
 * Check if attempts have converged (no longer improving)
 */
export function hasConverged(history: AttemptHistory[]): boolean {
  if (history.length < 2) {
    return false;
  }

  const lastAttempt = history[history.length - 1];
  const previousAttempt = history[history.length - 2];

  // If both failed with the same error, we've converged (stuck)
  if (lastAttempt.error && previousAttempt.error) {
    const normalizeError = (err: string) => 
      err.toLowerCase().replace(/line \d+/g, 'line X').replace(/\d+/g, 'N');
    
    if (normalizeError(lastAttempt.error) === normalizeError(previousAttempt.error)) {
      return true;
    }
  }

  // If last 3 attempts have the same code (cycling)
  if (history.length >= 3 && lastAttempt.code) {
    const thirdAttempt = history[history.length - 3];
    if (thirdAttempt.code && lastAttempt.code === thirdAttempt.code) {
      return true;
    }
  }

  // If the last attempt succeeded, we've converged (success)
  if (lastAttempt.result && lastAttempt.result.success) {
    return true;
  }

  return false;
}

/**
 * Check if the last N attempts show no improvement
 */
export function isStuck(history: AttemptHistory[], lookback: number = 3): boolean {
  if (history.length < lookback) {
    return false;
  }

  const recentAttempts = history.slice(-lookback);
  
  // All recent attempts failed
  const allFailed = recentAttempts.every(attempt => 
    !attempt.result?.success || attempt.error
  );

  if (!allFailed) {
    return false;
  }

  // Check if errors are similar (not making progress)
  const errors = recentAttempts
    .map(a => a.error || a.result?.error || '')
    .filter(e => e.length > 0);

  if (errors.length < 2) {
    return false;
  }

  const normalizeError = (err: string) => 
    err.toLowerCase()
      .replace(/line \d+/g, 'line X')
      .replace(/:\d+:/g, ':X:')
      .replace(/\d+/g, 'N');

  const normalizedErrors = errors.map(normalizeError);
  
  // If all errors are the same, we're stuck
  const firstError = normalizedErrors[0];
  return normalizedErrors.every(err => err === firstError);
}

/**
 * Calculate success rate from attempt history
 */
export function calculateSuccessRate(history: AttemptHistory[]): number {
  if (history.length === 0) {
    return 0;
  }

  const successful = history.filter(attempt => 
    attempt.result?.success && !attempt.error
  ).length;

  return successful / history.length;
}

/**
 * Get the best attempt from history (highest success or least errors)
 */
export function getBestAttempt(history: AttemptHistory[]): AttemptHistory | undefined {
  if (history.length === 0) {
    return undefined;
  }

  // First, try to find a successful attempt
  const successfulAttempts = history.filter(attempt => 
    attempt.result?.success && !attempt.error
  );

  if (successfulAttempts.length > 0) {
    // Return the first successful attempt
    return successfulAttempts[0];
  }

  // If no successful attempts, return the last one (most recent)
  return history[history.length - 1];
}

/**
 * Estimate if we should continue iterating
 */
export function shouldContinueIterating(
  history: AttemptHistory[],
  maxAttempts: number
): {
  shouldContinue: boolean;
  reason: string;
} {
  // Check max attempts
  if (history.length >= maxAttempts) {
    return {
      shouldContinue: false,
      reason: `Reached maximum attempts (${maxAttempts})`
    };
  }

  // Check if we've succeeded
  const lastAttempt = history[history.length - 1];
  if (lastAttempt?.result?.success && !lastAttempt.error) {
    return {
      shouldContinue: false,
      reason: 'Task completed successfully'
    };
  }

  // Check if we're stuck
  if (isStuck(history)) {
    return {
      shouldContinue: false,
      reason: 'No progress in recent attempts - appears stuck'
    };
  }

  // Check if we've converged
  if (hasConverged(history)) {
    return {
      shouldContinue: false,
      reason: 'Attempts have converged - not improving'
    };
  }

  // Otherwise, continue
  return {
    shouldContinue: true,
    reason: 'Still making progress'
  };
}
