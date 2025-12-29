import { generateText, generateObject, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { weatherTool, calculatorTool, searchTool } from './tools.js';

/**
 * ReAct Pattern (Reasoning + Acting)
 * 
 * The model reasons about what to do, takes an action (tool call),
 * observes the result, and repeats until task completion.
 * 
 * Uses generateText with stopWhen for multi-step tool calls.
 */
export async function runReActAgent(prompt: string) {
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
  });

  return result;
}

/**
 * Plan and Execute Pattern
 * 
 * First creates a plan, then executes each step sequentially.
 * Good for complex multi-step tasks.
 */
export async function planAndExecute(task: string, model = openai.chat('gpt-4o-mini')) {
  // Step 1: Create a detailed plan
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

  // Step 2: Execute each step
  const results: Array<{ stepId: number; action: string; result: string }> = [];
  
  for (const step of plan.steps) {
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
  }

  // Step 3: Synthesize final result
  const { text: finalResult } = await generateText({
    model,
    prompt: `Synthesize the results of executing this plan:

Goal: ${plan.goal}

Step Results:
${results.map(r => `Step ${r.stepId} (${r.action}): ${r.result}`).join('\n\n')}

Provide a comprehensive final answer.`,
  });

  return {
    plan,
    stepResults: results,
    finalResult,
  };
}

/**
 * Routing Pattern
 * 
 * Classifies input and routes to specialized handlers.
 * Good for handling diverse input types.
 */
export async function routingPattern(input: string, model = openai.chat('gpt-4o-mini')) {
  // Step 1: Classify the input
  const { object: classification } = await generateObject({
    model,
    schema: z.object({
      type: z.enum(['question', 'calculation', 'research', 'creative', 'technical']),
      complexity: z.enum(['simple', 'moderate', 'complex']),
      reasoning: z.string(),
    }),
    prompt: `Classify this input: "${input}"
    
Determine the type of request and its complexity.`,
  });

  // Step 2: Route to appropriate handler
  const systemPrompts: Record<string, string> = {
    question: 'You are a knowledgeable assistant that answers questions clearly and concisely.',
    calculation: 'You are a mathematical expert. Show your work step by step.',
    research: 'You are a research assistant. Provide comprehensive, well-sourced information.',
    creative: 'You are a creative writer. Be imaginative and engaging.',
    technical: 'You are a technical expert. Provide detailed, accurate technical information.',
  };

  const { text: response } = await generateText({
    model: classification.complexity === 'complex' ? openai.chat('gpt-4o') : openai.chat('gpt-4o-mini'),
    system: systemPrompts[classification.type],
    prompt: input,
  });

  return {
    classification,
    response,
  };
}

/**
 * Parallel Processing Pattern
 * 
 * Runs multiple independent analyses simultaneously.
 * Good for comprehensive analysis tasks.
 */
export async function parallelAnalysis(content: string, model = openai.chat('gpt-4o-mini')) {
  const [sentimentAnalysis, keyPointsExtraction, summaryGeneration] = await Promise.all([
    // Sentiment Analysis
    generateObject({
      model,
      schema: z.object({
        sentiment: z.enum(['positive', 'neutral', 'negative']),
        confidence: z.number(),
        emotionalTones: z.array(z.string()),
      }),
      prompt: `Analyze the sentiment of this content: ${content}`,
    }),

    // Key Points Extraction
    generateObject({
      model,
      schema: z.object({
        keyPoints: z.array(z.object({
          point: z.string(),
          importance: z.enum(['high', 'medium', 'low']),
        })),
      }),
      prompt: `Extract the key points from this content: ${content}`,
    }),

    // Summary Generation
    generateText({
      model,
      prompt: `Provide a concise summary of this content: ${content}`,
    }),
  ]);

  return {
    sentiment: sentimentAnalysis.object,
    keyPoints: keyPointsExtraction.object.keyPoints,
    summary: summaryGeneration.text,
  };
}

/**
 * Evaluator-Optimizer Pattern
 * 
 * Generates output, evaluates it, and iteratively improves.
 * Good for quality-sensitive tasks.
 */
export async function evaluatorOptimizer(
  task: string,
  qualityThreshold: number = 8,
  maxIterations: number = 3,
  model = openai.chat('gpt-4o-mini')
) {
  let currentOutput = '';
  let iteration = 0;
  let evaluation: { qualityScore: number; feedback: string[] } | null = null;

  // Initial generation
  const { text: initialOutput } = await generateText({
    model,
    prompt: task,
  });
  currentOutput = initialOutput;

  // Evaluation-optimization loop
  while (iteration < maxIterations) {
    // Evaluate current output
    const { object: evalResult } = await generateObject({
      model,
      schema: z.object({
        qualityScore: z.number().min(1).max(10),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        specificImprovements: z.array(z.string()),
      }),
      prompt: `Evaluate this output for the task "${task}":

Output: ${currentOutput}

Rate the quality from 1-10 and provide specific feedback.`,
    });

    evaluation = {
      qualityScore: evalResult.qualityScore,
      feedback: evalResult.specificImprovements,
    };

    // Check if quality meets threshold
    if (evalResult.qualityScore >= qualityThreshold) {
      break;
    }

    // Generate improved version
    const { text: improvedOutput } = await generateText({
      model,
      prompt: `Improve this output based on the feedback:

Original Task: ${task}
Current Output: ${currentOutput}

Feedback to address:
${evalResult.specificImprovements.join('\n')}

Provide an improved version.`,
    });

    currentOutput = improvedOutput;
    iteration++;
  }

  return {
    finalOutput: currentOutput,
    iterations: iteration + 1,
    finalScore: evaluation?.qualityScore,
    feedback: evaluation?.feedback,
  };
}

/**
 * Orchestrator-Worker Pattern
 * 
 * An orchestrator breaks down complex tasks and delegates to workers.
 */
export async function orchestratorWorker(task: string, model = openai.chat('gpt-4o-mini')) {
  // Orchestrator: Plan the work
  const { object: workPlan } = await generateObject({
    model,
    schema: z.object({
      subtasks: z.array(z.object({
        id: z.number(),
        task: z.string(),
        workerType: z.enum(['researcher', 'analyzer', 'writer', 'reviewer']),
        priority: z.enum(['high', 'medium', 'low']),
      })),
      dependencies: z.array(z.object({
        taskId: z.number(),
        dependsOn: z.array(z.number()),
      })),
    }),
    system: 'You are a project manager breaking down complex tasks into subtasks.',
    prompt: `Break down this task into subtasks: ${task}`,
  });

  // Workers: Execute subtasks
  const workerSystemPrompts: Record<string, string> = {
    researcher: 'You are a thorough researcher. Find and synthesize information.',
    analyzer: 'You are a data analyst. Analyze information and identify patterns.',
    writer: 'You are a skilled writer. Create clear, engaging content.',
    reviewer: 'You are a quality reviewer. Check for accuracy and completeness.',
  };

  const results = await Promise.all(
    workPlan.subtasks.map(async (subtask) => {
      const { text: result } = await generateText({
        model,
        system: workerSystemPrompts[subtask.workerType],
        prompt: `Complete this subtask: ${subtask.task}`,
      });
      return { ...subtask, result };
    })
  );

  // Orchestrator: Synthesize results
  const { text: finalResult } = await generateText({
    model,
    system: 'You are synthesizing work from multiple team members into a cohesive result.',
    prompt: `Synthesize these subtask results into a final output:

${results.map(r => `[${r.workerType}] ${r.task}: ${r.result}`).join('\n\n')}`,
  });

  return {
    workPlan,
    subtaskResults: results,
    finalResult,
  };
}
