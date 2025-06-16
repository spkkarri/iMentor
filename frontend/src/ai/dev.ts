import { config } from 'dotenv';
config();

import '@/ai/flows/chat-tutor.ts';
import '@/ai/flows/generate-topics.ts';
import '@/ai/flows/generate-faq.ts';
import '@/ai/flows/generate-mind-map.ts';
import '@/ai/flows/generate-podcast-script.ts';