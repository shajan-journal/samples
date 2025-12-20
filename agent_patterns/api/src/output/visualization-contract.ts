/**
 * Visualization Contract - SINGLE SOURCE OF TRUTH
 * 
 * This interface defines the exact structure that:
 * 1. Python code GENERATES (in visualization_manifest.json)
 * 2. API PROCESSES and RETURNS
 * 3. Frontend EXPECTS and RENDERS
 * 
 * All layers must conform to this contract.
 */

/**
 * Configuration for a visualization
 * Defines what data columns to use and how to label axes
 */
export interface VisualizationConfig {
  // Column names
  xColumn?: string;           // For charts with X-axis (bar, line, scatter)
  yColumns?: string[];        // For charts with Y-axis (bar, line, scatter) - PLURAL
  labelColumn?: string;       // For pie/donut charts
  valueColumn?: string;       // For pie/donut charts
  
  // Labels
  xLabel?: string;            // X-axis label
  yLabel?: string;            // Y-axis label
  
  // Additional options
  [key: string]: any;         // Allow extension for specific chart types
}

/**
 * A single data row (object with column values)
 */
export type DataRow = Record<string, any>;

/**
 * Output definition for a single visualization
 * This is what gets rendered by the frontend
 */
export interface VisualizationOutput {
  id: string;                           // Unique identifier
  type: 'table' | 'bar_chart' | 'line_chart' | 'scatter' | 'pie_chart';
  title: string;                        // Display title
  config: VisualizationConfig;          // Configuration for rendering
  data: DataRow[];                      // REQUIRED: Parsed data array (not file reference)
  error?: string;                       // Optional error message if processing failed
}

/**
 * Complete visualization manifest
 * This is the top-level structure returned by the API
 */
export interface VisualizationManifest {
  version: string;                      // Format version (e.g., "1.0")
  outputs: VisualizationOutput[];        // Array of visualizations
}

/**
 * PYTHON CODE CONTRACT
 * =====================
 * 
 * Python code must generate this structure in visualization_manifest.json:
 * 
 * {
 *   "version": "1.0",
 *   "outputs": [
 *     {
 *       "id": "unique_id",
 *       "type": "bar_chart",          // Must be one of the allowed types
 *       "title": "Chart Title",
 *       "config": {
 *         "xColumn": "month",
 *         "yColumns": ["sales"],      // NOTE: PLURAL, array format
 *         "xLabel": "Month",
 *         "yLabel": "Sales ($)"
 *       },
 *       "dataFile": "data.csv"        // Reference to CSV file with data
 *     }
 *   ]
 * }
 * 
 * And also create the data file (CSV) with actual data.
 * 
 * IMPORTANT: Use yColumns (plural array), not yColumn
 */

/**
 * API PROCESSING CONTRACT
 * =======================
 * 
 * 1. Receive visualization_manifest.json
 * 2. For each output with dataFile:
 *    - Read the CSV file
 *    - Parse into array of objects
 *    - Add `data` field to output
 *    - REMOVE `dataFile` field (no longer needed)
 * 3. Return: VisualizationManifest where all outputs have `data` (not `dataFile`)
 * 
 * Before returning to frontend, verify:
 * - All outputs have `data` (not `dataFile`)
 * - All outputs have required fields: id, type, title, config, data
 * - Config has required fields for chart type
 */

/**
 * FRONTEND RENDERING CONTRACT
 * ============================
 * 
 * VisualizationRenderer receives VisualizationManifest and:
 * 1. Iterates outputs
 * 2. Dispatches to correct component (BarChart, LineChart, etc.) based on `type`
 * 3. Each component receives: { id, type, title, config, data }
 * 4. Components use `data` array and `config` to render with Recharts
 * 
 * Validation:
 * - Must have `data` (array of objects), not `dataFile`
 * - Config must have required fields for chart type:
 *   - bar_chart: xColumn, yColumns (array)
 *   - line_chart: xColumn, yColumns (array)
 *   - scatter: xColumn, yColumns (array)
 *   - pie_chart: labelColumn, valueColumn
 */

/**
 * EXAMPLE: Complete flow for bar chart
 * =====================================
 * 
 * PYTHON GENERATES:
 * {
 *   "version": "1.0",
 *   "outputs": [{
 *     "id": "sales_2024",
 *     "type": "bar_chart",
 *     "title": "Q1 2024 Sales",
 *     "config": {
 *       "xColumn": "month",
 *       "yColumns": ["sales"],
 *       "xLabel": "Month",
 *       "yLabel": "Sales ($)"
 *     },
 *     "dataFile": "sales_data.csv"
 *   }]
 * }
 * 
 * CSV FILE (sales_data.csv):
 * month,sales
 * January,45000
 * February,52000
 * March,48000
 * 
 * API TRANSFORMS TO:
 * {
 *   "version": "1.0",
 *   "outputs": [{
 *     "id": "sales_2024",
 *     "type": "bar_chart",
 *     "title": "Q1 2024 Sales",
 *     "config": {
 *       "xColumn": "month",
 *       "yColumns": ["sales"],
 *       "xLabel": "Month",
 *       "yLabel": "Sales ($)"
 *     },
 *     "data": [
 *       { "month": "January", "sales": 45000 },
 *       { "month": "February", "sales": 52000 },
 *       { "month": "March", "sales": 48000 }
 *     ]
 *   }]
 * }
 * 
 * FRONTEND RENDERS:
 * - Receives manifest with data array
 * - BarChart component iterates `data`
 * - Uses `config.xColumn` and `config.yColumns` to map data
 * - Recharts renders bars
 */
