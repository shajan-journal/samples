import { z } from 'zod';
import { tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const tools = {
  get_context: tool({
    description: 'Get project context',
    parameters: z.object({
      url: z.string()
    }),
    execute: async (args) => ({ received: args })
  })
};

console.log('Tools created');

(async () => {
  try {
    // Try with responses API - just use openai() directly
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Get context for url test.com',
      tools: tools
    });
    console.log('Success!', result.text);
  } catch (e: any) {
    console.error('Error:', e.message);
    if (e.responseBody) {
      console.error('Response body:', e.responseBody);
    }
  }
})();
