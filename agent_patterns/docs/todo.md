# Current Issues and Next Steps

## Primary Issue: Iteration 2 Empty LLM Response

### Symptom
When testing string reversal with the ReAct pattern:
- **Iteration 1**: LLM correctly identifies the task and calls `python_execute` tool
- **Tool Execution**: Python tool successfully returns reversed string
- **Iteration 2**: ReasoningCapability calls LLM to synthesize results, but LLM returns empty content

### Debug Evidence
```
[DEBUG] About to call LLM with X messages
[ERROR] LLM returned empty content! Stream finished without any content.
```

The `[DEBUG] Raw LLM output:` log never appears, indicating the LLM stream completes without generating any content.

### Root Cause Hypothesis
After receiving tool results, the LLM may be:
1. Confused about what to do next (no clear synthesis instruction)
2. Seeing conflicting signals (shouldSuggestCode logic may still be suggesting tool use)
3. Missing context about conversation state (system message positioning)

### Fixes Already Implemented

#### ✅ System Message Positioning (reasoning.ts:58-62)
```typescript
// PREPEND system message to beginning for maximum impact
messages.unshift({
  role: "system",
  content: systemMessage,
});
```
**Rationale**: System messages at end of conversation are ignored by LLMs.

#### ✅ State-Aware Code Suggestions (reasoning.ts:38)
```typescript
const shouldSuggestCode = !hasToolResults && hasCodeExecution && 
  (explicitlyAsksForTools || isAlgorithmicTask);
```
**Rationale**: Don't suggest code execution after tools have already run.

#### ✅ Post-Tool-Results Guidance (reasoning.ts:172-175)
```typescript
if (hasToolResults) {
  systemMessage += `\n\nIMPORTANT: Tool results are available in the conversation. 
  Analyze the results and provide a clear answer. Do NOT request to use tools again.`;
}
```
**Rationale**: Explicitly instruct LLM to synthesize results, not request more tools.

#### ✅ NEXT_ACTION Parsing (reasoning.ts:221-222)
```typescript
const normalizedAction = action.replace(/[.,!?;]+$/g, '').trim().toLowerCase();
if (normalizedAction === "none") {
```
**Rationale**: Handle "None.", "none!", etc. in structured output parsing.

#### ✅ Python Expression Auto-Wrapping (python-execution.ts:93-125)
```typescript
private wrapCodeForOutput(code: string): string {
  // Auto-wrap expressions in print() for output capture
  if (!hasStatements && !hasReturn && !hasPrint) {
    return `print(${trimmedCode})`;
  }
  return code;
}
```
**Rationale**: Expressions like `"string"[::-1]` evaluate but don't produce stdout.

### Verification Needed

1. **End-to-End Test**: Run string reversal request with OpenAI to confirm Iteration 2 completes
2. **Log Analysis**: Check if empty response still occurs with latest fixes
3. **Alternative Prompts**: Test with different phrasings ("reverse the string hello", "what is hello backwards")

### Next Actions

- [ ] **Test with OpenAI**: Verify string reversal completes successfully with real LLM
- [ ] **Add Fallback**: If LLM returns empty content in Iteration 2, use SynthesisCapability with explicit prompt
- [ ] **Enhanced Logging**: Add LLM request/response logging to identify what's being sent vs returned
- [ ] **Alternative Test Cases**: Try other algorithmic tasks (sorting, calculating) to see if issue is specific to string reversal

## Secondary Tasks

### Documentation
- [x] Update architecture.md with code execution tools section
- [x] Update prd.md with completed features
- [x] Update README.md with new examples and troubleshooting
- [x] Update current_state.md with sections 9-11
- [x] Create this todo.md file

### Code Quality
- [ ] Add integration test for string reversal end-to-end
- [ ] Add test for Iteration 2 synthesis after tool execution
- [ ] Consider refactoring shouldSuggestCode logic into separate function
- [ ] Add metrics for LLM response times and token usage

### Future Enhancements
- [ ] Add retry logic for empty LLM responses
- [ ] Implement streaming feedback to UI during tool execution
- [ ] Add conversation branching for "what if" scenarios
- [ ] Support for tool chaining (use output of one tool as input to another)

## Known Limitations

1. **Python Timeout**: Currently 5 seconds, may need adjustment for longer-running scripts
2. **Node Sandbox**: vm.Script has limited security guarantees, consider vm2 or isolated-vm
3. **No Error Recovery**: If LLM returns invalid JSON or empty content, pattern fails
4. **Single Pattern**: Only ReAct implemented, no planning or reflection patterns yet
5. **No Streaming to Tools**: Tool execution blocks until complete, no progress updates

## Testing Strategy

### Unit Tests (216 passing)
- ✅ All capabilities, tools, patterns, LLM providers
- ✅ Python expression wrapping
- ✅ NEXT_ACTION parsing with punctuation
- ✅ Tool registration in startup

### Integration Tests Needed
- [ ] String reversal end-to-end with OpenAI
- [ ] Multi-turn conversation with tool execution
- [ ] Synthesis after tool results
- [ ] Error handling for empty LLM responses
- [ ] Code execution with various Python/JavaScript snippets

### Manual Testing
- [ ] Test all example queries from README.md
- [ ] Verify debug logs show complete LLM interactions
- [ ] Test JSON download functionality
- [ ] Test conversation history persistence across requests
- [ ] Verify split-panel UI responsiveness
