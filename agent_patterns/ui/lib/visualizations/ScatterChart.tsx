'use client';

import React from 'react';
import { ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualizationOutput } from './Table';

/**
 * Scatter chart visualization component
 */
export function ScatterChart({ output }: { output: VisualizationOutput }) {
  const { data, config, title } = output;
  
  if (!config?.yColumn) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">Error: Scatter chart requires yColumn configuration</p>
      </div>
    );
  }
  
  const xColumn = config.xColumn || Object.keys(data[0])[0];
  const yColumn = Array.isArray(config.yColumn) ? config.yColumn[0] : config.yColumn;
  
  return (
    <div className="my-4 border border-gray-300 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-100 px-4 py-2 font-semibold border-b border-gray-300">
          {title}
        </div>
      )}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
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
