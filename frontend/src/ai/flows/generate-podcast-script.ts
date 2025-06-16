'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a podcast script from a given document.
 *
 * - generatePodcastScript - A function that generates a podcast script based on the content of a document.
 * - GeneratePodcastScriptInput - The input type for the generatePodcastScript function.
 * - GeneratePodcastScriptOutput - The return type for the generatePodcastScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePodcastScriptInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to generate a podcast script from.'),
});
export type GeneratePodcastScriptInput = z.infer<typeof GeneratePodcastScriptInputSchema>;

const GeneratePodcastScriptOutputSchema = z.object({
  podcastScript: z
    .string()
    .describe('The generated podcast script based on the document content.'),
});
export type GeneratePodcastScriptOutput = z.infer<typeof GeneratePodcastScriptOutputSchema>;

export async function generatePodcastScript(input: GeneratePodcastScriptInput): Promise<GeneratePodcastScriptOutput> {
  return generatePodcastScriptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePodcastScriptPrompt',
  input: {schema: GeneratePodcastScriptInputSchema},
  output: {schema: GeneratePodcastScriptOutputSchema},
  prompt: `You are an AI that specializes in creating engaging podcast scripts.

  Based on the content of the document provided, generate a script for a podcast episode that explores the key topics and ideas. The script should be suitable for a conversational format, including an introduction, discussion points, and a conclusion.

  Document Content: {{{documentContent}}}
  `,
});

const generatePodcastScriptFlow = ai.defineFlow(
  {
    name: 'generatePodcastScriptFlow',
    inputSchema: GeneratePodcastScriptInputSchema,
    outputSchema: GeneratePodcastScriptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
