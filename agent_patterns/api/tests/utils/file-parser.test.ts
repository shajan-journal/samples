import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, parseJSON, detectFileType, validateDataStructure, parseDataFile } from '../../src/utils/file-parser';

describe('file-parser', () => {
  const testDataDir = path.join(__dirname, '../../test-workspace/file-parser-test');
  
  beforeAll(async () => {
    // Create test directory
    await fs.promises.mkdir(testDataDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Clean up test directory
    await fs.promises.rm(testDataDir, { recursive: true, force: true });
  });
  
  describe('parseCSV', () => {
    it('should parse valid CSV file', async () => {
      const csvPath = path.join(testDataDir, 'valid.csv');
      const csvContent = `name,age,city
John,30,New York
Jane,25,Los Angeles
Bob,35,Chicago`;
      
      await fs.promises.writeFile(csvPath, csvContent);
      
      const result = await parseCSV(csvPath);
      
      expect(result.rowCount).toBe(3);
      expect(result.columns).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual({ name: 'John', age: 30, city: 'New York' });
      expect(result.errors).toBeUndefined();
    });
    
    it('should handle empty CSV file', async () => {
      const csvPath = path.join(testDataDir, 'empty.csv');
      await fs.promises.writeFile(csvPath, '');
      
      const result = await parseCSV(csvPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.columns).toEqual([]);
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toContain('File is empty');
    });
    
    it('should handle CSV with only headers', async () => {
      const csvPath = path.join(testDataDir, 'headers-only.csv');
      await fs.promises.writeFile(csvPath, 'name,age,city');
      
      const result = await parseCSV(csvPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.columns).toEqual([]);
    });
    
    it('should handle malformed CSV gracefully', async () => {
      const csvPath = path.join(testDataDir, 'malformed.csv');
      const csvContent = `name,age,city
John,30,New York
Jane,25`;  // Missing city
      
      await fs.promises.writeFile(csvPath, csvContent);
      
      const result = await parseCSV(csvPath);
      
      // Should still parse with relax_column_count
      expect(result.rowCount).toBeGreaterThan(0);
      expect(result.errors).toBeUndefined();
    });
    
    it('should cast numeric values', async () => {
      const csvPath = path.join(testDataDir, 'numbers.csv');
      const csvContent = `product,price,quantity
Apple,1.5,10
Banana,0.75,20`;
      
      await fs.promises.writeFile(csvPath, csvContent);
      
      const result = await parseCSV(csvPath);
      
      expect(result.rows[0].price).toBe(1.5);
      expect(result.rows[0].quantity).toBe(10);
      expect(typeof result.rows[0].price).toBe('number');
    });
    
    it('should handle non-existent file', async () => {
      const csvPath = path.join(testDataDir, 'non-existent.csv');
      
      const result = await parseCSV(csvPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('ENOENT');
    });
  });
  
  describe('parseJSON', () => {
    it('should parse valid JSON array', async () => {
      const jsonPath = path.join(testDataDir, 'valid-array.json');
      const jsonContent = JSON.stringify([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]);
      
      await fs.promises.writeFile(jsonPath, jsonContent);
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual(['name', 'age']);
      expect(result.rows).toHaveLength(2);
      expect(result.errors).toBeUndefined();
    });
    
    it('should parse JSON object with data property', async () => {
      const jsonPath = path.join(testDataDir, 'object-with-data.json');
      const jsonContent = JSON.stringify({
        data: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]
      });
      
      await fs.promises.writeFile(jsonPath, jsonContent);
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual(['name', 'age']);
    });
    
    it('should parse JSON object with rows property', async () => {
      const jsonPath = path.join(testDataDir, 'object-with-rows.json');
      const jsonContent = JSON.stringify({
        rows: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ]
      });
      
      await fs.promises.writeFile(jsonPath, jsonContent);
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual(['name', 'age']);
    });
    
    it('should wrap single object in array', async () => {
      const jsonPath = path.join(testDataDir, 'single-object.json');
      const jsonContent = JSON.stringify({ name: 'John', age: 30 });
      
      await fs.promises.writeFile(jsonPath, jsonContent);
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(1);
      expect(result.columns).toEqual(['name', 'age']);
      expect(result.rows[0]).toEqual({ name: 'John', age: 30 });
    });
    
    it('should handle empty JSON file', async () => {
      const jsonPath = path.join(testDataDir, 'empty.json');
      await fs.promises.writeFile(jsonPath, '');
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.errors).toContain('File is empty');
    });
    
    it('should handle invalid JSON', async () => {
      const jsonPath = path.join(testDataDir, 'invalid.json');
      await fs.promises.writeFile(jsonPath, '{ invalid json }');
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.errors).toBeDefined();
    });
    
    it('should handle empty array', async () => {
      const jsonPath = path.join(testDataDir, 'empty-array.json');
      await fs.promises.writeFile(jsonPath, '[]');
      
      const result = await parseJSON(jsonPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.columns).toEqual([]);
      expect(result.errors).toBeUndefined();
    });
  });
  
  describe('detectFileType', () => {
    it('should detect CSV files', () => {
      expect(detectFileType('data.csv')).toBe('csv');
      expect(detectFileType('/path/to/file.CSV')).toBe('csv');
    });
    
    it('should detect JSON files', () => {
      expect(detectFileType('data.json')).toBe('json');
      expect(detectFileType('/path/to/file.JSON')).toBe('json');
    });
    
    it('should detect text files', () => {
      expect(detectFileType('readme.txt')).toBe('text');
      expect(detectFileType('notes.md')).toBe('text');
      expect(detectFileType('app.log')).toBe('text');
    });
    
    it('should return unknown for other types', () => {
      expect(detectFileType('image.png')).toBe('unknown');
      expect(detectFileType('doc.pdf')).toBe('unknown');
      expect(detectFileType('noextension')).toBe('unknown');
    });
  });
  
  describe('validateDataStructure', () => {
    it('should validate array of objects', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      const result = validateDataStructure(data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept empty array', () => {
      const result = validateDataStructure([]);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject non-array input', () => {
      const result = validateDataStructure({ not: 'array' } as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data must be an array');
    });
    
    it('should reject array with non-object items', () => {
      const data = ['string', 123, true];
      
      const result = validateDataStructure(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('All data items must be objects');
    });
    
    it('should reject array with null items', () => {
      const data = [{ name: 'John' }, null, { name: 'Jane' }];
      
      const result = validateDataStructure(data);
      
      expect(result.valid).toBe(false);
    });
  });
  
  describe('parseDataFile', () => {
    it('should auto-detect and parse CSV', async () => {
      const csvPath = path.join(testDataDir, 'auto.csv');
      await fs.promises.writeFile(csvPath, 'name,age\nJohn,30');
      
      const result = await parseDataFile(csvPath);
      
      expect(result.rowCount).toBe(1);
      expect(result.columns).toEqual(['name', 'age']);
    });
    
    it('should auto-detect and parse JSON', async () => {
      const jsonPath = path.join(testDataDir, 'auto.json');
      await fs.promises.writeFile(jsonPath, JSON.stringify([{ name: 'John', age: 30 }]));
      
      const result = await parseDataFile(jsonPath);
      
      expect(result.rowCount).toBe(1);
      expect(result.columns).toEqual(['name', 'age']);
    });
    
    it('should handle unsupported file types', async () => {
      const txtPath = path.join(testDataDir, 'unsupported.txt');
      await fs.promises.writeFile(txtPath, 'some text');
      
      const result = await parseDataFile(txtPath);
      
      expect(result.rowCount).toBe(0);
      expect(result.errors).toContain('Unsupported file type: text');
    });
  });
});
