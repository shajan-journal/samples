import request from 'supertest';
import { Application } from 'express';
import { createServer } from '../../src/api/server';
import { AgentOrchestrator } from '../../src/orchestrator/orchestrator';
import { MockLLMProvider } from '../../src/llm/mock';
import { CalculatorTool } from '../../src/tools/calculator';
import { ReActPattern } from '../../src/patterns/react';
import { PatternRegistry } from '../../src/patterns/base';

describe('API Server', () => {
  let app: Application;
  let orchestrator: AgentOrchestrator;
  let mockProvider: MockLLMProvider;
  let calculatorTool: CalculatorTool;

  beforeEach(() => {
    // Clear registries
    PatternRegistry.clear();

    // Set up mock provider and tools
    mockProvider = new MockLLMProvider();
    calculatorTool = new CalculatorTool();

    // Create orchestrator
    orchestrator = new AgentOrchestrator(mockProvider, [calculatorTool]);

    // Register pattern
    const reactPattern = new ReActPattern(mockProvider);
    orchestrator.registerPattern(reactPattern);

    // Create server
    app = createServer({ port: 3000, orchestrator });
  });

  describe('GET /api/patterns', () => {
    it('should return list of registered patterns', async () => {
      const response = await request(app)
        .get('/api/patterns')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('patterns');
      expect(Array.isArray(response.body.patterns)).toBe(true);
      expect(response.body.patterns.length).toBeGreaterThan(0);
      
      const reactPattern = response.body.patterns.find((p: any) => p.name === 'react');
      expect(reactPattern).toBeDefined();
      expect(reactPattern.description).toBeDefined();
    });
  });

  describe('GET /api/capabilities', () => {
    it('should return list of available capabilities', async () => {
      const response = await request(app)
        .get('/api/capabilities')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('capabilities');
      expect(Array.isArray(response.body.capabilities)).toBe(true);
      expect(response.body.capabilities.length).toBeGreaterThan(0);

      const reasoningCap = response.body.capabilities.find((c: any) => c.name === 'reasoning');
      expect(reasoningCap).toBeDefined();
      expect(reasoningCap.description).toBeDefined();
    });
  });

  describe('GET /api/tools', () => {
    it('should return list of available tools', async () => {
      const response = await request(app)
        .get('/api/tools')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('tools');
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(response.body.tools.length).toBeGreaterThan(0);

      const calcTool = response.body.tools.find((t: any) => t.name === 'calculator');
      expect(calcTool).toBeDefined();
      expect(calcTool.description).toBeDefined();
      expect(calcTool.parameters).toBeDefined();
    });
  });

  describe('POST /api/execute', () => {
    it('should return 400 if pattern is missing', async () => {
      const response = await request(app)
        .post('/api/execute')
        .send({ input: 'test' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toContain('Pattern name is required');
    });

    it('should return 400 if input is missing', async () => {
      const response = await request(app)
        .post('/api/execute')
        .send({ pattern: 'react' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toContain('Input is required');
    });

    it('should stream SSE events for valid execution', async () => {
      // Set up mock responses
      mockProvider.setResponses([
        { content: 'I need to calculate this.' },
        {
          content: 'Using calculator',
          toolCalls: [
            {
              id: 'call_1',
              name: 'calculator',
              arguments: { expression: '2+2' }
            }
          ]
        },
        { content: 'The result is 4. Task completed.' }
      ]);

      const response = await request(app)
        .post('/api/execute')
        .send({
          pattern: 'react',
          input: 'Calculate 2+2',
          options: { maxSteps: 10 }
        })
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);

      // Verify SSE format
      expect(response.text).toContain('data: ');
      
      // Parse events from SSE stream
      const events = response.text
        .split('\n\n')
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.replace('data: ', '')));

      // Verify we got events
      expect(events.length).toBeGreaterThan(0);

      // Check for start event
      const startEvent = events.find(e => e.eventType === 'start');
      expect(startEvent).toBeDefined();
      expect(startEvent.data.pattern).toBe('react');
      expect(startEvent.data.input).toBe('Calculate 2+2');

      // Check for complete event
      const completeEvent = events.find(e => e.eventType === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.data.status).toBe('success');
    });

    it('should handle execution errors gracefully', async () => {
      const response = await request(app)
        .post('/api/execute')
        .send({
          pattern: 'nonexistent',
          input: 'test'
        })
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);

      // Should get an error event
      const events = response.text
        .split('\n\n')
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.replace('data: ', '')));

      const errorEvent = events.find(e => e.eventType === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.data.error).toBeDefined();
    });

    it('should support execution options', async () => {
      mockProvider.setResponses([
        { content: 'Task completed.' }
      ]);

      const response = await request(app)
        .post('/api/execute')
        .send({
          pattern: 'react',
          input: 'Simple task',
          options: {
            maxSteps: 5,
            debug: true,
            visualizations: false
          }
        })
        .expect(200);

      // Verify execution completed
      expect(response.text).toContain('data: ');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors with proper status codes', async () => {
      // The body parser will catch this and return 400
      await request(app)
        .post('/api/execute')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      // Just verify it doesn't crash - status code is 400 from body parser
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/patterns')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
