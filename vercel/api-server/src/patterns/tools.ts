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

// ============================================
// Journal API Tools (via MCP)
// ============================================

const JOURNAL_API_BASE = process.env.JOURNAL_API_URL || 'http://localhost:3001';
const JOURNAL_API_KEY = process.env.JOURNAL_API_KEY || '';

// Generic MCP tool caller
async function callMCPTool(toolName: string, args: Record<string, unknown>) {
  console.log(`[JOURNAL MCP] Calling ${toolName} with:`, args);
  
  const response = await fetch(`${JOURNAL_API_BASE}/api/mcp/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'x-mcp-api-key': JOURNAL_API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[JOURNAL MCP] HTTP error ${response.status}:`, errorText);
    throw new Error(`MCP request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    console.error(`[JOURNAL MCP] Error from ${toolName}:`, data.error);
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  // Parse the result - MCP returns { content: [{ type: 'text', text: '...' }] }
  const content = data.result?.content?.[0];
  if (content?.type === 'text') {
    try {
      const parsed = JSON.parse(content.text);
      console.log(`[JOURNAL MCP] ${toolName} success`);
      return parsed;
    } catch {
      return content.text;
    }
  }
  
  return data.result || data;
}

// ============================================
// Task Tools
// ============================================

export const journalListTasksTool = tool({
  description: 'List tasks from Journal with optional filtering by status, priority, project, workspace, or assignee. Use this to find tasks, count tasks by status, or get an overview of work.',
  inputSchema: z.object({
    status: z.enum(['backlog', 'to_do', 'in_progress', 'complete', 'archive']).optional().describe('Filter by task status'),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'unassigned']).optional().describe('Filter by priority'),
    projectId: z.string().optional().describe('Filter by project ID'),
    workspaceId: z.string().optional().describe('Filter by workspace ID'),
    assignedTo: z.string().optional().describe('Filter by assignee member ID'),
    limit: z.number().min(1).max(100).optional().describe('Max tasks to return (default 50)'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('list_tasks', args);
    } catch (error) {
      return { error: `Failed to list tasks: ${error}` };
    }
  },
});

export const journalGetTaskTool = tool({
  description: 'Get detailed task information including implementation plan, comments count, and resources. Use task identifier like JO-123.',
  inputSchema: z.object({
    task: z.string().describe('Task identifier (e.g., "JO-123") or full URL'),
  }),
  execute: async ({ task }) => {
    try {
      return await callMCPTool('get_task', { task });
    } catch (error) {
      return { error: `Failed to get task: ${error}` };
    }
  },
});

export const journalCreateTaskTool = tool({
  description: 'Create a new task in Journal. Returns the created task with its identifier.',
  inputSchema: z.object({
    name: z.string().describe('Required. Task name/title'),
    description: z.string().optional().describe('Task description in markdown'),
    status: z.enum(['backlog', 'to_do', 'in_progress', 'complete', 'archive']).optional().describe('Task status (default: to_do)'),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'unassigned']).optional().describe('Task priority'),
    projectId: z.string().optional().describe('Project ID to associate with'),
    workspaceId: z.string().optional().describe('Workspace ID to associate with'),
    assignedTo: z.string().optional().describe('Member ID to assign to'),
    dueDate: z.string().optional().describe('Due date in ISO 8601 format'),
    labels: z.array(z.string()).optional().describe('Array of label IDs'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('create_task', args);
    } catch (error) {
      return { error: `Failed to create task: ${error}` };
    }
  },
});

export const journalUpdateTaskTool = tool({
  description: 'Update an existing task properties like status, priority, assignee, etc.',
  inputSchema: z.object({
    task: z.string().describe('Task identifier (e.g., "JO-123") or full URL'),
    name: z.string().optional().describe('New task name'),
    description: z.string().optional().describe('New description'),
    status: z.enum(['backlog', 'to_do', 'in_progress', 'complete', 'archive']).optional().describe('New status'),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'unassigned']).optional().describe('New priority'),
    assignedTo: z.string().nullable().optional().describe('Member ID to assign (null to unassign)'),
    dueDate: z.string().nullable().optional().describe('Due date (null to clear)'),
    labels: z.array(z.string()).optional().describe('Label IDs (replaces existing)'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('update_task', args);
    } catch (error) {
      return { error: `Failed to update task: ${error}` };
    }
  },
});

export const journalDeleteTaskTool = tool({
  description: 'Soft delete a task (can be recovered by admin).',
  inputSchema: z.object({
    task: z.string().describe('Task identifier (e.g., "JO-123") or full URL'),
  }),
  execute: async ({ task }) => {
    try {
      return await callMCPTool('delete_task', { task });
    } catch (error) {
      return { error: `Failed to delete task: ${error}` };
    }
  },
});

export const journalGetTaskCommentsTool = tool({
  description: 'Get comments on a task with pagination.',
  inputSchema: z.object({
    task: z.string().describe('Task identifier or URL'),
    limit: z.number().optional().describe('Max comments to return (default 20)'),
    offset: z.number().optional().describe('Pagination offset'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('get_task_comments', args);
    } catch (error) {
      return { error: `Failed to get comments: ${error}` };
    }
  },
});

export const journalGetTaskResourcesTool = tool({
  description: 'Get resources attached to a task (GitHub PRs, Slack messages, linked documents).',
  inputSchema: z.object({
    task: z.string().describe('Task identifier or URL'),
    limit: z.number().optional().describe('Max resources to return (default 20)'),
    offset: z.number().optional().describe('Pagination offset'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('get_task_resources', args);
    } catch (error) {
      return { error: `Failed to get resources: ${error}` };
    }
  },
});

// ============================================
// Project Tools
// ============================================

export const journalListProjectsTool = tool({
  description: 'List all projects in the organization.',
  inputSchema: z.object({
    limit: z.number().optional().describe('Max projects to return'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('list_projects', args);
    } catch (error) {
      return { error: `Failed to list projects: ${error}` };
    }
  },
});

export const journalGetProjectTool = tool({
  description: 'Get project details including name, status, summary, and owner.',
  inputSchema: z.object({
    url: z.string().describe('Project slug or full URL (e.g., "my-project" or "https://journal.one/projects/my-project")'),
  }),
  execute: async ({ url }) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://journal.one/projects/${url}`;
      return await callMCPTool('get_project_context', { url: fullUrl });
    } catch (error) {
      return { error: `Failed to get project: ${error}` };
    }
  },
});

