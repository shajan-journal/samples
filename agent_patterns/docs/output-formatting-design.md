# Output Formatting Design Proposal

## Problem Statement

LLM output needs to be presented to users through different channels:
- **API responses**: JSON with structured data
- **Terminal/CLI**: Plain text or formatted console output
- **Web UI**: HTML/Markdown with rich formatting
- **Chat interfaces**: Conversational, streaming text
- **Mobile apps**: Compact, mobile-optimized format

Each channel has different formatting requirements, but we want to avoid:
- Duplicating content generation logic
- Excessive LLM calls (cost/latency)
- Tight coupling between generation and presentation

## Approaches

### 1. Prompt-Based Format Instructions ⭐ (Your Option 1)

Include output format requirements directly in the system prompt.

**How it works:**
```typescript
// API layer modifies prompt based on output target
const formatInstruction = outputTarget === 'api' 
  ? "Return response as JSON with 'answer' and 'confidence' fields."
  : outputTarget === 'terminal'
  ? "Return plain text response, max 80 chars per line."
  : "Return response in markdown format.";

// Add to synthesis prompt
synthesisPrompt += `\n\nOUTPUT FORMAT: ${formatInstruction}`;
```

**Pros:**
- ✅ Single LLM call (no extra cost)
- ✅ LLM can adapt content to format (e.g., shorter for mobile)
- ✅ Simple to implement
- ✅ Works with current architecture

**Cons:**
- ❌ Format instructions clutter reasoning prompts
- ❌ Less control over exact formatting
- ❌ Hard to guarantee structure (LLM might not follow exactly)
- ❌ Mixing concerns (content + presentation)

**Use case:** Simple formatting needs, when LLM flexibility is desired.

---

### 2. Post-Processing LLM Phase (Your Option 2)

Separate LLM call to reformat existing output.

**How it works:**
```typescript
// Generate content normally
const content = await synthesisCapability.execute(context);

// Reformat with second LLM call
const formatted = await formattingLLM.reformat(content, {
  target: 'api',
  schema: { answer: 'string', confidence: 'number' }
});
```

**Pros:**
- ✅ Clean separation of concerns
- ✅ Can optimize each LLM call separately
- ✅ Content generation unaware of presentation
- ✅ Can improve/enhance content during formatting

**Cons:**
- ❌ Extra LLM call (2x cost, 2x latency)
- ❌ Potential for information loss
- ❌ More complex error handling
- ❌ Inconsistency between calls

**Use case:** When high-quality formatting is critical, cost is acceptable.

---

### 3. Output Adapter Pattern (Code-Based) ⭐⭐ **RECOMMENDED**

Transform ExecutionEvents programmatically based on output target.

**How it works:**
```typescript
interface OutputAdapter {
  format(events: ExecutionEvent[]): OutputFormat;
}

class APIAdapter implements OutputAdapter {
  format(events: ExecutionEvent[]) {
    const answer = extractFinalAnswer(events);
    const tools = extractToolsUsed(events);
    const visualizations = extractVisualizations(events);
    
    return {
      answer,
      metadata: { tools, visualizations },
      timestamp: Date.now()
    };
  }
}

class TerminalAdapter implements OutputAdapter {
  format(events: ExecutionEvent[]) {
    return events
      .filter(e => e.eventType !== 'debug')
      .map(e => this.formatEvent(e))
      .join('\n');
  }
}

// Usage
const adapter = createAdapter(outputTarget);
const formatted = adapter.format(collectedEvents);
```

**Pros:**
- ✅ No extra LLM calls (free, instant)
- ✅ Deterministic, testable
- ✅ Complete control over format
- ✅ Can validate output structure
- ✅ Easy to add new formats
- ✅ Separation of concerns

**Cons:**
- ❌ Can't improve/enhance content
- ❌ Limited to transforming existing data
- ❌ Requires maintaining adapter code

**Use case:** Most common case - formatting without content changes.

---

### 4. Capability-Based Formatting

Add FormattingCapability to pattern execution flow.

**How it works:**
```typescript
class FormattingCapability extends BaseCapability {
  async execute(context: AgentContext): Promise<CapabilityResult> {
    const outputFormat = context.config.outputFormat;
    
    if (outputFormat === 'default') {
      return this.success(context.state.answer);
    }
    
    // Use LLM to reformat
    const formatted = await this.llm.format(
      context.state.answer,
      outputFormat
    );
    
    return this.success(formatted);
  }
}

// In pattern
if (context.config.outputFormat !== 'default') {
  yield* formattingCapability.execute(context);
}
```

