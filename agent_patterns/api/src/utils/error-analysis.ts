/**
 * Error Analysis Utilities
 * 
 * Provides functions to analyze code execution errors, categorize them,
 * and suggest fixes. Used primarily by ValidationCapability and
 * iterative refinement patterns.
 */

import { ToolResult } from '../types';

export type ErrorCategory = 'syntax' | 'runtime' | 'logical' | 'timeout' | 'none';

export interface ErrorAnalysis {
  hasError: boolean;
  errorType: ErrorCategory;
  errorMessage: string;
  lineNumber?: number;
  stackTrace?: string;
  suggestions: string[];
}

/**
 * Analyze a tool execution result for errors
 */
export function analyzeExecutionError(result: ToolResult): ErrorAnalysis {
  // If the result was successful, no error
  if (result.success) {
    return {
      hasError: false,
      errorType: 'none',
      errorMessage: '',
      suggestions: []
    };
  }

  const errorMessage = result.error || 'Unknown error';
  const errorType = categorizeError(errorMessage);
  const lineNumber = extractLineNumber(errorMessage);
  const stackTrace = extractStackTrace(result);
  const suggestions = suggestFix(errorType, errorMessage);

  return {
    hasError: true,
    errorType,
    errorMessage,
    lineNumber,
    stackTrace,
    suggestions
  };
}

/**
 * Categorize an error based on error message patterns
 */
export function categorizeError(errorText: string): ErrorCategory {
  const lowerError = errorText.toLowerCase();

  // Timeout errors
  if (lowerError.includes('timeout') || 
      lowerError.includes('time out') ||
      lowerError.includes('exceeded')) {
    return 'timeout';
  }

  // Syntax errors
  if (lowerError.includes('syntaxerror') ||
      lowerError.includes('syntax error') ||
      lowerError.includes('unexpected token') ||
      lowerError.includes('invalid syntax') ||
      lowerError.includes('parsing error') ||
      lowerError.includes('indentationerror')) {
    return 'syntax';
  }

  // Runtime errors
  if (lowerError.includes('referenceerror') ||
      lowerError.includes('typeerror') ||
      lowerError.includes('rangeerror') ||
      lowerError.includes('nameerror') ||
      lowerError.includes('attributeerror') ||
      lowerError.includes('keyerror') ||
      lowerError.includes('indexerror') ||
      lowerError.includes('valueerror') ||
      lowerError.includes('zerodivisionerror') ||
      lowerError.includes('is not defined') ||
      lowerError.includes('cannot read property') ||
      lowerError.includes('undefined')) {
    return 'runtime';
  }

  // If no specific pattern matched but there's an error, assume logical
  return 'logical';
}

/**
 * Extract error message from stderr or error string
 */
export function extractErrorMessage(errorText: string): string {
  // Try to extract the main error message
  const lines = errorText.split('\n');
  
  // Look for lines that start with common error patterns
  const errorPatterns = [
    /^(SyntaxError|TypeError|ReferenceError|RangeError|Error):/,
    /^(NameError|AttributeError|KeyError|IndexError|ValueError|ZeroDivisionError):/,
    /File ".*", line \d+/
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of errorPatterns) {
      if (pattern.test(trimmed)) {
        return trimmed;
      }
    }
  }

  // If no pattern matched, return first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return errorText.trim();
}

/**
 * Extract line number from error message
 */
export function extractLineNumber(errorText: string): number | undefined {
  // Python style: File "file.py", line 5
  const pythonMatch = errorText.match(/line (\d+)/i);
  if (pythonMatch) {
    return parseInt(pythonMatch[1], 10);
  }

  // JavaScript style: at Object.<anonymous> (file.js:5:10)
  const jsMatch = errorText.match(/:(\d+):\d+\)/);
  if (jsMatch) {
    return parseInt(jsMatch[1], 10);
  }

  return undefined;
}

/**
 * Extract stack trace from tool result
 */
