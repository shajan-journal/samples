/**
 * Python Execution Tool - Execute Python code in a subprocess
 * 
 * Uses child_process to spawn Python with timeout and output capture.
 * Simple approach for learning/exploration - not production-grade security.
 * 
 * Enhanced with visualization manifest detection and data parsing.
 */

import { spawn } from 'child_process';
import { BaseTool } from './base';
import { ToolResult, VisualizationManifest } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceManager } from '../utils/workspace-manager';
import { parseDataFile } from '../utils/file-parser';
import { validateManifest } from '../utils/visualization-validator';

export interface PythonExecutionParams {
  code: string;
  timeout?: number;  // Timeout in milliseconds (default: 10000)
  packages?: string[];  // Packages to check/mention if missing
  workspaceDir?: string;  // Workspace directory for file operations
}

export class PythonExecutionTool extends BaseTool {
  name = 'python_execute';
  description = `Execute Python code and automatically detect visualizations. 

IMPORTANT: DO NOT use matplotlib, seaborn, or plotly. Instead, create visualizations using this simple 2-file approach:

1. Create a CSV data file with your data
2. Create a visualization_manifest.json file that describes the chart

MANIFEST FORMAT:
{
  "version": "1.0",
  "outputs": [{
    "id": "unique_id",
    "type": "bar_chart",  // Options: table, line_chart, bar_chart, scatter, pie_chart
    "title": "Chart Title",
    "dataFile": "data.csv",
    "config": {
      "xColumn": "column_name",
      "yColumns": ["value_column"],
      "xLabel": "X Axis Label",
      "yLabel": "Y Axis Label"
    }
  }]
}

EXAMPLE - Bar Chart:
import json, csv
data = [{"month": "Jan", "sales": 10000}, {"month": "Feb", "sales": 12000}]
with open("data.csv", "w", newline="") as f:
    csv.DictWriter(f, fieldnames=["month", "sales"]).writeheader()
    csv.DictWriter(f, fieldnames=["month", "sales"]).writerows(data)
with open("visualization_manifest.json", "w") as f:
    json.dump({"version": "1.0", "outputs": [{"id": "chart1", "type": "bar_chart", "title": "Sales", "dataFile": "data.csv", "config": {"xColumn": "month", "yColumns": ["sales"], "xLabel": "Month", "yLabel": "Sales ($)"}}]}, f)

The system will automatically render the chart in the UI. Use json and csv modules (built-in, no install needed).`;
  parameters = {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute. For visualizations, create a CSV data file and visualization_manifest.json file.',
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
      workspaceDir: {
        type: 'string',
        description: 'Workspace directory for file operations and visualization detection',
      },
    },
    required: ['code'],
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) return validationError;

    const { code, timeout = 10000, workspaceDir } = params as PythonExecutionParams;

    // Create temp file for code
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `python_exec_${Date.now()}.py`);
    
    // Use workspace manager if workspace directory provided
    const workspaceManager = workspaceDir ? new WorkspaceManager(workspaceDir) : null;

    try {
      // Wrap code to capture expression result (similar to Node's vm behavior)
      // If the code is a single expression, wrap it in print()
      const wrappedCode = this.wrapCodeForOutput(code);
      
      // Write code to temp file
      fs.writeFileSync(tempFile, wrappedCode, 'utf-8');

      // Execute Python with timeout (and optional workspace directory)
      const result = await this.executePython(tempFile, timeout, workspaceDir);

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      // If execution was successful and workspace manager exists, scan for generated files
      if (result.success && workspaceManager) {
        try {
          const enhancedData = await this.scanForVisualizationFiles(workspaceManager);
          
          // Add files and visualizations to result data
          if (result.data) {
            result.data = {
              ...result.data,
              ...enhancedData
            };
          }
        } catch (scanError) {
          console.error('[PythonExecutionTool] Error scanning for visualization files:', scanError);
          // Don't fail the execution, just log the error
        }
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

  private executePython(scriptPath: string, timeout: number, cwd?: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const stdout: string[] = [];
      const stderr: string[] = [];

      // Spawn Python process with optional working directory
      const spawnOptions: any = { timeout };
      if (cwd) {
        spawnOptions.cwd = cwd;
      }
      
      const pythonProcess = spawn('python3', [scriptPath], spawnOptions);

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
  
  /**
   * Scan workspace for generated files and detect visualization manifest
   * @param workspaceManager Workspace manager instance
   * @returns Enhanced data with files and visualizations
   */
  private async scanForVisualizationFiles(workspaceManager: WorkspaceManager): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    // Scan for all generated files
    const files = await workspaceManager.scanFiles();
    
    if (files.length > 0) {
      console.log(`[PythonExecutionTool] Found ${files.length} generated files`);
      result.files = files.map(f => ({
        filename: f.filename,
        relativePath: f.relativePath,
        type: f.type,
        size: f.size
      }));
    }
    
    // Check for visualization manifest
    const manifestFile = files.find(f => f.filename === 'visualization_manifest.json');
    
    if (manifestFile) {
      console.log('[PythonExecutionTool] Found visualization manifest, parsing...');
      
      try {
        // Validate manifest
        const validation = await validateManifest(
          manifestFile.path,
          workspaceManager.getBaseDir()
        );
        
        if (!validation.valid) {
          console.warn('[PythonExecutionTool] Manifest validation failed:', validation.errors);
          result.manifestErrors = validation.errors;
          return result;
        }
        
        // Read and parse manifest
        const manifestContent = await workspaceManager.readFile(manifestFile.relativePath);
        const manifest = JSON.parse(manifestContent) as VisualizationManifest;
        
        // Parse data files referenced in manifest
        const parsedVisualizations = await this.parseVisualizationData(
          manifest,
          workspaceManager
        );
        
        result.visualizations = {
          version: manifest.version,
          outputs: parsedVisualizations
        };
        
        console.log(`[PythonExecutionTool] Successfully parsed ${parsedVisualizations.length} visualizations`);
      } catch (error) {
        console.error('[PythonExecutionTool] Error parsing manifest:', error);
        result.manifestError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
    
    return result;
  }
  
  /**
   * Parse visualization data from manifest
   * @param manifest Visualization manifest
   * @param workspaceManager Workspace manager
   * @returns Array of visualization outputs with parsed data
   */
  private async parseVisualizationData(
    manifest: VisualizationManifest,
    workspaceManager: WorkspaceManager
  ): Promise<any[]> {
    const outputs = [];
    
    for (const output of manifest.outputs) {
      try {
        // If output already has data, use it
        if (output.data && Array.isArray(output.data)) {
          outputs.push(output);
          continue;
        }
        
        // Otherwise, parse from dataFile (legacy format)
        if ((output as any).dataFile) {
          const dataFile = (output as any).dataFile;
          const dataPath = workspaceManager.resolvePath(dataFile);
          
          if (!dataPath) {
            console.warn(`[PythonExecutionTool] Invalid data file path: ${dataFile}`);
            continue;
          }
          
          // Parse data file
          const parsedData = await parseDataFile(dataPath);
          
          if (parsedData.errors && parsedData.errors.length > 0) {
            console.warn(`[PythonExecutionTool] Data parsing errors for ${dataFile}:`, parsedData.errors);
          }
          
          // Add parsed data to output
          outputs.push({
            ...output,
            data: parsedData.rows
          });
        } else {
          // No data source, include output as-is
          outputs.push(output);
        }
      } catch (error) {
        console.error(`[PythonExecutionTool] Error parsing visualization ${output.id}:`, error);
        // Include output with error marker
        outputs.push({
          ...output,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return outputs;
  }
}
