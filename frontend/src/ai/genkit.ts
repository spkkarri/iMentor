import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

// Add Flask backend integration for AI (if needed)
// Example: Replace or extend this with your Flask API endpoints if not using Google AI
// import { sendChatMessage } from '@/lib/api';
// export const ai = {
//   chat: sendChatMessage,
//   // ...other methods
// };

// If you want to switch between Google AI and Flask backend dynamically, you can export both and select at runtime.
