import { generateText, generateObject, stepCountIs, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { weatherTool, calculatorTool, searchTool } from './tools.js';
import type { Response } from 'express';

// Helper to send SSE status updates
function sendStatus(res: Response, status: string, data?: unknown) {
  res.write(`data: ${JSON.stringify({ type: 'status', status, data })}\n\n`);
}

// Helper to send final result
function sendResult(res: Response, result: unknown) {
  res.write(`data: ${JSON.stringify({ type: 'result', ...result as object })}\n\n`);
  res.write(`data: [DONE]\n\n`);
  res.end();
}

// Helper to send error
function sendError(res: Response, error: string) {
  res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
  res.end();
}

/**
 * Streaming ReAct Pattern
 */
export async function streamReActAgent(prompt: string, res: Response) {
  try {
    sendStatus(res, '🔍 Analyzing your request...', { phase: 'init' });

    const result = await generateText({
      model: openai.chat('gpt-4o-mini'),
      system: `You are a helpful assistant that uses tools to answer questions.
    
For each request:
1. THINK: Analyze what information you need
2. ACT: Use the appropriate tool to get that information
3. OBSERVE: Review the tool's output
4. REPEAT: If more information is needed, continue. Otherwise, provide your final answer.

Always explain your reasoning before taking actions.`,
      prompt,
      tools: {
        weather: weatherTool,
        calculator: calculatorTool,
        search: searchTool,
      },
      stopWhen: stepCountIs(10),
      onStepFinish: ({ stepType, toolCalls, toolResults, text }) => {
        if (toolCalls && toolCalls.length > 0) {
          const toolNames = toolCalls.map(tc => tc.toolName).join(', ');
          sendStatus(res, `🔧 Using tools: ${toolNames}`, { 
            phase: 'tool-call',
            tools: toolCalls.map(tc => ({ name: tc.toolName, args: tc.args }))
          });
        }
        if (toolResults && toolResults.length > 0) {
          sendStatus(res, `📊 Got results from tools`, { 
            phase: 'tool-result',
            results: toolResults.map(tr => ({ name: tr.toolName, result: tr.result }))
          });
        }
        if (stepType === 'finish' || text) {
          sendStatus(res, '✨ Generating final response...', { phase: 'finishing' });
        }
      },
    });

    sendResult(res, {
      pattern: 'react',
      text: result.text,
      steps: result.steps.map((step, index) => ({
        stepNumber: index + 1,
        type: step.finishReason,
        toolCalls: step.toolCalls?.map(tc => ({
          tool: tc.toolName,
          args: tc.args,
        })),
        toolResults: step.toolResults?.map(tr => ({
          tool: tr.toolName,
          result: tr.result,
        })),
      })),
      usage: result.usage,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}

/**
 * Streaming Plan and Execute Pattern
 */
export async function streamPlanAndExecute(task: string, res: Response) {
  try {
    const model = openai.chat('gpt-4o-mini');
    
    sendStatus(res, '📋 Creating execution plan...', { phase: 'planning' });

    const { object: plan } = await generateObject({
      model,
      schema: z.object({
        goal: z.string().describe('The main goal to achieve'),
        steps: z.array(z.object({
          id: z.number(),
          action: z.string(),
          reasoning: z.string(),
          dependsOn: z.array(z.number()).optional(),
        })),
        estimatedComplexity: z.enum(['low', 'medium', 'high']),
      }),
      prompt: `Create a detailed plan for the following task: ${task}
      
Break it down into clear, actionable steps. Each step should be specific and achievable.`,
    });

    sendStatus(res, `📝 Plan created with ${plan.steps.length} steps`, { 
      phase: 'plan-ready',
      goal: plan.goal,
      stepCount: plan.steps.length,
      complexity: plan.estimatedComplexity
    });

    const results: Array<{ stepId: number; action: string; result: string }> = [];
    
    for (const step of plan.steps) {
      sendStatus(res, `⚡ Executing step ${step.id}: ${step.action.substring(0, 50)}...`, {
        phase: 'executing',
        currentStep: step.id,
        totalSteps: plan.steps.length,
        action: step.action
      });

      const { text: result } = await generateText({
        model,
        prompt: `Execute this step: ${step.action}
        
Context from previous steps:
${results.map(r => `Step ${r.stepId}: ${r.result}`).join('\n')}

Provide the result of executing this step.`,
      });
      
      results.push({
        stepId: step.id,
        action: step.action,
        result,
      });

      sendStatus(res, `✅ Completed step ${step.id}/${plan.steps.length}`, {
        phase: 'step-complete',
        completedStep: step.id,
        totalSteps: plan.steps.length
      });
    }

    sendStatus(res, '🔄 Synthesizing final result...', { phase: 'synthesizing' });

    const { text: finalResult } = await generateText({
      model,
      prompt: `Synthesize the results of executing this plan:

Goal: ${plan.goal}

Step Results:
${results.map(r => `Step ${r.stepId} (${r.action}): ${r.result}`).join('\n\n')}

Provide a comprehensive final answer.`,
    });

    sendResult(res, {
      pattern: 'plan-execute',
      plan,
      stepResults: results,
      finalResult,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}

/**
 * Streaming Routing Pattern
 */
export async function streamRoutingPattern(input: string, res: Response) {
  try {
    const model = openai.chat('gpt-4o-mini');
    
    sendStatus(res, '🔀 Classifying input...', { phase: 'classifying' });

    const { object: classification } = await generateObject({
      model,
      schema: z.object({
        category: z.enum(['question', 'task', 'creative', 'analysis', 'other']),
        sentiment: z.enum(['positive', 'negative', 'neutral']),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        reasoning: z.string(),
      }),
      prompt: `Classify this input: "${input}"`,
    });

    sendStatus(res, `📊 Classified as: ${classification.category} (${classification.complexity})`, {
      phase: 'classified',
      category: classification.category,
      complexity: classification.complexity,
      sentiment: classification.sentiment
    });

    sendStatus(res, `🎯 Routing to ${classification.complexity === 'complex' ? 'GPT-4o' : 'GPT-4o-mini'}...`, {
      phase: 'routing',
      model: classification.complexity === 'complex' ? 'gpt-4o' : 'gpt-4o-mini'
    });

    const { text: response } = await generateText({
      model: classification.complexity === 'complex' ? openai.chat('gpt-4o') : openai.chat('gpt-4o-mini'),
      system: `You are an expert at handling ${classification.category} requests. 
The user's sentiment is ${classification.sentiment}. Respond appropriately.`,
      prompt: input,
    });

    sendResult(res, {
      pattern: 'routing',
      classification,
      response,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}

/**
 * Streaming Parallel Analysis Pattern
 */
export async function streamParallelAnalysis(content: string, res: Response) {
  try {
    const model = openai.chat('gpt-4o-mini');
    
    sendStatus(res, '⚡ Starting parallel analysis (4 tasks)...', { phase: 'starting' });

    const analyses = ['Summary', 'Key Points', 'Sentiment', 'Questions'];
    
    sendStatus(res, '📝 Running: Summary, Key Points, Sentiment, Questions', {
      phase: 'parallel-start',
      tasks: analyses
    });

    const [summary, keyPoints, sentiment, questions] = await Promise.all([
      (async () => {
        const result = await generateText({
          model,
          prompt: `Provide a concise summary of this content:\n\n${content}`,
        });
        sendStatus(res, '✅ Summary analysis complete', { phase: 'task-complete', task: 'Summary' });
        return result.text;
      })(),
      
      (async () => {
        const result = await generateObject({
          model,
          schema: z.object({
            points: z.array(z.object({
              point: z.string(),
              importance: z.enum(['high', 'medium', 'low']),
            })),
          }),
          prompt: `Extract key points from this content:\n\n${content}`,
        });
        sendStatus(res, '✅ Key Points analysis complete', { phase: 'task-complete', task: 'Key Points' });
        return result.object.points;
      })(),
      
      (async () => {
        const result = await generateObject({
          model,
          schema: z.object({
            overall: z.enum(['positive', 'negative', 'neutral', 'mixed']),
            confidence: z.number().min(0).max(1),
            aspects: z.array(z.object({
              aspect: z.string(),
              sentiment: z.enum(['positive', 'negative', 'neutral']),
            })),
          }),
          prompt: `Analyze the sentiment of this content:\n\n${content}`,
        });
        sendStatus(res, '✅ Sentiment analysis complete', { phase: 'task-complete', task: 'Sentiment' });
        return result.object;
      })(),
      
      (async () => {
        const result = await generateObject({
          model,
          schema: z.object({
            questions: z.array(z.string()),
          }),
          prompt: `Generate follow-up questions for this content:\n\n${content}`,
        });
        sendStatus(res, '✅ Questions generation complete', { phase: 'task-complete', task: 'Questions' });
        return result.object.questions;
      })(),
    ]);

    sendStatus(res, '🎉 All analyses complete!', { phase: 'complete' });

    sendResult(res, {
      pattern: 'parallel',
      summary,
      keyPoints,
      sentiment,
      suggestedQuestions: questions,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}

/**
 * Streaming Evaluator-Optimizer Pattern
 */
export async function streamEvaluatorOptimizer(
  task: string,
  qualityThreshold: number = 8,
  maxIterations: number = 3,
  res: Response
) {
  try {
    const model = openai.chat('gpt-4o-mini');
    let currentOutput = '';
    let currentScore = 0;
    let iteration = 0;
    const feedbackHistory: string[] = [];

    sendStatus(res, '🎯 Starting optimization loop...', { 
      phase: 'init',
      qualityThreshold,
      maxIterations
    });

    while (iteration < maxIterations && currentScore < qualityThreshold) {
      iteration++;
      
      sendStatus(res, `📝 Iteration ${iteration}/${maxIterations}: Generating output...`, {
        phase: 'generating',
        iteration,
        maxIterations
      });

      const { text: output } = await generateText({
        model,
        prompt: iteration === 1
          ? `Complete this task: ${task}`
          : `Improve your previous response based on this feedback:

Previous output: ${currentOutput}

Feedback: ${feedbackHistory[feedbackHistory.length - 1]}

Task: ${task}`,
      });
      currentOutput = output;

      sendStatus(res, `🔍 Iteration ${iteration}: Evaluating quality...`, {
        phase: 'evaluating',
        iteration
      });

      const { object: evaluation } = await generateObject({
        model,
        schema: z.object({
          score: z.number().min(1).max(10),
          strengths: z.array(z.string()),
          weaknesses: z.array(z.string()),
          suggestions: z.string(),
        }),
        prompt: `Evaluate this output for the task "${task}":

${currentOutput}

Rate it 1-10 and provide specific feedback.`,
      });

      currentScore = evaluation.score;
      feedbackHistory.push(evaluation.suggestions);

      sendStatus(res, `📊 Score: ${currentScore}/10 ${currentScore >= qualityThreshold ? '✨' : '(optimizing...)'}`, {
        phase: 'evaluated',
        iteration,
        score: currentScore,
        threshold: qualityThreshold,
        passed: currentScore >= qualityThreshold
      });
    }

    sendStatus(res, currentScore >= qualityThreshold 
      ? '🎉 Quality threshold reached!' 
      : `⚠️ Max iterations reached (score: ${currentScore})`, {
      phase: 'complete',
      finalScore: currentScore,
      iterations: iteration
    });

    sendResult(res, {
      pattern: 'evaluator-optimizer',
      finalOutput: currentOutput,
      finalScore: currentScore,
      iterations: iteration,
      feedback: feedbackHistory,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}

/**
 * Streaming Orchestrator-Worker Pattern
 */
export async function streamOrchestratorWorker(task: string, res: Response) {
  try {
    const model = openai.chat('gpt-4o-mini');

    sendStatus(res, '🎭 Orchestrator analyzing task...', { phase: 'analyzing' });

    const { object: decomposition } = await generateObject({
      model,
      schema: z.object({
        mainGoal: z.string(),
        subtasks: z.array(z.object({
          id: z.number(),
          task: z.string(),
          workerType: z.enum(['researcher', 'writer', 'analyst', 'coder', 'reviewer']),
          priority: z.enum(['high', 'medium', 'low']),
        })),
      }),
      prompt: `Decompose this task into subtasks for specialized workers:

Task: ${task}

Assign each subtask to the most appropriate worker type.`,
    });

    sendStatus(res, `📋 Created ${decomposition.subtasks.length} subtasks`, {
      phase: 'decomposed',
      mainGoal: decomposition.mainGoal,
      subtaskCount: decomposition.subtasks.length,
      workers: decomposition.subtasks.map(s => s.workerType)
    });

    const subtaskResults: Array<{
      id: number;
      task: string;
      workerType: string;
      result: string;
    }> = [];

    for (const subtask of decomposition.subtasks) {
      sendStatus(res, `👷 Worker [${subtask.workerType}] processing: ${subtask.task.substring(0, 40)}...`, {
        phase: 'worker-processing',
        workerId: subtask.id,
        workerType: subtask.workerType,
        task: subtask.task
      });

      const { text: result } = await generateText({
        model,
        system: `You are a specialized ${subtask.workerType}. Focus on your expertise.`,
        prompt: `Complete this subtask: ${subtask.task}

Context: This is part of the larger goal: ${decomposition.mainGoal}`,
      });

      subtaskResults.push({
        id: subtask.id,
        task: subtask.task,
        workerType: subtask.workerType,
        result,
      });

      sendStatus(res, `✅ Worker [${subtask.workerType}] completed task ${subtask.id}/${decomposition.subtasks.length}`, {
        phase: 'worker-complete',
        workerId: subtask.id,
        workerType: subtask.workerType,
        totalWorkers: decomposition.subtasks.length
      });
    }

    sendStatus(res, '🔄 Orchestrator synthesizing results...', { phase: 'synthesizing' });

    const { text: finalResult } = await generateText({
      model,
      prompt: `As the orchestrator, synthesize these worker results into a cohesive final output:

Main Goal: ${decomposition.mainGoal}

Worker Results:
${subtaskResults.map(r => `[${r.workerType}] ${r.task}:\n${r.result}`).join('\n\n')}

Provide a comprehensive final answer.`,
    });

    sendResult(res, {
      pattern: 'orchestrator-worker',
      decomposition,
      subtaskResults,
      finalResult,
    });
  } catch (error) {
    sendError(res, String(error));
  }
}
