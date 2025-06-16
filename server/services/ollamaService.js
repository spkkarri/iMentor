// server/services/ollamaService.js
const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_API_BASE_URL || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'llama3';

const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT = 4096;
const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG = 8192;

async function generateContentWithHistory(
    chatHistory,
    systemPromptText = null,
    options = {} // Now accepts { model, maxOutputTokens, apiKey }
) {
    const modelToUse = options.model || DEFAULT_OLLAMA_MODEL;
    const effectiveMaxOutputTokens = options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT;
    
    const headers = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
    
    const fullPrompt = formatHistoryForOllama(chatHistory, systemPromptText);
    
    const requestPayload = {
        model: modelToUse,
        prompt: fullPrompt,
        system: systemPromptText || "You are a helpful AI assistant.",
        stream: false,
        options: {
            temperature: options.temperature || 0.7,
            num_predict: effectiveMaxOutputTokens,
        }
    };
    
    const endpoint = `${OLLAMA_BASE_URL}/api/generate`;

    try {
        const response = await axios.post(endpoint, requestPayload, { 
            headers,
            timeout: 120000 
        });

        if (response.data && response.data.response) {
            return response.data.response.trim();
        } else {
            throw new Error("Ollama service returned an invalid response structure.");
        }
    } catch (error) {
        console.error("Ollama API Call Error:", error.message);
        const clientMessage = error.response?.data?.error || "Failed to get response from Ollama service.";
        const enhancedError = new Error(clientMessage);
        enhancedError.status = error.response?.status || 503;
        throw enhancedError;
    }
}

function formatHistoryForOllama(chatHistory) {
    let promptString = "";
    chatHistory.forEach(msg => {
        const role = msg.role === 'model' ? 'assistant' : 'user';
        const text = msg.parts?.[0]?.text || '';
        promptString += `<|im_start|>${role}\n${text}<|im_end|>\n`;
    });
    promptString += "<|im_start|>assistant\n";
    return promptString;
}


module.exports = {
    generateContentWithHistory,
    DEFAULT_OLLAMA_MODEL,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG,
};