# Scenario: Code Generation and Execution

## Problem Statement

Generate Python code that solves user-requested data analysis and visualization tasks. The system creates, executes, and iterates on code until the problem is solved correctly.

## Target Use Cases

### 1. Data Download and Analysis
- "Download the top 100 movies from IMDB and show me the distribution by genre"
- "Get cryptocurrency prices for the last month and plot the trends"
- "Find the population of all US states and rank them"

### 2. Data Transformation
- "Load this CSV and group sales by region, showing totals"
- "Take this dataset and calculate moving averages for each column"
- "Merge these two data files on the ID column and export results"

### 3. Visualization
- "Create a bar chart showing monthly revenue growth"
- "Plot a scatter diagram of temperature vs ice cream sales"
- "Generate a heatmap of correlation between variables"

### 4. Web Scraping and Processing
- "Scrape product reviews from this URL and analyze sentiment"
- "Extract all email addresses from these web pages"
- "Download weather data and show average temperatures by month"

## Tools Available

### 1. Code Execution Tools

**NodeExecutionTool**: Executes JavaScript/Node.js code in a sandboxed vm environment.
- Quick scripting, JSON manipulation, API calls
- No external dependencies
- Built-in security via vm module

**PythonExecutionTool**: Executes Python code in an isolated virtual environment.
- Data analysis, ML, numpy/pandas work
- Full package management
- Process isolation

**Common Capabilities:**
- Create working directory for the task
- Execute code with timeout enforcement
- Capture stdout, stderr, and return code
- Return generated files (CSV, images, etc.)
- Clean up environment after execution

**Python-Specific:**
- Set up virtual environment
- Install required packages (pip install)

**Node-Specific:**
- Sandboxed vm.Script execution
- Built-in memory and timeout limits

**Interface:**
```typescript
interface CodeExecutionTool extends Tool {
  name: "node_execute" | "python_execute";
  description: "Execute Python code in isolated environment";
  parameters: {
    code: string;              // Python code to execute
    packages?: string[];       // pip packages to install
    workingDir?: string;       // Optional working directory
    timeout?: number;          // Execution timeout in seconds
  };
}

interface PythonExecutionResult extends ToolResult {
  success: boolean;
  stdout: string;              // Standard output
  stderr: string;              // Error output
  returnCode: number;          // Exit code
  files?: FileOutput[];        // Generated files
  visualizations?: VisualizationManifest;  // Visualization metadata
  executionTime: number;       // Time taken in ms
}

interface FileOutput {
  filename: string;
  path: string;
  type: 'csv' | 'image' | 'text' | 'json';
  size: number;
}
```

**Implementation Details:**
- Uses Node.js `child_process` to spawn Python
- Creates temp directory with UUID for isolation
- Runs `python -m venv` to create virtual environment
- Activates venv and installs packages
- Writes code to temp file and executes
- Monitors output streams in real-time
- Copies generated files to accessible location
- Cleans up temp directory on completion

### 2. File System Tool
Read and write files for data persistence and sharing.

**Capabilities:**
- Read file contents (CSV, JSON, TXT)
- Write data to files
- List files in directory
- Check file existence

**Interface:**
```typescript
interface FileSystemTool extends Tool {
  name: "file_system";
  parameters: {
    action: 'read' | 'write' | 'list' | 'exists';
    path: string;
    content?: string;  // For write operations
  };
}
```

### 3. Web Fetch Tool
Download content from URLs.

**Capabilities:**
- HTTP GET requests
- Parse HTML content
- Download files
- Simple rate limiting

**Interface:**
```typescript
interface WebFetchTool extends Tool {
  name: "web_fetch";
  parameters: {
    url: string;
    type?: 'html' | 'json' | 'text' | 'file';
  };
}
```

### 4. Calculator Tool
Perform mathematical calculations.

**Capabilities:**
- Basic arithmetic
- Statistical functions
- Unit conversions

### 5. Visualization Output Tool
Defines the contract for Python code to produce renderable visualizations.

**Purpose:**
Provides a standardized format for Python code to output data that the frontend can render. Python code writes a JSON manifest alongside generated files to specify how data should be displayed.

