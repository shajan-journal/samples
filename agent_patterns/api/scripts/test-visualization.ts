#!/usr/bin/env ts-node
/**
 * Test script to verify end-to-end visualization workflow
 */

import { PythonExecutionTool } from '../src/tools/python-execution';
import * as path from 'path';
import * as fs from 'fs';

const workspaceDir = path.join(__dirname, '../../api/test-workspace');

async function testVisualization() {
  console.log('🧪 Testing End-to-End Visualization Workflow\n');
  console.log('=' .repeat(60));
  
  // Clean workspace
  console.log('\n1️⃣  Cleaning workspace...');
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true });
  }
  fs.mkdirSync(workspaceDir, { recursive: true });
  console.log(`   ✅ Workspace ready: ${workspaceDir}`);
  
  // Create test Python script
  console.log('\n2️⃣  Creating test Python script...');
  const testScript = `
import json
import csv

# Create sample data
data = [
    {"month": "January", "revenue": 10000},
    {"month": "February", "revenue": 12000},
    {"month": "March", "revenue": 15000},
    {"month": "April", "revenue": 13000},
    {"month": "May", "revenue": 16000},
]

# Write data to CSV
with open("revenue_data.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["month", "revenue"])
    writer.writeheader()
    writer.writerows(data)

# Create visualization manifest
manifest = {
    "version": "1.0",
    "outputs": [
        {
            "id": "revenue_chart",
            "type": "bar_chart",
            "title": "Monthly Revenue",
            "dataFile": "revenue_data.csv",
            "config": {
                "xColumn": "month",
                "yColumns": ["revenue"],
                "xLabel": "Month",
                "yLabel": "Revenue ($)"
            }
        }
    ]
}

# Write manifest
with open("visualization_manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("✅ Created visualization manifest and data file!")
print(f"   - revenue_data.csv: {len(data)} rows")
print(f"   - visualization_manifest.json: 1 bar chart")
`;
  
  console.log('   ✅ Test script ready');
  
  // Execute Python code
  console.log('\n3️⃣  Executing Python code with PythonExecutionTool...');
  const tool = new PythonExecutionTool();
  const result = await tool.execute({ code: testScript, workspaceDir });
  
  console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (!result.success) {
    console.log(`   ❌ Error: ${result.error}`);
    if (result.errorDetails) {
      console.log(`   Details: ${result.errorDetails.message}`);
    }
    return;
  }
  
  console.log(`   ✅ Python code executed successfully`);
  
  // Check for visualizations
  console.log('\n4️⃣  Checking for visualization data in result...');
  if (result.data?.visualizations) {
    const viz = result.data.visualizations;
    console.log('   ✅ Visualizations detected!');
    console.log(`   Version: ${viz.version}`);
    console.log(`   Outputs: ${viz.outputs.length}`);
    
    viz.outputs.forEach((output: any, idx: number) => {
      console.log(`\n   📊 Visualization ${idx + 1}:`);
      console.log(`      Type: ${output.type}`);
      console.log(`      Title: ${output.title}`);
      console.log(`      Data File: ${output.dataFile}`);
      
      if (output.data) {
        console.log(`      Parsed Data: ${output.data.length} rows`);
        console.log(`      Columns: ${output.data.length > 0 ? Object.keys(output.data[0]).join(', ') : 'none'}`);
        console.log(`      Sample Row: ${JSON.stringify(output.data[0])}`);
      } else {
        console.log(`      ⚠️  No parsed data found`);
      }
      
      console.log(`      Config:`);
      Object.entries(output.config).forEach(([key, value]) => {
        console.log(`         ${key}: ${JSON.stringify(value)}`);
      });
    });
  } else {
    console.log('   ❌ No visualizations found in result.data');
    console.log(`   Result keys: ${Object.keys(result.data || {}).join(', ')}`);
  }
  
  // Verify files in workspace
  console.log('\n5️⃣  Verifying files in workspace...');
  const files = fs.readdirSync(workspaceDir);
  console.log(`   Files created: ${files.join(', ')}`);
  
  if (files.includes('visualization_manifest.json')) {
    const manifestPath = path.join(workspaceDir, 'visualization_manifest.json');
    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log('   ✅ Manifest file exists and is valid JSON');
  }
  
  if (files.includes('revenue_data.csv')) {
    const dataPath = path.join(workspaceDir, 'revenue_data.csv');
    const dataContent = fs.readFileSync(dataPath, 'utf-8');
    const lines = dataContent.trim().split('\n');
    console.log(`   ✅ Data file exists with ${lines.length} lines (including header)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ End-to-End Visualization Test Complete!\n');
}

testVisualization().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
