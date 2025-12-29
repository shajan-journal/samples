import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import {
  runReActAgent,
  planAndExecute,
  routingPattern,
  parallelAnalysis,
  evaluatorOptimizer,
  orchestratorWorker,
} from './patterns/index.js';
import {
  streamReActAgent,
  streamPlanAndExecute,
  streamRoutingPattern,
  streamParallelAnalysis,
  streamEvaluatorOptimizer,
  streamOrchestratorWorker,
} from './patterns/streaming-agents.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// SSE helper - sets up response for Server-Sent Events
function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// List available patterns
app.get('/api/patterns', (_req: Request, res: Response) => {
  res.json({
    patterns: [
      {
        id: 'react',
        name: 'ReAct (Reasoning + Acting)',
        description: 'Agent reasons about actions, uses tools, observes results, and iterates until task completion.',
        endpoint: '/api/patterns/react',
        streaming: true,
      },
      {
        id: 'plan-execute',
        name: 'Plan and Execute',
        description: 'Creates a detailed plan first, then executes each step sequentially.',
        endpoint: '/api/patterns/plan-execute',
        streaming: false,
      },
      {
        id: 'routing',
        name: 'Routing',
        description: 'Classifies input and routes to specialized handlers based on type and complexity.',
        endpoint: '/api/patterns/routing',
        streaming: false,
      },
      {
        id: 'parallel',
        name: 'Parallel Processing',
        description: 'Runs multiple independent analyses simultaneously for comprehensive results.',
        endpoint: '/api/patterns/parallel',
        streaming: false,
      },
      {
        id: 'evaluator-optimizer',
        name: 'Evaluator-Optimizer',
        description: 'Generates output, evaluates quality, and iteratively improves until threshold met.',
        endpoint: '/api/patterns/evaluator-optimizer',
        streaming: false,
      },
      {
        id: 'orchestrator-worker',
        name: 'Orchestrator-Worker',
        description: 'Orchestrator breaks down tasks and delegates to specialized workers.',
        endpoint: '/api/patterns/orchestrator-worker',
        streaming: false,
      },
    ],
  });
});

// Original chat endpoint - streaming response
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages }: { messages: UIMessage[] } = req.body;

    const result = streamText({
      model: openai.chat('gpt-4o-mini'),
      system: 'You are a helpful assistant.',
      messages: await convertToModelMessages(messages),
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ReAct Pattern endpoint
app.post('/api/patterns/react', async (req: Request, res: Response) => {
  try {
    const { prompt }: { prompt?: string } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await runReActAgent(prompt);
    
    res.json({
      pattern: 'react',
      text: result.text,
      steps: result.steps.map((step, index) => ({
        stepNumber: index + 1,
        type: step.finishReason,
        toolCalls: step.toolCalls?.map(tc => ({
          tool: tc.toolName,
          args: tc.args,
        })),
        toolResults: step.toolResults?.map(tr => ({
          tool: tr.toolName,
          result: tr.result,
        })),
      })),
      usage: result.usage,
    });
  } catch (error) {
    console.error('ReAct error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// Plan and Execute Pattern
app.post('/api/patterns/plan-execute', async (req: Request, res: Response) => {
  try {
    const { task }: { task: string } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const result = await planAndExecute(task);
    res.json({
      pattern: 'plan-execute',
      ...result,
    });
  } catch (error) {
    console.error('Plan-Execute error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// Routing Pattern
app.post('/api/patterns/routing', async (req: Request, res: Response) => {
  try {
    const { input }: { input: string } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const result = await routingPattern(input);
    res.json({
      pattern: 'routing',
      ...result,
    });
  } catch (error) {
    console.error('Routing error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// Parallel Processing Pattern
app.post('/api/patterns/parallel', async (req: Request, res: Response) => {
  try {
    const { content }: { content: string } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await parallelAnalysis(content);
    res.json({
      pattern: 'parallel',
      ...result,
    });
  } catch (error) {
    console.error('Parallel error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// Evaluator-Optimizer Pattern
app.post('/api/patterns/evaluator-optimizer', async (req: Request, res: Response) => {
  try {
    const { task, qualityThreshold = 8, maxIterations = 3 }: { 
      task: string; 
      qualityThreshold?: number;
      maxIterations?: number;
    } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const result = await evaluatorOptimizer(task, qualityThreshold, maxIterations);
    res.json({
      pattern: 'evaluator-optimizer',
      ...result,
    });
  } catch (error) {
    console.error('Evaluator-Optimizer error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// Orchestrator-Worker Pattern
app.post('/api/patterns/orchestrator-worker', async (req: Request, res: Response) => {
  try {
    const { task }: { task: string } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const result = await orchestratorWorker(task);
    res.json({
      pattern: 'orchestrator-worker',
      ...result,
    });
  } catch (error) {
    console.error('Orchestrator-Worker error:', error);
    res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
});

// ============= STREAMING ENDPOINTS =============

// Streaming ReAct Pattern
app.post('/api/patterns/react/stream', async (req: Request, res: Response) => {
  const { prompt }: { prompt: string } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  setupSSE(res);
  await streamReActAgent(prompt, res);
});

// Streaming Plan and Execute Pattern
app.post('/api/patterns/plan-execute/stream', async (req: Request, res: Response) => {
  const { task }: { task: string } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }
  setupSSE(res);
  await streamPlanAndExecute(task, res);
});

// Streaming Routing Pattern
app.post('/api/patterns/routing/stream', async (req: Request, res: Response) => {
  const { input }: { input: string } = req.body;
  if (!input) {
    return res.status(400).json({ error: 'Input is required' });
  }
  setupSSE(res);
  await streamRoutingPattern(input, res);
});

// Streaming Parallel Processing Pattern
app.post('/api/patterns/parallel/stream', async (req: Request, res: Response) => {
  const { content }: { content: string } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  setupSSE(res);
  await streamParallelAnalysis(content, res);
});

// Streaming Evaluator-Optimizer Pattern
app.post('/api/patterns/evaluator-optimizer/stream', async (req: Request, res: Response) => {
  const { task, qualityThreshold = 8, maxIterations = 3 }: { 
    task: string; 
    qualityThreshold?: number;
    maxIterations?: number;
  } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }
  setupSSE(res);
  await streamEvaluatorOptimizer(task, qualityThreshold, maxIterations, res);
});

// Streaming Orchestrator-Worker Pattern
app.post('/api/patterns/orchestrator-worker/stream', async (req: Request, res: Response) => {
  const { task }: { task: string } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Task is required' });
  }
  setupSSE(res);
  await streamOrchestratorWorker(task, res);
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📋 Available patterns at http://localhost:${PORT}/api/patterns`);
});
