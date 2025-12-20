/**
 * LLM Integration Test - Visualization Generation
 * 
 * Tests that patterns can generate visualizations when requested.
 * Requires OPENAI_API_KEY to be set.
 */

import * as path from 'path';
import {
  createTestOrchestrator,
  executeAndCollect,
  assertions,
  describeIfApiKey
} from '../helpers/llm-integration-helpers';

describeIfApiKey('LLM Integration - Visualization Generation', () => {
  const orchestrator = createTestOrchestrator();
  const testWorkspaceDir = path.join(__dirname, '../../test-workspace');
  
  const visualizationPrompt = `Create a bar chart showing Q1 2024 sales:
- January: $45,000
- February: $52,000  
- March: $48,000
Use Python to generate the visualization.`;

  it('should generate visualization with ReAct pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'react', visualizationPrompt, testWorkspaceDir);

    expect(assertions.usedTool(result, 'python_execute')).toBe(true);
    expect(assertions.hasVisualizations(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);

  it('should generate visualization with PlanAndValidate pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'plan-and-validate', visualizationPrompt, testWorkspaceDir);

    expect(assertions.usedTool(result, 'python_execute')).toBe(true);
    expect(assertions.hasVisualizations(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);

  it('should generate visualization with IterativeRefinement pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'iterative-refinement', visualizationPrompt, testWorkspaceDir);

    expect(assertions.usedTool(result, 'python_execute')).toBe(true);
    expect(assertions.hasVisualizations(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);
});
