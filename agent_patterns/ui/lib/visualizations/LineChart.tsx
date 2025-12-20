'use client';

import React from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualizationOutput } from './Table';

/**
 * Line chart visualization component
 * 
 * Expected config structure (per Visualization Contract):
 * {
 *   xColumn: string,           // Column name for X-axis
 *   yColumns: string[],        // PLURAL - array of column names for Y-axis
 *   xLabel?: string,
 *   yLabel?: string
 * }
 */
export function LineChart({ output }: { output: VisualizationOutput }) {
  const { data, config, title } = output;
  
  if (!data || !config) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">Error: Line chart requires data and configuration</p>
      </div>
    );
  }

  if (!config.yColumns || !Array.isArray(config.yColumns) || config.yColumns.length === 0) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">
          Error: Line chart requires yColumns configuration (array of column names).
          Per Visualization Contract, use yColumns (plural), not yColumn.
          Received config: {JSON.stringify(config)}
        </p>
      </div>
    );
  }
  
  const xColumn = config.xColumn || Object.keys(data[0])[0];
  const yColumns = config.yColumns;
  
  // Colors for multiple lines
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c'];
  
  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-hidden dark:border-gray-700">
      {title && (
        <div className="bg-gray-100 px-4 py-2 font-semibold border-b border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
          {title}
        </div>
      )}
      <div className="p-4 bg-white dark:bg-gray-900">
        <ResponsiveContainer width="100%" height={400}>
          <RechartsLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={xColumn} 
              label={{ value: config.xLabel || xColumn, position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              label={{ value: config.yLabel || 'Value', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Legend />
            {yColumns.map((yCol, idx) => (
              <Line 
                key={yCol}
                type="monotone" 
                dataKey={yCol} 
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
