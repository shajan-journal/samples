# Tools Reference

Tools are the actions agents can perform. Each tool has a specific purpose and security constraints.

## Available Tools

### Calculator

Perform mathematical calculations safely.

**Parameters:**
- `expression` (string) - Mathematical expression to calculate

**Supported:**
- Arithmetic: `+`, `-`, `*`, `/`, `**` (power)
- Functions: `sqrt()`, `abs()`, `floor()`, `ceil()`, `round()`, `min()`, `max()`
- Trigonometry: `sin()`, `cos()`, `tan()`, `log()`, `exp()`
- Constants: `pi`, `e`

**Examples:**
```bash
npm run test:tool -- calculator '{"expression":"2+2"}'
npm run test:tool -- calculator '{"expression":"sqrt(16) * pi"}'
npm run test:tool -- calculator '{"expression":"max(10, 20, 5)"}'
```

**Security:** Expression evaluation is sandboxed. Only safe math functions allowed.

---

### File System

Read, write, list, and check files in workspace.

**Actions:**
- `read` - Read file contents
- `write` - Write/overwrite file
- `list` - List directory contents
- `exists` - Check if file exists
- `delete` - Delete a file

**Parameters:**
- `action` (string) - Action to perform
- `path` (string) - File path (relative to workspace)
- `content` (string) - Content to write (for write action)

**Examples:**
```bash
# Write file
npm run test:tool -- file_system '{"action":"write","path":"test.txt","content":"Hello"}'

# Read file
npm run test:tool -- file_system '{"action":"read","path":"test.txt"}'

# List directory
npm run test:tool -- file_system '{"action":"list","path":"."}'

# Check if exists
npm run test:tool -- file_system '{"action":"exists","path":"test.txt"}'

# Delete file
npm run test:tool -- file_system '{"action":"delete","path":"test.txt"}'
```

**Security:**
- All paths are relative to workspace directory
- Directory traversal (`../`) is blocked
- Cannot escape workspace

---

### Node Execution

Execute JavaScript/Node.js code in a sandboxed environment.

**Parameters:**
- `code` (string) - JavaScript code to execute
- `timeout` (number, optional) - Timeout in milliseconds (default: 5000)

**Examples:**
```bash
# Simple code
npm run test:tool -- node_execute '{"code":"console.log(2 + 2)"}'

# Math operations
npm run test:tool -- node_execute '{"code":"console.log(Math.sqrt(16))"}'

# Array operations
npm run test:tool -- node_execute '{"code":"console.log([1,2,3].reverse())"}'

# With custom timeout
npm run test:tool -- node_execute '{"code":"console.log(1+1)","timeout":3000}'
```

**Features:**
- Captures console output (log, error, warn, info)
- Timeout protection against infinite loops
- Returns execution result and output

**Security:**
- Disabled: `require()`, `process`, `setTimeout`, `setInterval`
- No file system access
- No network access
- Timeout enforcement

**Limitations:**
- Cannot import modules (no `require`)
- Cannot use async/await (no Promise support)
- Limited to synchronous code

---

### Python Execution

Execute Python code in a subprocess. **Supports automatic visualization generation**.

**Parameters:**
- `code` (string) - Python code to execute
- `timeout` (number, optional) - Timeout in milliseconds (default: 10000)
- `workspaceDir` (string, optional) - Directory for file operations

**Examples:**
```bash
# Simple output
npm run test:tool -- python_execute '{"code":"print(2 + 2)"}'

# Math
npm run test:tool -- python_execute '{"code":"import math\\nprint(math.sqrt(16))"}'

# File operations
npm run test:tool -- python_execute '{"code":"with open(\"test.txt\",\"w\") as f: f.write(\"Hello\")"}'
```

**Visualization Support:**

Create a `visualization_manifest.json` file:

```python
import json, csv

# Create data file
data = [
    {"month": "January", "sales": 45000},
    {"month": "February", "sales": 52000},
    {"month": "March", "sales": 48000}
]
with open("sales.csv", "w", newline="") as f:
    csv.DictWriter(f, fieldnames=["month", "sales"]).writeheader()
    csv.DictWriter(f, fieldnames=["month", "sales"]).writerows(data)

# Create manifest
manifest = {
    "version": "1.0",
    "outputs": [{
        "id": "sales_chart",
        "type": "bar_chart",
        "title": "Q1 2024 Sales",
        "dataFile": "sales.csv",
        "config": {
            "xColumn": "month",
            "yColumns": ["sales"],
            "xLabel": "Month",
            "yLabel": "Sales ($)"
        }
    }]
}
with open("visualization_manifest.json", "w") as f:
    json.dump(manifest, f)
```

**Visualization Types:**
- `bar_chart` - Bar chart visualization
- `line_chart` - Line chart visualization
- `scatter` - Scatter plot
- `pie_chart` - Pie chart
- `table` - Data table

See [Visualization Contract](./visualization-contract.md) for complete specification.

**Features:**
- Runs Python code in subprocess
- Captures stdout and stderr
- Auto-detects visualization manifests
- Parses CSV data automatically
- Returns parsed data with visualization

**Security:**
- Runs in subprocess (isolated from Node process)
- Timeout enforcement
- Can create files in workspace only

**Built-in Modules:**
- All standard library modules (`json`, `csv`, `math`, `datetime`, etc.)
- Install packages with subprocess calls if needed

---

## Custom Tools

### Create a Tool

```typescript
// api/src/tools/my-tool.ts
import { BaseTool } from './base';
import { ToolResult } from '../types';

export class MyTool extends BaseTool {
  name = 'my_tool';
  description = 'What this tool does';
  parameters = {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'First parameter'
      }
    },
    required: ['param1']
  };

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { param1 } = params;
    
    try {
      const result = await doSomething(param1);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

### Register Tool

```typescript
// api/src/orchestrator/orchestrator.ts
import { MyTool } from '../tools/my-tool';

const tools = [
  new CalculatorTool(),
  new FileSystemTool(),
  new NodeExecutionTool(),
  new PythonExecutionTool(),
  new MyTool()  // ← Add here
];
```

### Test Tool

```bash
npm run test:tool -- my_tool '{"param1":"value"}'
```

---

## Tool Best Practices

1. **Security First** - Validate all inputs, limit access
2. **Error Handling** - Return meaningful error messages
3. **Timeout** - Implement timeout for long operations
4. **Documentation** - Clear descriptions and examples
5. **Testing** - Unit tests for all tool functionality

See `api/src/tools/` directory for examples.
