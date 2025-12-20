/**
 * Tests for PythonExecutionTool
 */

import { PythonExecutionTool } from '../../src/tools/python-execution';
import * as fs from 'fs';
import * as path from 'path';

describe('PythonExecutionTool', () => {
  let tool: PythonExecutionTool;

  beforeEach(() => {
    tool = new PythonExecutionTool();
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('python_execute');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('should have parameters schema', () => {
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties.code).toBeDefined();
    });
  });

  describe('Basic Execution', () => {
    it('should execute simple print statement', async () => {
      const result = await tool.execute({
        code: 'print("Hello, Python!")',
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Hello, Python!');
      expect(result.data.returnCode).toBe(0);
    });

    it('should execute arithmetic operations', async () => {
      const result = await tool.execute({
        code: 'print(2 + 2)',
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('4');
    });

    it('should execute multiple statements', async () => {
      const result = await tool.execute({
        code: `
x = 10
y = 20
print(x + y)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('30');
    });

    it('should capture multiple print calls', async () => {
      const result = await tool.execute({
        code: `
print("Line 1")
print("Line 2")
print("Line 3")
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('Line 1');
      expect(result.data.stdout).toContain('Line 2');
      expect(result.data.stdout).toContain('Line 3');
    });

    it('should capture stderr output', async () => {
      const result = await tool.execute({
        code: `
import sys
print("Error message", file=sys.stderr)
        `,
      });

      // This might succeed with stderr captured
      expect(result.data.stderr).toContain('Error message');
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors', async () => {
      const result = await tool.execute({
        code: 'print("unclosed string',  // Syntax error
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle runtime errors', async () => {
      const result = await tool.execute({
        code: 'raise ValueError("Test error")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ValueError');
    });

    it('should handle undefined variable errors', async () => {
      const result = await tool.execute({
        code: 'print(undefined_variable)',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('NameError');
    });
  });

  describe('Timeout', () => {
    it('should timeout long-running code', async () => {
      const result = await tool.execute({
        code: `
import time
time.sleep(10)
        `,
        timeout: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 2000);

    it('should respect custom timeout', async () => {
      const result = await tool.execute({
        code: 'print("Quick execution")',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should require code parameter', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('code');
    });

    it('should accept valid parameters', async () => {
      const result = await tool.execute({
        code: 'print("test")',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Code', () => {
    it('should handle functions', async () => {
      const result = await tool.execute({
        code: `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('120');
    });

    it('should handle lists and dictionaries', async () => {
      const result = await tool.execute({
        code: `
data = {"name": "test", "values": [1, 2, 3]}
print(data)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('test');
    });

    it('should handle loops', async () => {
      const result = await tool.execute({
        code: `
for i in range(5):
    print(i)
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('0');
      expect(result.data.stdout).toContain('4');
    });

    it('should handle imports of standard library', async () => {
      const result = await tool.execute({
        code: `
import math
print(math.sqrt(16))
        `,
      });

      expect(result.success).toBe(true);
      expect(result.data.stdout).toContain('4');
    });
  });

  describe('Execution Time Tracking', () => {
    it('should track execution time', async () => {
      const result = await tool.execute({
        code: 'print("test")',
      });

      expect(result.success).toBe(true);
      expect(result.data.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Visualization Detection', () => {
    const testWorkspace = path.join(__dirname, '../../test-workspace/python-viz-test');
    
    beforeAll(async () => {
      await fs.promises.mkdir(testWorkspace, { recursive: true });
    });
    
    afterAll(async () => {
      await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    });
    
    beforeEach(async () => {
      // Clean workspace before each test
      const files = await fs.promises.readdir(testWorkspace);
      for (const file of files) {
        await fs.promises.rm(path.join(testWorkspace, file), { recursive: true, force: true });
      }
    });
    
    it('should detect generated CSV files', async () => {
      const code = `
import csv
import os

os.chdir('${testWorkspace}')

with open('data.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['name', 'value'])
    writer.writerow(['A', 10])
    writer.writerow(['B', 20])

print("CSV created")
      `;
      
      const result = await tool.execute({
        code,
        workspaceDir: testWorkspace
      });
      
      expect(result.success).toBe(true);
      expect(result.data.files).toBeDefined();
      expect(result.data.files.length).toBeGreaterThan(0);
      
      const csvFile = result.data.files.find((f: any) => f.filename === 'data.csv');
      expect(csvFile).toBeDefined();
      expect(csvFile.type).toBe('csv');
    });
    
    it('should detect and parse visualization manifest', async () => {
      const code = `
import json
import csv
import os

os.chdir('${testWorkspace}')

# Create data file
with open('revenue.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['month', 'revenue'])
    writer.writerow(['Jan', 10000])
    writer.writerow(['Feb', 12000])
    writer.writerow(['Mar', 15000])

# Create manifest
manifest = {
    "version": "1.0",
    "outputs": [
        {
            "id": "revenue_chart",
            "type": "bar_chart",
            "title": "Monthly Revenue",
            "dataFile": "revenue.csv",
            "config": {
                "xColumn": "month",
                "yColumn": "revenue"
            }
        }
    ]
}

with open('visualization_manifest.json', 'w') as f:
    json.dump(manifest, f)

print("Visualization created")
      `;
      
      const result = await tool.execute({
        code,
        workspaceDir: testWorkspace
      });
      
      expect(result.success).toBe(true);
      expect(result.data.visualizations).toBeDefined();
      expect(result.data.visualizations.version).toBe('1.0');
      expect(result.data.visualizations.outputs).toHaveLength(1);
      
      const output = result.data.visualizations.outputs[0];
      expect(output.id).toBe('revenue_chart');
      expect(output.type).toBe('bar_chart');
      expect(output.data).toBeDefined();
      expect(Array.isArray(output.data)).toBe(true);
      expect(output.data.length).toBe(3);
      expect(output.data[0].month).toBe('Jan');
      expect(output.data[0].revenue).toBe(10000);
    });
    
    it('should handle multiple visualizations', async () => {
      const code = `
import json
import csv
import os

os.chdir('${testWorkspace}')

# Create data file
with open('sales.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['product', 'sales'])
    writer.writerow(['A', 100])
    writer.writerow(['B', 150])
    writer.writerow(['C', 200])

# Create manifest with multiple outputs
manifest = {
    "version": "1.0",
    "outputs": [
        {
            "id": "sales_table",
            "type": "table",
            "title": "Sales Data",
            "dataFile": "sales.csv"
        },
        {
            "id": "sales_chart",
            "type": "pie_chart",
            "title": "Sales Distribution",
            "dataFile": "sales.csv",
            "config": {
                "labelColumn": "product",
                "valueColumn": "sales"
            }
        }
    ]
}

with open('visualization_manifest.json', 'w') as f:
    json.dump(manifest, f)

print("Multiple visualizations created")
      `;
      
      const result = await tool.execute({
        code,
        workspaceDir: testWorkspace
      });
      
      expect(result.success).toBe(true);
      expect(result.data.visualizations).toBeDefined();
      expect(result.data.visualizations.outputs).toHaveLength(2);
      
      const table = result.data.visualizations.outputs.find((o: any) => o.type === 'table');
      const chart = result.data.visualizations.outputs.find((o: any) => o.type === 'pie_chart');
      
      expect(table).toBeDefined();
      expect(chart).toBeDefined();
      expect(table.data).toHaveLength(3);
      expect(chart.data).toHaveLength(3);
    });
    
    it('should work without workspace directory (backward compatible)', async () => {
      const result = await tool.execute({
        code: 'print("Hello")',
      });
      
      expect(result.success).toBe(true);
      expect(result.data.files).toBeUndefined();
      expect(result.data.visualizations).toBeUndefined();
    });
  });
});
