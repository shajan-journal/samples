/**
 * Type validation tests - ensures all interfaces compile correctly
 * and sample data matches expected structures
 */

import {
  Message,
  Tool,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolParameter,
  Capability,
  AgentContext,
  CapabilityResult,
  LLMConfig,
  LLMChunk,
  LLMProvider,
  TokenUsage,
  AgentPattern,
  PatternStep,
  ExecutionOptions,
  ExecutionEvent,
  DebugInfo,
  VisualizationManifest,
  VisualizationOutput,
  VisualizationConfig,
  FileOutput,
  PythonExecutionResult,
  ExecuteRequest,
  PatternInfo,
  CapabilityInfo,
  ToolInfo,
  TestToolRequest,
} from '../src/types';

describe('Type Validation Tests', () => {
  describe('Message Types', () => {
    it('should create valid user message', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello, world!',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should create valid assistant message', () => {
      const message: Message = {
        role: 'assistant',
        content: 'I can help you with that.',
      };
      expect(message.role).toBe('assistant');
    });

    it('should create valid tool message', () => {
      const message: Message = {
        role: 'tool',
        content: JSON.stringify({ result: 'success' }),
        name: 'calculator',
        toolCallId: 'call_123',
      };
      expect(message.role).toBe('tool');
      expect(message.name).toBe('calculator');
    });
  });

  describe('Tool Types', () => {
    it('should create valid tool definition', () => {
      const toolDef: ToolDefinition = {
        name: 'calculator',
        description: 'Performs mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate',
            },
          },
          required: ['expression'],
        },
      };
      expect(toolDef.name).toBe('calculator');
      expect(toolDef.parameters.required).toContain('expression');
    });

    it('should create valid tool call', () => {
      const toolCall: ToolCall = {
        id: 'call_456',
        name: 'calculator',
        arguments: { expression: '2 + 2' },
      };
      expect(toolCall.id).toBe('call_456');
      expect(toolCall.arguments.expression).toBe('2 + 2');
    });

    it('should create valid tool result - success', () => {
      const result: ToolResult = {
        success: true,
        data: { answer: 4 },
      };
      expect(result.success).toBe(true);
      expect(result.data.answer).toBe(4);
    });

    it('should create valid tool result - error', () => {
      const result: ToolResult = {
        success: false,
        error: 'Invalid expression',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid expression');
    });

    it('should create mock tool implementation', async () => {
      const mockTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Test input',
            },
          },
        },
        execute: async (params: Record<string, any>): Promise<ToolResult> => {
          return {
            success: true,
            data: { echo: params.input },
          };
        },
      };

      const result = await mockTool.execute({ input: 'test' });
      expect(result.success).toBe(true);
      expect(result.data.echo).toBe('test');
    });
  });

  describe('Capability Types', () => {
    it('should create valid agent context', () => {
      const context: AgentContext = {
        messages: [
          { role: 'user', content: 'What is 2+2?' },
        ],
        tools: [],
        config: {
          provider: 'mock',
          model: 'test-model',
          temperature: 0.7,
        },
        state: { stepCount: 0 },
      };
      expect(context.messages.length).toBe(1);
      expect(context.config.provider).toBe('mock');
    });

    it('should create valid capability result', () => {
      const result: CapabilityResult = {
        output: 'I need to calculate 2+2',
        reasoning: 'User asked for a simple arithmetic operation',
        nextAction: 'call calculator tool',
        toolCalls: [
          {
            id: 'call_789',
            name: 'calculator',
            arguments: { expression: '2+2' },
          },
        ],
      };
      expect(result.output).toContain('calculate');
      expect(result.toolCalls).toHaveLength(1);
    });

    it('should create mock capability implementation', async () => {
      const mockCapability: Capability = {
        name: 'test_capability',
        description: 'A test capability',
        execute: async (context: AgentContext): Promise<CapabilityResult> => {
          return {
            output: `Processed ${context.messages.length} messages`,
            reasoning: 'Simple test',
          };
        },
      };

      const context: AgentContext = {
        messages: [{ role: 'user', content: 'test' }],
        tools: [],
        config: { provider: 'mock', model: 'test' },
      };

      const result = await mockCapability.execute(context);
      expect(result.output).toContain('Processed 1 messages');
    });
  });

  describe('LLM Provider Types', () => {
    it('should create valid LLM config', () => {
      const config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        stream: true,
        apiKey: 'test-key',
      };
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
    });

    it('should create valid token usage', () => {
      const usage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };
      expect(usage.totalTokens).toBe(150);
    });

    it('should create valid LLM chunks', () => {
      const contentChunk: LLMChunk = {
        type: 'content',
        content: 'Hello',
      };
      expect(contentChunk.type).toBe('content');

      const toolCallChunk: LLMChunk = {
        type: 'tool_call',
        toolCall: {
          id: 'call_123',
          name: 'calculator',
          arguments: { expression: '2+2' },
        },
      };
      expect(toolCallChunk.type).toBe('tool_call');

      const doneChunk: LLMChunk = {
        type: 'done',
        finishReason: 'stop',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };
      expect(doneChunk.finishReason).toBe('stop');
    });

    it('should create mock LLM provider', async () => {
      const mockProvider: LLMProvider = {
        chat: async function* (
          messages: Message[],
          options: LLMConfig
        ): AsyncGenerator<LLMChunk> {
          yield { type: 'content', content: 'Test response' };
          yield { type: 'done', finishReason: 'stop' };
        },
        chatWithTools: async function* (
          messages: Message[],
          tools: ToolDefinition[],
          options: LLMConfig
        ): AsyncGenerator<LLMChunk> {
          yield { type: 'content', content: 'Using tools' };
          yield { type: 'done', finishReason: 'stop' };
        },
      };

      const chunks: LLMChunk[] = [];
      for await (const chunk of mockProvider.chat(
        [{ role: 'user', content: 'test' }],
        { provider: 'mock', model: 'test' }
      )) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0].type).toBe('content');
    });
  });

  describe('Pattern Types', () => {
    it('should create valid pattern steps', () => {
      const capabilityStep: PatternStep = {
        type: 'capability',
        capability: 'reasoning',
        content: 'Analyzing the problem...',
        timestamp: Date.now(),
      };
      expect(capabilityStep.type).toBe('capability');

      const toolStep: PatternStep = {
        type: 'tool_call',
        tool: 'calculator',
        content: 'Calling calculator',
        metadata: { params: { expression: '2+2' } },
      };
      expect(toolStep.type).toBe('tool_call');

      const resultStep: PatternStep = {
        type: 'result',
        content: 'The answer is 4',
      };
      expect(resultStep.type).toBe('result');
    });

    it('should create mock pattern implementation', async () => {
      const mockPattern: AgentPattern = {
        name: 'test_pattern',
        description: 'A test pattern',
        execute: async function* (
          input: string,
          context: AgentContext
        ): AsyncGenerator<PatternStep> {
          yield {
            type: 'capability',
            capability: 'reasoning',
            content: 'Processing input...',
          };
          yield {
            type: 'result',
            content: `Processed: ${input}`,
          };
        },
      };

      const context: AgentContext = {
        messages: [],
        tools: [],
        config: { provider: 'mock', model: 'test' },
      };

      const steps: PatternStep[] = [];
      for await (const step of mockPattern.execute('test input', context)) {
        steps.push(step);
      }
      expect(steps).toHaveLength(2);
      expect(steps[1].content).toContain('Processed: test input');
    });
  });

  describe('Orchestrator Types', () => {
    it('should create valid execution options', () => {
      const options: ExecutionOptions = {
        maxSteps: 10,
        timeout: 30000,
        debug: true,
        visualizations: true,
      };
      expect(options.maxSteps).toBe(10);
      expect(options.debug).toBe(true);
    });

    it('should create valid debug info', () => {
      const debugInfo: DebugInfo = {
        prompt: 'What is 2+2?',
        modelResponse: 'The answer is 4',
        toolCalls: [
          {
            id: 'call_123',
            name: 'calculator',
            arguments: { expression: '2+2' },
          },
        ],
        tokens: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        latency: 1500,
      };
      expect(debugInfo.latency).toBe(1500);
      expect(debugInfo.tokens?.totalTokens).toBe(15);
    });

    it('should create valid execution events', () => {
      const startEvent: ExecutionEvent = {
        timestamp: Date.now(),
        eventType: 'start',
        data: { pattern: 'react', input: 'test' },
      };
      expect(startEvent.eventType).toBe('start');

      const stepEvent: ExecutionEvent = {
        timestamp: Date.now(),
        eventType: 'step',
        data: { capability: 'reasoning', output: 'thinking...' },
        debug: {
          prompt: 'Analyze this',
          tokens: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        },
      };
      expect(stepEvent.debug?.tokens?.totalTokens).toBe(15);

      const completeEvent: ExecutionEvent = {
        timestamp: Date.now(),
        eventType: 'complete',
        data: { result: 'Success' },
      };
      expect(completeEvent.eventType).toBe('complete');
    });
  });

  describe('Visualization Types', () => {
    it('should create valid visualization config', () => {
      const tableConfig: VisualizationConfig = {
        columns: ['name', 'value'],
        maxRows: 100,
      };
      expect(tableConfig.columns).toHaveLength(2);

      const chartConfig: VisualizationConfig = {
        xColumn: 'date',
        yColumn: 'revenue',
        xLabel: 'Date',
        yLabel: 'Revenue ($)',
        groupBy: 'category',
      };
      expect(chartConfig.xColumn).toBe('date');
    });

    it('should create valid visualization output', () => {
      const output: VisualizationOutput = {
        id: 'chart_1',
        type: 'bar_chart',
        title: 'Monthly Revenue',
        data: [
          { month: 'Jan', revenue: 1000 },
          { month: 'Feb', revenue: 1200 },
        ],
        config: {
          xColumn: 'month',
          yColumn: 'revenue',
        },
      };
      expect(output.type).toBe('bar_chart');
      expect(output.data).toHaveLength(2);
    });

    it('should create valid visualization manifest', () => {
      const manifest: VisualizationManifest = {
        version: '1.0',
        outputs: [
          {
            id: 'table_1',
            type: 'table',
            title: 'Data Table',
            data: [{ col1: 'a', col2: 1 }],
          },
          {
            id: 'chart_1',
            type: 'line_chart',
            title: 'Trend Line',
            data: [{ x: 1, y: 10 }, { x: 2, y: 20 }],
            config: { xColumn: 'x', yColumn: 'y' },
          },
        ],
      };
      expect(manifest.version).toBe('1.0');
      expect(manifest.outputs).toHaveLength(2);
    });
  });

  describe('File Output Types', () => {
    it('should create valid file output', () => {
      const fileOutput: FileOutput = {
        filename: 'data.csv',
        path: '/tmp/output/data.csv',
        type: 'csv',
        size: 1024,
        content: 'col1,col2\n1,2\n',
      };
      expect(fileOutput.type).toBe('csv');
      expect(fileOutput.size).toBe(1024);
    });

    it('should create valid Python execution result', () => {
      const result: PythonExecutionResult = {
        success: true,
        stdout: 'Calculation complete\n',
        stderr: '',
        returnCode: 0,
        files: [
          {
            filename: 'output.csv',
            path: '/tmp/output.csv',
            type: 'csv',
            size: 512,
          },
        ],
        visualizations: {
          version: '1.0',
          outputs: [
            {
              id: 'result_table',
              type: 'table',
              data: [{ a: 1, b: 2 }],
            },
          ],
        },
        executionTime: 1234,
      };
      expect(result.success).toBe(true);
      expect(result.returnCode).toBe(0);
      expect(result.files).toHaveLength(1);
      expect(result.visualizations?.outputs).toHaveLength(1);
    });
  });

  describe('API Types', () => {
    it('should create valid execute request', () => {
      const request: ExecuteRequest = {
        pattern: 'react',
        input: 'What is the weather today?',
        options: {
          maxSteps: 5,
          debug: true,
        },
      };
      expect(request.pattern).toBe('react');
      expect(request.options?.maxSteps).toBe(5);
    });

    it('should create valid pattern info', () => {
      const info: PatternInfo = {
        name: 'react',
        description: 'Reasoning and Acting in interleaved loop',
      };
      expect(info.name).toBe('react');
    });

    it('should create valid capability info', () => {
      const info: CapabilityInfo = {
        name: 'reasoning',
        description: 'Performs logical reasoning',
      };
      expect(info.name).toBe('reasoning');
    });

    it('should create valid tool info', () => {
      const info: ToolInfo = {
        name: 'calculator',
        description: 'Mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Math expression',
            },
          },
        },
      };
      expect(info.name).toBe('calculator');
    });

    it('should create valid test tool request', () => {
      const request: TestToolRequest = {
        toolName: 'calculator',
        params: { expression: '2+2' },
      };
      expect(request.toolName).toBe('calculator');
      expect(request.params.expression).toBe('2+2');
    });
  });

  describe('Type Composition', () => {
    it('should compose types for a complete workflow', async () => {
      // This test validates that all types work together
      
      // 1. Create context
      const config: LLMConfig = {
        provider: 'mock',
        model: 'test-model',
      };

      const messages: Message[] = [
        { role: 'user', content: 'Calculate 10 factorial' },
      ];

      const tool: Tool = {
        name: 'calculator',
        description: 'Math tool',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Expression' },
          },
        },
        execute: async (params) => ({
          success: true,
          data: { result: 3628800 },
        }),
      };

      const context: AgentContext = {
        messages,
        tools: [tool],
        config,
      };

      // 2. Execute capability
      const capability: Capability = {
        name: 'reasoning',
        description: 'Reasoning capability',
        execute: async (ctx) => ({
          output: 'I will calculate 10!',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: 'factorial(10)' },
            },
          ],
        }),
      };

      const capResult = await capability.execute(context);
      expect(capResult.toolCalls).toHaveLength(1);

      // 3. Execute tool
      const toolResult = await tool.execute({ expression: 'factorial(10)' });
      expect(toolResult.success).toBe(true);

      // 4. Create execution event
      const event: ExecutionEvent = {
        timestamp: Date.now(),
        eventType: 'complete',
        data: { result: toolResult.data },
        debug: {
          prompt: 'Calculate 10!',
          modelResponse: capResult.output,
          toolCalls: capResult.toolCalls,
        },
      };

      expect(event.eventType).toBe('complete');
      expect(event.debug?.toolCalls).toHaveLength(1);
    });
  });
});
