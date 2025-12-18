#!/usr/bin/env ts-node
/**
 * Quick verification that patterns are properly registered
 */

import { MockLLMProvider } from '../src/llm/mock';
import { AgentOrchestrator } from '../src/orchestrator/orchestrator';
import { ReActPattern } from '../src/patterns/react';

const llmProvider = new MockLLMProvider();
const orchestrator = new AgentOrchestrator(llmProvider, []);

// Register pattern
const reactPattern = new ReActPattern(llmProvider);
orchestrator.registerPattern(reactPattern);

// Verify registration
const patterns = orchestrator.getPatterns();
console.log('Registered patterns:', patterns.map(p => p.name));

const reactFound = orchestrator.getPattern('react');
if (reactFound) {
  console.log('✅ SUCCESS: React pattern is registered');
  console.log('   Name:', reactFound.name);
  console.log('   Description:', reactFound.description);
  process.exit(0);
} else {
  console.log('❌ ERROR: React pattern not found');
  process.exit(1);
}
