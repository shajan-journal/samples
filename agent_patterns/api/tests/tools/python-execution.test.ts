/**
 * Tests for PythonExecutionTool
 */

import { PythonExecutionTool } from '../../src/tools/python-execution';

describe('PythonExecutionTool', () => {
  let tool: PythonExecutionTool;

  beforeEach(() => {
    tool = new PythonExecutionTool();
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('python_execute');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('should have parameters schema', () => {
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.code).toBeDefined();
    });
  });

  describe('Basic Execution', () => {
    it('should execute simple print statement', async () => {
      const result = await tool.execute({
        code: 'print("Hello, Python!")',
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Hello, Python!');
      expect(result.data.returnCode).toBe(0);
    });

    it('should execute arithmetic operations', async () => {
      const result = await tool.execute({
        code: 'print(2 + 2)',
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('4');
    });

    it('should execute multiple statements', async () => {
      const result = await tool.execute({
        code: `
x = 10
y = 20
print(x + y)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('30');
    });

    it('should capture multiple print calls', async () => {
      const result = await tool.execute({
        code: `
print("Line 1")
print("Line 2")
print("Line 3")
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Line 1');
      expect(result.data.stdout).toContain('Line 2');
      expect(result.data.stdout).toContain('Line 3');
    });

    it('should capture stderr output', async () => {
      const result = await tool.execute({
        code: `
import sys
print("Error message", file=sys.stderr)
        `,
      });

      // This might succeed with stderr captured
      expect(result.data.stderr).toContain('Error message');
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors', async () => {
      const result = await tool.execute({
        code: 'print("unclosed string',  // Syntax error
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle runtime errors', async () => {
      const result = await tool.execute({
        code: 'raise ValueError("Test error")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ValueError');
    });

    it('should handle undefined variable errors', async () => {
      const result = await tool.execute({
        code: 'print(undefined_variable)',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('NameError');
    });
  });

  describe('Timeout', () => {
    it('should timeout long-running code', async () => {
      const result = await tool.execute({
        code: `
import time
time.sleep(10)
        `,
        timeout: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 2000);

    it('should respect custom timeout', async () => {
      const result = await tool.execute({
        code: 'print("Quick execution")',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should require code parameter', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('code');
    });

    it('should accept valid parameters', async () => {
      const result = await tool.execute({
        code: 'print("test")',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Code', () => {
    it('should handle functions', async () => {
      const result = await tool.execute({
        code: `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('120');
    });

    it('should handle lists and dictionaries', async () => {
      const result = await tool.execute({
        code: `
data = {"name": "test", "values": [1, 2, 3]}
print(data)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('test');
    });

    it('should handle loops', async () => {
      const result = await tool.execute({
        code: `
for i in range(5):
    print(i)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('0');
      expect(result.data.stdout).toContain('4');
    });

    it('should handle imports of standard library', async () => {
      const result = await tool.execute({
        code: `
import math
print(math.sqrt(16))
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('4');
    });
  });

  describe('Execution Time Tracking', () => {
    it('should track execution time', async () => {
      const result = await tool.execute({
        code: 'print("test")',
      });

      expect(result.success).toBe(true);
      expect(result.data.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
