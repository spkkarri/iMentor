// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// The global API key from .env now acts as a fallback or for system tasks
const FALLBACK_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash";

const DEFAULT_MAX_OUTPUT_TOKENS_CHAT = 8192;
const DEFAULT_MAX_OUTPUT_TOKENS_KG = 65536;

const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

async function generateContentWithHistory(
    chatHistory,
    currentUserQuery,
    systemPromptText = null,
    options = {} // Now accepts { maxOutputTokens, apiKey }
) {
    const apiKeyToUse = options.apiKey || FALLBACK_API_KEY;
    if (!apiKeyToUse) {
        throw new Error("Gemini API key is not available. Please provide one or configure it on the server.");
    }

    try {
        // Initialize the client with the specific key for this request
        const genAI = new GoogleGenerativeAI(apiKeyToUse);

        const generationConfig = {
            temperature: 0.7,
            maxOutputTokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS_CHAT,
        };
        
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: {
                parts: [{ text: systemPromptText || "You are a helpful AI assistant." }]
            },
            safetySettings: baseSafetySettings,
        });

        const historyForStartChat = (chatHistory || []).map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text || '' }))
        }));

        const chat = model.startChat({
            history: historyForStartChat,
            generationConfig: generationConfig,
        });
        
        const result = await chat.sendMessage(currentUserQuery);
        const response = result.response;
        const candidate = response?.candidates?.[0];

        if (candidate && (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS')) {
             const responseText = candidate?.content?.parts?.[0]?.text || "";
             if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn("Gemini response was truncated due to MAX_TOKENS limit.");
             }
             return responseText;
        } else {
            const finishReason = candidate?.finishReason || 'Unknown';
            const safetyRatings = candidate?.safetyRatings;
            console.warn("Gemini response was potentially blocked or had issues.", { finishReason, safetyRatings });
            let blockMessage = `AI response generation failed or was blocked. Reason: ${finishReason}`;
            const error = new Error(blockMessage);
            error.status = 400; // Bad Request is appropriate for content blocking
            throw error;
        }

    } catch (error) {
        console.error("Gemini API Call Error:", error?.message || error);
        const enhancedError = new Error(error.message);
        enhancedError.status = error.status || 500;
        throw enhancedError;
    }
};

module.exports = {
    generateContentWithHistory,
    DEFAULT_MAX_OUTPUT_TOKENS_KG
};