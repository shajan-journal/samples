'use client';

import React from 'react';
import { TableView, VisualizationOutput, VisualizationManifest } from './Table';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { ScatterChart } from './ScatterChart';
import { PieChart } from './PieChart';

/**
 * Main visualization renderer component
 * Dispatches to appropriate visualization component based on type
 */
export function VisualizationRenderer({ manifest }: { manifest: VisualizationManifest }) {
  console.log('[VisualizationRenderer] Received manifest:', manifest);
  
  if (!manifest || !manifest.outputs || manifest.outputs.length === 0) {
    console.warn('[VisualizationRenderer] Invalid manifest or no outputs');
    return null;
  }
  
  return (
    <div className="visualizations-container">
      {manifest.outputs.map((output) => (
        <SingleVisualization key={output.id} output={output} />
      ))}
    </div>
  );
}

/**
 * Render a single visualization based on its type
 */
function SingleVisualization({ output }: { output: VisualizationOutput }) {
  try {
    switch (output.type) {
      case 'table':
        return <TableView output={output} />;
      
      case 'line_chart':
        return <LineChart output={output} />;
      
      case 'bar_chart':
        return <BarChart output={output} />;
      
      case 'scatter':
        return <ScatterChart output={output} />;
      
      case 'pie_chart':
        return <PieChart output={output} />;
      
      default:
        return (
          <div className="my-4 p-4 border border-yellow-300 rounded-lg bg-yellow-50">
            <p className="text-yellow-700">
              Unsupported visualization type: {output.type}
            </p>
          </div>
        );
    }
  } catch (error) {
    console.error('Error rendering visualization:', error);
    return (
      <div className="my-4 p-4 border border-red-300 rounded-lg bg-red-50">
        <p className="text-red-700">
          Error rendering visualization: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }
}

// Export all types for convenience
export type { VisualizationOutput, VisualizationManifest };
