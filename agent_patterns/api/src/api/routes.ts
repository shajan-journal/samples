import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from '../orchestrator/orchestrator';
import { PatternRegistry } from '../patterns/base';

export function createRoutes(orchestrator: AgentOrchestrator): Router {
  const router = Router();

  /**
   * GET /api/patterns
   * List all registered patterns
   */
  router.get('/patterns', (req: Request, res: Response) => {
    try {
      const patterns = PatternRegistry.getAll().map((pattern: any) => ({
        name: pattern.name,
        description: pattern.description
      }));
      
      res.json({ patterns });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/capabilities
   * List all available capabilities
   */
  router.get('/capabilities', (req: Request, res: Response) => {
    try {
      // Return hardcoded list of capabilities for now
      // In a full implementation, this would come from a registry
      const capabilities = [
        { name: 'reasoning', description: 'Logical reasoning and inference' },
        { name: 'tool_use', description: 'Execute external tools and process results' }
      ];
      
      res.json({ capabilities });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/tools
   * List all available tools
   */
  router.get('/tools', (req: Request, res: Response) => {
    try {
      // Get tools from orchestrator
      const tools = (orchestrator as any).tools || [];
      const toolInfo = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }));
      
      res.json({ tools: toolInfo });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/execute
   * Execute a pattern with Server-Sent Events streaming
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { pattern, input, options } = req.body;

      // Validate request
      if (!pattern || typeof pattern !== 'string') {
        res.status(400).json({ error: 'Pattern name is required' });
        return;
      }

      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Input is required' });
        return;
      }

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Execute pattern and stream events
      try {
        for await (const event of orchestrator.executePattern(pattern, input, options)) {
          // Send event to client
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // Send completion signal
        res.write('event: done\ndata: {}\n\n');
        res.end();
      } catch (executionError) {
        // Send error event
        const errorEvent = {
          timestamp: Date.now(),
          eventType: 'error',
          data: {
            error: (executionError as Error).message
          }
        };
        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        res.end();
      }
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  return router;
}
