# Product Requirements Document: Agentic AI Patterns Exploration

## Project Overview
A collection of simple, illustrative samples demonstrating different agentic AI patterns using composable agent capabilities. Focus is on quick exploration and learning, not production-grade implementation.

**Tech Stack**: Node.js / TypeScript

## Goals
- Demonstrate core agent capabilities in isolation
- Illustrate how to compose capabilities into standard agentic patterns
- Provide clear, minimal examples for learning and experimentation
- Enable rapid prototyping of different agent architectures

## Core Agent Capabilities

### 1. Planning Agent
Breaks down complex tasks into actionable steps with dependencies and sequencing.

### 2. Reasoning Agent
Performs logical deduction and inference over available information to reach conclusions.

### 3. Reflection Agent
Analyzes past actions and outcomes to improve future decisions and behavior.

### 4. Critique Agent
Evaluates outputs for quality, correctness, and alignment with goals or constraints.

### 5. Tool-Use Agent
Executes external functions/APIs and processes their results to accomplish tasks.

### 6. Memory Agent
Maintains context across interactions, storing and retrieving relevant information.

### 7. JIT Agent (Just-In-Time Composition)
Analyzes incoming problems and dynamically selects/composes the most appropriate pattern and capabilities for solving them.

### 8. Summarization Agent
Condenses large amounts of information into concise summaries while preserving key points.

### 9. Extraction Agent
Pulls specific structured data or facts from unstructured text based on defined criteria.

### 10. Validation Agent
Checks outputs, data, or decisions against predefined rules, constraints, or quality criteria.

### 11. Comparison Agent
Analyzes multiple items systematically to identify similarities, differences, and relative strengths.

### 12. Synthesis Agent
Combines information from multiple sources into coherent, unified insights or conclusions.

## Agentic Patterns to Implement

### 1. ReAct (Reasoning + Acting)
Interleaves reasoning traces with action execution in a loop until task completion.

### 2. Plan-and-Execute
Creates a complete plan upfront, then executes steps sequentially with error handling.

### 3. ReWOO (Reasoning WithOut Observation)
Plans all tool calls upfront in a single reasoning step, then executes them in parallel.

### 4. Reflection
Generates output, critiques it, refines based on feedback in iterative cycles.

### 5. Self-Critique Loop
Agent generates solution, self-critiques, and iteratively improves until quality threshold met.

### 6. Multi-Agent Collaboration
Multiple specialized agents work together, passing intermediate results and context.

### 7. Chain-of-Thought
Explicitly generates step-by-step reasoning before taking any actions or providing final answer.

### 8. Tree-of-Thoughts
Explores multiple reasoning paths in parallel, evaluates them, and selects the most promising approach.

### 9. Iterative Refinement
Generates initial output, then makes multiple refinement passes based on validation and critique.

### 10. Ensemble
Runs multiple agents/approaches in parallel and aggregates their outputs through voting or weighted combination.

### 11. Retrieval-Augmented
Fetches relevant context/knowledge first, then reasons over retrieved information to answer query.

## Technical Approach

### Architecture
- Each capability implemented as an independent, composable function/class
- Patterns compose capabilities using simple orchestration logic
- Clean separation between capability logic and pattern orchestration

### Agent Interface
- Standardized input/output contract for all capabilities
- Simple context/state passing mechanism
- Minimal abstraction layers

### LLM Integration
- Provider-agnostic design (OpenAI, Anthropic, etc.)
- Simple prompt templates for each capability
- Basic retry and error handling

### Examples Structure
```
/capabilities      # Individual agent capabilities
/patterns          # Composed agentic patterns
/examples          # Sample use cases for each pattern
/utils             # Shared helpers and types
/ui                # User interface and debug views
```

## User Interface

### Main UI
- Agent type selector dropdown/menu
- Chat interface with message history
- Streaming response display as agent generates output
- Simple, clean conversation view

### Debug UI (Separate View)
- Real-time display of prompts sent to the model
- Tool definitions and schemas
- Tool call requests and responses
- Model parameters and configuration
- Token usage and timing information
- Full conversation state/context
- Toggle-able detailed logging view

## Scenario

See [scenario.md](scenario.md) for detailed problem domain, use cases, and tools.

**Focus**: Code generation and execution for data analysis and visualization tasks.

**Core Problem**: Generate Python code that downloads, analyzes, and visualizes tabular data based on user requests.

## Out of Scope
- Production-ready error handling and resilience
- Authentication and security features
- Persistent storage or databases (beyond in-memory for current session)
- Advanced observability and monitoring (beyond debug UI)
- Cost optimization and caching strategies
- Multi-tenancy or scaling concerns
- Mobile responsive design or accessibility features

## Success Criteria
- Each capability can run independently with clear demonstrations
- Each pattern has at least one working example
- Code is readable and well-commented for learning purposes
- Patterns can be mixed and matched to create new variations
- Setup and running examples takes < 5 minutes
- No paid APIs or complex authentication required (mock provider available)
- All external tools work via simple npm install

## Implementation Status

**Completed (Steps 1-6):**
- ✅ Core types and TypeScript interfaces
- ✅ Basic tools: Calculator, FileSystem
- ✅ LLM providers: OpenAI, Mock
- ✅ Capabilities: Reasoning, ToolUse
- ✅ Patterns: ReAct
- ✅ Orchestrator: Unified execution engine
- ✅ 160 tests passing

**In Progress (Steps 7-13):**
- 🚧 API Layer (Express + SSE)
- 🚧 UI Layer (Next.js)
- 🚧 Code Execution Tools (Node, Python)
- 🚧 Additional Patterns
- 🚧 Additional Capabilities
- 🚧 Visualization Support
- 🚧 Advanced Features

