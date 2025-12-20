# Available Patterns

This project implements several agentic patterns. Each pattern is a composition of capabilities that defines how an agent thinks and acts.

## ReAct (Reasoning + Acting)

**Pattern**: Think → Act → Observe → Repeat

```bash
npm run test:orchestrator -- react "Calculate 2+2"
```

**Capabilities Used:**
1. Reasoning - Agent thinks about the problem
2. Tool Use - Agent decides which tool to call
3. Synthesis - Agent provides the final answer

**Best For:**
- Tasks requiring tool use
- Multi-step problems
- Interactive workflows

**Example**: Mathematical calculations, code generation, data processing

---

## Plan and Validate

**Pattern**: Plan → Execute → Validate → Refine

Plans before executing, validates results, and refines if needed.

**Capabilities Used:**
1. Reasoning - Create a plan
2. Tool Use - Execute the plan
3. Validation - Check if plan succeeded
4. Refinement - Improve if needed

**Best For:**
- Complex, structured tasks
- Tasks requiring validation
- Situations where planning helps

**Example**: Multi-step projects, quality assurance workflows

---

## Iterative Refinement

**Pattern**: Execute → Evaluate → Refine → Repeat

Iteratively improves results through multiple passes.

**Capabilities Used:**
1. Tool Use - Generate initial result
2. Reasoning - Evaluate quality
3. Synthesis - Refine the result
4. Repetition - Multiple improvement cycles

**Best For:**
- Creative tasks needing iteration
- Complex outputs that need polish
- Continuous improvement scenarios

**Example**: Content generation, code optimization, design refinement

---

## How Patterns Work

### Architecture

```
Pattern (Strategy)
    ↓
    ├─ Capabilities (What agent can do)
    │   ├─ Reasoning
    │   ├─ Tool Use
    │   ├─ Synthesis
    │   └─ Validation
    │
    └─ Tools (What agent can use)
        ├─ Calculator
        ├─ File System
        ├─ Node Execution
        └─ Python Execution
```

### Example: ReAct Pattern

```typescript
// Pattern orchestrates capabilities
async function execute(context: AgentContext) {
  // 1. Reason about the problem
  const reasoning = await reasoningCapability.execute(context);
  
  // 2. Use tools if needed
  const toolResult = await toolUseCapability.execute(context);
  
  // 3. Synthesize final answer
  const answer = await synthesisCapability.execute(context);
  
  return answer;
}
```

### Capability Composition

Each capability is independent but can be composed in different ways:

- **ReAct**: Reason → Tool Use → Synthesize
- **Plan & Validate**: Reason (plan) → Tool Use → Validate → Synthesize
- **Iterative**: Tool Use → Reason (evaluate) → Synthesize → Repeat

---

## Adding Custom Patterns

Create a new file in `api/src/patterns/`:

```typescript
import { Pattern, PatternResult, AgentContext } from '../types';

export class MyPattern extends Pattern {
  name = 'my_pattern';
  description = 'My custom pattern';

  async execute(context: AgentContext): Promise<PatternResult> {
    // Compose capabilities in your own way
    const step1 = await this.reasoning.execute(context);
    const step2 = await this.toolUse.execute(context);
    const answer = await this.synthesis.execute(context);
    
    return answer;
  }
}
```

Register it in `api/src/orchestrator/orchestrator.ts`:

```typescript
import { MyPattern } from '../patterns/my-pattern';

const patterns = [
  new ReActPattern(...),
  new PlanAndValidatePattern(...),
  new MyPattern(...)  // ← Add here
];
```

---

## Metrics

### Execution Time
- **ReAct**: ~50-200ms per iteration (depends on LLM)
- **Plan & Validate**: ~100-300ms (multiple steps)
- **Iterative**: ~200-500ms+ (multiple passes)

### Token Usage
- **ReAct**: ~500-2000 tokens per execution
- **Plan & Validate**: ~1000-3000 tokens
- **Iterative**: ~2000-5000+ tokens (scales with iterations)

---

## Testing Patterns

```bash
# Test specific pattern
npm run test:pattern -- react

# Run integration tests
npm run test:orchestrator -- react "Your prompt here"

# With logging
DEBUG=true npm run test:pattern -- react
```

See [Testing Guide](./testing.md) for details.
