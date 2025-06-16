// src/app/actions.ts
'use server';

import { z } from 'zod';
import {
  chatTutor as chatTutorFlow,
  type ChatTutorInput,
  type ChatTutorOutput
} from '@/ai/flows/chat-tutor';
import {
  generateFaq as generateFaqFlow,
  type GenerateFaqInput,
  type GenerateFaqOutput
} from '@/ai/flows/generate-faq';
import {
  generateTopics as generateTopicsFlow,
  type GenerateTopicsInput,
  type GenerateTopicsOutput
} from '@/ai/flows/generate-topics';
import {
  generateMindMap as generateMindMapFlow,
  type GenerateMindMapInput,
  type GenerateMindMapOutput
} from '@/ai/flows/generate-mind-map';
import {
  generatePodcastScript as generatePodcastScriptFlow,
  type GeneratePodcastScriptInput,
  type GeneratePodcastScriptOutput
} from '@/ai/flows/generate-podcast-script';

export async function chatTutor(input: ChatTutorInput): Promise<ChatTutorOutput> {
  try {
    return await chatTutorFlow(input);
  } catch (error) {
    console.error("Error in chatTutor server action:", error);
    throw new Error("Failed to get response from AI tutor.");
  }
}

export async function generateFaq(input: GenerateFaqInput): Promise<GenerateFaqOutput> {
   try {
    return await generateFaqFlow(input);
  } catch (error) {
    console.error("Error in generateFaq server action:", error);
    throw new Error("Failed to generate FAQ.");
  }
}

export async function generateTopics(input: GenerateTopicsInput): Promise<GenerateTopicsOutput> {
  try {
    return await generateTopicsFlow(input);
  } catch (error) {
    console.error("Error in generateTopics server action:", error);
    throw new Error("Failed to generate topics.");
  }
}

export async function generateMindMap(input: GenerateMindMapInput): Promise<GenerateMindMapOutput> {
   try {
    return await generateMindMapFlow(input);
  } catch (error) {
    console.error("Error in generateMindMap server action:", error);
    throw new Error("Failed to generate mind map.");
  }
}

export async function generatePodcastScript(input: GeneratePodcastScriptInput): Promise<GeneratePodcastScriptOutput> {
  try {
    return await generatePodcastScriptFlow(input);
  } catch (error) {
    console.error("Error in generatePodcastScript server action:", error);
    throw new Error("Failed to generate podcast script.");
  }
}

// Schema for the output of the external data fetch
const ExternalDataSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});
export type ExternalData = z.infer<typeof ExternalDataSchema>;

/**
 * Fetches data from an external API.
 * This is an example of how to connect to your own backend.
 * @param id - The ID of the resource to fetch (e.g., a todo item ID).
 * @returns A promise that resolves to the fetched and validated data.
 */
export async function fetchExternalData(id: number): Promise<ExternalData> {
  try {
    // Replace this URL with your actual backend API endpoint
    const response = await fetch(`http://localhost:5000/todos/${id}`);
    
    if (!response.ok) {
      // You might want to handle different statuses differently
      throw new Error(`API call failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate the structure of the data received from the API
    const validatedData = ExternalDataSchema.parse(data);
    
    return validatedData;
  } catch (error) {
    console.error("Error in fetchExternalData server action:", error);
    if (error instanceof z.ZodError) {
      // This means the data from the API didn't match the expected schema
      throw new Error(`Data validation failed: ${error.message}`);
    }
    // For other errors (network issues, API errors handled above, etc.)
    throw new Error("Failed to fetch external data. Please check the console for more details.");
  }
}
