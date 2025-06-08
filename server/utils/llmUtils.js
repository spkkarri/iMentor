// server/utils/llmUtils.js

// Adjust these require paths if your service files are located differently
// or if you are using a central service locator.
const { generateContentWithHistory } = require('../services/geminiService'); // For Gemini
const { generateGroqChatCompletion } = require('../services/groqService');   // For Groq
//  

/**
 * Uses an LLM to refine a user query into a more effective search query
 * for academic databases or general web search.
 * @param {string} originalQuery - The user's original query.
 * @param {string} llmProvider - The LLM provider to use (e.g., 'gemini', 'groq', 'ollama').
 * @param {string} [modelId] - The model ID for the chosen provider (optional, uses default if not provided).
 * @param {string} [sessionId] - The session ID, potentially for Ollama state.
 * @returns {Promise<string>} - The refined search query, or the original query if refinement fails or is not significant.
 */

async function getSearchOptimizedQuery(originalQuery, llmProvider, modelId, sessionId) {
    const keywordPrompt = `Based on the following user query, generate a concise and effective search query suitable for finding academic research papers or relevant web articles.
Focus on the core concepts, keywords, and essential search terms.
If the query is already very concise and search-engine-friendly, you can return it as is, or with minor improvements.
Output ONLY the refined search query. Do not include any explanations, preambles, or labels like "Refined Query:".

User Query: "${originalQuery}"`;

    // A simple system prompt
    const systemPrompt = "You are an AI assistant that specializes in refining user queries into effective search terms. Your sole output should be the refined search query itself.";

    let extractedText = "";
    let llmToUse = llmProvider || process.env.DEFAULT_LLM_PROVIDER || 'gemini'; // Fallback provider

    try {
        console.log(`[llmUtils] Refining query with ${llmToUse}. Original: "${originalQuery}"`);

        if (llmToUse === 'gemini') {
            // Assuming geminiService.generateContentWithHistory can be called without actual history or ragContext for this task
            const result = await generateContentWithHistory([], keywordPrompt, null, systemPrompt);
            extractedText = result.text;
        } else if (llmToUse === 'groq') {
            const groqModel = modelId || process.env.GROQ_MODEL_ID || 'mixtral-8x7b-32768'; // Default Groq model
            // Assuming groqService.generateGroqChatCompletion can be called without actual history or ragContext
            const result = await generateGroqChatCompletion([], keywordPrompt, null, systemPrompt, groqModel);
            extractedText = result.content;
        // // } else if (llmToUse === 'ollama') {
        // //     if (ollamaService.getOllamaTextResponse) { // Check if the non-streaming function exists
        // //          const ollamaModel = modelId || process.env.OLLAMA_MODEL; // Or get from getOllamaModel()
        // //          extractedText = await ollamaService.getOllamaTextResponse(keywordPrompt, systemPrompt, ollamaModel, sessionId);
        // //     } else {
        // //         console.warn("[llmUtils] Ollama 'getOllamaTextResponse' function not available in ollamaService. Using original query for search.");
        // //         return originalQuery;
        //     }
        // } else {
            console.warn(`[llmUtils] Unsupported LLM provider for query refinement: ${llmToUse}. Using original query.`);
            return originalQuery;
        }

        if (extractedText && extractedText.trim() !== "") {
            let cleanedText = extractedText.trim();
            // Remove common LLM artifacts like surrounding quotes
            if ((cleanedText.startsWith('"') && cleanedText.endsWith('"')) || (cleanedText.startsWith("'") && cleanedText.endsWith("'"))) {
                cleanedText = cleanedText.substring(1, cleanedText.length - 1);
            }
            // Remove potential "Refined Query:", "Search Query:", "Keywords:" prefixes if the LLM ignores the prompt strictly
            cleanedText = cleanedText.replace(/^(Refined Query:|Search Query:|Keywords:)\s*/i, '').trim();
            
            if (cleanedText.length > 0 && cleanedText.toLowerCase() !== originalQuery.toLowerCase().trim()) {
                console.log(`[llmUtils] Refined query: "${cleanedText}"`);
                return cleanedText;
            } else {
                console.log(`[llmUtils] No significant refinement made or refined query is same as original. Using original.`);
                return originalQuery; // Return original if refinement is same or empty
            }
        }
        console.log(`[llmUtils] LLM returned empty response for refinement. Using original query.`);
        return originalQuery; // Fallback if LLM gives empty response

    } catch (error) {
        console.error(`[llmUtils] Error during LLM call for query refinement (${llmToUse}):`, error.message);
        return originalQuery; // Fallback to original query on error
    }
}

module.exports = { getSearchOptimizedQuery };