**Visualization Manifest Format:**
```typescript
interface VisualizationManifest {
  version: "1.0";
  outputs: VisualizationOutput[];
}

interface VisualizationOutput {
  id: string;                    // Unique identifier for this output
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;                // Display title
  dataFile: string;              // Path to CSV or JSON data file
  config?: VisualizationConfig;  // Type-specific configuration
}

interface VisualizationConfig {
  // For tables
  columns?: string[];            // Which columns to display
  maxRows?: number;              // Limit displayed rows
  
  // For charts
  xColumn?: string;              // X-axis data column
  yColumn?: string | string[];   // Y-axis data column(s)
  xLabel?: string;               // X-axis label
  yLabel?: string;               // Y-axis label
  groupBy?: string;              // Column to group/color by
  
  // For pie charts
  labelColumn?: string;          // Slice labels
  valueColumn?: string;          // Slice values
}
```

**Python Code Example:**
```python
import pandas as pd
import json

# Generate data
df = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar', 'Apr'],
    'revenue': [10000, 12000, 15000, 18000]
})

# Save data
df.to_csv('revenue_data.csv', index=False)

# Create visualization manifest
manifest = {
    "version": "1.0",
    "outputs": [
        {
            "id": "revenue_table",
            "type": "table",
            "title": "Monthly Revenue",
            "dataFile": "revenue_data.csv"
        },
        {
            "id": "revenue_chart",
            "type": "bar_chart",
            "title": "Revenue Trend",
            "dataFile": "revenue_data.csv",
            "config": {
                "xColumn": "month",
                "yColumn": "revenue",
                "xLabel": "Month",
                "yLabel": "Revenue ($)"
            }
        }
    ]
}

# Save manifest
with open('visualization_manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)

print("SUCCESS: Generated visualization manifest")
```

**Tool Integration:**
The Python Execution Tool automatically looks for `visualization_manifest.json` in the output directory and includes it in the result.

**Supported Visualizations:**

1. **Table** - Display tabular data with optional column filtering and row limits
2. **Line Chart** - Show trends over time or continuous data
3. **Bar Chart** - Compare categorical values
4. **Scatter Plot** - Show relationship between two variables
5. **Pie Chart** - Display proportions and percentages

**Frontend Rendering:**
- Tables: Simple HTML table with styling
- Charts: Lightweight library like Chart.js or Recharts
- All visualizations embedded inline in chat
- Support for multiple visualizations per response

## How Patterns Apply

### ReAct Pattern
```
User: "Download Bitcoin prices and plot the trend"

1. [Reason] Need to find Bitcoin price data source
2. [Act] web_fetch to get data from API
3. [Observe] Got JSON data with prices
4. [Reason] Need to parse and plot this data
5. [Act] python_execute with pandas + matplotlib code
6. [Observe] Error - pandas not installed
7. [Reason] Need to specify pandas in packages
8. [Act] python_execute with packages=['pandas', 'matplotlib']
9. [Observe] Success - generated plot.png
10. [Result] Return plot and summary
```

### Plan-and-Execute Pattern
```
User: "Analyze movie ratings by genre"

Planning Phase:
1. Find movie dataset source
2. Download the data
3. Parse and clean data
4. Group by genre
5. Calculate statistics
6. Create visualization
7. Generate summary

Execution Phase:
Step 1: web_fetch movie data
Step 2: python_execute to parse CSV
Step 3: python_execute to group and analyze
Step 4: python_execute to create chart
Step 5: Summarize findings
```

### Reflection Pattern
```
User: "Create a scatter plot of sales vs marketing spend"

Generation:
- Generate Python code with matplotlib
- Execute code

Critique:
- Plot has no title
- Axes not labeled
- No legend
- Colors not distinct

Refinement:
- Regenerate code with improvements
- Execute again
- Verify all issues addressed
```

### Tree-of-Thoughts Pattern
```
User: "Find correlation between weather and sales"

Branch 1: Use pandas correlation
- Generate code with df.corr()
- Simple but limited visualization

Branch 2: Use statistical analysis
- Generate code with scipy.stats
- More detailed p-values and confidence

Branch 3: Use ML approach
- Generate code with sklearn
- Feature importance analysis

Evaluate: Branch 2 provides best balance
Execute: Run statistical analysis approach
```

