'use client';

import React from 'react';
import { ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualizationOutput } from './Table';

/**
 * Scatter chart visualization component
 * 
 * Expected config structure (per Visualization Contract):
 * {
 *   xColumn: string,           // Column name for X-axis
 *   yColumns: string[],        // PLURAL - array of column names for Y-axis (uses first)
 *   xLabel?: string,
 *   yLabel?: string
 * }
 */
export function ScatterChart({ output }: { output: VisualizationOutput }) {
  const { data, config, title } = output;
  
  if (!data || !config) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">Error: Scatter chart requires data and configuration</p>
      </div>
    );
  }

  if (!config.yColumns || !Array.isArray(config.yColumns) || config.yColumns.length === 0) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">
          Error: Scatter chart requires yColumns configuration (array of column names).
          Per Visualization Contract, use yColumns (plural), not yColumn.
          Received config: {JSON.stringify(config)}
        </p>
      </div>
    );
  }
  
  const xColumn = config.xColumn || Object.keys(data[0])[0];
  // Scatter uses first Y column
  const yColumn = config.yColumns[0];
  
  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-hidden dark:border-gray-700">
      {title && (
        <div className="bg-gray-100 px-4 py-2 font-semibold border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
          {title}
        </div>
      )}
      <div className="p-4 bg-white dark:bg-gray-900">
        <ResponsiveContainer width="100%" height={400}>
          <RechartsScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number"
              dataKey={xColumn} 
              name={config.xLabel || xColumn}
              label={{ value: config.xLabel || xColumn, position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              type="number"
              dataKey={yColumn}
              name={config.yLabel || yColumn}
              label={{ value: config.yLabel || yColumn, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter 
              name={config.yLabel || yColumn}
              data={data} 
              fill="#8884d8"
            />
          </RechartsScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
