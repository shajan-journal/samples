/**
 * ToolUseCapability: Execute tools based on LLM decisions
 * 
 * This capability enables the agent to use external tools to accomplish tasks.
 * It presents available tools to the LLM and executes them based on the LLM's decisions.
 */

import { BaseCapability } from './base';
import { AgentContext, CapabilityResult, Message, ToolCall, ToolResult, LLMProvider } from '../types';

export class ToolUseCapability extends BaseCapability {
  name = 'tool_use';
  description = 'Execute tools to accomplish tasks based on LLM decisions';

  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    super();
    this.llmProvider = llmProvider;
  }

  async execute(context: AgentContext): Promise<CapabilityResult> {
    try {
      // If no tools available, return error
      if (!context.tools || context.tools.length === 0) {
        return this.error('No tools available for execution');
      }

      // Build prompt that asks LLM to use tools if needed
      const messages = this.buildToolUsePrompt(context);

      // Get LLM response with tools
      const toolDefinitions = context.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));

      const stream = this.llmProvider.chatWithTools(messages, toolDefinitions, context.config);
      const { content, toolCalls } = await this.collectStreamWithToolCalls(stream);

      // Log raw LLM output for debugging
      console.log('[DEBUG] Tool-use LLM output:', content);
      console.log('[DEBUG] Tool calls:', JSON.stringify(toolCalls, null, 2));

      // Store debug info with FULL context
      const debugInfo = {
        messagesCount: messages.length,
        rawLLMOutput: content || '(no content)',
        contentLength: content?.length || 0,
        toolCallsCount: toolCalls?.length || 0,
        fullMessages: messages,  // Include ALL messages sent to LLM
        toolDefinitions,  // Include tool definitions sent to LLM
      };

      // If no tool calls, return the content
      if (!toolCalls || toolCalls.length === 0) {
        return this.success(content, {
          reasoning: 'No tools needed for this step',
          metadata: {
            debug: debugInfo,
          },
        });
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(toolCalls, context.tools);

      // Check if any tool result contains visualization data
      const visualizations = this.extractVisualizations(toolResults);
      
      // Build metadata
      const metadata: Record<string, any> = {
        toolResults,
        debug: debugInfo,
      };
      
      // Add visualizations if present
      if (visualizations) {
        metadata.visualizations = visualizations;
        console.log('[ToolUseCapability] Found visualization data in tool results');
      }

      // Return results with tool calls
      return this.success(content, {
        toolCalls,
        metadata
      });
    } catch (error) {
      return this.error(`Tool use failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Extract visualization data from tool results
   */
  private extractVisualizations(toolResults: ToolResult[]): any | null {
    for (const result of toolResults) {
      if (result.success && result.data?.visualizations) {
        return result.data.visualizations;
      }
    }
    return null;
  }

  /**
   * Build prompt for tool use
   */
  private buildToolUsePrompt(context: AgentContext): Message[] {
    const systemMessage: Message = {
      role: 'system',
      content: `You are an AI assistant with access to tools. Use the available tools when needed to accomplish the user's request.

Available tools:
${context.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

When you need to use a tool, the system will execute it and provide you with the results.
If you don't need any tools for the current step, just respond with your reasoning or final answer.`
    };

    return [systemMessage, ...context.messages];
  }

  /**
   * Execute multiple tool calls in sequence
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    tools: any[]
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const tool = tools.find(t => t.name === toolCall.name);
      
      if (!tool) {
        results.push({
          success: false,
          error: `Tool '${toolCall.name}' not found`
        });
        continue;
      }

      try {
        const result = await tool.execute(toolCall.arguments);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: `Tool execution failed: ${(error as Error).message}`
        });
      }
    }

    return results;
  }
}
