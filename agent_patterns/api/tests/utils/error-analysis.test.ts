/**
 * Tests for error analysis utilities
 */

import {
  analyzeExecutionError,
  categorizeError,
  extractErrorMessage,
  extractLineNumber,
  suggestFix,
  areSimilarErrors,
  detectErrorConvergence,
  ErrorCategory
} from '../../src/utils/error-analysis';
import { ToolResult } from '../../src/types';

describe('Error Analysis Utilities', () => {
  describe('analyzeExecutionError', () => {
    it('should detect no error for successful result', () => {
      const result: ToolResult = { success: true, data: 'output' };
      const analysis = analyzeExecutionError(result);

      expect(analysis.hasError).toBe(false);
      expect(analysis.errorType).toBe('none');
      expect(analysis.suggestions).toHaveLength(0);
    });

    it('should analyze syntax error', () => {
      const result: ToolResult = {
        success: false,
        error: 'SyntaxError: Unexpected token on line 5'
      };
      const analysis = analyzeExecutionError(result);

      expect(analysis.hasError).toBe(true);
      expect(analysis.errorType).toBe('syntax');
      expect(analysis.lineNumber).toBe(5);
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it('should analyze runtime error', () => {
      const result: ToolResult = {
        success: false,
        error: 'TypeError: Cannot read property "foo" of undefined'
      };
      const analysis = analyzeExecutionError(result);

      expect(analysis.hasError).toBe(true);
      expect(analysis.errorType).toBe('runtime');
      expect(analysis.suggestions.some(s => s.includes('Verify the object exists'))).toBe(true);
    });

    it('should analyze timeout error', () => {
      const result: ToolResult = {
        success: false,
        error: 'Execution timeout exceeded'
      };
      const analysis = analyzeExecutionError(result);

      expect(analysis.hasError).toBe(true);
      expect(analysis.errorType).toBe('timeout');
      expect(analysis.suggestions.some(s => s.includes('Optimize the code'))).toBe(true);
    });
  });

  describe('categorizeError', () => {
    it('should categorize syntax errors', () => {
      expect(categorizeError('SyntaxError: invalid syntax')).toBe('syntax');
      expect(categorizeError('Unexpected token')).toBe('syntax');
      expect(categorizeError('IndentationError: expected indent')).toBe('syntax');
    });

    it('should categorize runtime errors', () => {
      expect(categorizeError('TypeError: foo is not defined')).toBe('runtime');
      expect(categorizeError('ReferenceError: x is not defined')).toBe('runtime');
      expect(categorizeError('NameError: name "x" is not defined')).toBe('runtime');
      expect(categorizeError('AttributeError: no attribute "foo"')).toBe('runtime');
      expect(categorizeError('ZeroDivisionError: division by zero')).toBe('runtime');
    });

    it('should categorize timeout errors', () => {
      expect(categorizeError('Execution timeout exceeded')).toBe('timeout');
      expect(categorizeError('Time out after 5 seconds')).toBe('timeout');
    });

    it('should default to logical for unknown errors', () => {
      expect(categorizeError('Something went wrong')).toBe('logical');
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract Python error message', () => {
      const stderr = `Traceback (most recent call last):
  File "test.py", line 5, in <module>
    print(x)
NameError: name 'x' is not defined`;

      const message = extractErrorMessage(stderr);
      expect(stderr).toContain('NameError');
      expect(message).toBeTruthy();
    });

    it('should extract JavaScript error message', () => {
      const stderr = `Error: Something went wrong
    at Object.<anonymous> (test.js:5:10)`;

      const message = extractErrorMessage(stderr);
      expect(message).toContain('Error: Something went wrong');
    });

    it('should handle simple error messages', () => {
      const message = extractErrorMessage('Simple error');
      expect(message).toBe('Simple error');
    });
  });

  describe('extractLineNumber', () => {
    it('should extract line number from Python error', () => {
      const error = 'File "test.py", line 42, in <module>';
      expect(extractLineNumber(error)).toBe(42);
    });

    it('should extract line number from JavaScript error', () => {
      const error = 'at Object.<anonymous> (test.js:15:10)';
      expect(extractLineNumber(error)).toBe(15);
    });

    it('should return undefined when no line number', () => {
      expect(extractLineNumber('Generic error message')).toBeUndefined();
    });
  });

  describe('suggestFix', () => {
    it('should suggest fixes for syntax errors', () => {
      const suggestions = suggestFix('syntax', 'SyntaxError: invalid syntax');
      expect(suggestions.some(s => s.includes('Check for syntax errors'))).toBe(true);
    });

    it('should suggest fixes for indentation errors', () => {
      const suggestions = suggestFix('syntax', 'IndentationError: expected indent');
      expect(suggestions.some(s => s.toLowerCase().includes('indentation'))).toBe(true);
    });

    it('should suggest fixes for undefined variables', () => {
      const suggestions = suggestFix('runtime', 'x is not defined');
      expect(suggestions.some(s => s.includes('variables and functions are defined'))).toBe(true);
    });

    it('should suggest fixes for timeout errors', () => {
      const suggestions = suggestFix('timeout', 'Execution timeout');
      expect(suggestions.some(s => s.includes('Optimize the code'))).toBe(true);
    });

    it('should return empty array for no error', () => {
      const suggestions = suggestFix('none', '');
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('areSimilarErrors', () => {
    it('should identify similar errors with different line numbers', () => {
      const error1 = 'NameError: name "x" is not defined at line 5';
      const error2 = 'NameError: name "x" is not defined at line 10';
      expect(areSimilarErrors(error1, error2)).toBe(true);
    });

    it('should identify different errors', () => {
      const error1 = 'NameError: name "x" is not defined';
      const error2 = 'TypeError: cannot read property';
      expect(areSimilarErrors(error1, error2)).toBe(false);
    });

    it('should normalize numbers in errors', () => {
      const error1 = 'IndexError: list index 5 out of range';
      const error2 = 'IndexError: list index 10 out of range';
      expect(areSimilarErrors(error1, error2)).toBe(true);
    });
  });

  describe('detectErrorConvergence', () => {
    it('should detect when errors are identical', () => {
      const history = [
        'NameError: x is not defined',
        'NameError: x is not defined'
      ];
      const result = detectErrorConvergence(history);
      expect(result.isConverging).toBe(false);
      expect(result.reason).toContain('unchanged');
    });

    it('should detect when errors are cycling', () => {
      const history = [
        'NameError: x is not defined',
        'TypeError: cannot read property',
        'NameError: x is not defined'
      ];
      const result = detectErrorConvergence(history);
      expect(result.isConverging).toBe(false);
      expect(result.reason).toContain('cycling');
    });

    it('should detect progress when errors are different', () => {
      const history = [
        'NameError: x is not defined',
        'TypeError: cannot read property'
      ];
      const result = detectErrorConvergence(history);
      expect(result.isConverging).toBe(true);
      expect(result.reason).toContain('progress');
    });

    it('should handle insufficient history', () => {
      const history = ['Single error'];
      const result = detectErrorConvergence(history);
      expect(result.isConverging).toBe(false);
      expect(result.reason).toContain('Not enough history');
    });
  });
});
