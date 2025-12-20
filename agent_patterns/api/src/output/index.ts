/**
 * Output adapters for formatting execution events
 */

export { OutputAdapter, BaseOutputAdapter } from './base';
export { APIAdapter, APIOutput } from './api-adapter';
export { TerminalAdapter } from './terminal-adapter';
export { MarkdownAdapter } from './markdown-adapter';
export { OutputAdapterRegistry, outputAdapterRegistry } from './registry';
