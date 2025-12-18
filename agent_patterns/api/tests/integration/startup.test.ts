/**
 * Integration test for server startup and pattern registration
 */

import { setupServer } from '../../scripts/start-api';
import { PatternRegistry } from '../../src/patterns/base';
import { Server } from 'http';

describe('Server Startup Integration', () => {
  let server: Server | null = null;

  beforeEach(() => {
    // Clear any existing patterns
    PatternRegistry.clear();
  });

  afterEach(async () => {
    // Clean up server
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }
    PatternRegistry.clear();
  });

  it('should register patterns during setup', async () => {
    const setup = await setupServer({ provider: 'mock', port: 13001 });
    server = setup.server;

    expect(setup).toBeDefined();
    expect(setup.orchestrator).toBeDefined();
    expect(setup.tools).toBeDefined();
    expect(setup.llmProvider).toBeDefined();
  });

  it('should have react pattern registered', async () => {
    const { orchestrator, server: serverInstance } = await setupServer({ 
      provider: 'mock', 
      port: 13002 
    });
    server = serverInstance;

    const patterns = orchestrator.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);

    const patternNames = patterns.map(p => p.name);
    expect(patternNames).toContain('react');
  });

  it('should retrieve react pattern by name', async () => {
    const { orchestrator, server: serverInstance } = await setupServer({ 
      provider: 'mock', 
      port: 13003 
    });
    server = serverInstance;

    const reactPattern = orchestrator.getPattern('react');
    expect(reactPattern).toBeDefined();
    expect(reactPattern?.name).toBe('react');
    expect(reactPattern?.description).toContain('Reasoning + Acting');
  });

  it('should have tools registered', async () => {
    const { tools, server: serverInstance } = await setupServer({ 
      provider: 'mock', 
      port: 13004 
    });
    server = serverInstance;

    expect(tools.length).toBe(2);
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('calculator');
    expect(toolNames).toContain('file_system');
  });

  it('should throw error when openai provider is used without API key', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(setupServer({ provider: 'openai', port: 13005 })).rejects.toThrow(
      'OPENAI_API_KEY not set in environment'
    );

    // Restore original key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
