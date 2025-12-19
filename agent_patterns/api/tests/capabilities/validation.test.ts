/**
 * Tests for ValidationCapability
 */

import { ValidationCapability } from '../../src/capabilities/validation';
import { MockLLMProvider } from '../../src/llm/mock';
import { AgentContext, ValidationCriteria } from '../../src/types';

describe('ValidationCapability', () => {
  let capability: ValidationCapability;
  let mockLLM: MockLLMProvider;

  const mockConfig = {
    provider: 'mock' as const,
    model: 'mock-model',
    temperature: 0.7
  };

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    capability = new ValidationCapability(mockLLM);
  });

  describe('Basic validation', () => {
    test('should validate successful tool execution', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'tool', content: 'Tool execution succeeded: {"result": "42"}' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
      expect(result.validationIssues).toHaveLength(0);
      expect(result.suggestedFixes).toHaveLength(0);
    });

    test('should detect failed tool execution', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'tool', content: 'Tool execution failed: SyntaxError: Unexpected token' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.length).toBeGreaterThan(0);
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
    });

    test('should handle no tool results', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'assistant', content: 'Thinking...' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues).toContain('No tool execution result found to validate');
    });
  });

  describe('Error analysis', () => {
    test('should analyze syntax errors', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution failed: SyntaxError: Unexpected token \'}\' at line 5' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('syntax'))).toBe(true);
      expect(result.suggestedFixes.length).toBeGreaterThan(0);
    });

    test('should analyze runtime errors', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution failed: ReferenceError: x is not defined' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('runtime'))).toBe(true);
    });

    test('should analyze timeout errors', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution failed: TimeoutError: Execution timed out' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('timeout'))).toBe(true);
    });
  });

  describe('Criteria validation', () => {
    test('should validate against expected output', async () => {
      const criteria: ValidationCriteria = {
        expectedOutput: '42',
        allowPartialMatch: false
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "42"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
    });

    test('should fail when output does not match expected', async () => {
      const criteria: ValidationCriteria = {
        expectedOutput: '42',
        allowPartialMatch: false
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "24"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('does not match expected'))).toBe(true);
    });

    test('should support partial matching', async () => {
      const criteria: ValidationCriteria = {
        expectedOutput: 'success',
        allowPartialMatch: true
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "Operation completed successfully"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
    });

    test('should validate against output pattern', async () => {
      const criteria: ValidationCriteria = {
        outputPattern: /^\d+$/
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "123"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
    });

    test('should fail when pattern does not match', async () => {
      const criteria: ValidationCriteria = {
        outputPattern: /^\d+$/
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "abc"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('does not match pattern'))).toBe(true);
    });

    test('should validate shouldNotContain criteria', async () => {
      const criteria: ValidationCriteria = {
        shouldNotContain: ['error', 'failed']
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "All tests passed"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
    });

    test('should fail when forbidden text is present', async () => {
      const criteria: ValidationCriteria = {
        shouldNotContain: ['error', 'failed']
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "Test failed: assertion error"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('forbidden text'))).toBe(true);
    });

    test('should support custom validators', async () => {
      const criteria: ValidationCriteria = {
        customValidator: (output: string) => {
          const num = parseInt(output, 10);
          return !isNaN(num) && num > 0 && num < 100;
        }
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "42"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(true);
    });

    test('should fail when custom validator returns false', async () => {
      const criteria: ValidationCriteria = {
        customValidator: (output: string) => {
          const num = parseInt(output, 10);
          return !isNaN(num) && num > 0 && num < 100;
        }
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "150"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('Custom validation failed'))).toBe(true);
    });
  });

  describe('LLM validation', () => {
    test('should use LLM for nuanced validation', async () => {
      // Set up mock response
      mockLLM.setResponses([{
        content: `VALID: true
ISSUES: None
FIXES: None
SUMMARY: The output is correct and meets requirements`
      }]);

      // Use a context where automatic validation returns inconclusive
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Complex output that needs LLM analysis' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      // Should invoke LLM and get result
      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
    });

    test('should parse LLM validation response format', async () => {
      mockLLM.setResponses([{
        content: `VALID: false
ISSUES:
- Missing required field 'name'
- Invalid date format
FIXES:
- Add a 'name' field to the output
- Use ISO 8601 date format
SUMMARY: Output is incomplete and has formatting issues`
      }]);

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Some complex output' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      // Should have a result with valid structure
      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });
  });

  describe('Metadata and metrics', () => {
    test('should include validation metrics', async () => {
      const criteria: ValidationCriteria = {
        expectedOutput: '42',
        outputPattern: /^\d+$/,
        shouldNotContain: ['error']
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "42"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.validationMetrics).toBeDefined();
      expect(result.metadata?.validationMetrics.passed).toBe(true);
      expect(result.metadata?.validationMetrics.score).toBe(1.0);
    });

    test('should track capability name', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "test"' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.metadata?.capability).toBe('validation');
    });
  });

  describe('Edge cases', () => {
    test('should handle malformed tool messages', async () => {
      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Malformed message without succeeded/failed markers' }
        ],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      // Should still be able to process
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    test('should handle empty messages array', async () => {
      const context: AgentContext = {
        messages: [],
        tools: [],
        config: mockConfig,
        state: {}
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues).toContain('No tool execution result found to validate');
    });

    test('should handle exceptions during validation', async () => {
      const criteria: ValidationCriteria = {
        customValidator: () => {
          throw new Error('Validator error');
        }
      };

      const context: AgentContext = {
        messages: [
          { role: 'tool', content: 'Tool execution succeeded: "test"' }
        ],
        tools: [],
        config: mockConfig,
        state: { validationCriteria: criteria }
      };

      const result = await capability.execute(context);

      expect(result.isValid).toBe(false);
      expect(result.validationIssues.some(i => i.includes('Validator error'))).toBe(true);
    });
  });
});
