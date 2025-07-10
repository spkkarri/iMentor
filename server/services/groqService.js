// C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Chatbot-geminiV3\server\services\groqService.js

const axios = require('axios');
require('dotenv').config(); 

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Generates a chat completion using the Groq API.
 *
 * @param {Array} chatHistory - The conversation history.
 * @param {String} currentUserQuery - The latest query from the user.
 * @param {String|null} ragContext - Context retrieved from RAG (or null if none).
 * @param {String|null} systemPromptText - An optional system prompt.
 * @param {String} groqModelId - The specific Groq model ID to use.
 * @returns {Promise<Object>} - A promise that resolves to an object { answer: String, thinking: String, error?: boolean, errorMessage?: string }.
 */
async function generateGroqChatCompletion(chatHistory, currentUserQuery, ragContext, systemPromptText, groqModelId) {
    console.log(`[Groq Service] Generating chat completion with model: ${groqModelId}`);

    if (!GROQ_API_KEY) {
        console.error("[Groq Service] Error: GROQ_API_KEY is not set in the environment variables.");
        return { 
            answer: "Groq API key is not configured on the server.", 
            thinking: "Configuration error: Missing Groq API Key.",
            error: true,
            errorMessage: "Groq API key is not configured."
        };
    }

    // Initialize the messages array for the Groq API payload
    const messages = [];

    // 1. Add System Prompt (if provided)
    if (systemPromptText && systemPromptText.trim() !== '') {
        messages.push({ role: 'system', content: systemPromptText.trim() });
        console.log("[Groq Service] Added system prompt to Groq payload.");
    }

    // 2. Add Chat History - TRANSFORMING THE STRUCTURE
    //    The input chatHistory is likely in {role, parts: [{text}]} format (from Gemini/frontend)
    //    Groq's OpenAI-compatible API expects {role, content: "string"} for user/assistant.
    if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach(msg => {
            const roleForGroq = msg.role === 'model' ? 'assistant' : msg.role; // Map 'model' to 'assistant'
            
            let messageContent = '';
            // Extract text content, prioritizing 'parts' structure, then 'content', then 'text'
            if (msg.parts && Array.isArray(msg.parts) && msg.parts[0] && typeof msg.parts[0].text === 'string') {
                messageContent = msg.parts[0].text;
            } else if (typeof msg.content === 'string') { 
                messageContent = msg.content;
            } else if (typeof msg.text === 'string') { // Fallback for simpler {role, text} from some histories
                 messageContent = msg.text;
            }

            // Only add if we have valid content and a standard role for Groq (user or assistant)
            if (messageContent.trim() !== '' && (roleForGroq === 'user' || roleForGroq === 'assistant')) {
                messages.push({ role: roleForGroq, content: messageContent });
            }
        });
        const historyMessagesAddedCount = messages.filter(m => m.role !== 'system').length; // Count non-system from history
        console.log(`[Groq Service] Added ${historyMessagesAddedCount} transformed messages from history to Groq payload.`);
    }


    // 3. Construct and add the final user message with RAG context (if available)
    let finalUserContent = currentUserQuery;
    if (ragContext && ragContext.trim() !== '') {
        // Ensure ragContext is a string
        const ragContextString = typeof ragContext === 'string' ? ragContext : JSON.stringify(ragContext);
        finalUserContent = `Context:\n${ragContextString}\n\nQuestion:\n${currentUserQuery}`;
        console.log("[Groq Service] Added RAG context to the current user query for Groq.");
    } else {
         console.log("[Groq Service] No RAG context provided for current Groq query.");
    }
    messages.push({ role: 'user', content: finalUserContent });


    // Prepare the API request payload
    const payload = {
        model: groqModelId,
        messages: messages, // Use the correctly formatted messages array
        temperature: 0.7,
        max_tokens: 4096, 
        // stream: false, 
    };

    const headers = {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
    };

    let thinkingSteps = `Using Groq model: ${groqModelId}.\n`;
    thinkingSteps += ragContext ? "Incorporating RAG context.\n" : "Processing query without RAG context.\n";
    const groqHistoryLength = payload.messages.filter(m => m.role === 'assistant').length; // Count only assistant messages from history part of payload
    thinkingSteps += `Formatted chat history for Groq: ${groqHistoryLength} assistant messages.\n`;

    try {
        console.log('[Groq Service] Sending request to Groq API...');
        // For deep debugging, uncomment the next line to see the exact payload:
        // console.log('[Groq Service] Payload for Groq:', JSON.stringify(payload, null, 2));

        const startTime = Date.now();
        const response = await axios.post(GROQ_API_URL, payload, { headers });
        const endTime = Date.now();
        console.log(`[Groq Service] Received response from Groq API in ${endTime - startTime} ms.`);

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const answer = response.data.choices[0]?.message?.content || "Groq returned a response, but the content was empty.";
            console.log("[Groq Service] Successfully extracted answer from Groq.");
            thinkingSteps += `Groq API call successful (${endTime - startTime} ms).\n`;
            if (response.data.usage) {
                console.log('[Groq Service] Usage:', response.data.usage);
                thinkingSteps += `Tokens Used: Prompt=${response.data.usage.prompt_tokens}, Completion=${response.data.usage.completion_tokens}, Total=${response.data.usage.total_tokens}\n`;
            }
            return {
                answer: answer.trim(),
                thinking: thinkingSteps,
                error: false 
            };
        } else {
            console.error('[Groq Service] Error: Invalid response structure from Groq API (no choices or message content):', response.data);
            thinkingSteps += "Error: Received invalid response structure from Groq.\n";
            return {
                answer: "Received an unexpected response structure from the Groq AI model.",
                thinking: thinkingSteps,
                error: true,
                errorMessage: "Invalid response structure from Groq API."
            };
        }

    } catch (error) {
        console.error('[Groq Service] Error calling Groq API:');
        let errorMessageForClient = "Sorry, I encountered an error trying to reach the Groq AI model. Please check the server logs.";
        let detailedErrorMessage = error.message; // Default to axios error message

        if (error.response) { // Error from Groq API (e.g., 4xx, 5xx)
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2)); 
            
            if (error.response.data && error.response.data.error && error.response.data.error.message) {
                detailedErrorMessage = error.response.data.error.message; // Use Groq's specific error message
                thinkingSteps += `Groq API Error (${error.response.status}): ${detailedErrorMessage}\n`;

                // Provide more specific client messages for common Groq errors
                if (error.response.status === 401) errorMessageForClient = "Groq API Error: Authentication failed. Please check your API Key.";
                else if (error.response.status === 429) errorMessageForClient = "Groq API Error: You have exceeded your quota or rate limit. Please check your Groq account.";
                else if (error.response.status === 400) errorMessageForClient = `Groq API Error: The request was invalid. Details: ${detailedErrorMessage}`;
                else errorMessageForClient = `Groq API Error: Received status ${error.response.status}. Details: ${detailedErrorMessage}`;

            } else { // No specific error message from Groq, just status
                thinkingSteps += `Groq API Error: Status ${error.response.status}\n`;
                errorMessageForClient = `Groq API Error: Received status ${error.response.status}.`;
            }
        } else if (error.request) { // Request was made but no response received (e.g. network issue, timeout)
             console.error('Error making request (no response received):', error.request);
             thinkingSteps += `Groq API Call Error: No response received. ${error.message}\n`;
             errorMessageForClient = "Could not connect to Groq AI service. Please check network or server status.";
        } else { // Other errors (e.g., setting up the request)
            thinkingSteps += `Groq API Call Setup Error: ${error.message}\n`;
        }

        return {
            answer: errorMessageForClient,
            thinking: thinkingSteps,
            error: true,
            errorMessage: detailedErrorMessage // This will contain Groq's specific error message if available
        };
    }
}

module.exports = {
    generateGroqChatCompletion,
};