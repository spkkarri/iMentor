const serviceManager = require('./serviceManager');
const File = require('../models/File');
const User = require('../models/User'); // Import User model

// Removed loadedFilesCache and ensureFileIsLoaded as they are specific to per-file RAG.
// For "RAG on all files", we assume all user files are already indexed or can be efficiently retrieved by the vector store.
// If you have a large number of files and want to ensure they are loaded,
// you might reintroduce a more generalized pre-loading or lazy-loading mechanism.

const RAG_CONFIDENCE_THRESHOLD = 0.65;

class HybridRagService {
    async correctAndClarifyQuery(query) {
        const { geminiAI } = serviceManager.getServices();
        try {
            const prompt = `Correct any spelling mistakes in the following user query. Return ONLY the corrected query, nothing else. Do not answer the question. Original Query: "${query}" Corrected Query:`;
            const correctedQuery = await geminiAI.generateText(prompt);
            const finalQuery = correctedQuery.trim().replace(/["*]/g, '');
            console.log(`[Query Correction] Original: "${query}" -> Corrected: "${finalQuery}"`);
            return finalQuery;
        } catch (error) {
            console.error("Error during query correction, using original query.", error);
            return query;
        }
    }

    // Modified processQuery to search across all files for the user
    // Removed fileId parameter
    async processQuery(query, userId) {
        const { vectorStore, geminiAI } = serviceManager.getServices();

        const correctedQuery = await this.correctAndClarifyQuery(query);

        // The `vectorStore.searchDocuments` should handle the actual search across indexed data.
        const relevantChunks = await vectorStore.searchDocuments(correctedQuery, {
            limit: 5,
            filters: { userId } // Removed fileId from filters
        });

        const isContextSufficient = relevantChunks.length > 0 && relevantChunks[0].score > RAG_CONFIDENCE_THRESHOLD;

        if (isContextSufficient) {
            console.log('[RAG Service] Context sufficient. Answering from document.');
            const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
            
            // --- MODIFICATION: Fetch user profile and use new RAG prompt builder ---
            const user = await User.findById(userId);
            const personalizationProfile = user ? user.personalizationProfile : '';
            // Assuming geminiAI has a `buildRagPrompt` method
            const prompt = geminiAI.buildRagPrompt(correctedQuery, context, personalizationProfile);
            
            const answer = await geminiAI.generateText(prompt);
            return {
                message: answer,
                metadata: { searchType: 'rag', sources: this.formatSources(relevantChunks) }
            };
        } else {
            console.log('[RAG Service] Context insufficient. Returning fallback message.');
            return {
                message: "I couldn't find a confident answer for that in your uploaded documents. Please try rephrasing your question or uploading more relevant files.",
                metadata: { searchType: 'rag_fallback', sources: [] }
            };
        }
    }
    
    // Moved to GeminiAI service or removed if it's not universally applicable
    // This method needs to be added to GeminiAI or a new prompt utility
    // For now, I'm providing a placeholder if GeminiAI doesn't have it.
    // If you plan to pass personalizationProfile, consider where buildStandardRagPrompt lives
    // if not in GeminiAI. I've assumed `geminiAI.buildRagPrompt` exists.
    // If it doesn't, uncomment this and adjust `processQuery` accordingly.
    /*
    buildStandardRagPrompt(query, context) {
        return `You are an expert assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I could not find an answer in the provided documents." Context: --- ${context} --- Question: "${query}" Answer:`;
    }
    */

    formatSources(chunks) {
        const uniqueSources = [...new Set(chunks.map(chunk => chunk.metadata.source))];
        return uniqueSources.map(source => ({ title: source, type: 'document' }));
    }
}

module.exports = new HybridRagService();