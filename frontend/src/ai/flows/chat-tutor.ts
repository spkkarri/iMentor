// src/ai/flows/chat-tutor.ts
'use server';

/**
 * @fileOverview A chat tutor AI agent that can answer questions about uploaded documents.
 *
 * - chatTutor - A function that handles the chat tutor process.
 * - ChatTutorInput - The input type for the chatTutor function.
 * - ChatTutorOutput - The return type for the chatTutor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatTutorInputSchema = z.object({
  documentContent: z
    .string()
    .describe('The content of the uploaded document.'),
  question: z.string().describe('The question to ask the AI tutor.'),
});
export type ChatTutorInput = z.infer<typeof ChatTutorInputSchema>;

const ChatTutorOutputSchema = z.object({
  answer: z.string().describe('The answer from the AI tutor.'),
});
export type ChatTutorOutput = z.infer<typeof ChatTutorOutputSchema>;

export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  return chatTutorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatTutorPrompt',
  input: {schema: ChatTutorInputSchema},
  output: {schema: ChatTutorOutputSchema},
  prompt: `You are an AI tutor specializing in answering questions about documents.

  Use the following document content to answer the user's question.

  Document Content: {{{documentContent}}}

  Question: {{{question}}}

  Answer:`, 
});

const chatTutorFlow = ai.defineFlow(
  {
    name: 'chatTutorFlow',
    inputSchema: ChatTutorInputSchema,
    outputSchema: ChatTutorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
