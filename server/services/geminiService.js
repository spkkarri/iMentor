// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
console.log("[Gemini Service] Initializing. API Key (first 5 chars):", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "NOT SET");


const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash-latest"; // Or your preferred model like "gemini-pro"

if (!API_KEY) {
    console.error("GEMINI_SERVICE FATAL ERROR: GEMINI_API_KEY is not available. Service cannot initialize.");
    // In a real app, you might have a more robust way to handle this at startup,
    // but for now, throwing an error will prevent the service from being used incorrectly.
    throw new Error("GEMINI_API_KEY is missing in geminiService, cannot proceed.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Define base configurations once
const baseGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 4096, // Adjust as needed for the specific model
    // topP: 0.9, // Optional
    // topK: 40,  // Optional
};

const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generateContentWithHistory = async (
    chatHistory = [],         // Array of {role, parts: [{text}]} - default to empty array
    currentUserQuery,         // String: The most recent query from the user
     externalContext = null, // This will be our combinedContextForLLM (RAG + Tool)
    systemPromptText = null,
    // +++ NEW PARAMETER: For specific instructions from chat.js +++
    specificInstruction = null
) => {
    try {
        if (!currentUserQuery || typeof currentUserQuery !== 'string' || !currentUserQuery.trim()) {
            console.error("[Gemini Service] Error: currentUserQuery is missing or empty.");
            throw new Error("currentUserQuery must be a non-empty string.");
        }

        const modelOptions = {
            model: MODEL_NAME,
            generationConfig: baseGenerationConfig,
            safetySettings: baseSafetySettings,
        };


         // --- MODIFIED: Incorporate specificInstruction into the system prompt ---
        let effectiveSystemPrompt = systemPromptText || "You are a helpful and informative AI assistant."; // Default system prompt
        if (specificInstruction && typeof specificInstruction === 'string' && specificInstruction.trim() !== '') {
            // You can choose to append, prepend, or replace. Appending is often safe.
            effectiveSystemPrompt += `\n\nImportant Instruction: ${specificInstruction.trim()}`;
            console.log("[Gemini Service] Appended specific instruction to system prompt.");
        }





        if (effectiveSystemPrompt && effectiveSystemPrompt.trim() !== '') {
            modelOptions.systemInstruction = {
                parts: [{ text: effectiveSystemPrompt.trim() }]
            };
            console.log("[Gemini Service] Using system instruction (snippet):", effectiveSystemPrompt.substring(0,150) + "...");
        } else {
            console.log("[Gemini Service] No custom system instruction provided or it's empty.");
        }

        const model = genAI.getGenerativeModel(modelOptions);


        // Prepare history for Gemini's startChat method
        // Ensure roles are 'user' or 'model'
        const historyForStartChat = chatHistory
            .map(msg => ({
                 role: msg.role === 'user' ? 'user' : 'model',
                 parts: Array.isArray(msg.parts) ? msg.parts.map(part => ({ text: part.text || '' })) : [{text:''}]
            }))
            .filter(msg => msg.role && msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string');

        const chat = model.startChat({
            history: historyForStartChat,
        });


        // Construct the final content for the current user turn, incorporating external context (RAG, Web, or Academic)
        let finalUserTurnContent;
        const isExternalContextProvidedAndMeaningful = externalContext &&
                                                      typeof externalContext === 'string' &&
                                                      externalContext.trim() !== "" &&
                                                      // Removed checks for "no relevant context" here, as chat.js now sends null if no context
                                                      !externalContext.toLowerCase().includes("error connecting to") && // Keep error checks
                                                      !externalContext.toLowerCase().includes("configuration error");

         if (isExternalContextProvidedAndMeaningful) {
            finalUserTurnContent = `
Considering the following information if relevant, please answer the user's question. If the provided context is not relevant to the specific question, please ignore it and answer based on your general knowledge. If you use information from the context, you can state that the information comes from provided documents.

Provided Context:
---
${externalContext} 
---

User's Question: ${currentUserQuery}
`;
            console.log("[Gemini Service] Constructed prompt WITH external context for Gemini.");
        } else {
            // If no external context, the specificInstruction (if any) is in the system prompt
            finalUserTurnContent = currentUserQuery;
            console.log("[Gemini Service] Constructed prompt WITHOUT external context for Gemini.");
        }
        
        console.log(`[Gemini Service] Sending message to Gemini model ${MODEL_NAME}. History length for startChat: ${historyForStartChat.length}.`);
        // For debugging, you can log the finalUserTurnContent (or a snippet)
        // console.log("[Gemini Service] Final User Turn Content (snippet):", finalUserTurnContent.substring(0, 300) + "...");

        const result = await chat.sendMessage(finalUserTurnContent);
        const response = result.response;
        const candidate = response?.candidates?.[0];

        if (candidate && (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS')) {
            const responseText = candidate?.content?.parts?.[0]?.text;
            if (typeof responseText === 'string') {
                console.log("[Gemini Service] Received successful response from Gemini.");
                return {
                    answer: responseText.trim(),
                    thinking: modelOptions.systemInstruction ? `Responded using system prompt: "${modelOptions.systemInstruction.parts[0].text.substring(0,50)}..."` : "Response generated by Gemini."
                };
            } else {
                 const warnMsg = "[Gemini Service] Gemini response finished normally but text content is missing or invalid.";
                 console.warn(warnMsg, { finishReason: candidate?.finishReason, content: candidate?.content });
                 throw new Error("Received an empty or invalid response from the Gemini AI service.");
            }
        } else {
             const finishReason = candidate?.finishReason || 'Unknown';
             const safetyRatings = candidate?.safetyRatings;
             const blockMsg = `[Gemini Service] Gemini response was potentially blocked or had issues. Reason: ${finishReason}.`;
             console.warn(blockMsg, { safetyRatings });

             let detailedBlockMessage = `Gemini AI response generation failed or was blocked. Reason: ${finishReason}.`;
             if (safetyRatings) {
                const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category.replace('HARM_CATEGORY_', '')).join(', ');
                if (blockedCategories) detailedBlockMessage += ` Blocked Categories: ${blockedCategories}.`;
             }
             const error = new Error(detailedBlockMessage);
             error.status = 400; // Indicates a bad request or content policy issue
             throw error;
        }

    } catch (error) {
        // Log the detailed error on the server
        console.error("[Gemini Service] Error during Gemini API call or processing:", error?.message || error, error?.stack || '');
        
        // Construct a more user-friendly message for the client
        let clientMessage = "An error occurred while communicating with the Gemini AI service.";
        if (error.message?.includes("API key not valid")) {
            clientMessage = "Gemini AI Service Error: The API Key is invalid or missing permissions.";
        } else if (error.message?.toLowerCase().includes("blocked")) { // Catch specific block messages
            clientMessage = error.message; // Propagate the detailed block message
        } else if (error.status === 400) { // For errors thrown by our code with status
             clientMessage = `Gemini AI Service Error: ${error.message}`;
        } else if (error.message?.includes("quota")) {
             clientMessage = "Gemini AI Service Error: Quota exceeded. Please check your API usage limits.";
        }
        // Re-throw a new error object to be caught by the route handler in chat.js
        const serviceError = new Error(clientMessage);
        // serviceError.status = error.status || 500; // Propagate status if available
        // serviceError.originalError = error; // Could attach original for deeper debugging if needed by caller
        throw serviceError;
    }
};

module.exports = { generateContentWithHistory };