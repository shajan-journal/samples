/**
 * Tests for NodeExecutionTool
 */

import { NodeExecutionTool } from '../../src/tools/node-execution';

describe('NodeExecutionTool', () => {
  let tool: NodeExecutionTool;

  beforeEach(() => {
    tool = new NodeExecutionTool();
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('node_execute');
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
    it('should execute simple console.log', async () => {
      const result = await tool.execute({
        code: 'console.log("Hello, World!");',
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('Hello, World!');
    });

    it('should execute arithmetic and return result', async () => {
      const result = await tool.execute({
        code: '2 + 2',
      });

      expect(result.success).toBe(true);
      expect(result.data.result).toBe('4');
    });

    it('should execute multiple statements', async () => {
      const result = await tool.execute({
        code: `
          const x = 10;
          const y = 20;
          console.log(x + y);
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('30');
    });

    it('should capture multiple console.log calls', async () => {
      const result = await tool.execute({
        code: `
          console.log("Line 1");
          console.log("Line 2");
          console.log("Line 3");
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Line 1');
      expect(result.data.stdout).toContain('Line 2');
      expect(result.data.stdout).toContain('Line 3');
    });

    it('should capture console.error', async () => {
      const result = await tool.execute({
        code: 'console.error("This is an error");',
      });

      expect(result.success).toBe(true);
      expect(result.data.stderr).toBe('This is an error');
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors', async () => {
      const result = await tool.execute({
        code: 'const x = ;',  // Invalid syntax
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });

    it('should handle runtime errors', async () => {
      const result = await tool.execute({
        code: 'throw new Error("Test error");',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should handle undefined variable errors', async () => {
      const result = await tool.execute({
        code: 'console.log(undefinedVariable);',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });
  });

  describe('Timeout', () => {
    it('should timeout infinite loops', async () => {
      const result = await tool.execute({
        code: 'while(true) {}',
        timeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should respect custom timeout', async () => {
      const result = await tool.execute({
        code: 'console.log("Quick execution");',
        timeout: 1000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Sandbox Restrictions', () => {
    it('should disable require', async () => {
      const result = await tool.execute({
        code: 'const fs = require("fs");',
      });

      expect(result.success).toBe(false);
    });

    it('should disable process access', async () => {
      const result = await tool.execute({
        code: 'console.log(process.env);',
      });

      expect(result.success).toBe(false);
    });

    it('should disable setTimeout', async () => {
      const result = await tool.execute({
        code: 'setTimeout(() => console.log("delayed"), 100);',
      });

      expect(result.success).toBe(false);
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
        code: 'console.log("test");',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Code', () => {
    it('should handle functions', async () => {
      const result = await tool.execute({
        code: `
          function factorial(n) {
            if (n <= 1) return 1;
            return n * factorial(n - 1);
          }
          console.log(factorial(5));
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('120');
    });

    it('should handle objects and arrays', async () => {
      const result = await tool.execute({
        code: `
          const data = { name: "test", values: [1, 2, 3] };
          console.log(JSON.stringify(data));
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('test');
      expect(result.data.stdout).toContain('[1,2,3]');
    });

    it('should handle string operations', async () => {
      const result = await tool.execute({
        code: `
          const text = "hello world";
          console.log(text.toUpperCase());
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toBe('HELLO WORLD');
    });
  });
});
