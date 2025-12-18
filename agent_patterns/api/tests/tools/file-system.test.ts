/**
 * Tests for FileSystemTool
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileSystemTool } from '../../src/tools/file-system';

describe('FileSystemTool', () => {
  let tool: FileSystemTool;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(process.cwd(), 'test-workspace', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    tool = new FileSystemTool(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('file_system');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    });

    it('should define parameters', () => {
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.properties.action).toBeDefined();
      expect(tool.parameters.properties.path).toBeDefined();
      expect(tool.parameters.required).toEqual(['action', 'path']);
    });

    it('should have correct base directory', () => {
      expect(tool.getBaseDir()).toBe(testDir);
    });
  });

  describe('Write operations', () => {
    it('should write a file successfully', async () => {
      const result = await tool.execute({
        action: 'write',
        path: 'test.txt',
        content: 'Hello, World!',
      });

      expect(result.success).toBe(true);
      expect(result.data.written).toBe(true);
      expect(result.data.path).toContain('test.txt');
    });

    it('should create nested directories when writing', async () => {
      const result = await tool.execute({
        action: 'write',
        path: 'nested/dir/file.txt',
        content: 'Nested content',
      });

      expect(result.success).toBe(true);
      
      // Verify file was created
      const readResult = await tool.execute({
        action: 'read',
        path: 'nested/dir/file.txt',
      });
      expect(readResult.success).toBe(true);
      expect(readResult.data.content).toBe('Nested content');
    });

    it('should fail when content is missing for write', async () => {
      const result = await tool.execute({
        action: 'write',
        path: 'test.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content is required');
    });

    it('should overwrite existing files', async () => {
      // Write initial content
      await tool.execute({
        action: 'write',
        path: 'overwrite.txt',
        content: 'First version',
      });

      // Overwrite
      const result = await tool.execute({
        action: 'write',
        path: 'overwrite.txt',
        content: 'Second version',
      });

      expect(result.success).toBe(true);

      // Verify new content
      const readResult = await tool.execute({
        action: 'read',
        path: 'overwrite.txt',
      });
      expect(readResult.data.content).toBe('Second version');
    });
  });

  describe('Read operations', () => {
    it('should read a file successfully', async () => {
      // First write a file
      await tool.execute({
        action: 'write',
        path: 'read-test.txt',
        content: 'Test content',
      });

      // Then read it
      const result = await tool.execute({
        action: 'read',
        path: 'read-test.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Test content');
      expect(result.data.size).toBeGreaterThan(0);
    });

    it('should fail when reading non-existent file', async () => {
      const result = await tool.execute({
        action: 'read',
        path: 'does-not-exist.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read file');
    });

    it('should read empty files', async () => {
      await tool.execute({
        action: 'write',
        path: 'empty.txt',
        content: '',
      });

      const result = await tool.execute({
        action: 'read',
        path: 'empty.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('');
      expect(result.data.size).toBe(0);
    });
  });

  describe('List operations', () => {
    it('should list directory contents', async () => {
      // Create some files
      await tool.execute({ action: 'write', path: 'file1.txt', content: 'A' });
      await tool.execute({ action: 'write', path: 'file2.txt', content: 'B' });
      await tool.execute({ action: 'write', path: 'subdir/file3.txt', content: 'C' });

      const result = await tool.execute({
        action: 'list',
        path: '.',
      });

      expect(result.success).toBe(true);
      expect(result.data.entries).toBeDefined();
      expect(result.data.count).toBeGreaterThanOrEqual(2);
      
      const fileNames = result.data.entries.map((e: any) => e.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.txt');
      expect(fileNames).toContain('subdir');
    });

    it('should list nested directory', async () => {
      await tool.execute({ action: 'write', path: 'dir/nested1.txt', content: 'X' });
      await tool.execute({ action: 'write', path: 'dir/nested2.txt', content: 'Y' });

      const result = await tool.execute({
        action: 'list',
        path: 'dir',
      });

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(2);
      
      const fileNames = result.data.entries.map((e: any) => e.name);
      expect(fileNames).toContain('nested1.txt');
      expect(fileNames).toContain('nested2.txt');
    });

    it('should distinguish files from directories', async () => {
      await tool.execute({ action: 'write', path: 'file.txt', content: 'File' });
      await tool.execute({ action: 'write', path: 'subdir/inner.txt', content: 'Dir' });

      const result = await tool.execute({
        action: 'list',
        path: '.',
      });

      expect(result.success).toBe(true);
      
      const entries = result.data.entries;
      const fileEntry = entries.find((e: any) => e.name === 'file.txt');
      const dirEntry = entries.find((e: any) => e.name === 'subdir');
      
      expect(fileEntry.type).toBe('file');
      expect(dirEntry.type).toBe('directory');
    });

    it('should fail when listing non-existent directory', async () => {
      const result = await tool.execute({
        action: 'list',
        path: 'does-not-exist',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Exists operations', () => {
    it('should return true for existing file', async () => {
      await tool.execute({
        action: 'write',
        path: 'exists.txt',
        content: 'I exist',
      });

      const result = await tool.execute({
        action: 'exists',
        path: 'exists.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.type).toBe('file');
    });

    it('should return true for existing directory', async () => {
      await tool.execute({
        action: 'write',
        path: 'mydir/file.txt',
        content: 'In dir',
      });

      const result = await tool.execute({
        action: 'exists',
        path: 'mydir',
      });

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(true);
      expect(result.data.type).toBe('directory');
    });

    it('should return false for non-existent file', async () => {
      const result = await tool.execute({
        action: 'exists',
        path: 'not-there.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });
  });

  describe('Security', () => {
    it('should prevent directory traversal with ..', async () => {
      const result = await tool.execute({
        action: 'read',
        path: '../../../etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid path');
    });

    it('should prevent absolute path access outside workspace', async () => {
      const result = await tool.execute({
        action: 'read',
        path: '/etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid path');
    });

    it('should allow relative paths within workspace', async () => {
      await tool.execute({
        action: 'write',
        path: 'a/b/c.txt',
        content: 'Deep',
      });

      const result = await tool.execute({
        action: 'read',
        path: './a/b/c.txt',
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Deep');
    });
  });

  describe('Error handling', () => {
    it('should fail when action is missing', async () => {
      const result = await tool.execute({
        path: 'test.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should fail when path is missing', async () => {
      const result = await tool.execute({
        action: 'read',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameters');
    });

    it('should fail on unknown action', async () => {
      const result = await tool.execute({
        action: 'unknown_action',
        path: 'test.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });
});
