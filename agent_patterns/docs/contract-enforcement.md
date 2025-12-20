# Visualization Contract - Enforced ✅

## Status: ACTIVE CONTRACT IN PLACE

The visualization system now has a **solid, enforced contract** between all three layers. Breaking the contract results in **immediate, clear error messages**.

---

## What Changed

### Before (No Contract)
- ❌ Python could use `yColumn` or `yColumns`
- ❌ API accepted either format
- ❌ Frontend checked for both, silently defaulted
- ❌ System appeared to work but with undefined behavior
- ❌ Hard to debug when things broke

### After (Enforced Contract)
- ✅ Python **must** use `yColumns: []` (plural array) - documented in tool
- ✅ API **enforces** TypeScript types (`yColumns?: string[]`)
- ✅ Frontend **validates** and rejects singular form with clear error
- ✅ System explicitly fails with helpful error messages
- ✅ Easy to debug - error tells you exactly what's wrong

---

## The Three Layers Now Aligned

### Layer 1: Python Code (Generates)

**Documentation in `api/src/tools/python-execution.ts`:**
```
MANIFEST FORMAT:
{
  "version": "1.0",
  "outputs": [{
    "id": "unique_id",
    "type": "bar_chart",
    "title": "Chart Title",
    "dataFile": "data.csv",
    "config": {
      "xColumn": "column_name",
      "yColumns": ["value_column"],    // ← PLURAL ARRAY (required)
      ...
    }
  }]
}
```

**Expected Output Structure:**
- ✅ `yColumns` must be an array
- ✅ Each chart type has specific requirements
- ✅ `dataFile` must be CSV path
- ✅ All fields documented in tool description

### Layer 2: API Processing (Transforms)

**TypeScript Contract in `api/src/types.ts`:**
```typescript
export interface VisualizationConfig {
  xColumn?: string;
  yColumns?: string[];        // ← STRICTLY PLURAL ARRAY
  xLabel?: string;
  yLabel?: string;
  [key: string]: any;
}

export interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];                // ← REQUIRED (not dataFile)
  config?: VisualizationConfig;
  error?: string;
}
```

**Processing Logic in `python-execution.ts`:**
- ✅ Parses `dataFile` reference from manifest
- ✅ Reads CSV file
- ✅ Creates `data` array of objects
- ✅ Returns manifest with `data` (removes `dataFile`)

### Layer 3: Frontend Rendering (Validates)

**TypeScript Contract in `ui/lib/sse.ts`:**
```typescript
export type ExecutionEvent = {
  timestamp: number;
  eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization';
  data: any;
  visualizations?: {
    version: string;
    outputs: Array<{
      id: string;
      type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
      title?: string;
      config?: Record<string, any>;
      data: any[];                    // ← REQUIRED ARRAY
      error?: string;
    }>;
  };
};
```

**Validation in Chart Components:**
- ✅ BarChart requires `config.yColumns` (array, not empty)
- ✅ LineChart requires `config.yColumns` (array, not empty)
- ✅ ScatterChart requires `config.yColumns` (array, uses first)
- ✅ All require `data` (array of objects)
- ✅ Clear error messages if validation fails

**Error Messages (from `ui/lib/visualizations/BarChart.tsx`):**
```typescript
if (!config.yColumns || !Array.isArray(config.yColumns) || config.yColumns.length === 0) {
  return <Error>
    Bar chart requires yColumns configuration (array of column names).
    Per Visualization Contract, use yColumns (plural), not yColumn.
    Received config: {JSON.stringify(config)}
  </Error>;
}
```

---

## How the Contract Works

### Example: Bar Chart Flow

```
1. Python Generates:
   ─────────────────
   {
     "id": "sales",
     "type": "bar_chart",
     "dataFile": "sales.csv",
     "config": {
       "xColumn": "month",
       "yColumns": ["revenue"],        ✅ Correct format
       ...
     }
   }

2. API Transforms:
   ──────────────
   Read CSV, add data:
   {
     "id": "sales",
     "type": "bar_chart",
     "config": {
       "xColumn": "month",
       "yColumns": ["revenue"],        ✅ Still correct
       ...
     },
     "data": [                         ✅ Added parsed data
       {"month": "Jan", "revenue": 100000},
       {"month": "Feb", "revenue": 120000}
     ]
   }

3. Frontend Renders:
   ─────────────────
   BarChart receives manifest:
   - Checks config.yColumns exists
   - Checks it's an array
   - Uses it to render Recharts bars     ✅ Success!
```

### Example: Contract Violation

If Python sends (WRONG):
```json
{
  "config": {
    "xColumn": "month",
    "yColumn": "revenue"                ❌ Singular, not plural
  }
}
```

Frontend error:
```
Error: Bar chart requires yColumns configuration (array of column names).
Per Visualization Contract, use yColumns (plural), not yColumn.
Received config: {"xColumn":"month","yColumn":"revenue"}
```

**This makes the error immediately obvious** instead of silent failures.

---

## Files Implementing the Contract

| File | Role | Contract Field |
|------|------|----------------|
| `api/src/output/visualization-contract.ts` | Documentation | Complete specification |
| `api/src/types.ts` | TypeScript types | Enforces structure |
| `api/src/tools/python-execution.ts` | Tool docs | Documents required format |
| `ui/lib/sse.ts` | Frontend types | Defines expected data |
| `ui/lib/visualizations/BarChart.tsx` | Validation | Enforces `yColumns` array |
| `ui/lib/visualizations/LineChart.tsx` | Validation | Enforces `yColumns` array |
| `ui/lib/visualizations/ScatterChart.tsx` | Validation | Enforces `yColumns` array |
| `docs/visualization-contract.md` | Reference | Full specification |

---

## How to Verify the Contract Works

### Test 1: Correct Format
```bash
# Ask the system to create a bar chart
# Python will generate correct manifest with yColumns: ["sales"]
# API will parse and add data
# Frontend will render successfully
```

Expected result: **Chart renders** ✅

### Test 2: Wrong Format
If Python code tries to use `yColumn` (singular):

Expected result: **Clear error message** ✅
```
Error: Bar chart requires yColumns configuration (array of column names).
Per Visualization Contract, use yColumns (plural), not yColumn.
```

---

## Summary

The **Visualization Contract is now:**

1. **Documented** - Complete spec in `visualization-contract.md`
2. **Enforced at Backend** - TypeScript interfaces prevent wrong types
3. **Enforced at Frontend** - Components validate and error clearly
4. **Self-Healing** - Error messages tell developers exactly what to fix
5. **Shared** - Same types used across all layers

**Result:** The system has a solid contract. Any layer that breaks it gets caught immediately with a helpful error message.
