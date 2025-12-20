'use client';

import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualizationOutput } from './Table';

/**
 * Pie chart visualization component
 */
export function PieChart({ output }: { output: VisualizationOutput }) {
  const { data, config, title } = output;
  
  if (!config?.labelColumn || !config?.valueColumn) {
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">Error: Pie chart requires labelColumn and valueColumn configuration</p>
      </div>
    );
  }
  
  // Transform data for recharts pie chart
  const pieData = data.map(row => ({
    name: row[config.labelColumn!],
    value: Number(row[config.valueColumn!])
  }));
  
  // Colors for pie slices
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
  
  return (
    <div className="my-4 border border-gray-300 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-100 px-4 py-2 font-semibold border-b border-gray-300">
          {title}
        </div>
      )}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <RechartsPieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name}: ${entry.value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
