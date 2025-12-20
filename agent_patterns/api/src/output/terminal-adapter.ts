/**
 * Terminal Output Adapter
 * 
 * Formats execution events as plain text suitable for terminal/CLI display
 */

import { BaseOutputAdapter } from './base';
import { ExecutionEvent } from '../types';

export class TerminalAdapter extends BaseOutputAdapter {
  supports(target: string): boolean {
    return target === 'terminal' || target === 'cli' || target === 'text';
  }

  format(events: ExecutionEvent[]): string {
    const lines: string[] = [];
    const answer = this.extractFinalAnswer(events);
    const tools = this.extractToolsUsed(events);
    const errors = this.extractErrors(events);
    const visualizations = this.extractVisualizations(events);

    // Add answer
    if (answer) {
      lines.push(answer);
    }

    // Add tool usage if any
    if (tools.length > 0) {
      lines.push('');
      lines.push(`[Tools used: ${tools.join(', ')}]`);
    }

    // Add visualization notice
    if (visualizations.length > 0) {
      lines.push(`[${visualizations.length} visualization(s) generated]`);
    }

    // Add errors if any
    if (errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      errors.forEach(err => {
        lines.push(`  - ${err.error || JSON.stringify(err)}`);
      });
    }

    return lines.join('\n');
  }
}
