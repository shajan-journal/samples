/**
 * API Output Adapter
 * 
 * Formats execution events as structured JSON suitable for API responses
 */

import { BaseOutputAdapter } from './base';
import { ExecutionEvent } from '../types';

export interface APIOutput {
  answer: string | null;
  metadata: {
    pattern: string | null;
    tools: string[];
    capabilities: string[];
    visualizations: any[];
    duration: number | null;
  };
  success: boolean;
  errors: any[];
}

export class APIAdapter extends BaseOutputAdapter {
  supports(target: string): boolean {
    return target === 'api' || target === 'json';
  }

  format(events: ExecutionEvent[]): APIOutput {
    return {
      answer: this.extractFinalAnswer(events),
      metadata: {
        pattern: this.extractPattern(events),
        tools: this.extractToolsUsed(events),
        capabilities: this.extractCapabilities(events),
        visualizations: this.extractVisualizations(events),
        duration: this.extractDuration(events)
      },
      success: this.isSuccessful(events),
      errors: this.extractErrors(events)
    };
  }
}