### Iterative Refinement Pattern
```
User: "Scrape product prices and compare"

Iteration 1:
- Generate basic scraping code
- Execute: Error - BeautifulSoup not found
- Fix: Add beautifulsoup4 to packages

Iteration 2:
- Execute: Error - Invalid selector
- Fix: Update CSS selectors

Iteration 3:
- Execute: Partial success - missing some data
- Fix: Add error handling and retries

Iteration 4:
- Execute: Success with complete data
- Generate comparison chart
```

### Ensemble Pattern
```
User: "Find the best way to cluster this customer data"

Agent 1: K-means clustering
- Generate k-means code
- Execute and evaluate silhouette score

Agent 2: Hierarchical clustering
- Generate dendrogram code
- Execute and evaluate

Agent 3: DBSCAN
- Generate density-based code
- Execute and evaluate

Aggregate:
- Compare metrics from all three
- Recommend best approach (K-means with k=4)
- Show comparison visualization
```

### JIT Pattern
```
User: "Download weather data and analyze patterns"

Analysis:
- Task requires data fetching + analysis + visualization
- Multiple steps with potential errors
- May need iteration
- Complexity: Medium-High

Selected Pattern: Reflection
- Generate complete code
- Execute and capture errors
- Critique the output
- Refine if needed
- Better than ReAct for this structured task
```

## Example Problems with Increasing Complexity

### Level 1: Simple Execution
**Problem**: "Calculate the sum of squares from 1 to 100"
**Tools Used**: python_execute
**Pattern**: Direct execution (no iteration needed)

### Level 2: Data Download
**Problem**: "Download JSON data from this API and show the top 5 entries"
**Tools Used**: web_fetch, python_execute
**Pattern**: ReAct (fetch, check format, process)

### Level 3: Error Recovery
**Problem**: "Load this CSV and create a bar chart by category"
**Tools Used**: file_system, python_execute
**Pattern**: Reflection (generate code, execute, fix errors, re-execute)

### Level 4: Multi-Step Analysis
**Problem**: "Download stock data, calculate moving averages, and plot trends"
**Tools Used**: web_fetch, python_execute (multiple times)
**Pattern**: Plan-and-Execute (break into steps, execute sequentially)

### Level 5: Exploration and Optimization
**Problem**: "Find the best ML model for this classification dataset"
**Tools Used**: file_system, python_execute (parallel executions)
**Pattern**: Ensemble or Tree-of-Thoughts (try multiple approaches)

## Success Criteria

### Code Generation Quality
- Syntactically correct Python code
- Appropriate libraries used
- Error handling included
- Clear variable names and comments
- Generates visualization manifest when creating tables or charts
- Uses supported visualization types from contract

### Execution Reliability
- Code runs without errors (after refinement)
- Produces expected output files
- Handles edge cases gracefully
- Completes within reasonable time

### Output Quality
- Visualizations are clear and labeled
- Data analysis is accurate
- Results directly answer user's question
- Files are in accessible format

### Pattern Effectiveness
- Simple tasks complete in 1-2 iterations
- Complex tasks show clear planning/reasoning
- Errors trigger appropriate refinement
- Pattern selection matches task complexity (for JIT)

## Technical Constraints

### Safety Considerations
- Code execution in isolated virtual environment
- Timeout limits to prevent infinite loops
- No network access from Python (only via web_fetch tool)
- No file system access outside working directory
- Limit package installation to approved list

### Performance Limits
- Max execution time: 60 seconds per code run
- Max file size: 50MB for downloads
- Max working directory size: 100MB
- Virtual environments cleaned up after use

### Package Whitelist
Common packages allowed for installation:
- pandas, numpy, scipy
- matplotlib, seaborn, plotly
- requests, beautifulsoup4
- scikit-learn
- openpyxl, csv
- json, datetime

## UI Considerations

### Main Chat View
User sees:
- Their question
- Agent's reasoning steps (simplified)
- Generated code (collapsible)
- Execution results
- Inline visualizations (tables, charts) rendered from manifest
- Other generated files (download links for CSV, etc.)

### Debug View
Developer sees:
- Full prompt sent to LLM
- Complete code generated (all iterations)
- Stdout/stderr from each execution
- Tool call parameters and responses
- Token usage per step
- Execution timing breakdown
- Virtual environment details
