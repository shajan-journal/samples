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
  tool_calls?: Array<{  // For assistant messages that call tools (OpenAI format)
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
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
  errorType?: 'syntax' | 'runtime' | 'timeout' | 'validation' | 'logical';
  errorDetails?: {
    message: string;
    lineNumber?: number;
    stackTrace?: string;
  };
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
  iterationState?: IterationState;
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
  messages?: Message[];  // Conversation history for multi-turn interactions
  workspaceDir?: string;  // Directory for file operations and visualization generation
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
// IMPORTANT: These types implement the Visualization Contract.
// See src/output/visualization-contract.ts for the complete specification.

export interface VisualizationConfig {
  // For tables
  columns?: string[];
  maxRows?: number;
  
  // For charts - PLURAL FORM (arrays)
  // NOTE: Python code must use yColumns (plural), not yColumn (singular)
  xColumn?: string;           // Column name for X-axis
  yColumns?: string[];        // PLURAL - array of column names for Y-axis
  xLabel?: string;            // X-axis label
  yLabel?: string;            // Y-axis label
  groupBy?: string;           // Group by column
  
  // For pie charts
  labelColumn?: string;
  valueColumn?: string;
  
  // Allow extension for specific chart types
  [key: string]: any;
}

export interface VisualizationOutput {
  id: string;
  type: 'table' | 'line_chart' | 'bar_chart' | 'scatter' | 'pie_chart';
  title?: string;
  data: any[];                // REQUIRED: Parsed CSV/JSON data (NOT dataFile reference)
  config?: VisualizationConfig;
  error?: string;             // Optional error from processing
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

// ============================================================================
// Iteration and Validation Types (for Self-Correcting Patterns)
// ============================================================================

export interface IterationState {
  attemptNumber: number;
  maxAttempts: number;
  previousAttempts: AttemptHistory[];
  converged: boolean;
  startTime: number;
}

export interface AttemptHistory {
  attemptNumber: number;
  code?: string;
  result?: ToolResult;
  error?: string;
  timestamp: number;
  duration?: number;
}

export interface ValidationResult extends CapabilityResult {
  isValid: boolean;
  validationIssues: string[];
  suggestedFixes: string[];
}

export interface ValidationCriteria {
  expectedOutput?: string;
  outputPattern?: RegExp;
  shouldNotContain?: string[];
  customValidator?: (output: string) => boolean;
  allowPartialMatch?: boolean;
}

export interface ValidationMetrics {
  passed: boolean;
  score?: number;
  criteria: string[];
  failures: string[];
  details?: Record<string, any>;
}

export interface ToolExecutionContext {
  toolName: string;
  attempt: number;
  parentCapability?: string;
  timestamp: number;
  parentPattern?: string;
}
