/**
 * Configuration management
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config();

export interface Config {
  workspace: {
    baseDir: string;
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'mock';
    apiKey?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  server: {
    port: number;
  };
}

/**
 * Get application configuration from environment variables with defaults
 */
export function getConfig(): Config {
  return {
    workspace: {
      baseDir: process.env.WORKSPACE_DIR || path.join(process.cwd(), 'workspace'),
    },
    llm: {
      provider: (process.env.LLM_PROVIDER as any) || 'mock',
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4',
      temperature: process.env.LLM_TEMPERATURE 
        ? parseFloat(process.env.LLM_TEMPERATURE) 
        : 0.7,
      maxTokens: process.env.LLM_MAX_TOKENS 
        ? parseInt(process.env.LLM_MAX_TOKENS) 
        : 2000,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    },
  };
}
