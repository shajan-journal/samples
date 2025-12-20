import * as fs from 'fs';
import * as path from 'path';
import { VisualizationManifest, VisualizationOutput, VisualizationConfig } from '../types';
import { ParsedData } from './file-parser';

/**
 * Validation error with severity
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Supported visualization types
 */
const VALID_TYPES = ['table', 'line_chart', 'bar_chart', 'scatter', 'pie_chart'] as const;

/**
 * Validate visualization manifest from file
 * @param manifestPath Absolute path to manifest JSON file
 * @param workspaceDir Workspace directory for resolving relative paths
 * @returns Validation result with errors
 */
export async function validateManifest(
  manifestPath: string,
  workspaceDir: string
): Promise<{ valid: boolean; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];
  
  try {
    // Check if manifest file exists
    if (!await fileExists(manifestPath)) {
      errors.push({
        field: 'manifest',
        message: `Manifest file not found: ${manifestPath}`,
        severity: 'error'
      });
      return { valid: false, errors };
    }
    
    // Read and parse manifest
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    let manifest: any;
    
    try {
      manifest = JSON.parse(manifestContent);
    } catch (parseError) {
      errors.push({
        field: 'manifest',
        message: `Invalid JSON in manifest: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        severity: 'error'
      });
      return { valid: false, errors };
    }
    
    // Validate manifest structure
    if (!manifest.version) {
      errors.push({
        field: 'version',
        message: 'Manifest must have a version field',
        severity: 'error'
      });
    }
    
    if (!Array.isArray(manifest.outputs)) {
      errors.push({
        field: 'outputs',
        message: 'Manifest must have an outputs array',
        severity: 'error'
      });
      return { valid: false, errors };
    }
    
    if (manifest.outputs.length === 0) {
      errors.push({
        field: 'outputs',
        message: 'Manifest must have at least one output',
        severity: 'warning'
      });
    }
    
    // Validate each output
    for (let i = 0; i < manifest.outputs.length; i++) {
      const output = manifest.outputs[i];
      const outputErrors = await validateOutput(output, i, workspaceDir);
      errors.push(...outputErrors);
    }
    
    console.log(`[VisualizationValidator] Validated manifest: ${errors.length} errors/warnings`);
    
    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors
    };
  } catch (error) {
    console.error('[VisualizationValidator] Error validating manifest:', error);
    errors.push({
      field: 'manifest',
      message: error instanceof Error ? error.message : 'Unknown validation error',
      severity: 'error'
    });
    return { valid: false, errors };
  }
}

/**
 * Validate a single visualization output
 * @param output Visualization output object
 * @param index Output index in manifest
 * @param workspaceDir Workspace directory
 * @returns Array of validation errors
 */
async function validateOutput(
  output: any,
  index: number,
  workspaceDir: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const prefix = `outputs[${index}]`;
  
  // Validate required fields
  if (!output.id) {
    errors.push({
      field: `${prefix}.id`,
      message: 'Output must have an id',
      severity: 'error'
    });
  }
  
  if (!output.type) {
    errors.push({
      field: `${prefix}.type`,
      message: 'Output must have a type',
      severity: 'error'
    });
  } else if (!VALID_TYPES.includes(output.type)) {
    errors.push({
      field: `${prefix}.type`,
      message: `Invalid type '${output.type}'. Must be one of: ${VALID_TYPES.join(', ')}`,
      severity: 'error'
    });
  }
  
  // Validate dataFile (if present, should exist)
  if (output.dataFile) {
    const dataPath = path.isAbsolute(output.dataFile)
      ? output.dataFile
      : path.join(workspaceDir, output.dataFile);
    
    if (!await fileExists(dataPath)) {
      errors.push({
        field: `${prefix}.dataFile`,
        message: `Data file not found: ${output.dataFile}`,
        severity: 'error'
      });
    }
  }
  
  return errors;
}

/**
 * Validate visualization output object with parsed data
 * @param output Visualization output
 * @param data Parsed data
 * @returns Array of validation errors
 */
export function validateVisualizationOutput(
  output: VisualizationOutput,
  data: ParsedData
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Validate required fields
  if (!output.id) {
    errors.push({
      field: 'id',
      message: 'Output must have an id',
      severity: 'error'
    });
  }
  
  if (!output.type) {
    errors.push({
      field: 'type',
      message: 'Output must have a type',
      severity: 'error'
    });
  } else if (!VALID_TYPES.includes(output.type)) {
    errors.push({
      field: 'type',
      message: `Invalid type '${output.type}'. Must be one of: ${VALID_TYPES.join(', ')}`,
      severity: 'error'
    });
  }
  
  // Validate data
  if (!output.data || !Array.isArray(output.data)) {
    errors.push({
      field: 'data',
      message: 'Output must have a data array',
      severity: 'error'
    });
    return errors;
  }
  
  if (output.data.length === 0) {
    errors.push({
      field: 'data',
      message: 'Data array is empty',
      severity: 'warning'
    });
  }
  
  // Validate config against data columns
  if (output.config && data.columns.length > 0) {
    const configErrors = validateConfig(output.type, output.config, data.columns);
    errors.push(...configErrors);
  }
  
  return errors;
}

/**
 * Validate visualization config against available columns
 * @param type Visualization type
 * @param config Visualization config
 * @param columns Available column names
 * @returns Array of validation errors
 */
export function validateConfig(
  type: string,
  config: VisualizationConfig,
  columns: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  switch (type) {
    case 'table':
      // Validate table columns
      if (config.columns) {
        for (const col of config.columns) {
          if (!columns.includes(col)) {
            errors.push({
              field: 'config.columns',
              message: `Column '${col}' not found in data. Available: ${columns.join(', ')}`,
              severity: 'error'
            });
          }
        }
      }
      break;
      
    case 'line_chart':
    case 'bar_chart':
    case 'scatter':
      // Validate X column
      if (config.xColumn && !columns.includes(config.xColumn)) {
        errors.push({
          field: 'config.xColumn',
          message: `Column '${config.xColumn}' not found in data. Available: ${columns.join(', ')}`,
          severity: 'error'
        });
      }
      
      // Validate Y column(s)
      if (config.yColumn) {
        const yColumns = Array.isArray(config.yColumn) ? config.yColumn : [config.yColumn];
        for (const col of yColumns) {
          if (!columns.includes(col)) {
            errors.push({
              field: 'config.yColumn',
              message: `Column '${col}' not found in data. Available: ${columns.join(', ')}`,
              severity: 'error'
            });
          }
        }
      } else {
        errors.push({
          field: 'config.yColumn',
          message: 'yColumn is required for chart visualizations',
          severity: 'error'
        });
      }
      
      // Validate groupBy if present
      if (config.groupBy && !columns.includes(config.groupBy)) {
        errors.push({
          field: 'config.groupBy',
          message: `Column '${config.groupBy}' not found in data. Available: ${columns.join(', ')}`,
          severity: 'warning'
        });
      }
      break;
      
    case 'pie_chart':
      // Validate label column
      if (!config.labelColumn) {
        errors.push({
          field: 'config.labelColumn',
          message: 'labelColumn is required for pie charts',
          severity: 'error'
        });
      } else if (!columns.includes(config.labelColumn)) {
        errors.push({
          field: 'config.labelColumn',
          message: `Column '${config.labelColumn}' not found in data. Available: ${columns.join(', ')}`,
          severity: 'error'
        });
      }
      
      // Validate value column
      if (!config.valueColumn) {
        errors.push({
          field: 'config.valueColumn',
          message: 'valueColumn is required for pie charts',
          severity: 'error'
        });
      } else if (!columns.includes(config.valueColumn)) {
        errors.push({
          field: 'config.valueColumn',
          message: `Column '${config.valueColumn}' not found in data. Available: ${columns.join(', ')}`,
          severity: 'error'
        });
      }
      break;
  }
  
  return errors;
}

/**
 * Check if file exists
 * @param filePath Absolute path to file
 * @returns True if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate manifest JSON structure (without file checks)
 * @param manifest Manifest object
 * @returns Validation result
 */
export function validateManifestStructure(manifest: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (!manifest) {
    errors.push({
      field: 'manifest',
      message: 'Manifest is null or undefined',
      severity: 'error'
    });
    return { valid: false, errors };
  }
  
  if (!manifest.version) {
    errors.push({
      field: 'version',
      message: 'Manifest must have a version field',
      severity: 'error'
    });
  }
  
  if (!Array.isArray(manifest.outputs)) {
    errors.push({
      field: 'outputs',
      message: 'Manifest must have an outputs array',
      severity: 'error'
    });
    return { valid: false, errors };
  }
  
  if (manifest.outputs.length === 0) {
    errors.push({
      field: 'outputs',
      message: 'Manifest must have at least one output',
      severity: 'warning'
    });
  }
  
  // Validate each output structure
  for (let i = 0; i < manifest.outputs.length; i++) {
    const output = manifest.outputs[i];
    const prefix = `outputs[${i}]`;
    
    if (!output.id) {
      errors.push({
        field: `${prefix}.id`,
        message: 'Output must have an id',
        severity: 'error'
      });
    }
    
    if (!output.type) {
      errors.push({
        field: `${prefix}.type`,
        message: 'Output must have a type',
        severity: 'error'
      });
    } else if (!VALID_TYPES.includes(output.type)) {
      errors.push({
        field: `${prefix}.type`,
        message: `Invalid type '${output.type}'. Must be one of: ${VALID_TYPES.join(', ')}`,
        severity: 'error'
      });
    }
  }
  
  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  };
}
