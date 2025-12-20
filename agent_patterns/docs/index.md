# Documentation Index

Welcome to the Agentic AI Patterns documentation. Start here to navigate the project.

## Quick Links

**First time?** → [Getting Started](./GETTING_STARTED.md) (5 minutes)

**Want to understand the system?** → [Architecture](./architecture.md)

**Ready to build?** → [Patterns](./PATTERNS.md) • [Tools](./TOOLS.md)

---

## Documentation Overview

### Getting Started
- [Getting Started](./getting-started.md) - Quick 5-minute setup and first steps

### Understanding the System
- [Architecture](./architecture.md) - System design and how components work together
- [Visualization Contract](./visualization-contract.md) - How visualizations work end-to-end
- [Contract Enforcement](./contract-enforcement.md) - How the system enforces contracts

### Building & Development
- [Patterns](./patterns.md) - Available agentic patterns (ReAct, Plan-and-Validate, etc.)
- [Tools](./tools.md) - Available tools and how to create custom tools
- [Configuration](./config.md) - Environment variables and configuration options
- [Testing](./testing.md) - How to test the system

### Design & Implementation
- [Output Formatting Design](./output-formatting-design.md) - Design of output adapters
- [Output Adapter Implementation](./output-adapter-implementation.md) - Technical implementation details
- [PRD](./prd.md) - Product requirements document (initial specification)
- [Scenario](./scenario.md) - Use case scenarios

### Development Notes
- [Current State](./current_state.md) - Current implementation status
- [Next Steps](./next_step.md) - Planned improvements
- [Memory](./memory.md) - Development progress log

---

## Architecture at a Glance

```
User Interface (Next.js/React)
    ↓
API Server (Express, TypeScript)
    ├─ Orchestrator
    │   └─ Patterns (ReAct, Plan-and-Validate, Iterative)
    │       ├─ Capabilities (Reasoning, Tool Use, Synthesis, Validation)
    │       └─ Tools (Calculator, File System, Node Exec, Python Exec)
    ├─ LLM Providers (OpenAI, Anthropic, Mock)
    └─ Output Adapters (API, Terminal, Markdown)
```

## Key Concepts

### Patterns
Compositions of capabilities that define how agents behave:
- **ReAct**: Think → Act → Observe → Repeat
- **Plan-and-Validate**: Plan → Execute → Validate → Refine
- **Iterative**: Execute → Evaluate → Refine → Repeat

### Capabilities
Individual agent skills:
- **Reasoning**: Think through problems
- **Tool Use**: Decide and call tools
- **Synthesis**: Summarize and answer
- **Validation**: Check work quality

### Tools
External actions agents can perform:
- **Calculator**: Math expressions
- **File System**: Read/write files
- **Node Execution**: JavaScript code
- **Python Execution**: Python code + visualizations

### Visualizations
Data visualization system:
- Python code generates CSV + JSON manifest
- API parses CSV into data arrays
- Frontend renders charts (Bar, Line, Scatter, Pie)

---

## Common Tasks

### I want to...

**Run the system**
→ [Getting Started](./getting-started.md)

**Understand how it works**
→ [Architecture](./architecture.md)

**Add a custom pattern**
→ [Patterns](./patterns.md) (Custom Patterns section)

**Add a custom tool**
→ [Tools](./tools.md) (Custom Tools section)

**Change configuration**
→ [Configuration](./CONFIG.md)

**Write tests**
→ [Testing](./testing.md)

**Generate visualizations**
→ [Tools - Python Execution](./tools.md#python-execution) + [Visualization Contract](./visualization-contract.md)

**Deploy to production**
→ [Architecture](./architecture.md) (Deployment section)

---

## File Structure

```
docs/
├── GETTING_STARTED.md              # Quick start guide
├── PATTERNS.md                     # Available patterns
├── TOOLS.md                        # Available tools
├── TESTING.md                      # Testing guide
├── CONFIG.md                       # Configuration reference
├── architecture.md                 # System design
├── VISUALIZATION_CONTRACT.md       # Visualization spec
├── CONTRACT_ENFORCEMENT.md         # How contracts are enforced
├── output-formatting-design.md     # Output adapter design
├── output-adapter-implementation.md # Implementation details
├── prd.md                          # Product requirements
├── scenario.md                     # Use case scenarios
├── current_state.md                # Current status
├── next_step.md                    # Future plans
└── memory.md                       # Development log
```

---

## Technology Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Testing**: Jest (API), Vitest (UI)
- **Charts**: Recharts (React)
- **Data**: CSV parsing, JSON manifests
- **Execution**: Subprocess (Python), VM module (Node.js)

---

## Support

### Resources
- [GitHub Issues](https://github.com/your-repo/issues) - Report bugs
- [Architecture](./architecture.md) - Technical deep dive
- [Testing](./TESTING.md) - Debug and troubleshoot

### Quick Reference
- [Configuration](./CONFIG.md) - All env variables
- [Tools](./TOOLS.md) - Tool usage examples
- [Patterns](./PATTERNS.md) - Available patterns

---

## Getting Help

1. **Check the relevant guide**
   - Problem with setup? → [Getting Started](./getting-started.md)
   - Need to configure something? → [Configuration](./config.md)
   - Building a feature? → [Patterns](./patterns.md) or [Tools](./tools.md)

2. **Check the architecture**
   - Confused about how something works? → [Architecture](./architecture.md)

3. **Check the tests**
   - See examples of usage → Look at `api/tests/` or `ui/__tests__/`

4. **Review error messages**
   - Check visualization issues → [Visualization Contract](./visualization-contract.md)
   - Check execution issues → [Tools](./tools.md)

---

## Contribute

See individual guides for:
- Adding patterns: [Patterns](./patterns.md)
- Adding tools: [Tools](./tools.md)
- Writing tests: [Testing](./testing.md)
- Configuration changes: [Configuration](./config.md)

---

**Last Updated**: December 2025  
**Status**: Active Development  
**Latest Features**: Visualization system, Output adapters, Multiple patterns
