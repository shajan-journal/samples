/**
 * Core type definitions for the agentic AI patterns system
 */

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;  // For tool messages
  toolCallId?: string;  // For tool response messages
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  execute(params: Record<string, any>): Promise<ToolResult>;
}

// ============================================================================
// Capability Types
// ============================================================================

export interface AgentContext {
  messages: Message[];
  tools: Tool[];
  config: LLMConfig;
  state?: Record<string, any>;
}

export interface CapabilityResult {
  output: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  nextAction?: string;
  metadata?: Record<string, any>;
}

export interface Capability {
  name: string;
  description: string;
  execute(context: AgentContext): Promise<CapabilityResult>;
}

// ============================================================================
// LLM Provider Types
// ============================================================================

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  apiKey?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: ToolCall;
  usage?: TokenUsage;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

export interface LLMProvider {
  chat(
    messages: Message[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk>;
  
  chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk>;
}

// ============================================================================
// Pattern Types
// ============================================================================

export interface PatternStep {
  type: 'capability' | 'tool_call' | 'result' | 'info' | 'answer' | 'error';
  capability?: string;
  tool?: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export interface AgentPattern {
  name: string;
  description: string;
  execute(input: string, context: AgentContext): AsyncGenerator<PatternStep>;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

export interface ExecutionOptions {
  maxSteps?: number;
  timeout?: number;
  debug?: boolean;
  visualizations?: boolean;
}

export interface DebugInfo {
  prompt?: string;
  modelResponse?: string;
  toolCalls?: ToolCall[];
  tokens?: TokenUsage;
  latency?: number;
}

export interface ExecutionEvent {
  timestamp: number;
  eventType: 'start' | 'step' | 'complete' | 'error' | 'visualization';
  data: any;
  visualizations?: VisualizationManifest;
  debug?: DebugInfo;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface VisualizationConfig {
  // For tables
  columns?: string[];
  maxRows?: number;
  
  // For charts
  xColumn?: string;
  yColumn?: string | string[];
  xLabel?: string;
  yLabel?: string;
  groupBy?: string;
  
  // For pie charts
  labelColumn?: string;
  valueColumn?: string;
}

export interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];  // Parsed CSV/JSON data
  config?: VisualizationConfig;
}

export interface VisualizationManifest {
  version: string;
  outputs: VisualizationOutput[];
}

// ============================================================================
// File Output Types (for Python Execution Tool)
// ============================================================================

export interface FileOutput {
  filename: string;
  path: string;
  type: 'csv' | 'image' | 'text' | 'json';
  size: number;
  content?: string;  // For small text files
}

export interface PythonExecutionResult extends ToolResult {
  stdout: string;
  stderr: string;
  returnCode: number;
  files?: FileOutput[];
  visualizations?: VisualizationManifest;
  executionTime: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface ExecuteRequest {
  pattern: string;
  input: string;
  options?: ExecutionOptions;
}

export interface PatternInfo {
  name: string;
  description: string;
}

export interface CapabilityInfo {
  name: string;
  description: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
}

export interface TestToolRequest {
  toolName: string;
  params: Record<string, any>;
}
