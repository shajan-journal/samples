import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceManager, FileInfo } from '../../src/utils/workspace-manager';

describe('workspace-manager', () => {
  const testDir = path.join(__dirname, '../../test-workspace/workspace-manager-test');
  let manager: WorkspaceManager;
  
  beforeAll(async () => {
    // Create test directory
    await fs.promises.mkdir(testDir, { recursive: true });
    manager = new WorkspaceManager(testDir);
  });
  
  afterAll(async () => {
    // Clean up test directory
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });
  
  beforeEach(async () => {
    // Clean test directory before each test
    const files = await fs.promises.readdir(testDir);
    for (const file of files) {
      await fs.promises.rm(path.join(testDir, file), { recursive: true, force: true });
    }
  });
  
  describe('resolvePath', () => {
    it('should resolve valid relative path', () => {
      const result = manager.resolvePath('test.txt');
      
      expect(result).toBe(path.join(testDir, 'test.txt'));
    });
    
    it('should resolve nested path', () => {
      const result = manager.resolvePath('subdir/test.txt');
      
      expect(result).toBe(path.join(testDir, 'subdir', 'test.txt'));
    });
    
    it('should block directory traversal attempts', () => {
      const result = manager.resolvePath('../../../etc/passwd');
      
      expect(result).toBeNull();
    });
    
    it('should block absolute paths outside workspace', () => {
      const result = manager.resolvePath('/etc/passwd');
      
      // Should either be null or resolve within testDir
      if (result !== null) {
        expect(result.startsWith(testDir)).toBe(true);
      }
    });
    
    it('should handle complex traversal attempts', () => {
      const result = manager.resolvePath('subdir/../../outside.txt');
      
      // This resolves to testDir/outside.txt which is valid
      if (result !== null) {
        expect(result.startsWith(testDir)).toBe(true);
      }
    });
  });
  
  describe('readFile and writeFile', () => {
    it('should write and read file', async () => {
      const content = 'Hello, World!';
      
      await manager.writeFile('test.txt', content);
      const readContent = await manager.readFile('test.txt');
      
      expect(readContent).toBe(content);
    });
    
    it('should create nested directories', async () => {
      const content = 'Nested file';
      
      await manager.writeFile('sub/nested/file.txt', content);
      const readContent = await manager.readFile('sub/nested/file.txt');
      
      expect(readContent).toBe(content);
    });
    
    it('should throw error for invalid write path', async () => {
      await expect(manager.writeFile('../outside.txt', 'content'))
        .rejects.toThrow('Invalid path');
    });
    
    it('should throw error for invalid read path', async () => {
      await expect(manager.readFile('../outside.txt'))
        .rejects.toThrow('Invalid path');
    });
    
    it('should throw error reading non-existent file', async () => {
      await expect(manager.readFile('nonexistent.txt'))
        .rejects.toThrow();
    });
  });
  
  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      await manager.writeFile('delete-me.txt', 'content');
      
      await manager.deleteFile('delete-me.txt');
      
      const exists = await manager.fileExists('delete-me.txt');
      expect(exists).toBe(false);
    });
    
    it('should throw error deleting non-existent file', async () => {
      await expect(manager.deleteFile('nonexistent.txt'))
        .rejects.toThrow();
    });
    
    it('should throw error for invalid delete path', async () => {
      await expect(manager.deleteFile('../outside.txt'))
        .rejects.toThrow('Invalid path');
    });
  });
  
  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await manager.writeFile('exists.txt', 'content');
      
      const exists = await manager.fileExists('exists.txt');
      
      expect(exists).toBe(true);
    });
    
    it('should return false for non-existent file', async () => {
      const exists = await manager.fileExists('nonexistent.txt');
      
      expect(exists).toBe(false);
    });
    
    it('should return false for invalid path', async () => {
      const exists = await manager.fileExists('../outside.txt');
      
      expect(exists).toBe(false);
    });
  });
  
  describe('getFileInfo', () => {
    it('should get info for existing file', async () => {
      const content = 'Test content';
      await manager.writeFile('info.csv', content);
      
      const info = await manager.getFileInfo('info.csv');
      
      expect(info).not.toBeNull();
      expect(info!.filename).toBe('info.csv');
      expect(info!.relativePath).toBe('info.csv');
      expect(info!.type).toBe('csv');
      expect(info!.size).toBe(content.length);
      expect(typeof info!.modified.getTime).toBe('function');
      expect(info!.modified.getTime()).toBeGreaterThan(0);
    });
    
    it('should detect JSON type', async () => {
      await manager.writeFile('data.json', '{}');
      
      const info = await manager.getFileInfo('data.json');
      
      expect(info!.type).toBe('json');
    });
    
    it('should detect text type', async () => {
      await manager.writeFile('notes.txt', 'notes');
      
      const info = await manager.getFileInfo('notes.txt');
      
      expect(info!.type).toBe('text');
    });
    
    it('should return null for non-existent file', async () => {
      const info = await manager.getFileInfo('nonexistent.txt');
      
      expect(info).toBeNull();
    });
    
    it('should return null for invalid path', async () => {
      const info = await manager.getFileInfo('../outside.txt');
      
      expect(info).toBeNull();
    });
  });
  
  describe('scanFiles', () => {
    beforeEach(async () => {
      // Create test file structure
      await manager.writeFile('file1.csv', 'data1');
      await manager.writeFile('file2.json', '{}');
      await manager.writeFile('file3.txt', 'text');
      await manager.writeFile('subdir/file4.csv', 'data2');
      await manager.writeFile('subdir/nested/file5.json', '[]');
    });
    
    it('should scan all files without pattern', async () => {
      const files = await manager.scanFiles();
      
      expect(files.length).toBe(5);
    });
    
    it('should filter by CSV pattern', async () => {
      const files = await manager.scanFiles('*.csv');
      
      expect(files.length).toBe(2);
      expect(files.every(f => f.type === 'csv')).toBe(true);
    });
    
    it('should filter by JSON pattern', async () => {
      const files = await manager.scanFiles('*.json');
      
      expect(files.length).toBe(2);
      expect(files.every(f => f.type === 'json')).toBe(true);
    });
    
    it('should scan nested directories', async () => {
      const files = await manager.scanFiles();
      
      const nestedFile = files.find(f => f.filename === 'file5.json');
      expect(nestedFile).toBeDefined();
      expect(nestedFile!.relativePath).toBe('subdir/nested/file5.json');
    });
    
    it('should skip hidden files', async () => {
      await manager.writeFile('.hidden', 'secret');
      
      const files = await manager.scanFiles();
      
      expect(files.find(f => f.filename === '.hidden')).toBeUndefined();
    });
  });
  
  describe('cleanup', () => {
    it('should clean up multiple files', async () => {
      await manager.writeFile('temp1.txt', 'temp');
      await manager.writeFile('temp2.txt', 'temp');
      await manager.writeFile('temp3.txt', 'temp');
      
      await manager.cleanup(['temp1.txt', 'temp2.txt', 'temp3.txt']);
      
      expect(await manager.fileExists('temp1.txt')).toBe(false);
      expect(await manager.fileExists('temp2.txt')).toBe(false);
      expect(await manager.fileExists('temp3.txt')).toBe(false);
    });
    
    it('should handle partial cleanup failures gracefully', async () => {
      await manager.writeFile('exists.txt', 'content');
      
      // Should not throw even if some files don't exist
      await manager.cleanup(['exists.txt', 'nonexistent1.txt', 'nonexistent2.txt']);
      
      expect(await manager.fileExists('exists.txt')).toBe(false);
    });
    
    it('should handle empty cleanup list', async () => {
      await manager.cleanup([]);
      
      // Should not throw
    });
  });
  
  describe('getBaseDir', () => {
    it('should return base directory', () => {
      const baseDir = manager.getBaseDir();
      
      expect(baseDir).toBe(testDir);
    });
  });
});
