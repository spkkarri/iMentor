// server/services/ollamaService.js
const axios = require('axios');

const SERVER_DEFAULT_OLLAMA_URL = process.env.OLLAMA_API_BASE_URL || 'https://angels-himself-fixtures-unknown.trycloudflare.com';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:14b-instruct';

const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT = 4096;
const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG = 8192;

// This function formats history for the /api/chat endpoint
function formatHistoryForOllamaChat(chatHistory) {
    return chatHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts?.[0]?.text || ''
    }));
}

async function generateContentWithHistory(
    chatHistory,
    currentUserQuery,
    systemPromptText = null,
    options = {}
) {
    const baseUrlToUse = options.ollamaUrl || SERVER_DEFAULT_OLLAMA_URL;
    const modelToUse = options.model || DEFAULT_OLLAMA_MODEL;
    const effectiveMaxOutputTokens = options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT;
    
    const headers = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    // --- THIS IS THE FIX ---
    // Decide which endpoint to use based on whether there's a real history.
    // Our Router call sends an empty history, so it will use /api/generate.
    // Real chat calls will have history and use /api/chat.
    let endpoint;
    let requestPayload;

    if (!chatHistory || chatHistory.length === 0) {
        // Use /api/generate for one-shot requests like the Router agent
        endpoint = `${baseUrlToUse}/api/generate`;
        console.log(`Ollama Service: Using /api/generate endpoint for one-shot request.`);
        requestPayload = {
            model: modelToUse,
            prompt: currentUserQuery, // The user query is the full prompt
            system: systemPromptText || "You are a helpful AI assistant.",
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                num_predict: effectiveMaxOutputTokens,
            }
        };
    } else {
        // Use /api/chat for actual conversations with history
        endpoint = `${baseUrlToUse}/api/chat`;
        console.log(`Ollama Service: Using /api/chat endpoint for conversation with history.`);
        const messages = formatHistoryForOllamaChat(chatHistory);
        messages.push({ role: 'user', content: currentUserQuery }); // Add the current query
        
        requestPayload = {
            model: modelToUse,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                // num_predict is often not needed for /chat, but can be included
            }
        };
        // For /chat, the system prompt is part of the messages array if needed
        if (systemPromptText) {
             messages.unshift({ role: 'system', content: systemPromptText });
        }
    }
    // --- END OF FIX ---

    console.log(`Ollama Service: Sending request to ${endpoint} for model ${modelToUse}.`);

    try {
        const response = await axios.post(endpoint, requestPayload, { 
            headers,
            timeout: 120000 
        });

        // Handle different response structures from /generate and /chat
        let responseText = '';
        if (response.data && response.data.response) { // from /api/generate
            responseText = response.data.response;
        } else if (response.data && response.data.message && response.data.message.content) { // from /api/chat
            responseText = response.data.message.content;
        } else {
            throw new Error("Ollama service returned an invalid or unrecognized response structure.");
        }

        return responseText.trim();
        
    } catch (error) {
        console.error("Ollama API Call Error:", error.message);
        const clientMessage = error.response?.data?.error || "Failed to get response from Ollama service.";
        const enhancedError = new Error(clientMessage);
        enhancedError.status = error.response?.status || 503;
        throw enhancedError;
    }
}

module.exports = {
    generateContentWithHistory,
    DEFAULT_OLLAMA_MODEL,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG,
};