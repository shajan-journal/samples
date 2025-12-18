/**
 * Node Execution Tool - Execute JavaScript/Node.js code in a sandboxed environment
 * 
 * Uses Node.js vm module to execute code with timeout and basic isolation.
 * Simple approach for learning/exploration - not production-grade security.
 */

import * as vm from 'vm';
import { BaseTool } from './base';
import { ToolResult } from '../types';

export interface NodeExecutionParams {
  code: string;
  timeout?: number;  // Timeout in milliseconds (default: 5000)
}

export class NodeExecutionTool extends BaseTool {
  name = 'node_execute';
  description = 'Execute JavaScript/Node.js code in a sandboxed environment with timeout';
  parameters = {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 5000)',
      },
    },
    required: ['code'],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) return validationError;

    const { code, timeout = 5000 } = params as NodeExecutionParams;

    try {
      // Capture console output
      const logs: string[] = [];
      const errors: string[] = [];

      // Create sandbox context with console that captures output
      const sandbox = {
        console: {
          log: (...args: any[]) => logs.push(args.map(String).join(' ')),
          error: (...args: any[]) => errors.push(args.map(String).join(' ')),
          warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
          info: (...args: any[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
        },
        // Add some useful globals
        setTimeout: undefined,  // Disable async operations
        setInterval: undefined,
        setImmediate: undefined,
        require: undefined,  // Disable module loading
        process: undefined,  // Disable process access
        global: undefined,
      };

      // Create context and script
      const context = vm.createContext(sandbox);
      const script = new vm.Script(code);

      // Execute with timeout
      const result = script.runInContext(context, {
        timeout,
        displayErrors: true,
      });

      return this.success({
        stdout: logs.join('\n'),
        stderr: errors.join('\n'),
        result: result !== undefined ? String(result) : '',
        executionTime: 0,  // Simple approach - not tracking exact time
      });
    } catch (error: any) {
      // Handle timeout or execution errors
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        return this.error(`Execution timed out after ${timeout}ms`);
      }
      
      return this.error(`Execution failed: ${error.message}`);
    }
  }
}
