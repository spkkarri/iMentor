// server/services/geminiAI.js

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { handleGeminiError } = require('../utils/errorUtils');

// ... (MODEL_NAME, baseGenerationConfig, baseSafetySettings remain the same) ...
const MODEL_NAME = "gemini-1.5-flash";

const baseGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 4096,
};

const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];


class GeminiAI {
    // ... (constructor, initialize, isEnabled, _configureModel, _processApiResponse remain the same) ...
    constructor() {
        this.genAI = null;
        this.model = null;
        this.initialize(); // Initialize on creation
    }

    initialize() {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.warn("⚠️ GEMINI_API_KEY not found. AI features will be disabled.");
            return;
        }
        try {
            this.genAI = new GoogleGenerativeAI(API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
            console.log("🤖 Gemini AI service initialized successfully");
        } catch (error) {
            console.error("❌ Failed to initialize Gemini AI:", error.message);
            this.genAI = null;
            this.model = null;
        }
    }

    isEnabled() {
        return !!this.model;
    }

    _configureModel(systemInstructionText) {
        if (!this.genAI) throw new Error("Cannot configure model, Gemini AI not initialized.");
        const modelOptions = {
            model: MODEL_NAME,
            generationConfig: baseGenerationConfig,
            safetySettings: baseSafetySettings,
        };
        if (systemInstructionText?.trim()) {
            modelOptions.systemInstruction = { parts: [{ text: systemInstructionText.trim() }] };
        }
        return this.genAI.getGenerativeModel(modelOptions);
    }

    _processApiResponse(response) {
        const candidate = response?.candidates?.[0];
        if (candidate && (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS')) {
            const responseText = candidate.content?.parts?.[0]?.text;
            if (typeof responseText === 'string') return responseText;
        }
        const finishReason = candidate?.finishReason || 'Unknown';
        const blockedCategories = candidate?.safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
        let blockMessage = `AI response generation failed. Reason: ${finishReason}.`;
        if (blockedCategories) blockMessage += ` Blocked Categories: ${blockedCategories}.`;
        throw new Error(blockMessage || "Received an empty or invalid response from the AI service.");
    }

    /**
     * --- MODIFIED: Build system prompt with all available context, including memory change announcements ---
     */
    buildSystemPrompt(systemPrompt, context, personalizationProfile = '', conversationSummary = '', userMemories = [], memoryChanges = {}) {
        let finalSystemPrompt = systemPrompt || 'You are a helpful AI assistant providing accurate and concise answers.';
        
        if (userMemories && userMemories.length > 0) {
            const memoryContext = userMemories.map(mem => `- ${mem.content}`).join('\n');
            // --- MODIFIED: More explicit instructions on how to use memory ---
            finalSystemPrompt += `\n\n## FACTS ABOUT THE USER (Your Long-Term Memory):
These are established facts about the user you are talking to. Use them to personalize your responses. Refer to the user as "you".
${memoryContext}`;
        }

        if (personalizationProfile) {
            finalSystemPrompt += `\n\n## User Personalization Profile (AI-generated insight):\n${personalizationProfile}`;
        }

        if (conversationSummary) {
            finalSystemPrompt += `\n\n## Summary of Current Conversation:\n${conversationSummary}`;
        }
        
        if (context && context !== 'No relevant document context available.') {
            finalSystemPrompt += `\n\n## Relevant Context from Documents:\n${context}`;
        }

        // --- NEW: Instructions for announcing memory changes ---
        if (memoryChanges && (memoryChanges.added?.length > 0 || memoryChanges.updated?.length > 0)) {
            finalSystemPrompt += `\n\n## MEMORY UPDATE NOTIFICATION:
You have just updated your memory based on the latest conversation. Briefly and naturally mention one of these updates in your response. For example: "Got it, I'll remember that." or "Okay, I've updated my notes on your project."
- Added: ${JSON.stringify(memoryChanges.add || [])}
- Updated: ${JSON.stringify(memoryChanges.update || [])}`;
        }
        
        return finalSystemPrompt;
    }

    async generateChatResponse(userMessage, documentChunks = [], chatHistory = [], systemPrompt = '', personalizationProfile = '', conversationSummary = '', userMemories = [], memoryChanges = {}) {
        if (!this.isEnabled()) {
            return "I understand you're asking: \"" + userMessage + "\". I'm currently unable to provide an AI-generated response. Please try again later or contact support if the issue persists.";
        }
        try {
            const context = this.buildContext(documentChunks);
            const finalSystemInstruction = this.buildSystemPrompt(systemPrompt, context, personalizationProfile, conversationSummary, userMemories, memoryChanges);
            
            const sanitizedHistory = chatHistory.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: msg.parts.map(part => ({ text: part.text || '' }))
            }));

            const model = this._configureModel(finalSystemInstruction);
            const chat = model.startChat({ history: sanitizedHistory });
            const result = await chat.sendMessage(userMessage);
            
            return this._processApiResponse(result.response);
        } catch (error) {
            console.error("Error in generateChatResponse:", error);
            throw handleGeminiError(error);
        }
    }
    
    // ... (rest of the file remains the same) ...
    buildRagPrompt(query, context, personalizationProfile = '') {
        let finalPrompt = `You are an expert assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I could not find an answer in the provided documents."`;
        if (personalizationProfile) {
            finalPrompt += `\n\nTailor your response to this user's profile: ${personalizationProfile}`;
        }
        finalPrompt += `\n\nContext: --- ${context} --- \n\nQuestion: "${query}" \n\nAnswer:`;
        return finalPrompt;
    }

    async generateText(prompt) {
        if (!this.isEnabled()) {
            throw new Error("AI service is not available.");
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            return this._processApiResponse(response);
        } catch (error) {
            console.error('Gemini text generation error:', error.message);
            throw new Error('Failed to generate text response');
        }
    }

    buildContext(documentChunks) {
        if (!Array.isArray(documentChunks) || documentChunks.length === 0) {
            return 'No relevant document context available.';
        }
        return documentChunks
            .map(chunk => `Document: ${chunk.metadata?.source || 'Unknown'}\n${chunk.content}`)
            .join('\n\n');
    }
}

module.exports = new GeminiAI();