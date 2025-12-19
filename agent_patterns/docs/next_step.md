# Next Implementation Phase: Visualization Support

## Overview

Implement visualization support to complete the core scenario - code generation → data analysis → visualization. This enables the agent to generate Python code that produces interactive charts and tables visible in the UI.

## Rationale

**Why Visualization is the Priority:**
1. **Completes the core scenario** - All pieces exist (code execution, validation, refinement), but output is text-only
2. **High demo value** - "Generate Python code to analyze data and show me a chart" is compelling
3. **Clear scope** - Visualization manifest format already defined in scenario.md
4. **Enables use cases** - All data analysis scenarios expect visualization output
5. **Self-contained** - Doesn't require other capabilities; works with existing patterns

## Implementation Plan

### Phase 1: Refactoring and Foundation (Required First)

Before implementing visualization, we need to create utility modules for clean separation of concerns and testability.

#### 1.1 Create File Parser Utility
**File:** `api/src/utils/file-parser.ts`

**Purpose:** Centralize CSV and JSON parsing with error handling

**Functionality:**
- Parse CSV files to JSON array using `csv-parse` library
- Parse JSON files with validation and error handling
- Detect file type from extension
- Validate parsed data structure
- Handle encoding issues

**Interface:**
```typescript
export interface ParsedData {
  rows: any[];
  columns: string[];
  rowCount: number;
  errors?: string[];
}

export async function parseCSV(filePath: string): Promise<ParsedData>
export async function parseJSON(filePath: string): Promise<ParsedData>
export function detectFileType(filePath: string): 'csv' | 'json' | 'text' | 'unknown'
export function validateDataStructure(data: any[]): { valid: boolean; errors: string[] }
```

**Testing:**
- Parse valid CSV/JSON files
- Handle malformed files gracefully
- Test various encoding formats
- Edge cases (empty files, large files)

---

#### 1.2 Create Visualization Validator Utility
**File:** `api/src/utils/visualization-validator.ts`

**Purpose:** Validate visualization manifests and referenced data

**Functionality:**
- Validate manifest JSON schema
- Check referenced data files exist
- Verify column references exist in data
- Validate visualization type configurations
- Provide detailed error messages

**Interface:**
```typescript
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export async function validateManifest(
  manifestPath: string,
  workspaceDir: string
): Promise<{ valid: boolean; errors: ValidationError[] }>

export function validateVisualizationOutput(
  output: VisualizationOutput,
  data: ParsedData
): ValidationError[]

export function validateConfig(
  type: string,
  config: VisualizationConfig,
  columns: string[]
): ValidationError[]
```

**Testing:**
- Valid manifest passes validation
- Detect missing data files
- Catch invalid column references
- Type-specific config validation
- Handle edge cases gracefully

---

#### 1.3 Create Workspace Manager Utility
**File:** `api/src/utils/workspace-manager.ts`

**Purpose:** Centralize workspace file operations and security

**Functionality:**
- Scan directory for files matching patterns
- Resolve and validate paths (prevent traversal)
- List files with metadata (size, type, modified time)
- Clean up temporary files
- Track generated files during execution

**Interface:**
```typescript
export interface FileInfo {
  filename: string;
  path: string;
  relativePath: string;
  type: 'csv' | 'json' | 'text' | 'image' | 'other';
  size: number;
  modified: Date;
}

export class WorkspaceManager {
  constructor(baseDir: string)
  
  resolvePath(relativePath: string): string | null
  async scanFiles(pattern?: string): Promise<FileInfo[]>
  async getFileInfo(relativePath: string): Promise<FileInfo | null>
  async readFile(relativePath: string): Promise<string>
  async writeFile(relativePath: string, content: string): Promise<void>
  async deleteFile(relativePath: string): Promise<void>
  async cleanup(files: string[]): Promise<void>
}
```

**Testing:**
- Path resolution and security checks
- File scanning with various patterns
- File metadata extraction
- Cleanup functionality
- Directory traversal prevention

---

#### 1.4 Enhance PythonExecutionTool
**File:** `api/src/tools/python-execution.ts`

**Enhancements:**
- After code execution, scan workspace for generated files
- Detect `visualization_manifest.json` if present
- Parse manifest and validate it
- Parse referenced data files (CSV/JSON)
- Include parsed data in ToolResult
- Return FileOutput array with metadata
- Clean up temp files appropriately