**Pros:**
- ✅ Integrated into pattern flow
- ✅ Only pays cost when needed
- ✅ Can leverage context/tools
- ✅ Follows existing capability pattern

**Cons:**
- ❌ Adds complexity to patterns
- ❌ Still requires LLM call for complex formatting
- ❌ All patterns need to support it

**Use case:** When formatting logic needs access to full agent context.

---

### 5. Structured Output (Modern Approach)

Use LLM structured output APIs (JSON mode, function calling).

**How it works:**
```typescript
// Define output schema
const outputSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    reasoning: { type: 'string' },
    confidence: { type: 'number', min: 0, max: 1 },
    sources: { type: 'array', items: { type: 'string' } }
  },
  required: ['answer']
};

// LLM generates conformant output
const response = await llm.chatWithStructuredOutput(
  messages,
  outputSchema
);
```

**Pros:**
- ✅ Type-safe, guaranteed structure
- ✅ No post-processing needed
- ✅ Single LLM call
- ✅ Modern best practice
- ✅ Validation built-in

**Cons:**
- ❌ Requires OpenAI's JSON mode or similar
- ❌ Not all LLMs support it
- ❌ Less flexible (must fit schema)
- ❌ May constrain LLM creativity

**Use case:** API responses, when structure matters more than flexibility.

---

### 6. Template-Based with Optional Enhancement (Hybrid)

Use templates for simple transforms, LLM for complex ones.

**How it works:**
```typescript
class HybridFormatter {
  async format(content: string, target: OutputTarget) {
    const template = this.getTemplate(target);
    
    // Try template first
    if (this.canUseTemplate(content, template)) {
      return this.applyTemplate(content, template);
    }
    
    // Fall back to LLM for complex cases
    return this.llmFormat(content, target);
  }
}

// Templates for common cases
const templates = {
  api: (content) => ({ answer: content, status: 'success' }),
  terminal: (content) => wrapText(content, 80),
  markdown: (content) => `### Response\n\n${content}`
};
```

**Pros:**
- ✅ Fast for simple cases
- ✅ High quality for complex cases
- ✅ Cost-effective (most are template-based)
- ✅ Graceful degradation

**Cons:**
- ❌ Complex logic to decide which path
- ❌ Need to maintain templates
- ❌ Inconsistent formatting approach

**Use case:** When you have predictable patterns but need flexibility.

---

## Recommendation: Layered Approach

**Primary Strategy: Output Adapter Pattern (#3)**

For 90% of cases, use pure code transformation:

```typescript
// 1. Define adapter interface
interface OutputAdapter {
  format(events: ExecutionEvent[]): any;
  supports(target: string): boolean;
}

// 2. Implement adapters for each target
class APIAdapter implements OutputAdapter {
  supports(target: string) { return target === 'api'; }
  
  format(events: ExecutionEvent[]) {
    return {
      answer: extractFinalAnswer(events),
      metadata: {
        pattern: extractPattern(events),
        tools: extractToolsUsed(events),
        visualizations: extractVisualizations(events),
        duration: extractDuration(events)
      },
      success: hasNoErrors(events)
    };
  }
}

class TerminalAdapter implements OutputAdapter {
  supports(target: string) { return target === 'terminal' || target === 'cli'; }
  
  format(events: ExecutionEvent[]) {
    const lines = [];
    
    for (const event of events) {
      if (event.eventType === 'step' && event.data.type === 'answer') {
        lines.push(event.data.content);
      }
      if (event.visualizations) {
        lines.push('[Visualization generated]');
      }
    }
    
    return lines.join('\n');
  }
}

class MarkdownAdapter implements OutputAdapter {
  supports(target: string) { return target === 'markdown' || target === 'web'; }
  
  format(events: ExecutionEvent[]) {
    const answer = extractFinalAnswer(events);
    const tools = extractToolsUsed(events);
    
    let md = `## Response\n\n${answer}\n\n`;
    
    if (tools.length > 0) {
      md += `### Tools Used\n${tools.map(t => `- ${t}`).join('\n')}\n\n`;
    }
    
    return md;
  }
}

// 3. Registry for adapters
class OutputAdapterRegistry {
  private adapters = new Map<string, OutputAdapter>();
  
  register(name: string, adapter: OutputAdapter) {
    this.adapters.set(name, adapter);
  }
  
