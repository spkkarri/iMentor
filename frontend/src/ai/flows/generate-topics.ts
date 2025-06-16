'use server';

/**
 * @fileOverview Generates the main topics covered in a document.
 *
 * - generateTopics - A function that handles the generation of topics from a document.
 * - GenerateTopicsInput - The input type for the generateTopics function.
 * - GenerateTopicsOutput - The return type for the generateTopics function.
 */

import {runAnalysis} from '@/lib/api';
import {z} from 'genkit';

const GenerateTopicsInputSchema = z.object({
  documentText: z.string().describe('The text content of the document.'),
});
export type GenerateTopicsInput = z.infer<typeof GenerateTopicsInputSchema>;

const GenerateTopicsOutputSchema = z.object({
  topics: z.array(z.string()).describe('A list of the main topics covered in the document.'),
});
export type GenerateTopicsOutput = z.infer<typeof GenerateTopicsOutputSchema>;

export async function generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
  // Call Flask backend for topic extraction
  // Assume input.documentText is not needed, only filename (adapt as needed)
  if (!('filename' in input)) {
    throw new Error('Missing filename for backend topic extraction');
  }
  const result = await runAnalysis((input as any).filename, 'topics');
  return {topics: result.topics || []};
}
