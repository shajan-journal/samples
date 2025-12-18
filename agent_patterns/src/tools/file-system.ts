/**
 * File System Tool - Read and write files for data persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolResult } from '../types';
import { BaseTool } from './base';
import { getConfig } from '../config';

export class FileSystemTool extends BaseTool {
  name = 'file_system';
  description = 'Read and write files. Supports operations: read, write, list, exists.';
  parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform',
        enum: ['read', 'write', 'list', 'exists'],
      },
      path: {
        type: 'string',
        description: 'File or directory path',
      },
      content: {
        type: 'string',
        description: 'Content to write (only for write action)',
      },
    },
    required: ['action', 'path'],
  };

  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    // Use provided baseDir, or from config, or default to workspace directory
    this.baseDir = baseDir || getConfig().workspace.baseDir;
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    // Validate parameters
    const validationError = this.validateParams(params);
    if (validationError) {
      return validationError;
    }

    const action = params.action as string;
    const filePath = params.path as string;
    const content = params.content as string;

    // Validate and resolve path
    const resolvedPath = this.resolvePath(filePath);
    if (!resolvedPath) {
      return this.error('Invalid path: path must be within the workspace directory');
    }

    try {
      switch (action) {
        case 'read':
          return await this.readFile(resolvedPath);
        case 'write':
          if (content === undefined || content === null) {
            return this.error('Content is required for write action');
          }
          return await this.writeFile(resolvedPath, content);
        case 'list':
          return await this.listDirectory(resolvedPath);
        case 'exists':
          return await this.checkExists(resolvedPath);
        default:
          return this.error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return this.error(
        `Failed to ${action} file: ${error instanceof Error ? error.message : String(error)}`,
        { path: filePath, action }
      );
    }
  }

  /**
   * Resolve and validate path to prevent directory traversal
   */
  private resolvePath(filePath: string): string | null {
    const resolved = path.resolve(this.baseDir, filePath);
    
    // Ensure the resolved path is within baseDir
    if (!resolved.startsWith(this.baseDir)) {
      return null;
    }
    
    return resolved;
  }

  /**
   * Read file contents
   */
  private async readFile(filePath: string): Promise<ToolResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    return this.success({
      content,
      size: stats.size,
      path: filePath,
    });
  }

  /**
   * Write content to file
   */
  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
    const stats = await fs.stat(filePath);
    
    return this.success({
      path: filePath,
      size: stats.size,
      written: true,
    });
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string): Promise<ToolResult> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        return {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
    );
    
    return this.success({
      path: dirPath,
      entries: files,
      count: files.length,
    });
  }

  /**
   * Check if file or directory exists
   */
  private async checkExists(filePath: string): Promise<ToolResult> {
    try {
      const stats = await fs.stat(filePath);
      
      return this.success({
        exists: true,
        path: filePath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.success({
          exists: false,
          path: filePath,
        });
      }
      throw error;
    }
  }

  /**
   * Get the base directory for this tool
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