  get(target: string): OutputAdapter {
    for (const adapter of this.adapters.values()) {
      if (adapter.supports(target)) {
        return adapter;
      }
    }
    return this.adapters.get('default')!;
  }
}

// 4. Usage
const registry = new OutputAdapterRegistry();
registry.register('api', new APIAdapter());
registry.register('terminal', new TerminalAdapter());
registry.register('markdown', new MarkdownAdapter());

// In orchestrator or API layer
const adapter = registry.get(req.query.format || 'api');
const formatted = adapter.format(events);
res.json(formatted);
```

**Why this is best:**
1. **Fast & Free**: No LLM calls for formatting
2. **Deterministic**: Same input = same output
3. **Testable**: Easy to unit test each adapter
4. **Extensible**: Add new formats without changing patterns
5. **Type-safe**: Full TypeScript support
6. **Separation of concerns**: Patterns don't know about presentation

**When to add LLM formatting:**

Only add LLM-based formatting (Option 2 or 4) for specific cases:

1. **Content enhancement**: "Make this more concise"
2. **Language translation**: "Translate to Spanish"
3. **Tone adjustment**: "Make this more formal"
4. **Complex restructuring**: "Convert to Q&A format"

For these, add an **optional** FormattingCapability:

```typescript
// Only used when needed
if (context.config.enhanceOutput) {
  const formattingCapability = new FormattingCapability(llm);
  const enhanced = await formattingCapability.execute({
    ...context,
    instruction: context.config.outputInstruction
  });
}
```

**For visualizations:** Keep existing manifest approach - it's working well.

---

## Implementation Plan

### Phase 1: Core Adapter System
1. Create `src/output/` directory
2. Define `OutputAdapter` interface
3. Implement 3 adapters: API, Terminal, Markdown
4. Create `OutputAdapterRegistry`
5. Add tests for each adapter

### Phase 2: Integration
1. Add `format` parameter to API endpoints
2. Update orchestrator to accept output target
3. Apply formatting in API routes
4. Document in README

### Phase 3: Optional Enhancement (Future)
1. Add `FormattingCapability` for complex cases
2. Implement with conditional usage
3. Add configuration for when to use

### Phase 4: Structured Output (Future)
1. Add structured output support to OpenAI provider
2. Define schemas for common response types
3. Use for API responses when possible

---

## Example Usage

### API Response
```typescript
// Request: GET /api/execute?pattern=react&input=Calculate+2+2&format=api

// Response:
{
  "answer": "The result is 4",
  "metadata": {
    "pattern": "react",
    "tools": ["calculator"],
    "visualizations": [],
    "duration": 1234
  },
  "success": true
}
```

### Terminal Output
```typescript
// Request: Same with format=terminal

// Response:
Analyzing request...
Using calculator tool...
The result is 4
```

### Markdown Output
```typescript
// Request: Same with format=markdown

// Response:
## Response

The result is 4

### Tools Used
- calculator

*Completed in 1.2s*
```

### Web UI (Rich)
```typescript
// Request: Same with format=web

// Response:
{
  "html": "<div class='agent-response'>...</div>",
  "metadata": {...},
  "visualizations": [...]
}
```

---

## Comparison Summary

| Approach | LLM Calls | Cost | Latency | Flexibility | Control | Complexity |
|----------|-----------|------|---------|-------------|---------|------------|
| Prompt-based | 1 | Low | Low | High | Low | Low |
| Post-process LLM | 2 | High | High | High | Medium | Medium |
| **Output Adapter** | **0** | **None** | **None** | **Medium** | **High** | **Low** |
| Capability-based | 1+ | Medium | Medium | High | High | High |
| Structured Output | 1 | Low | Low | Low | High | Medium |
| Hybrid Template | 0-1 | Low | Low | High | High | High |

---

## Decision

**Recommendation: Output Adapter Pattern (#3) as primary approach**

**Rationale:**
1. Current system already streams ExecutionEvents - perfect for transformation
2. No performance/cost impact
3. Clean separation matches existing architecture (Orchestrator → Pattern → Capability)
4. Easy to test and maintain
5. Can add LLM formatting later if needed for specific cases

**Implementation effort:** ~4 hours
- 2 hours: Core adapters + registry
- 1 hour: API integration
- 1 hour: Tests + documentation

**Next steps:**
1. Create output adapter system
2. Update API to use adapters
3. Document format parameter
4. Add tests
5. (Optional) Add FormattingCapability for enhancement cases
