/**
 * Base tool implementation and utilities
 */

import { Tool, ToolResult, ToolParameter } from '../types';

/**
 * Abstract base class for tools with common functionality
 */
export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };

  abstract execute(params: Record<string, any>): Promise<ToolResult>;

  /**
   * Validate that required parameters are present
   */
  protected validateParams(params: Record<string, any>): ToolResult | null {
    const required = this.parameters.required || [];
    const missing = required.filter(key => !(key in params));
    
    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing required parameters: ${missing.join(', ')}`,
      };
    }
    
    return null;
  }

  /**
   * Create a success result
   */
  protected success(data: any, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /**
   * Create an error result
   */
  protected error(message: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      error: message,
      metadata,
    };
  }
}

/**
 * Utility to convert a tool to its definition format (for LLM)
 */
export function toolToDefinition(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAllDefinitions() {
    return this.getAll().map(toolToDefinition);
  }
}
