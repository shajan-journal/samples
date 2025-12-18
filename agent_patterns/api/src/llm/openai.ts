/**
 * OpenAI LLM Provider
 */

import OpenAI from 'openai';
import {
  LLMChunk,
  Message,
  LLMConfig,
  ToolDefinition,
  ToolCall,
} from '../types';
import { BaseLLMProvider } from './base';

/**
 * OpenAI provider with streaming support
 */
export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    super();
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async *chat(
    messages: Message[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk> {
    this.validateConfig(options);

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: this.formatMessagesForOpenAI(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      let contentBuffer = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          contentBuffer += delta.content;
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        if (finishReason) {
          // Note: With stream_options.include_usage, usage comes in a separate chunk
          // after the finish_reason chunk
          const usageData = chunk.usage
            ? {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              }
            : undefined;
          
          yield {
            type: 'done',
            finishReason: this.mapFinishReason(finishReason),
            usage: usageData,
          };
        } else if (chunk.usage && !finishReason) {
          // Sometimes usage comes in a separate chunk after completion
          yield {
            type: 'done',
            finishReason: 'stop',
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      }
    } catch (error) {
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async *chatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMConfig
  ): AsyncGenerator<LLMChunk> {
    this.validateConfig(options);

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: this.formatMessagesForOpenAI(messages),
        tools: this.formatToolsForOpenAI(tools),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      });

      const toolCallBuffers: Map<number, { 
        id?: string; 
        name?: string; 
        argumentsStr: string; 
      }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        // Handle content
        if (delta?.content) {
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;
            
            if (!toolCallBuffers.has(index)) {
              toolCallBuffers.set(index, {
                id: toolCallDelta.id,
                name: toolCallDelta.function?.name,
                argumentsStr: '',
              });
            }

            const buffer = toolCallBuffers.get(index)!;

            if (toolCallDelta.id) {
              buffer.id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              buffer.name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              // Accumulate arguments string
              buffer.argumentsStr += toolCallDelta.function.arguments;
            }
          }
        }

        if (finishReason) {
          // Emit complete tool calls
          for (const toolCall of toolCallBuffers.values()) {
            if (toolCall.id && toolCall.name) {
              try {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id,
                    name: toolCall.name,
                    arguments: JSON.parse(toolCall.argumentsStr || '{}'),
                  },
                };
              } catch (error) {
                // If JSON parsing fails, log error but don't crash
                console.error('Failed to parse tool call arguments:', toolCall.argumentsStr);
              }
            }
          }

          yield {
            type: 'done',
            finishReason: this.mapFinishReason(finishReason),
            usage: chunk.usage
              ? {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : undefined,
          };
        }
      }
    } catch (error) {
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert our Message format to OpenAI's format
   */
  private formatMessagesForOpenAI(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId || '',
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Convert our ToolDefinition format to OpenAI's format
   */
  private formatToolsForOpenAI(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Map OpenAI's finish reason to our format
   */
  private mapFinishReason(
    reason: string
  ): 'stop' | 'length' | 'tool_calls' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'error';
    }
  }
}
