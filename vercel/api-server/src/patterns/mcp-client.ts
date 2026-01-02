import { tool, type CoreTool } from 'ai';
import { z } from 'zod';

// ============================================
// Dynamic MCP Client
// ============================================

const JOURNAL_API_BASE = process.env.JOURNAL_API_URL || 'http://localhost:3001';
const JOURNAL_API_KEY = process.env.JOURNAL_API_KEY || '';

interface JSONSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  items?: { type: string; enum?: string[] };
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  format?: string;
  anyOf?: Array<{ type: string }>;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    $schema?: string;
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

interface MCPToolsListResponse {
  result: {
    tools: MCPToolDefinition[];
  };
}

// Cache for tools to avoid fetching on every request
let cachedTools: Record<string, CoreTool> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Call an MCP tool on the Journal server
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[MCP Client] Calling ${toolName} with:`, JSON.stringify(args));
  
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
    console.error(`[MCP Client] HTTP error ${response.status}:`, errorText);
    throw new Error(`MCP request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    console.error(`[MCP Client] Error from ${toolName}:`, data.error);
    throw new Error(data.error.message || JSON.stringify(data.error));
  }

  // Parse the result - MCP returns { content: [{ type: 'text', text: '...' }] }
  const content = data.result?.content?.[0];
  if (content?.type === 'text') {
    try {
      const parsed = JSON.parse(content.text);
      console.log(`[MCP Client] ${toolName} success`);
      return parsed;
    } catch {
      return content.text;
    }
  }
  
  return data.result || data;
}

/**
 * Convert JSON Schema type to Zod schema
 */
function jsonSchemaToZod(prop: JSONSchemaProperty): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  
  // Handle anyOf (e.g., string | null)
  if (prop.anyOf) {
    const types = prop.anyOf.map(t => t.type);
    const hasNull = types.includes('null');
    const nonNullType = types.find(t => t !== 'null');
    
    if (nonNullType === 'string') {
      schema = hasNull ? z.string().nullable() : z.string();
    } else {
      schema = z.unknown();
    }
  } else {
    switch (prop.type) {
      case 'string':
        if (prop.enum) {
          schema = z.enum(prop.enum as [string, ...string[]]);
        } else {
          let strSchema = z.string();
          if (prop.minLength) {
            strSchema = strSchema.min(prop.minLength);
          }
          schema = strSchema;
        }
        break;
      case 'number':
      case 'integer':
        let numSchema = z.number();
        if (prop.minimum !== undefined) {
          numSchema = numSchema.min(prop.minimum);
        }
        if (prop.maximum !== undefined) {
          numSchema = numSchema.max(prop.maximum);
        }
        schema = numSchema;
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'array':
        if (prop.items?.enum) {
          schema = z.array(z.enum(prop.items.enum as [string, ...string[]]));
        } else if (prop.items?.type === 'string') {
          schema = z.array(z.string());
        } else {
          schema = z.array(z.unknown());
        }
        break;
      case 'object':
        // Handle nested objects - just use z.record for simplicity
        schema = z.record(z.unknown());
        break;
      default:
        schema = z.unknown();
    }
  }
  
  if (prop.description) {
    schema = schema.describe(prop.description);
  }
  
  return schema;
}

/**
 * Convert MCP tool definition to Vercel AI SDK tool using Zod schemas
 */
function mcpToolToAITool(mcpTool: MCPToolDefinition): CoreTool {
  const properties = mcpTool.inputSchema.properties || {};
  const required = mcpTool.inputSchema.required || [];
  
  // Build Zod schema from JSON Schema
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  
  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema = jsonSchemaToZod(prop);
    
    // Make optional if not required
    if (!required.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }
    
    schemaShape[key] = fieldSchema;
  }
  
  // Create the parameters schema - always an object
  const parametersSchema = z.object(schemaShape);
  
  return tool({
    description: mcpTool.description,
    parameters: parametersSchema,
    execute: async (args) => {
      try {
        return await callMCPTool(mcpTool.name, args as Record<string, unknown>);
      } catch (error) {
        return { error: `Failed to execute ${mcpTool.name}: ${error}` };
      }
    },
  });
}

/**
 * Fetch available tools from the MCP server
 */
async function fetchMCPTools(): Promise<MCPToolDefinition[]> {
  console.log('[MCP Client] Fetching tools list from MCP server...');
  
  const response = await fetch(`${JOURNAL_API_BASE}/api/mcp/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'x-mcp-api-key': JOURNAL_API_KEY,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch MCP tools: ${response.status}`);
  }

  const data: MCPToolsListResponse = await response.json();
  console.log(`[MCP Client] Found ${data.result.tools.length} tools`);
  
  return data.result.tools;
}

/**
 * Get all Journal tools dynamically from MCP server
 * Tools are cached for performance with a 1-minute TTL
 */
export async function getJournalTools(): Promise<Record<string, CoreTool>> {
  const now = Date.now();
  
  // Return cached tools if still valid
  if (cachedTools && (now - cacheTimestamp) < CACHE_TTL_MS) {
    console.log('[MCP Client] Using cached tools');
    return cachedTools;
  }
  
  try {
    const mcpTools = await fetchMCPTools();
    
    // Convert each MCP tool to AI SDK format
    const tools: Record<string, CoreTool> = {};
    for (const mcpTool of mcpTools) {
      // Convert snake_case to camelCase for tool names
      const toolName = 'journal_' + mcpTool.name;
      tools[toolName] = mcpToolToAITool(mcpTool);
    }
    
    // Update cache
    cachedTools = tools;
    cacheTimestamp = now;
    
    console.log(`[MCP Client] Loaded ${Object.keys(tools).length} Journal tools:`, Object.keys(tools));
    return tools;
  } catch (error) {
    console.error('[MCP Client] Failed to fetch tools:', error);
    
    // Return cached tools even if expired, if available
    if (cachedTools) {
      console.log('[MCP Client] Returning stale cached tools');
      return cachedTools;
    }
    
    // Return empty if no cache
    return {};
  }
}

/**
 * Clear the tools cache (useful for testing or when tools change)
 */
export function clearToolsCache(): void {
  cachedTools = null;
  cacheTimestamp = 0;
  console.log('[MCP Client] Tools cache cleared');
}

/**
 * Check if MCP server is available
 */
export async function checkMCPHealth(): Promise<boolean> {
  try {
    const tools = await fetchMCPTools();
    return tools.length > 0;
  } catch {
    return false;
  }
}
