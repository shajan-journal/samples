/**
 * Validation Capability - Validates code execution results
 * 
 * This capability analyzes tool execution results (especially from code execution),
 * determines if they meet validation criteria, identifies issues, and suggests fixes.
 * It uses the error-analysis utilities to provide structured feedback.
 */

import { BaseCapability } from './base';
import { 
  AgentContext, 
  ValidationResult, 
  ToolResult,
  ValidationCriteria,
  ValidationMetrics,
  LLMProvider,
  Message
} from '../types';
import { analyzeExecutionError } from '../utils/error-analysis';

export class ValidationCapability extends BaseCapability {
  name = 'validation';
  description = 'Validates code execution results against criteria and identifies issues';

  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }

  async execute(context: AgentContext): Promise<ValidationResult> {
    try {
      // Extract the most recent tool result from conversation
      const lastToolResult = this.extractLastToolResult(context.messages);
      
      if (!lastToolResult) {
        return this.validationError('No tool execution result found to validate', []);
      }

      // Get validation criteria from context state if provided
      const criteria = context.state?.validationCriteria as ValidationCriteria | undefined;

      // Perform automatic validation based on tool result
      const autoValidation = this.performAutomaticValidation(lastToolResult, criteria);

      // If automatic validation is conclusive, return it
      if (autoValidation.isValid || autoValidation.validationIssues.length > 0) {
        return autoValidation;
      }

      // Otherwise, use LLM for more nuanced validation
      const llmValidation = await this.performLLMValidation(context, lastToolResult, criteria);
      
      return llmValidation;
    } catch (error) {
      return this.validationError(
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        []
      );
    }
  }

  /**
   * Extract the most recent tool result from messages
   */
  private extractLastToolResult(messages: Message[]): ToolResult | null {
    // Look for the most recent tool message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'tool') {
        // Parse the content to extract result
        try {
          const content = msg.content;
          if (content.includes('succeeded:')) {
            const dataStr = content.substring(content.indexOf('succeeded:') + 10).trim();
            const data = JSON.parse(dataStr);
            return { success: true, data };
          } else if (content.includes('failed:')) {
            const errorStr = content.substring(content.indexOf('failed:') + 7).trim();
            return { success: false, error: errorStr };
          }
        } catch (e) {
          // If parsing fails, return a basic result
          return {
            success: !msg.content.includes('ERROR') && !msg.content.includes('failed'),
            data: msg.content
          };
        }
      }
    }
    return null;
  }

  /**
   * Perform automatic validation using error analysis
   */
  private performAutomaticValidation(
    result: ToolResult,
    criteria?: ValidationCriteria
  ): ValidationResult {
    const issues: string[] = [];
    const fixes: string[] = [];

    // Analyze errors if result failed
    if (!result.success) {
      const errorAnalysis = analyzeExecutionError(result);
      
      if (errorAnalysis.hasError) {
        issues.push(`${errorAnalysis.errorType} error: ${errorAnalysis.errorMessage}`);
        fixes.push(...errorAnalysis.suggestions);
      }

      return {
        output: `Validation failed: ${errorAnalysis.errorType} error detected`,
        isValid: false,
        validationIssues: issues,
        suggestedFixes: fixes,
        metadata: {
          errorAnalysis,
          capability: this.name
        }
      };
    }

    // Check against criteria if provided
    if (criteria) {
      const criteriaValidation = this.validateAgainstCriteria(result, criteria);
      if (!criteriaValidation.passed) {
        return {
          output: 'Validation failed: Criteria not met',
          isValid: false,
          validationIssues: criteriaValidation.failures,
          suggestedFixes: ['Review the output and ensure it meets all specified criteria'],
          metadata: {
            validationMetrics: criteriaValidation,
            capability: this.name
          }
        };
      }
      
      // Criteria passed, include metrics
      return {
        output: 'Validation passed: All criteria met',
        isValid: true,
        validationIssues: [],
        suggestedFixes: [],
        metadata: {
          validationMetrics: criteriaValidation,
          capability: this.name
        }
      };
    }

    // If we get here, automatic validation passed
    return {
      output: 'Validation passed: No errors detected',
      isValid: true,
      validationIssues: [],
      suggestedFixes: [],
      metadata: {
        capability: this.name
      }
    };
  }

  /**
   * Validate result against specific criteria
   */
  private validateAgainstCriteria(
    result: ToolResult,
    criteria: ValidationCriteria
  ): ValidationMetrics {
    const criteriaList: string[] = [];
    const failures: string[] = [];

    const output = String(result.data || '');

    // Check expected output
    if (criteria.expectedOutput !== undefined) {
      criteriaList.push('Expected output match');
      const matches = criteria.allowPartialMatch 
        ? output.includes(criteria.expectedOutput)
        : output === criteria.expectedOutput;
      
      if (!matches) {
        failures.push(`Output does not match expected: "${criteria.expectedOutput}"`);
      }
    }

    // Check output pattern
    if (criteria.outputPattern) {
      criteriaList.push('Output pattern match');
      if (!criteria.outputPattern.test(output)) {
        failures.push(`Output does not match pattern: ${criteria.outputPattern}`);
      }
    }

    // Check should not contain
    if (criteria.shouldNotContain) {
      for (const forbidden of criteria.shouldNotContain) {
        criteriaList.push(`Should not contain "${forbidden}"`);
        if (output.includes(forbidden)) {
          failures.push(`Output contains forbidden text: "${forbidden}"`);
        }
      }
    }

    // Check custom validator
    if (criteria.customValidator) {
      criteriaList.push('Custom validation');
      try {
        if (!criteria.customValidator(output)) {
          failures.push('Custom validation failed');
        }
      } catch (e) {
        failures.push(`Custom validator error: ${e}`);
      }
    }

    return {
      passed: failures.length === 0,
      criteria: criteriaList,
      failures,
      score: criteriaList.length > 0 
        ? (criteriaList.length - failures.length) / criteriaList.length 
        : 1.0
    };
  }

  /**
   * Use LLM for more nuanced validation
   */
  private async performLLMValidation(
    context: AgentContext,
    result: ToolResult,
    criteria?: ValidationCriteria
  ): Promise<ValidationResult> {
    const validationPrompt = this.buildValidationPrompt(result, criteria);

    const messages: Message[] = [
      { role: 'system', content: validationPrompt },
      ...context.messages
    ];

    // Get LLM response
    const stream = this.llmProvider.chat(messages, context.config);
    const collected = await this.collectStreamContent(stream);
    const content = collected.content || '';

    // Parse LLM response
    const validation = this.parseValidationResponse(content);

    return {
      output: validation.output,
      isValid: validation.isValid,
      validationIssues: validation.issues,
      suggestedFixes: validation.fixes,
      metadata: {
        usage: collected.usage,
        capability: this.name,
        llmResponse: content
      }
    };
  }

  /**
   * Build validation prompt for LLM
   */
  private buildValidationPrompt(result: ToolResult, criteria?: ValidationCriteria): string {
    let prompt = `You are validating code execution results. Analyze the result and determine if it's valid and correct.

Execution Result:
- Success: ${result.success}
- Output: ${JSON.stringify(result.data, null, 2)}
${result.error ? `- Error: ${result.error}` : ''}

Your task:
1. Determine if the execution was successful
2. Identify any issues or errors
3. Suggest fixes if problems are found

`;

    if (criteria) {
      prompt += `Validation Criteria:\n`;
      if (criteria.expectedOutput) {
        prompt += `- Expected output: ${criteria.expectedOutput}\n`;
      }
      if (criteria.outputPattern) {
        prompt += `- Should match pattern: ${criteria.outputPattern}\n`;
      }
      if (criteria.shouldNotContain && criteria.shouldNotContain.length > 0) {
        prompt += `- Should not contain: ${criteria.shouldNotContain.join(', ')}\n`;
      }
      prompt += '\n';
    }

    prompt += `Format your response as:
VALID: [true/false]
ISSUES: [List any issues found, one per line, or "None"]
FIXES: [List suggested fixes, one per line, or "None"]
SUMMARY: [Brief explanation]`;

    return prompt;
  }

  /**
   * Parse LLM validation response
   */
  private parseValidationResponse(content: string): {
    output: string;
    isValid: boolean;
    issues: string[];
    fixes: string[];
  } {
    const lines = content.split('\n').map(l => l.trim());
    
    let isValid = true;
    const issues: string[] = [];
    const fixes: string[] = [];
    let summary = '';

    let currentSection: 'none' | 'issues' | 'fixes' | 'summary' = 'none';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('VALID:')) {
        const validStr = line.substring(6).trim().toLowerCase();
        isValid = validStr === 'true';
      } else if (line.startsWith('ISSUES:')) {
        currentSection = 'issues';
        const issuesStr = line.substring(7).trim();
        if (issuesStr && issuesStr.toLowerCase() !== 'none') {
          issues.push(issuesStr);
        }
      } else if (line.startsWith('FIXES:')) {
        currentSection = 'fixes';
        const fixesStr = line.substring(6).trim();
        if (fixesStr && fixesStr.toLowerCase() !== 'none') {
          fixes.push(fixesStr);
        }
      } else if (line.startsWith('SUMMARY:')) {
        currentSection = 'summary';
        summary = line.substring(8).trim();
      } else if (line.length > 0 && line !== 'None') {
        // Add to current section
        if (currentSection === 'issues') {
          if (line.startsWith('-')) {
            issues.push(line.substring(1).trim());
          } else if (!line.startsWith('FIXES:') && !line.startsWith('SUMMARY:')) {
            issues.push(line);
          }
        } else if (currentSection === 'fixes') {
          if (line.startsWith('-')) {
            fixes.push(line.substring(1).trim());
          } else if (!line.startsWith('SUMMARY:')) {
            fixes.push(line);
          }
        } else if (currentSection === 'summary') {
          summary += ' ' + line;
        }
      }
    }

    return {
      output: summary || (isValid ? 'Validation passed' : 'Validation failed'),
      isValid,
      issues,
      fixes
    };
  }

  /**
   * Helper to create a validation error result
   */
  private validationError(message: string, fixes: string[]): ValidationResult {
    return {
      output: message,
      isValid: false,
      validationIssues: [message],
      suggestedFixes: fixes,
      metadata: {
        error: true,
        capability: this.name
      }
    };
  }
}
