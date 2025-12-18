/**
 * Calculator Tool - Performs mathematical calculations
 */

import { ToolResult } from '../types';
import { BaseTool } from './base';

export class CalculatorTool extends BaseTool {
  name = 'calculator';
  description = 'Performs mathematical calculations. Supports basic arithmetic, powers, square roots, and common mathematical functions.';
  parameters = {
    type: 'object' as const,
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "10 ** 2")',
      },
    },
    required: ['expression'],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    // Validate parameters
    const validationError = this.validateParams(params);
    if (validationError) {
      return validationError;
    }

    const expression = params.expression as string;

    try {
      // Sanitize and evaluate the expression
      const result = this.evaluateExpression(expression);
      
      return this.success({
        expression,
        result,
      });
    } catch (error) {
      return this.error(
        `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`,
        { expression }
      );
    }
  }

  /**
   * Safely evaluate a mathematical expression
   */
  private evaluateExpression(expr: string): number {
    // Remove whitespace
    const cleaned = expr.trim();

    // Check for dangerous patterns
    if (this.containsDangerousPatterns(cleaned)) {
      throw new Error('Expression contains potentially dangerous operations');
    }

    try {
      // Replace common math functions with Math. equivalents
      let processedExpr = cleaned
        .replace(/\bsqrt\(/g, 'Math.sqrt(')
        .replace(/\babs\(/g, 'Math.abs(')
        .replace(/\bsin\(/g, 'Math.sin(')
        .replace(/\bcos\(/g, 'Math.cos(')
        .replace(/\btan\(/g, 'Math.tan(')
        .replace(/\blog\(/g, 'Math.log(')
        .replace(/\bexp\(/g, 'Math.exp(')
        .replace(/\bfloor\(/g, 'Math.floor(')
        .replace(/\bceil\(/g, 'Math.ceil(')
        .replace(/\bround\(/g, 'Math.round(')
        .replace(/\bmax\(/g, 'Math.max(')
        .replace(/\bmin\(/g, 'Math.min(')
        .replace(/\bpi\b/g, 'Math.PI')
        .replace(/\be\b/g, 'Math.E')
        .replace(/\*\*/g, '**'); // Power operator

      // Use Function constructor for safe evaluation
      // This is safer than eval() as it doesn't have access to local scope
      const result = new Function(`'use strict'; return (${processedExpr})`)();

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Expression did not evaluate to a finite number');
      }

      return result;
    } catch (error) {
      throw new Error(`Invalid expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check for dangerous patterns that could be code injection
   */
  private containsDangerousPatterns(expr: string): boolean {
    const dangerousPatterns = [
      /require\(/,
      /import\s/,
      /function\s/,
      /=>/,
      /\beval\(/,
      /\bexec\(/,
      /process\./,
      /global\./,
      /\bwhile\(/,
      /\bfor\(/,
      /\bif\(/,
      /\breturn\b/,
      /\bthrow\b/,
      /\btry\b/,
      /\bcatch\b/,
      /\bfinally\b/,
      /\bdelete\b/,
      /\bnew\s/,
      /\bthis\./,
      /\bwindow\./,
      /\bdocument\./,
      /\bconsole\./,
      /\bsetTimeout\(/,
      /\bsetInterval\(/,
    ];

    return dangerousPatterns.some(pattern => pattern.test(expr));
  }
}
