import express, { Application } from 'express';
import cors from 'cors';
import { createRoutes } from './routes';
import { errorHandler, requestLogger } from './middleware';
import { AgentOrchestrator } from '../orchestrator/orchestrator';
import { LLMProvider } from '../types';
import { Tool } from '../types';

export interface ServerConfig {
  port: number;
  orchestrator: AgentOrchestrator;
}

/**
 * Create and configure the Express server
 */
export function createServer(config: ServerConfig): Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Routes
  app.use('/api', createRoutes(config.orchestrator));

  // Error handling
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
export function startServer(
  llmProvider: LLMProvider,
  tools: Tool[],
  port: number = 3000
): Promise<{ app: Application; server: any }> {
  return new Promise((resolve, reject) => {
    try {
      // Create orchestrator
      const orchestrator = new AgentOrchestrator(llmProvider, tools);

      // Create and start server
      const app = createServer({ port, orchestrator });
      const server = app.listen(port, () => {
        console.log(`🚀 API server running on http://localhost:${port}`);
        console.log(`📡 SSE endpoint: http://localhost:${port}/api/execute`);
        console.log(`📋 Patterns: http://localhost:${port}/api/patterns`);
        resolve({ app, server });
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
