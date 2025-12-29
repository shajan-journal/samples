import { tool } from 'ai';
import { z } from 'zod';

// Sample tools that can be used by agents

export const weatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The city and state/country'),
  }),
  execute: async ({ location }) => {
    // Simulated weather data
    const temp = 60 + Math.floor(Math.random() * 30);
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)];
    return {
      location,
      temperature: temp,
      unit: 'fahrenheit',
      conditions,
    };
  },
});

export const calculatorTool = tool({
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate'),
  }),
  execute: async ({ expression }) => {
    try {
      // Simple safe eval for math expressions
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { expression, result };
    } catch {
      return { expression, error: 'Invalid expression' };
    }
  },
});

export const searchTool = tool({
  description: 'Search for information on a topic',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    // Simulated search results
    return {
      query,
      results: [
        { title: `Result 1 for ${query}`, snippet: 'This is a sample result...' },
        { title: `Result 2 for ${query}`, snippet: 'Another relevant result...' },
      ],
    };
  },
});

export const analyzeDataTool = tool({
  description: 'Analyze data and provide insights',
  inputSchema: z.object({
    data: z.string().describe('JSON data to analyze'),
    analysisType: z.enum(['summary', 'trends', 'anomalies']).describe('Type of analysis'),
  }),
  execute: async ({ data, analysisType }) => {
    return {
      analysisType,
      dataReceived: data.substring(0, 100) + '...',
      insights: `${analysisType} analysis completed. Found interesting patterns in the data.`,
    };
  },
});

export const createPlanTool = tool({
  description: 'Create a structured plan for a task',
  inputSchema: z.object({
    task: z.string().describe('The task to plan'),
    constraints: z.string().optional().describe('Any constraints or requirements'),
  }),
  execute: async ({ task, constraints }) => {
    return {
      task,
      constraints,
      plan: {
        steps: [
          { id: 1, action: 'Analyze the task requirements', status: 'pending' },
          { id: 2, action: 'Gather necessary information', status: 'pending' },
          { id: 3, action: 'Execute the main task', status: 'pending' },
          { id: 4, action: 'Verify results', status: 'pending' },
        ],
      },
    };
  },
});

export const executeStepTool = tool({
  description: 'Execute a specific step from a plan',
  inputSchema: z.object({
    stepId: z.number().describe('The step ID to execute'),
    stepAction: z.string().describe('The action to execute'),
    context: z.string().optional().describe('Additional context'),
  }),
  execute: async ({ stepId, stepAction, context }) => {
    return {
      stepId,
      action: stepAction,
      status: 'completed',
      result: `Successfully executed: ${stepAction}`,
      context,
    };
  },
});

export const classifyTool = tool({
  description: 'Classify input into categories',
  inputSchema: z.object({
    input: z.string().describe('The input to classify'),
    categories: z.array(z.string()).describe('Available categories'),
  }),
  execute: async ({ input, categories }) => {
    // Simple mock classification
    const randomIndex = Math.floor(Math.random() * categories.length);
    return {
      input: input.substring(0, 50) + '...',
      classification: categories[randomIndex],
      confidence: 0.7 + Math.random() * 0.3,
    };
  },
});
