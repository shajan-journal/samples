import {
  createTestOrchestrator,
  executeAndCollect,
  assertions,
  describeIfApiKey
} from '../helpers/llm-integration-helpers';

describeIfApiKey('LLM Integration - Tool Selection', () => {
  const orchestrator = createTestOrchestrator();
  const testPrompt = 'reverse string dkfjdlfjdsljfdlsj';

  it('should use code generation tool with ReAct pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'react', testPrompt);

    expect(assertions.usedCodeTool(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);

  it('should use code generation tool with PlanAndValidate pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'plan-and-validate', testPrompt);

    expect(assertions.usedCodeTool(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);

  it('should use code generation tool with IterativeRefinement pattern', async () => {
    const result = await executeAndCollect(orchestrator, 'iterative-refinement', testPrompt);

    expect(assertions.usedCodeTool(result)).toBe(true);
    expect(assertions.completedSuccessfully(result)).toBe(true);
  }, 60000);
});
