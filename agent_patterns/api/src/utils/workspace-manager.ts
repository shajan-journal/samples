import * as fs from 'fs';
import * as path from 'path';

/**
 * File information structure
 */
export interface FileInfo {
  filename: string;
  path: string;
  relativePath: string;
  type: 'csv' | 'json' | 'text' | 'image' | 'other';
  size: number;
  modified: Date;
}

/**
 * Workspace manager for centralized file operations
 */
export class WorkspaceManager {
  private baseDir: string;
  
  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
    console.log(`[WorkspaceManager] Initialized with base directory: ${this.baseDir}`);
  }
  
  /**
   * Resolve and validate a relative path
   * Prevents directory traversal attacks
   * @param relativePath Relative path to resolve
   * @returns Absolute path if valid, null if invalid
   */
  resolvePath(relativePath: string): string | null {
    try {
      // Resolve the path
      const absolutePath = path.resolve(this.baseDir, relativePath);
      
      // Check if the resolved path is within the base directory
      if (!absolutePath.startsWith(this.baseDir)) {
        console.warn(`[WorkspaceManager] Path traversal attempt blocked: ${relativePath}`);
        return null;
      }
      
      return absolutePath;
    } catch (error) {
      console.error(`[WorkspaceManager] Error resolving path:`, error);
      return null;
    }
  }
  
  /**
   * Scan workspace for files matching pattern
   * @param pattern Optional glob-like pattern (e.g., "*.csv")
   * @returns Array of file information
   */
  async scanFiles(pattern?: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
      await this.scanDirectory(this.baseDir, '', pattern, files);
      console.log(`[WorkspaceManager] Scanned workspace: ${files.length} files found`);
      return files;
    } catch (error) {
      console.error(`[WorkspaceManager] Error scanning files:`, error);
      return [];
    }
  }
  
  /**
   * Recursively scan directory
   * @param dirPath Current directory path
   * @param relativePath Current relative path
   * @param pattern File pattern to match
   * @param files Accumulator for results
   */
  private async scanDirectory(
    dirPath: string,
    relativePath: string,
    pattern: string | undefined,
    files: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const entryRelPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recurse into directories
          await this.scanDirectory(entryPath, entryRelPath, pattern, files);
        } else if (entry.isFile()) {
          // Check pattern match if provided
          if (pattern && !this.matchPattern(entry.name, pattern)) {
            continue;
          }
          
          // Get file info
          const info = await this.getFileInfo(entryRelPath);
          if (info) {
            files.push(info);
          }
        }
      }
    } catch (error) {
      console.error(`[WorkspaceManager] Error scanning directory ${dirPath}:`, error);
    }
  }
  
  /**
   * Match filename against pattern
   * @param filename File name to check
   * @param pattern Pattern to match (supports * wildcard)
   * @returns True if matches
   */
  private matchPattern(filename: string, pattern: string): boolean {
    // Simple pattern matching - convert * to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }
  
  /**
   * Get file information
   * @param relativePath Relative path to file
   * @returns File information or null if error
   */
  async getFileInfo(relativePath: string): Promise<FileInfo | null> {
    const absolutePath = this.resolvePath(relativePath);
    
    if (!absolutePath) {
      return null;
    }
    
    try {
      const stats = await fs.promises.stat(absolutePath);
      
      if (!stats.isFile()) {
        return null;
      }
      
      return {
        filename: path.basename(absolutePath),
        path: absolutePath,
        relativePath,
        type: this.detectFileType(absolutePath),
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      console.error(`[WorkspaceManager] Error getting file info for ${relativePath}:`, error);
      return null;
    }
  }
  
  /**
   * Detect file type from extension
   * @param filePath Path to file
   * @returns File type
   */
  private detectFileType(filePath: string): 'csv' | 'json' | 'text' | 'image' | 'other' {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.csv':
        return 'csv';
      case '.json':
        return 'json';
      case '.txt':
      case '.md':
      case '.log':
        return 'text';
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
      case '.svg':
        return 'image';
      default:
        return 'other';
    }
  }
  
  /**
   * Read file content
   * @param relativePath Relative path to file
   * @returns File content
   */
  async readFile(relativePath: string): Promise<string> {
    const absolutePath = this.resolvePath(relativePath);
    
    if (!absolutePath) {
      throw new Error(`Invalid path: ${relativePath}`);
    }
    
    try {
      const content = await fs.promises.readFile(absolutePath, 'utf-8');
      console.log(`[WorkspaceManager] Read file: ${relativePath} (${content.length} bytes)`);
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read file ${relativePath}: ${message}`);
    }
  }
  
  /**
   * Write file content
   * @param relativePath Relative path to file
   * @param content Content to write
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    
    if (!absolutePath) {
      throw new Error(`Invalid path: ${relativePath}`);
    }
    
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(absolutePath);
      await fs.promises.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.promises.writeFile(absolutePath, content, 'utf-8');
      console.log(`[WorkspaceManager] Wrote file: ${relativePath} (${content.length} bytes)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write file ${relativePath}: ${message}`);
    }
  }
  
  /**
   * Delete file
   * @param relativePath Relative path to file
   */
  async deleteFile(relativePath: string): Promise<void> {
    const absolutePath = this.resolvePath(relativePath);
    
    if (!absolutePath) {
      throw new Error(`Invalid path: ${relativePath}`);
    }
    
    try {
      await fs.promises.unlink(absolutePath);
      console.log(`[WorkspaceManager] Deleted file: ${relativePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete file ${relativePath}: ${message}`);
    }
  }
  
  /**
   * Clean up multiple files
   * @param files Array of relative file paths to delete
   */
  async cleanup(files: string[]): Promise<void> {
    console.log(`[WorkspaceManager] Cleaning up ${files.length} files`);
    
    const results = await Promise.allSettled(
      files.map(file => this.deleteFile(file))
    );
    
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`[WorkspaceManager] Failed to delete ${failed} files`);
    } else {
      console.log(`[WorkspaceManager] Successfully cleaned up all files`);
    }
  }
  
  /**
   * Check if file exists
   * @param relativePath Relative path to file
   * @returns True if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const absolutePath = this.resolvePath(relativePath);
    
    if (!absolutePath) {
      return false;
    }
    
    try {
      await fs.promises.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get base directory
   * @returns Base directory path
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