**Changes:**
```typescript
// Add workspace manager
private workspaceManager: WorkspaceManager;

// Enhanced result
async execute(params: Record<string, any>): Promise<ToolResult> {
  // ... existing execution logic ...
  
  // After execution, scan for generated files
  const files = await this.scanGeneratedFiles();
  
  // Check for visualization manifest
  const manifest = await this.detectVisualizationManifest();
  
  // Parse data if manifest exists
  const visualizations = manifest 
    ? await this.parseVisualizations(manifest)
    : undefined;
    
  return this.success({
    stdout,
    stderr,
    returnCode: 0,
    files,
    visualizations,
    executionTime
  });
}
```

**Testing:**
- Execute code that generates CSV files
- Execute code that creates visualization manifest
- Parse manifest and data correctly
- Handle missing/malformed files
- Integration test with full workflow

---

### Phase 2: Core Visualization Implementation

#### 2.1 Update Type Definitions
**File:** `api/src/types.ts`

**Changes:**
- Ensure `VisualizationManifest` and related types are complete
- Add any missing types for data parsing
- Already mostly complete, just verify

---

#### 2.2 Enhance Orchestrator
**File:** `api/src/orchestrator/orchestrator.ts`

**Changes:**
- Detect visualization data in PatternStep metadata
- Include visualizations in ExecutionEvent
- Emit visualization events when data is available

**Flow:**
```typescript
async *executePatternSteps(...) {
  for await (const step of pattern.execute(input, context)) {
    const event = this.stepToEvent(step);
    
    // Check if step has visualization data
    if (step.metadata?.visualizations) {
      event.visualizations = step.metadata.visualizations;
    }
    
    yield event;
  }
}
```

---

#### 2.3 Update API Routes
**File:** `api/src/api/routes.ts`

**Changes:**
- Ensure SSE properly serializes visualization data
- No major changes needed (already handles arbitrary event data)

---

### Phase 3: UI Implementation

#### 3.1 Install Chart Library
**Command:** `cd ui && npm install recharts`

**Rationale:** Recharts is a React charting library built on D3, with good TypeScript support

---

#### 3.2 Create Visualization Components
**Files:**
- `ui/lib/visualizations/Table.tsx` - Table renderer
- `ui/lib/visualizations/LineChart.tsx` - Line chart
- `ui/lib/visualizations/BarChart.tsx` - Bar chart  
- `ui/lib/visualizations/ScatterChart.tsx` - Scatter plot
- `ui/lib/visualizations/PieChart.tsx` - Pie chart
- `ui/lib/visualizations/VisualizationRenderer.tsx` - Main dispatcher

**Component Structure:**
```tsx
interface VisualizationProps {
  output: VisualizationOutput;
}

export function VisualizationRenderer({ output }: VisualizationProps) {
  switch (output.type) {
    case 'table': return <TableView output={output} />;
    case 'line_chart': return <LineChart output={output} />;
    case 'bar_chart': return <BarChart output={output} />;
    // ... etc
  }
}
```

---

#### 3.3 Integrate into Chat UI
**File:** `ui/app/page.tsx`

**Changes:**
- Detect visualization events from SSE stream
- Store visualization data in state
- Render VisualizationRenderer component for each output
- Display visualizations in message timeline
- Handle loading states and errors

**UI Flow:**
```
User Message
  ↓
Assistant Reasoning Step
  ↓
Tool Call: python_execute
  ↓
[Visualization Output Here]
  ├─ Table: Revenue Data
  └─ Chart: Revenue Trend
  ↓
Assistant Final Answer
```

---

#### 3.4 Testing
**Files:**
- `ui/__tests__/visualizations/*.test.tsx` - Component tests
- Mock data for each visualization type
- Test rendering and edge cases
- Accessibility testing

---

### Phase 4: Integration and Testing

#### 4.1 End-to-End Test
Create test script that:
1. Starts API with mock LLM
2. Sends request: "Create a bar chart showing monthly revenue: Jan=10000, Feb=12000, Mar=15000"
3. Verifies Python code execution
4. Verifies manifest generation
5. Verifies data parsing
6. Verifies SSE includes visualization data
7. Verifies UI renders chart

---

#### 4.2 Manual Testing Scenarios

**Test 1: Simple Table**
- Prompt: "Create a table showing this data: Name, Age, City for 3 people"
- Verify: Table renders with correct columns and data

**Test 2: Bar Chart**
- Prompt: "Show monthly sales as a bar chart: Jan=100, Feb=150, Mar=200"
- Verify: Bar chart renders with correct axes and values

**Test 3: Line Chart**
- Prompt: "Plot temperature over time: Day1=20C, Day2=22C, Day3=25C, Day4=23C"
- Verify: Line chart shows trend correctly

