/**
 * Tests for pattern utilities
 */

import {
  isTaskComplete,
  shouldTerminate,
  hasDefinitiveAnswer,
  isValidationSuccessful,
  hasConverged,
  isStuck,
  calculateSuccessRate,
  getBestAttempt,
  shouldContinueIterating
} from '../../src/patterns/utils';
import { CapabilityResult, Message, AttemptHistory, ToolResult } from '../../src/types';

describe('Pattern Utilities', () => {
  describe('isTaskComplete', () => {
    it('should detect task completion signals', () => {
      const result1: CapabilityResult = { output: 'Task completed successfully' };
      expect(isTaskComplete(result1)).toBe(true);

      const result2: CapabilityResult = { output: 'The task complete now' };
      expect(isTaskComplete(result2)).toBe(true);

      const result3: CapabilityResult = { output: 'Done processing' };
      expect(isTaskComplete(result3)).toBe(true);

      const result4: CapabilityResult = { output: 'Final answer: 42' };
      expect(isTaskComplete(result4)).toBe(true);

      const result5: CapabilityResult = { output: 'In conclusion, the result is 42' };
      expect(isTaskComplete(result5)).toBe(true);

      const result6: CapabilityResult = { output: 'Still working on it' };
      expect(isTaskComplete(result6)).toBe(false);

      const result7: CapabilityResult = { output: '' };
      expect(isTaskComplete(result7)).toBe(false);
    });
  });

  describe('shouldTerminate', () => {
    it('should terminate when nextAction is "none"', () => {
      const result: CapabilityResult = {
        output: 'Some output',
        nextAction: 'none'
      };
      expect(shouldTerminate(result, [])).toBe(true);
    });

    it('should terminate when nextAction includes "complete"', () => {
      const result: CapabilityResult = {
        output: 'Some output',
        nextAction: 'complete the task'
      };
      expect(shouldTerminate(result, [])).toBe(true);
    });

    it('should terminate after tool execution with no nextAction', () => {
      const result: CapabilityResult = {
        output: 'Result from tool'
      };
      const messages: Message[] = [
        { role: 'user', content: 'Do something' },
        { role: 'tool', content: 'Tool result', name: 'calculator' }
      ];
      expect(shouldTerminate(result, messages)).toBe(true);
    });

    it('should not terminate when still working', () => {
      const result: CapabilityResult = {
        output: 'Analyzing...',
        nextAction: 'use_tool'
      };
      expect(shouldTerminate(result, [])).toBe(false);
    });
  });

  describe('hasDefinitiveAnswer', () => {
    it('should detect definitive answers', () => {
      const result1: CapabilityResult = { output: 'The answer is 42' };
      expect(hasDefinitiveAnswer(result1)).toBe(true);

      const result2: CapabilityResult = { output: 'Therefore, the result is correct' };
      expect(hasDefinitiveAnswer(result2)).toBe(true);

      const result3: CapabilityResult = { output: 'In conclusion, yes' };
      expect(hasDefinitiveAnswer(result3)).toBe(true);

      const result4: CapabilityResult = { output: 'Final answer: success' };
      expect(hasDefinitiveAnswer(result4)).toBe(true);

      const result5: CapabilityResult = { 
        output: 'This is a complete response with enough detail', 
        nextAction: 'none' 
      };
      expect(hasDefinitiveAnswer(result5)).toBe(true);

      const result6: CapabilityResult = { output: 'Processing...' };
      expect(hasDefinitiveAnswer(result6)).toBe(false);
    });
  });

  describe('isValidationSuccessful', () => {
    it('should detect successful validation from ValidationResult', () => {
      const result: any = {
        output: 'Validation complete',
        isValid: true,
        validationIssues: [],
        suggestedFixes: []
      };
      expect(isValidationSuccessful(result)).toBe(true);
    });

    it('should detect failed validation from ValidationResult', () => {
      const result: any = {
        output: 'Validation failed',
        isValid: false,
        validationIssues: ['Error 1'],
        suggestedFixes: []
      };
      expect(isValidationSuccessful(result)).toBe(false);
    });

    it('should detect success from output patterns', () => {
      const result: CapabilityResult = {
        output: 'Validation passed - all checks successful'
      };
      expect(isValidationSuccessful(result)).toBe(true);
    });

    it('should detect failure from output patterns', () => {
      const result: CapabilityResult = {
        output: 'Validation failed - errors found'
      };
      expect(isValidationSuccessful(result)).toBe(false);
    });
  });

  describe('hasConverged', () => {
    it('should detect convergence with identical errors', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x is not defined',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'NameError: x is not defined',
          timestamp: Date.now()
        }
      ];
      expect(hasConverged(history)).toBe(true);
    });

    it('should detect convergence with cycling code', () => {
      const code1 = 'print(x)';
      const history: AttemptHistory[] = [
        { attemptNumber: 1, code: code1, timestamp: Date.now() },
        { attemptNumber: 2, code: 'print(y)', timestamp: Date.now() },
        { attemptNumber: 3, code: code1, timestamp: Date.now() }
      ];
      expect(hasConverged(history)).toBe(true);
    });

    it('should detect convergence with success', () => {
      const successResult: ToolResult = { success: true, data: 'result' };
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          result: successResult,
          timestamp: Date.now()
        }
      ];
      // Need at least 2 attempts to check convergence
      expect(hasConverged(history)).toBe(false);
      
      // With 2 attempts and the last one successful
      history.push({
        attemptNumber: 2,
        result: successResult,
        timestamp: Date.now()
      });
      expect(hasConverged(history)).toBe(true);
    });

    it('should not detect convergence with different errors', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x is not defined',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'TypeError: cannot read property',
          timestamp: Date.now()
        }
      ];
      expect(hasConverged(history)).toBe(false);
    });

    it('should handle insufficient history', () => {
      expect(hasConverged([])).toBe(false);
      expect(hasConverged([{ attemptNumber: 1, timestamp: Date.now() }])).toBe(false);
    });
  });

  describe('isStuck', () => {
    it('should detect when stuck with same errors', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x is not defined at line 5',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'NameError: x is not defined at line 10',
          timestamp: Date.now()
        },
        {
          attemptNumber: 3,
          error: 'NameError: x is not defined at line 7',
          timestamp: Date.now()
        }
      ];
      expect(isStuck(history)).toBe(true);
    });

    it('should not detect stuck when making progress', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x is not defined',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'TypeError: cannot read',
          timestamp: Date.now()
        },
        {
          attemptNumber: 3,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        }
      ];
      expect(isStuck(history)).toBe(false);
    });
  });

  describe('calculateSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          result: { success: false, error: 'fail' },
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        },
        {
          attemptNumber: 3,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        }
      ];
      expect(calculateSuccessRate(history)).toBeCloseTo(0.667, 2);
    });

    it('should return 0 for empty history', () => {
      expect(calculateSuccessRate([])).toBe(0);
    });
  });

  describe('getBestAttempt', () => {
    it('should return successful attempt if available', () => {
      const successAttempt: AttemptHistory = {
        attemptNumber: 2,
        result: { success: true, data: 'ok' },
        timestamp: Date.now()
      };
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'fail',
          timestamp: Date.now()
        },
        successAttempt,
        {
          attemptNumber: 3,
          error: 'fail',
          timestamp: Date.now()
        }
      ];
      expect(getBestAttempt(history)).toBe(successAttempt);
    });

    it('should return last attempt if none successful', () => {
      const lastAttempt: AttemptHistory = {
        attemptNumber: 3,
        error: 'fail',
        timestamp: Date.now()
      };
      const history: AttemptHistory[] = [
        { attemptNumber: 1, error: 'fail', timestamp: Date.now() },
        { attemptNumber: 2, error: 'fail', timestamp: Date.now() },
        lastAttempt
      ];
      expect(getBestAttempt(history)).toBe(lastAttempt);
    });

    it('should return undefined for empty history', () => {
      expect(getBestAttempt([])).toBeUndefined();
    });
  });

  describe('shouldContinueIterating', () => {
    it('should stop at max attempts', () => {
      const history: AttemptHistory[] = [
        { attemptNumber: 1, timestamp: Date.now() },
        { attemptNumber: 2, timestamp: Date.now() },
        { attemptNumber: 3, timestamp: Date.now() }
      ];
      const result = shouldContinueIterating(history, 3);
      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('maximum attempts');
    });

    it('should stop on success', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          result: { success: true, data: 'ok' },
          timestamp: Date.now()
        }
      ];
      const result = shouldContinueIterating(history, 10);
      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('completed successfully');
    });

    it('should stop when stuck', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x is not defined at line 5',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'NameError: x is not defined at line 10',
          timestamp: Date.now()
        },
        {
          attemptNumber: 3,
          error: 'NameError: x is not defined at line 7',
          timestamp: Date.now()
        }
      ];
      const result = shouldContinueIterating(history, 10);
      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('stuck');
    });

    it('should continue when making progress', () => {
      const history: AttemptHistory[] = [
        {
          attemptNumber: 1,
          error: 'NameError: x',
          timestamp: Date.now()
        },
        {
          attemptNumber: 2,
          error: 'TypeError: y',
          timestamp: Date.now()
        }
      ];
      const result = shouldContinueIterating(history, 10);
      expect(result.shouldContinue).toBe(true);
      expect(result.reason).toContain('progress');
    });
  });
});
