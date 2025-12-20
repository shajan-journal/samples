# Visualization System Contract

A "contract" is a binding agreement between three layers of a system: what one layer produces must be exactly what the next layer expects. Without this contract, system integration breaks.

## The Three Layers

```
PYTHON LLM Code
    ↓
    ├─ Creates: CSV file + visualization_manifest.json
    └─ Format: Specific JSON structure with `yColumns` (plural array)
    
API Layer (python_execute tool)
    ↓
    ├─ Reads: visualization_manifest.json and CSV files
    ├─ Transforms: Converts `dataFile` reference → parsed `data` array
    └─ Returns: VisualizationManifest with `data` field (not `dataFile`)
    
Frontend (UI)
    ↓
    ├─ Receives: VisualizationManifest from API
    ├─ Expects: Specific config structure with `yColumns` (plural array)
    └─ Renders: Charts using Recharts library
```

## The Contract Specification

### Layer 1: Python Code Output

**What Python code must generate:**

#### File 1: `visualization_manifest.json`

```json
{
  "version": "1.0",
  "outputs": [
    {
      "id": "unique_chart_id",
      "type": "bar_chart",
      "title": "Chart Title",
      "dataFile": "path/to/data.csv",
      "config": {
        "xColumn": "month",
        "yColumns": ["sales", "profit"],
        "xLabel": "Month",
        "yLabel": "Amount ($)"
      }
    }
  ]
}
```

**Critical Requirements:**
- ✅ `yColumns` must be an ARRAY (plural), not a string
- ✅ `yColumns` is REQUIRED for bar_chart, line_chart, scatter
- ✅ `dataFile` is a path reference to the CSV file (can be relative or absolute)
- ✅ Each output must have `id`, `type`, `title`, `dataFile`, `config`
- ✅ Valid types: `table`, `line_chart`, `bar_chart`, `scatter`, `pie_chart`

#### File 2: CSV Data File (e.g., `data.csv`)

```csv
month,sales,profit
January,45000,12000
February,52000,15000
March,48000,11000
```

**Requirements:**
- ✅ Standard CSV format (comma-separated)
- ✅ First row must be column headers
- ✅ Must match column names referenced in `config.xColumn` and `config.yColumns`

### Layer 2: API Processing

**What the API receives and transforms:**

The `PythonExecutionTool` receives the manifest and CSV files. It:

1. **Reads** `visualization_manifest.json`
2. **Parses** each data file (resolving relative paths from workspace)
3. **Transforms** the manifest:
   ```
   Before:  { ..., "dataFile": "data.csv", ...}
   After:   { ..., "data": [{month: "Jan", sales: 45000}, ...], ...}
   ```
4. **Returns** transformed `VisualizationManifest` to the client

**Transformation Logic (in python-execution.ts):**
```typescript
// If output has dataFile, parse it into data array
if ((output as any).dataFile) {
  const dataPath = workspaceManager.resolvePath(output.dataFile);
  const parsedData = await parseDataFile(dataPath);
  outputs.push({
    ...output,
    data: parsedData.rows  // Array of objects
  });
}
```

**What gets returned to frontend:**

```typescript
{
  "version": "1.0",
  "outputs": [
    {
      "id": "unique_chart_id",
      "type": "bar_chart",
      "title": "Chart Title",
      "config": {
        "xColumn": "month",
        "yColumns": ["sales", "profit"],      // ← PLURAL ARRAY
        "xLabel": "Month",
        "yLabel": "Amount ($)"
      },
      "data": [
        { "month": "January", "sales": 45000, "profit": 12000 },
        { "month": "February", "sales": 52000, "profit": 15000 },
        { "month": "March", "sales": 48000, "profit": 11000 }
      ]
    }
  ]
}
```

### Layer 3: Frontend Rendering

**What the UI expects to receive:**

TypeScript interface (in `ui/lib/visualizations/Table.tsx`):

```typescript
export interface VisualizationConfig {
  xColumn?: string;           // Single column name
  yColumns?: string[];        // PLURAL - array of column names
  xLabel?: string;
  yLabel?: string;
  // ... other optional fields
}

export interface VisualizationOutput {
  id: string;
  type: 'bar_chart' | 'line_chart' | 'scatter' | 'pie_chart' | 'table';
  title?: string;
  config?: VisualizationConfig;
  data: any[];                // REQUIRED: parsed data array
  error?: string;
}
```

**What each component validates:**

- **BarChart**: 
  - ✅ Requires `data` (array)
  - ✅ Requires `config`
  - ✅ Requires `config.yColumns` (array, not empty)
  - ✅ Requires `config.xColumn` (or derives from first column of data)
  
- **LineChart**: Same as BarChart (multiple lines from yColumns array)

- **ScatterChart**: 
  - ✅ Requires `data` (array)
  - ✅ Requires `config`
  - ✅ Requires `config.yColumns` (array - uses first column)
  - ✅ Requires `config.xColumn`