// ============================================
// Document Tools
// ============================================

export const journalListDocumentsTool = tool({
  description: 'List all documents with optional filtering by type, project, or workspace.',
  inputSchema: z.object({
    type: z.enum(['organization_context', 'project_context', 'workspace_context', 'clipped_page', 'implementation_plan']).optional().describe('Filter by document type'),
    projectId: z.string().optional().describe('Filter by project ID'),
    workspaceId: z.string().optional().describe('Filter by workspace ID'),
    limit: z.number().optional().describe('Max documents to return'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('list_documents', args);
    } catch (error) {
      return { error: `Failed to list documents: ${error}` };
    }
  },
});

export const journalGetDocumentTool = tool({
  description: 'Get full document content including markdown.',
  inputSchema: z.object({
    url: z.string().describe('Document URL or path (e.g., "/projects/my-project/documents/spec")'),
  }),
  execute: async ({ url }) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://journal.one${url.startsWith('/') ? '' : '/'}${url}`;
      return await callMCPTool('get_document', { url: fullUrl });
    } catch (error) {
      return { error: `Failed to get document: ${error}` };
    }
  },
});

export const journalCreateDocumentTool = tool({
  description: 'Create a new document with markdown content.',
  inputSchema: z.object({
    name: z.string().describe('Document name'),
    markdown: z.string().describe('Document content in markdown'),
    type: z.enum(['organization_context', 'project_context', 'workspace_context', 'clipped_page', 'implementation_plan']).optional().describe('Document type'),
    projectId: z.string().optional().describe('Project to associate with'),
    workspaceId: z.string().optional().describe('Workspace to associate with'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('create_document', args);
    } catch (error) {
      return { error: `Failed to create document: ${error}` };
    }
  },
});

export const journalUpdateDocumentTool = tool({
  description: 'Update document content or metadata.',
  inputSchema: z.object({
    url: z.string().describe('Document URL or slug'),
    name: z.string().optional().describe('New document name'),
    markdown: z.string().optional().describe('New markdown content'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('update_document', args);
    } catch (error) {
      return { error: `Failed to update document: ${error}` };
    }
  },
});

export const journalListProjectDocumentsTool = tool({
  description: 'List all documents in a specific project.',
  inputSchema: z.object({
    url: z.string().describe('Project slug or URL'),
    type: z.enum(['organization_context', 'project_context', 'workspace_context', 'clipped_page', 'implementation_plan']).optional().describe('Filter by type'),
  }),
  execute: async ({ url, type }) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://journal.one/projects/${url}`;
      return await callMCPTool('list_project_documents', { url: fullUrl, ...(type && { type }) });
    } catch (error) {
      return { error: `Failed to list project documents: ${error}` };
    }
  },
});

// ============================================
// Workspace Tools
// ============================================

export const journalListWorkspacesTool = tool({
  description: 'List all workspaces in the organization.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return await callMCPTool('list_workspaces', {});
    } catch (error) {
      return { error: `Failed to list workspaces: ${error}` };
    }
  },
});

export const journalGetWorkspaceTool = tool({
  description: 'Get workspace details by slug or URL.',
  inputSchema: z.object({
    url: z.string().describe('Workspace slug or full URL'),
  }),
  execute: async ({ url }) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://journal.one/workspaces/${url}`;
      return await callMCPTool('get_workspace', { url: fullUrl });
    } catch (error) {
      return { error: `Failed to get workspace: ${error}` };
    }
  },
});

// ============================================
// Search & Utility Tools
// ============================================

export const journalSearchTool = tool({
  description: 'Search across all Journal content - tasks, documents, projects, workspaces. Uses hybrid semantic + keyword search.',
  inputSchema: z.object({
    query: z.string().describe('Search query text'),
    types: z.array(z.enum(['document', 'task', 'build', 'canvas', 'project', 'workspace'])).optional().describe('Filter to specific content types'),
    projectId: z.string().optional().describe('Filter to a specific project'),
    limit: z.number().optional().describe('Max results (default 20)'),
  }),
  execute: async (args) => {
    try {
      return await callMCPTool('search', args);
    } catch (error) {
      return { error: `Failed to search: ${error}` };
    }
  },
});

export const journalSearchMembersTool = tool({
  description: 'Search for organization members by name or email to find member IDs for task assignment.',
  inputSchema: z.object({
    query: z.string().describe('Name or email to search for'),
  }),
  execute: async ({ query }) => {
    try {
      return await callMCPTool('search_members', { query });
    } catch (error) {
      return { error: `Failed to search members: ${error}` };
    }
  },
});

export const journalListLabelsTool = tool({
  description: 'List all available task labels in the organization.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return await callMCPTool('list_labels', {});
    } catch (error) {
      return { error: `Failed to list labels: ${error}` };
    }
  },
});
