import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * Parsed data structure with metadata
 */
export interface ParsedData {
  rows: any[];
  columns: string[];
  rowCount: number;
  errors?: string[];
}

/**
 * Parse CSV file to JSON array
 * @param filePath Absolute path to CSV file
 * @returns Parsed data with rows, columns, and metadata
 */
export async function parseCSV(filePath: string): Promise<ParsedData> {
  const errors: string[] = [];
  
  try {
    // Read file content
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    
    if (!fileContent.trim()) {
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        errors: ['File is empty']
      };
    }
    
    // Parse CSV with headers
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: false,
      relax_quotes: true,
      relax_column_count: true,
      on_record: (record, context) => {
        // Track any parsing issues
        return record;
      }
    }) as Record<string, any>[];
    
    // Extract column names from first record
    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    
    console.log(`[FileParser] Parsed CSV: ${records.length} rows, ${columns.length} columns`);
    
    return {
      rows: records,
      columns,
      rowCount: records.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error(`[FileParser] Error parsing CSV:`, error);
    // NodeError objects have a code property
    const hasCode = error && typeof error === 'object' && 'code' in error;
    const hasMessage = error && typeof error === 'object' && 'message' in error;
    
    let errorMessage: string;
    if (hasCode && hasMessage) {
      errorMessage = `${(error as any).code}: ${(error as any).message}`;
    } else if (hasMessage) {
      errorMessage = (error as any).message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Unknown parsing error';
    }
    
    return {
      rows: [],
      columns: [],
      rowCount: 0,
      errors: [errorMessage]
    };
  }
}

/**
 * Parse JSON file with validation
 * @param filePath Absolute path to JSON file
 * @returns Parsed data with rows, columns, and metadata
 */
export async function parseJSON(filePath: string): Promise<ParsedData> {
  const errors: string[] = [];
  
  try {
    // Read file content
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    
    if (!fileContent.trim()) {
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        errors: ['File is empty']
      };
    }
    
    // Parse JSON
    const data = JSON.parse(fileContent);
    
    // Handle different JSON structures
    let rows: any[];
    
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object') {
      // If it's an object with a data array property
      if (Array.isArray(data.data)) {
        rows = data.data;
      } else if (Array.isArray(data.rows)) {
        rows = data.rows;
      } else {
        // Wrap single object in array
        rows = [data];
      }
    } else {
      errors.push('JSON must be an array or object with data/rows property');
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        errors
      };
    }
    
    // Extract columns from first row
    const columns = rows.length > 0 && typeof rows[0] === 'object' 
      ? Object.keys(rows[0]) 
      : [];
    
    // Validate data structure
    const validation = validateDataStructure(rows);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
    
    console.log(`[FileParser] Parsed JSON: ${rows.length} rows, ${columns.length} columns`);
    
    return {
      rows,
      columns,
      rowCount: rows.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error(`[FileParser] Error parsing JSON:`, error);
    return {
      rows: [],
      columns: [],
      rowCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown parsing error']
    };
  }
}

/**
 * Detect file type from extension
 * @param filePath Path to file
 * @returns Detected file type
 */
export function detectFileType(filePath: string): 'csv' | 'json' | 'text' | 'unknown' {
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
    default:
      return 'unknown';
  }
}

/**
 * Validate data structure
 * @param data Array of data objects
 * @returns Validation result with errors
 */
export function validateDataStructure(data: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { valid: false, errors };
  }
  
  if (data.length === 0) {
    // Empty array is valid but might be worth noting
    return { valid: true, errors: [] };
  }
  
  // Check if all items are objects
  const allObjects = data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
  
  if (!allObjects) {
    errors.push('All data items must be objects');
  }
  
  // Check for consistent keys across rows
  if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
    const firstKeys = Object.keys(data[0]).sort();
    
    for (let i = 1; i < data.length; i++) {
      // Skip null items (already caught by allObjects check)
      if (typeof data[i] !== 'object' || data[i] === null) {
        continue;
      }
      
      const currentKeys = Object.keys(data[i]).sort();
      
      // Allow some flexibility - just warn about inconsistent keys
      if (JSON.stringify(firstKeys) !== JSON.stringify(currentKeys)) {
        console.warn(`[FileParser] Row ${i} has different keys than first row`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parse data file based on detected type
 * @param filePath Absolute path to data file
 * @returns Parsed data
 */
export async function parseDataFile(filePath: string): Promise<ParsedData> {
  const fileType = detectFileType(filePath);
  
  console.log(`[FileParser] Detecting file type for ${path.basename(filePath)}: ${fileType}`);
  
  switch (fileType) {
    case 'csv':
      return parseCSV(filePath);
    case 'json':
      return parseJSON(filePath);
    default:
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        errors: [`Unsupported file type: ${fileType}`]
      };
  }
}