function extractStackTrace(result: ToolResult): string | undefined {
  // Check if metadata contains stderr with stack trace
  if (result.metadata?.stderr && typeof result.metadata.stderr === 'string') {
    const stderr = result.metadata.stderr;
    if (stderr.includes('Traceback') || stderr.includes('at ')) {
      return stderr;
    }
  }

  // Check if data contains stack trace
  if (result.data?.stderr) {
    return result.data.stderr;
  }

  return undefined;
}

/**
 * Suggest fixes based on error type and message
 */
export function suggestFix(errorType: ErrorCategory, errorMessage: string): string[] {
  const suggestions: string[] = [];
  const lowerError = errorMessage.toLowerCase();

  switch (errorType) {
    case 'syntax':
      suggestions.push('Check for syntax errors in your code');
      if (lowerError.includes('indent')) {
        suggestions.push('Verify proper indentation (use consistent spaces or tabs)');
      }
      if (lowerError.includes('unexpected token') || lowerError.includes('unexpected eof')) {
        suggestions.push('Check for missing or extra brackets, parentheses, or quotes');
      }
      if (lowerError.includes('invalid syntax')) {
        suggestions.push('Review the syntax near the indicated line number');
      }
      break;

    case 'runtime':
      if (lowerError.includes('is not defined') || lowerError.includes('nameerror')) {
        suggestions.push('Ensure all variables and functions are defined before use');
        suggestions.push('Check for typos in variable or function names');
      }
      if (lowerError.includes('cannot read property') || lowerError.includes('attributeerror')) {
        suggestions.push('Verify the object exists before accessing its properties');
        suggestions.push('Check if the variable is null or undefined');
      }
      if (lowerError.includes('typeerror')) {
        suggestions.push('Check data types - ensure operations match expected types');
      }
      if (lowerError.includes('indexerror') || lowerError.includes('keyerror')) {
        suggestions.push('Verify array/list indices are within bounds');
        suggestions.push('Check if the key exists in the dictionary/object');
      }
      if (lowerError.includes('zerodivision')) {
        suggestions.push('Add a check to prevent division by zero');
      }
      break;

    case 'timeout':
      suggestions.push('Optimize the code to run faster');
      suggestions.push('Check for infinite loops or expensive operations');
      suggestions.push('Consider breaking the task into smaller chunks');
      break;

    case 'logical':
      suggestions.push('Review the logic to ensure it matches the requirements');
      suggestions.push('Add print statements to debug intermediate values');
      suggestions.push('Test with simpler inputs first');
      break;

    case 'none':
      // No error, no suggestions needed
      break;
  }

  return suggestions;
}

/**
 * Check if two errors are similar (for convergence detection)
 */
export function areSimilarErrors(error1: string, error2: string): boolean {
  // Normalize both errors
  const normalize = (err: string) => {
    return err
      .toLowerCase()
      .replace(/line \d+/g, 'line X')  // Normalize line numbers
      .replace(/:\d+:/g, ':X:')        // Normalize positions
      .replace(/\d+/g, 'N')            // Normalize all numbers
      .trim();
  };

  return normalize(error1) === normalize(error2);
}

/**
 * Detect if errors are converging (getting better or staying the same)
 */
export function detectErrorConvergence(errorHistory: string[]): {
  isConverging: boolean;
  reason: string;
} {
  if (errorHistory.length < 2) {
    return { isConverging: false, reason: 'Not enough history' };
  }

  // Check if last two errors are identical
  const lastError = errorHistory[errorHistory.length - 1];
  const previousError = errorHistory[errorHistory.length - 2];

  if (areSimilarErrors(lastError, previousError)) {
    return { 
      isConverging: false, 
      reason: 'Error unchanged - not making progress' 
    };
  }

  // Check if last 3 errors are cycling
  if (errorHistory.length >= 3) {
    const thirdError = errorHistory[errorHistory.length - 3];
    if (areSimilarErrors(lastError, thirdError)) {
      return { 
        isConverging: false, 
        reason: 'Errors cycling - stuck in a loop' 
      };
    }
  }

  // Otherwise, assume making progress
  return { isConverging: true, reason: 'Different error - making progress' };
}
