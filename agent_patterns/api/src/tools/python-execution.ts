/**
 * Python Execution Tool - Execute Python code in a subprocess
 * 
 * Uses child_process to spawn Python with timeout and output capture.
 * Simple approach for learning/exploration - not production-grade security.
 */

import { spawn } from 'child_process';
import { BaseTool } from './base';
import { ToolResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface PythonExecutionParams {
  code: string;
  timeout?: number;  // Timeout in milliseconds (default: 10000)
  packages?: string[];  // Packages to check/mention if missing
}

export class PythonExecutionTool extends BaseTool {
  name = 'python_execute';
  description = 'Execute Python code in a subprocess with timeout and output capture';
  parameters = {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 10000)',
      },
      packages: {
        type: 'array',
        description: 'List of Python packages that might be needed',
        items: {
          type: 'string',
          description: 'Package name',
        },
      },
    },
    required: ['code'],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) return validationError;

    const { code, timeout = 10000 } = params as PythonExecutionParams;

    // Create temp file for code
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `python_exec_${Date.now()}.py`);

    try {
      // Wrap code to capture expression result (similar to Node's vm behavior)
      // If the code is a single expression, wrap it in print()
      const wrappedCode = this.wrapCodeForOutput(code);
      
      // Write code to temp file
      fs.writeFileSync(tempFile, wrappedCode, 'utf-8');

      // Execute Python with timeout
      const result = await this.executePython(tempFile, timeout);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return result;
    } catch (error: any) {
      // Clean up temp file on error
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return this.error(`Failed to execute Python: ${error.message}`);
    }
  }

  /**
   * Wrap code to ensure output is captured.
   * If the code is a simple expression (no statements), wrap it in print().
   * This makes Python behave similar to Node's vm which returns expression results.
   */
  private wrapCodeForOutput(code: string): string {
    const trimmedCode = code.trim();
    
    // If code already has print() or return, leave as-is
    if (trimmedCode.includes('print(') || trimmedCode.includes('return ')) {
      return code;
    }
    
    // If code has newlines, it's likely multiple statements
    if (trimmedCode.includes('\n')) {
      return code;
    }
    
    // Try to detect if it's a simple expression
    // Check if it starts with a statement keyword
    const statementKeywords = ['if ', 'for ', 'while ', 'def ', 'class ', 'import ', 'from ', 'with ', 'try ', 'except ', 'raise ', 'assert '];
    const hasStatementKeyword = statementKeywords.some(keyword => trimmedCode.startsWith(keyword));
    
    if (hasStatementKeyword) {
      return code;
    }
    
    // If it looks like an expression (starts with a literal, variable, or call)
    // wrap it in print() to capture the result
    return `print(${code})`;
  }

  private executePython(scriptPath: string, timeout: number): Promise<ToolResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const stdout: string[] = [];
      const stderr: string[] = [];

      // Spawn Python process
      const pythonProcess = spawn('python3', [scriptPath], {
        timeout,
      });

      // Capture stdout
      pythonProcess.stdout.on('data', (data) => {
        stdout.push(data.toString());
      });

      // Capture stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr.push(data.toString());
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        const executionTime = Date.now() - startTime;
        
        if (code === null) {
          // Process was killed (likely timeout)
          resolve(this.error(`Process killed (timeout after ${timeout}ms)`));
        } else if (code === 0) {
          // Success
          resolve(this.success({
            stdout: stdout.join(''),
            stderr: stderr.join(''),
            returnCode: code,
            executionTime,
          }));
        } else {
          // Error exit code
          resolve(this.error(
            `Python exited with code ${code}\nStderr: ${stderr.join('')}`,
            {
              stdout: stdout.join(''),
              stderr: stderr.join(''),
              returnCode: code,
              executionTime,
            }
          ));
        }
      });

      // Handle spawn errors
      pythonProcess.on('error', (error) => {
        resolve(this.error(`Failed to spawn Python: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!pythonProcess.killed) {
              pythonProcess.kill('SIGKILL');
            }
          }, 1000);
        }
      }, timeout);
    });
  }
}
