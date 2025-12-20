/**
 * Markdown Output Adapter
 * 
 * Formats execution events as Markdown suitable for web UIs and documentation
 */

import { BaseOutputAdapter } from './base';
import { ExecutionEvent } from '../types';

export class MarkdownAdapter extends BaseOutputAdapter {
  supports(target: string): boolean {
    return target === 'markdown' || target === 'md' || target === 'web';
  }

  format(events: ExecutionEvent[]): string {
    const lines: string[] = [];
    const answer = this.extractFinalAnswer(events);
    const tools = this.extractToolsUsed(events);
    const capabilities = this.extractCapabilities(events);
    const duration = this.extractDuration(events);
    const errors = this.extractErrors(events);
    const visualizations = this.extractVisualizations(events);

    // Main answer
    lines.push('## Response\n');
    if (answer) {
      lines.push(answer + '\n');
    } else {
      lines.push('*No response generated*\n');
    }

    // Execution details
    if (tools.length > 0 || capabilities.length > 0 || duration !== null) {
      lines.push('### Execution Details\n');
      
      if (tools.length > 0) {
        lines.push('**Tools Used:**');
        tools.forEach(tool => lines.push(`- \`${tool}\``));
        lines.push('');
      }
      
      if (capabilities.length > 0) {
        lines.push('**Capabilities:**');
        capabilities.forEach(cap => lines.push(`- ${cap}`));
        lines.push('');
      }
      
      if (duration !== null) {
        lines.push(`**Duration:** ${(duration / 1000).toFixed(2)}s\n`);
      }
    }

    // Visualizations
    if (visualizations.length > 0) {
      lines.push('### Visualizations\n');
      lines.push(`${visualizations.length} visualization(s) generated\n`);
    }

    // Errors
    if (errors.length > 0) {
      lines.push('### Errors\n');
      errors.forEach(err => {
        lines.push(`⚠️ ${err.error || JSON.stringify(err)}\n`);
      });
    }

    return lines.join('\n');
  }
}
