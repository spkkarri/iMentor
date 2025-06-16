'use server';

/**
 * @fileOverview Generates frequently asked questions (FAQ) based on the content of a document.
 *
 * - generateFaq - A function that handles the FAQ generation process.
 * - GenerateFaqInput - The input type for the generateFaq function.
 * - GenerateFaqOutput - The return type for the generateFaq function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFaqInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the document to generate FAQs from.'),
});
export type GenerateFaqInput = z.infer<typeof GenerateFaqInputSchema>;

const GenerateFaqOutputSchema = z.object({
  faqList: z
    .string()
    .describe('A list of frequently asked questions based on the document content.'),
});
export type GenerateFaqOutput = z.infer<typeof GenerateFaqOutputSchema>;

export async function generateFaq(input: GenerateFaqInput): Promise<GenerateFaqOutput> {
  return generateFaqFlow(input);
}

const generateFaqPrompt = ai.definePrompt({
  name: 'generateFaqPrompt',
  input: {schema: GenerateFaqInputSchema},
  output: {schema: GenerateFaqOutputSchema},
  prompt: `You are an expert at generating frequently asked questions (FAQ) from documents.

  Generate a list of frequently asked questions based on the content of the following document:

  Document Content: {{{documentContent}}}

  Format the FAQ list as a string.
  `,
});

const generateFaqFlow = ai.defineFlow(
  {
    name: 'generateFaqFlow',
    inputSchema: GenerateFaqInputSchema,
    outputSchema: GenerateFaqOutputSchema,
  },
  async input => {
    const {output} = await generateFaqPrompt(input);
    return output!;
  }
);
