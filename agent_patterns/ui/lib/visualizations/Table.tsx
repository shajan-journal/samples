'use client';

import React from 'react';

/**
 * Visualization output interface matching backend types
 */
export interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];
  config?: VisualizationConfig;
}

export interface VisualizationConfig {
  // For tables
  columns?: string[];
  maxRows?: number;
  
  // For charts
  xColumn?: string;
  yColumn?: string | string[];
  xLabel?: string;
  yLabel?: string;
  groupBy?: string;
  
  // For pie charts
  labelColumn?: string;
  valueColumn?: string;
}

export interface VisualizationManifest {
  version: string;
  outputs: VisualizationOutput[];
}

/**
 * Table visualization component
 */
export function TableView({ output }: { output: VisualizationOutput }) {
  const { data, config, title } = output;
  
  // Determine columns to display
  const columns = config?.columns || (data.length > 0 ? Object.keys(data[0]) : []);
  const maxRows = config?.maxRows || 100;
  const displayData = data.slice(0, maxRows);
  
  return (
    <div className="my-4 border border-gray-300 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-100 px-4 py-2 font-semibold border-b border-gray-300">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-sm text-gray-900">
                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 border-t border-gray-300">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}
