/**
 * Tests for CalculatorTool
 */

import { CalculatorTool } from '../../src/tools/calculator';

describe('CalculatorTool', () => {
  let calculator: CalculatorTool;

  beforeEach(() => {
    calculator = new CalculatorTool();
  });

  describe('Tool metadata', () => {
    it('should have correct name', () => {
      expect(calculator.name).toBe('calculator');
    });

    it('should have description', () => {
      expect(calculator.description).toBeTruthy();
      expect(calculator.description.length).toBeGreaterThan(10);
    });

    it('should define parameters', () => {
      expect(calculator.parameters).toBeDefined();
      expect(calculator.parameters.properties.expression).toBeDefined();
      expect(calculator.parameters.required).toContain('expression');
    });
  });

  describe('Basic arithmetic', () => {
    it('should add numbers', async () => {
      const result = await calculator.execute({ expression: '2 + 2' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(4);
    });

    it('should subtract numbers', async () => {
      const result = await calculator.execute({ expression: '10 - 3' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(7);
    });

    it('should multiply numbers', async () => {
      const result = await calculator.execute({ expression: '5 * 6' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(30);
    });

    it('should divide numbers', async () => {
      const result = await calculator.execute({ expression: '20 / 4' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(5);
    });

    it('should handle complex expressions', async () => {
      const result = await calculator.execute({ expression: '(10 + 5) * 2 - 8' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(22);
    });

    it('should handle decimal numbers', async () => {
      const result = await calculator.execute({ expression: '3.14 * 2' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(6.28, 2);
    });
  });

  describe('Power operations', () => {
    it('should calculate powers', async () => {
      const result = await calculator.execute({ expression: '2 ** 8' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(256);
    });

    it('should handle fractional powers', async () => {
      const result = await calculator.execute({ expression: '9 ** 0.5' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(3, 5);
    });
  });

  describe('Mathematical functions', () => {
    it('should calculate square root', async () => {
      const result = await calculator.execute({ expression: 'sqrt(16)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(4);
    });

    it('should calculate absolute value', async () => {
      const result = await calculator.execute({ expression: 'abs(-42)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(42);
    });

    it('should calculate max', async () => {
      const result = await calculator.execute({ expression: 'max(5, 10, 3)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(10);
    });

    it('should calculate min', async () => {
      const result = await calculator.execute({ expression: 'min(5, 10, 3)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(3);
    });

    it('should handle floor', async () => {
      const result = await calculator.execute({ expression: 'floor(3.7)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(3);
    });

    it('should handle ceil', async () => {
      const result = await calculator.execute({ expression: 'ceil(3.2)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(4);
    });

    it('should handle round', async () => {
      const result = await calculator.execute({ expression: 'round(3.6)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(4);
    });

    it('should use pi constant', async () => {
      const result = await calculator.execute({ expression: 'pi * 2' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(6.283185, 5);
    });

    it('should use e constant', async () => {
      const result = await calculator.execute({ expression: 'e * 2' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(5.436563, 5);
    });
  });

  describe('Trigonometric functions', () => {
    it('should calculate sine', async () => {
      const result = await calculator.execute({ expression: 'sin(0)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(0, 5);
    });

    it('should calculate cosine', async () => {
      const result = await calculator.execute({ expression: 'cos(0)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(1, 5);
    });

    it('should calculate tangent', async () => {
      const result = await calculator.execute({ expression: 'tan(0)' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeCloseTo(0, 5);
    });
  });

  describe('Error handling', () => {
    it('should fail when expression parameter is missing', async () => {
      const result = await calculator.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should fail on invalid expression', async () => {
      const result = await calculator.execute({ expression: 'invalid expression @@' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to evaluate expression');
    });

    it('should fail on division by zero', async () => {
      const result = await calculator.execute({ expression: '1 / 0' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('did not evaluate to a finite number');
    });

    it('should reject dangerous code injection attempts', async () => {
      const dangerousExpressions = [
        'require("fs")',
        'process.exit()',
        'eval("2+2")',
        'while(true){}',
        'function() { return 42; }',
        '() => 42',
      ];

      for (const expr of dangerousExpressions) {
        const result = await calculator.execute({ expression: expr });
        expect(result.success).toBe(false);
        expect(result.error).toContain('dangerous');
      }
    });

    it('should handle very large numbers', async () => {
      const result = await calculator.execute({ expression: '10 ** 100' });
      expect(result.success).toBe(true);
      expect(result.data.result).toBeGreaterThan(0);
    });
  });

  describe('Return data format', () => {
    it('should include expression in result', async () => {
      const result = await calculator.execute({ expression: '5 + 3' });
      expect(result.data.expression).toBe('5 + 3');
      expect(result.data.result).toBe(8);
    });

    it('should include metadata on error', async () => {
      const result = await calculator.execute({ expression: 'invalid' });
      expect(result.metadata?.expression).toBe('invalid');
    });
  });
});
