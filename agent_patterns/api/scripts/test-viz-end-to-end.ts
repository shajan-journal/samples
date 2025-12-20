/**
 * End-to-end visualization test
 * Traces the complete flow from Python execution to frontend-ready output
 */

import * as path from 'path';
import { PythonExecutionTool } from '../src/tools/python-execution';

async function testEndToEnd() {
  const testWorkspace = path.join(__dirname, '../test-workspace');
  
  console.log('=== Visualization End-to-End Test ===\n');
  console.log('Test workspace:', testWorkspace);

  const pythonCode = `
import json
import csv

# Create sales data
data = [
  {"month": "January", "sales": 45000},
  {"month": "February", "sales": 52000},
  {"month": "March", "sales": 48000}
]

# Write CSV file
with open("sales_data.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["month", "sales"])
    writer.writeheader()
    writer.writerows(data)

# Write manifest
manifest = {
  "version": "1.0",
  "outputs": [{
    "id": "sales_chart",
    "type": "bar_chart",
    "title": "Q1 2024 Sales",
    "dataFile": "sales_data.csv",
    "config": {
      "xColumn": "month",
      "yColumns": ["sales"],
      "xLabel": "Month",
      "yLabel": "Sales ($)"
    }
  }]
}

with open("visualization_manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("Files created successfully")
`;

  const tool = new PythonExecutionTool();
  const result = await tool.execute({
    code: pythonCode,
    workspaceDir: testWorkspace
  });

  console.log('\n=== Python Execution Result ===');
  console.log('Success:', result.success);
  console.log('Error:', result.error);
  
  if (result.data) {
    console.log('\n=== Data Returned by Tool ===');
    console.log(JSON.stringify(result.data, null, 2));
    
    if (result.data.visualizations) {
      console.log('\n=== Visualizations Extracted ===');
      console.log(JSON.stringify(result.data.visualizations, null, 2));
      
      if (result.data.visualizations.outputs && result.data.visualizations.outputs[0]) {
        const firstOutput = result.data.visualizations.outputs[0];
        console.log('\n=== First Visualization Output ===');
        console.log('ID:', firstOutput.id);
        console.log('Type:', firstOutput.type);
        console.log('Title:', firstOutput.title);
        console.log('Has data array:', !!firstOutput.data);
        if (firstOutput.data) {
          console.log('Data rows:', firstOutput.data.length);
          console.log('First row:', JSON.stringify(firstOutput.data[0]));
        }
      }
    }
  }

  console.log('\n=== Summary ===');
  const hasFrontendReadyData = 
    result.success &&
    result.data?.visualizations?.outputs?.[0]?.data &&
    Array.isArray(result.data.visualizations.outputs[0].data);
  
  console.log('Frontend-ready visualization data available:', hasFrontendReadyData ? '✅ YES' : '❌ NO');
}

testEndToEnd().catch(console.error);
