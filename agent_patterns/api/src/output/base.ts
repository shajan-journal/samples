/**
 * Output Adapter Interface
 * 
 * Transforms ExecutionEvents into different output formats
 * without requiring additional LLM calls.
 */

import { ExecutionEvent } from '../types';

export interface OutputAdapter {
  /**
   * Transform execution events into the target format
   */
  format(events: ExecutionEvent[]): any;
  
  /**
   * Check if this adapter supports the given target
   */
  supports(target: string): boolean;
}

/**
 * Base adapter with common utility methods
 */
export abstract class BaseOutputAdapter implements OutputAdapter {
  abstract format(events: ExecutionEvent[]): any;
  abstract supports(target: string): boolean;

  /**
   * Extract the final answer from events
   */
  protected extractFinalAnswer(events: ExecutionEvent[]): string | null {
    // Look for answer step type first
    const answerEvent = events
      .filter(e => e.eventType === 'step')
      .reverse()
      .find(e => e.data.type === 'answer');
    
    if (answerEvent) {
      return answerEvent.data.content;
    }

    // Fall back to last result before complete
    const completeIndex = events.findIndex(e => e.eventType === 'complete');
    const beforeComplete = completeIndex >= 0 ? events.slice(0, completeIndex) : events;
    
    const resultEvent = beforeComplete
      .filter(e => e.eventType === 'step')
      .reverse()
      .find(e => e.data.type === 'result');
    
    return resultEvent?.data.content || null;
  }

  /**
   * Extract all tools used during execution
   */
  protected extractToolsUsed(events: ExecutionEvent[]): string[] {
    const tools = new Set<string>();
    
    events
      .filter(e => e.eventType === 'step' && e.data.type === 'tool_call')
      .forEach(e => {
        if (e.data.tool) {
          tools.add(e.data.tool);
        }
      });
    
    return Array.from(tools);
  }

  /**
   * Extract visualizations from events
   */
  protected extractVisualizations(events: ExecutionEvent[]): any[] {
    return events
      .filter(e => e.visualizations)
      .map(e => e.visualizations);
  }

  /**
   * Extract pattern name from start event
   */
  protected extractPattern(events: ExecutionEvent[]): string | null {
    const startEvent = events.find(e => e.eventType === 'start');
    return startEvent?.data?.pattern || null;
  }

  /**
   * Calculate execution duration
   */
  protected extractDuration(events: ExecutionEvent[]): number | null {
    if (events.length < 2) return null;
    
    const startEvent = events.find(e => e.eventType === 'start');
    const endEvent = events.find(e => 
      e.eventType === 'complete' || e.eventType === 'error'
    );
    
    if (!startEvent || !endEvent) return null;
    
    return endEvent.timestamp - startEvent.timestamp;
  }

  /**
   * Check if execution was successful
   */
  protected isSuccessful(events: ExecutionEvent[]): boolean {
    const hasErrors = events.some(e => e.eventType === 'error');
    const hasComplete = events.some(e => e.eventType === 'complete');
    
    return !hasErrors && hasComplete;
  }

  /**
   * Extract capabilities used
   */
  protected extractCapabilities(events: ExecutionEvent[]): string[] {
    const capabilities = new Set<string>();
    
    events
      .filter(e => e.eventType === 'step' && e.data.type === 'capability')
      .forEach(e => {
        if (e.data.capability) {
          capabilities.add(e.data.capability);
        }
      });
    
    return Array.from(capabilities);
  }

  /**
   * Extract errors
   */
  protected extractErrors(events: ExecutionEvent[]): any[] {
    return events
      .filter(e => e.eventType === 'error')
      .map(e => e.data);
  }
}
