const serviceManager = require('./serviceManager');
const File = require('../models/File');

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
    async processQuery(query, userId) { // Removed fileId parameter
        const { vectorStore } = serviceManager.getServices();

        const correctedQuery = await this.correctAndClarifyQuery(query);

        // Fetch all files for the user to ensure their content is ready for search.
        // In a real-world scenario with many files, you'd want an efficient way
        // to ensure they are indexed in your vector store rather than fetching all here.
        // The `vectorStore.searchDocuments` should handle the actual search across indexed data.
        
        const relevantChunks = await vectorStore.searchDocuments(correctedQuery, {
            limit: 5,
            filters: { userId } // Removed fileId from filters
        });

        const isContextSufficient = relevantChunks.length > 0 && relevantChunks[0].score > RAG_CONFIDENCE_THRESHOLD;

        if (isContextSufficient) {
            console.log('[RAG Service] Context sufficient. Answering from document.');
            const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
            const answer = await serviceManager.geminiAI.generateText(this.buildStandardRagPrompt(correctedQuery, context));
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
    
    buildStandardRagPrompt(query, context) {
        return `You are an expert assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I could not find an answer in the provided documents." Context: --- ${context} --- Question: "${query}" Answer:`;
    }

    formatSources(chunks) {
        const uniqueSources = [...new Set(chunks.map(chunk => chunk.metadata.source))];
        return uniqueSources.map(source => ({ title: source, type: 'document' }));
    }
}

module.exports = new HybridRagService();