**Test 4: Multiple Visualizations**
- Prompt: "Analyze quarterly revenue and show both a table and line chart"
- Verify: Both visualizations render correctly

**Test 5: Error Handling**
- Prompt: "Create a chart with invalid data"
- Verify: Graceful error message, no crash

---

### Phase 5: Documentation

#### 5.1 Update Documentation Files
- Update `architecture.md` with visualization pipeline
- Update `current_state.md` with completion status
- Update `README.md` with visualization examples
- Add code samples to `scenario.md`

#### 5.2 Example Code
Add Python code example to docs showing how to create visualizations:

```python
import json
import pandas as pd

# Create data
df = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar'],
    'revenue': [10000, 12000, 15000]
})

# Save data
df.to_csv('revenue.csv', index=False)

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

print("Visualization created successfully")
```

---

## Success Criteria

### Functionality
- ✅ PythonExecutionTool detects and parses visualization manifests
- ✅ Data files (CSV/JSON) are parsed correctly
- ✅ Visualization data flows through orchestrator to API
- ✅ SSE streams visualization events to UI
- ✅ UI renders all 5 visualization types (table, line, bar, scatter, pie)
- ✅ Error handling works gracefully at each layer

### Testing
- ✅ Unit tests for all utility modules (file-parser, visualization-validator, workspace-manager)
- ✅ Integration tests for PythonExecutionTool with visualizations
- ✅ Component tests for all visualization renderers
- ✅ End-to-end test covering full pipeline
- ✅ Manual testing of all test scenarios passes

### Documentation
- ✅ Architecture diagram updated with visualization flow
- ✅ README includes visualization examples
- ✅ Code samples demonstrate manifest creation
- ✅ current_state.md reflects completion

---

## Fast-Follow Enhancements (After Basic Visualization)

### 1. WebFetch Tool
Enable downloading data from URLs:
- HTTP GET requests with timeout
- JSON and text response parsing
- Content-type handling
- Size limits for security

### 2. Additional Capabilities
- **PlanningCapability** - Structured task breakdown
- **ReflectionCapability** - Analyze and learn from actions
- **MemoryCapability** - Context persistence across sessions

### 3. Additional Patterns
- **Reflection Pattern** - Generate → Critique → Refine
- **Chain-of-Thought** - Explicit reasoning steps
- **Tree-of-Thoughts** - Parallel path exploration

### 4. Advanced Visualization Features
- Export visualizations as images
- Interactive tooltips and zoom
- Custom color schemes
- Responsive sizing
- Download as CSV/JSON

---

## Implementation Order Summary

**Week 1: Foundation**
1. Day 1-2: Create utility modules (file-parser, visualization-validator, workspace-manager)
2. Day 3: Enhance PythonExecutionTool with file scanning and manifest parsing
3. Day 4: Write comprehensive tests for all utilities
4. Day 5: Update orchestrator and API for visualization events

**Week 2: UI and Integration**
1. Day 1-2: Create visualization components (Table, Charts)
2. Day 3: Integrate into chat UI with SSE handling
3. Day 4: End-to-end integration testing
4. Day 5: Documentation and manual testing

**Total Estimated Time:** 10 days

---

## Risk Mitigation

**Risk:** CSV parsing library issues
- **Mitigation:** Use well-tested library (csv-parse), extensive error handling

**Risk:** Large data files cause performance issues
- **Mitigation:** Add size limits, pagination for tables, data sampling for charts

**Risk:** Manifest parsing failures
- **Mitigation:** Comprehensive validation, graceful fallbacks, detailed error messages

**Risk:** UI rendering bugs with edge cases
- **Mitigation:** Extensive testing with mock data, error boundaries in React

**Risk:** Security issues with file access
- **Mitigation:** WorkspaceManager enforces path validation, sandboxed workspace directory

---

## Dependencies

**Backend:**
- `csv-parse` - CSV parsing (install: `cd api && npm install csv-parse`)
- Existing: `fs`, `path`, `child_process`

**Frontend:**
- `recharts` - Charting library (install: `cd ui && npm install recharts`)
- Existing: `react`, `next.js`

**No Breaking Changes:**
- All changes are additive
- Existing functionality remains unchanged
- Backward compatible with non-visualization workflows

---

## Conclusion

This implementation plan provides a clear, testable path to adding visualization support. The refactoring phase ensures clean architecture, while the phased approach allows for iterative validation. Upon completion, the system will support the full data analysis and visualization scenario described in the PRD.
