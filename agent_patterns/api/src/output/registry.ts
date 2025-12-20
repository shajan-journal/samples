/**
 * Output Adapter Registry
 * 
 * Manages and selects appropriate output adapters
 */

import { OutputAdapter } from './base';
import { APIAdapter } from './api-adapter';
import { TerminalAdapter } from './terminal-adapter';
import { MarkdownAdapter } from './markdown-adapter';

export class OutputAdapterRegistry {
  private adapters: OutputAdapter[] = [];
  private defaultAdapter: OutputAdapter;

  constructor() {
    // Register default adapters
    this.register(new APIAdapter());
    this.register(new TerminalAdapter());
    this.register(new MarkdownAdapter());
    
    // API is default
    this.defaultAdapter = this.adapters[0];
  }

  /**
   * Register a new output adapter
   */
  register(adapter: OutputAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Get adapter for the specified target format
   */
  get(target: string): OutputAdapter {
    const adapter = this.adapters.find(a => a.supports(target));
    
    if (!adapter) {
      console.warn(`No adapter found for target '${target}', using default`);
      return this.defaultAdapter;
    }
    
    return adapter;
  }

  /**
   * Get all registered adapters
   */
  getAll(): OutputAdapter[] {
    return [...this.adapters];
  }

  /**
   * Get all supported format names
   */
  getSupportedFormats(): string[] {
    const formats = new Set<string>();
    
    // Common format names to test
    const testFormats = ['api', 'json', 'terminal', 'cli', 'text', 'markdown', 'md', 'web'];
    
    testFormats.forEach(format => {
      if (this.adapters.some(a => a.supports(format))) {
        formats.add(format);
      }
    });
    
    return Array.from(formats);
  }
}

// Singleton instance
export const outputAdapterRegistry = new OutputAdapterRegistry();