## Common Contract Violations

### ❌ Violation 1: Using `yColumn` (singular) instead of `yColumns` (plural)

**Wrong (Old Code):**
```json
{
  "config": {
    "xColumn": "month",
    "yColumn": "sales"          // ← WRONG (singular string)
  }
}
```

**Correct (Contract-Compliant):**
```json
{
  "config": {
    "xColumn": "month",
    "yColumns": ["sales"]       // ← CORRECT (plural array)
  }
}
```

### ❌ Violation 2: API not parsing dataFile

If the API returns:
```json
{
  "dataFile": "data.csv",      // ← Should be removed
  "data": undefined            // ← Should have parsed array
}
```

Frontend will fail with: **"Error: Bar chart requires data"**

### ❌ Violation 3: Python not creating proper manifest

If Python creates:
```json
{
  "outputs": [{
    "type": "bar_chart",
    "config": {
      "xColumn": "month",
      "yColumns": "sales"      // ← Should be array, not string
    }
  }]
}
```

Frontend will fail with: **"Error: Bar chart requires yColumns configuration (array of column names)"**

## Validation at Each Layer

### Python Code (Before It Runs)

Should create test output to verify:
```python
# After creating visualization_manifest.json:
import json
with open("visualization_manifest.json", "r") as f:
    manifest = json.load(f)
    
# Verify yColumns is array
for output in manifest["outputs"]:
    assert isinstance(output["config"]["yColumns"], list), \
        f"yColumns must be array, got {type(output['config']['yColumns'])}"
```

### API Layer (In python-execution.ts)

Already validates via logging:
```
[PythonExecutionTool] Including visualization data in event
  outputCount: 1
  firstOutputHasData: true      // ← Confirms data array exists
```

### Frontend (Chart Components)

Each component validates:
```typescript
if (!config.yColumns || !Array.isArray(config.yColumns)) {
  return <Error>yColumns must be array</Error>;
}
```

## Type Definitions (Source of Truth)

### Backend Types

**File:** `api/src/types.ts`
```typescript
export interface VisualizationConfig {
  xColumn?: string;
  yColumns?: string[];        // ← PLURAL ARRAY
  xLabel?: string;
  yLabel?: string;
  [key: string]: any;
}

export interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];                // ← REQUIRED: parsed data
  config?: VisualizationConfig;
  error?: string;
}

export interface VisualizationManifest {
  version: string;
  outputs: VisualizationOutput[];
}
```

### Frontend Types

**File:** `ui/lib/visualizations/Table.tsx` (same as backend)
```typescript
// Imports and uses same interface definitions
export interface VisualizationConfig {
  xColumn?: string;
  yColumns?: string[];        // ← PLURAL ARRAY
  // ...
}
```

### Contract Reference

**File:** `api/src/output/visualization-contract.ts`
- Complete specification with examples
- All three layers' expectations
- Common violations and fixes

## How to Debug Contract Violations

### 1. Add logging at each layer

**Backend Logging:**
```typescript
// In orchestrator.ts when sending visualizations
console.log('[Orchestrator] Visualization event:', {
  hasOutputs: !!event.visualizations?.outputs,
  outputCount: event.visualizations?.outputs?.length,
  firstOutputConfig: event.visualizations?.outputs?.[0]?.config,
  firstOutputDataLength: event.visualizations?.outputs?.[0]?.data?.length
});
```

**Frontend Logging:**
```typescript
// In BarChart component
console.log('[BarChart] Received:', {
  hasData: !!data,
  configKeys: Object.keys(config || {}),
  yColumnsType: typeof config?.yColumns,
  yColumnsIsArray: Array.isArray(config?.yColumns)
});
```

### 2. Check browser console for frontend errors

Open Developer Tools (F12) and look for:
- ❌ "yColumns must be array"
- ❌ "Error: Bar chart requires data"
- ✅ "[BarChart] Received:" logs showing actual structure

### 3. Check server console for backend errors

Look for:
- ❌ "[PythonExecutionTool] Data parsing errors"
- ❌ "[Orchestrator] Error parsing visualization"
- ✅ "[Orchestrator] Including visualization data in event"

## Summary

| Layer | Input | Output | Contract |
|-------|-------|--------|----------|
| **Python** | LLM request | CSV + manifest JSON with `yColumns: []` | python-execution.ts docs (mandatory format) |
| **API** | manifest.json + CSV files | VisualizationManifest with `data: []` (no `dataFile`) | api/src/types.ts (TypeScript interfaces) |
| **Frontend** | VisualizationManifest | Rendered charts | ui/lib/visualizations/Table.tsx (interfaces) |

**The contract is enforced by:**
1. TypeScript interfaces (compile-time)
2. Runtime validation (component error messages)
3. Documentation (this file + code comments)
4. Logging (trace data through system)

**Breaking the contract = system breaks.** Always validate data structure at layer boundaries.
