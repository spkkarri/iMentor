// server/services/HybridRagService.js

const serviceManager = require('./serviceManager');
const File = require('../models/File');

const loadedFilesCache = new Set();
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

    async ensureFileIsLoaded(fileId, userId) {
        if (loadedFilesCache.has(fileId)) {
            return;
        }
        console.log(`[RAG Service] File ${fileId} not in memory. Processing on-demand...`);
        const { documentProcessor } = serviceManager.getServices();
        const file = await File.findOne({ _id: fileId, user: userId });
        if (!file) {
            throw new Error(`File not found or user not authorized for fileId: ${fileId}`);
        }
        await documentProcessor.processFile(file.path, {
            userId: file.user.toString(),
            fileId: file._id.toString(),
            originalName: file.originalname,
        });
        loadedFilesCache.add(fileId);
        console.log(`[RAG Service] Successfully processed and loaded file ${file.originalname} into memory.`);
    }

    async processQuery(query, userId, fileId) {
        const { vectorStore } = serviceManager.getServices();

        if (!fileId) {
            return {
                message: "Please select a file to chat with from the 'My Files' list before asking a question in RAG mode.",
                metadata: { searchType: 'rag_error', sources: [] }
            };
        }

        const correctedQuery = await this.correctAndClarifyQuery(query);
        await this.ensureFileIsLoaded(fileId, userId);

        const relevantChunks = await vectorStore.searchDocuments(correctedQuery, {
            limit: 5,
            filters: { userId, fileId }
        });

        const isContextSufficient = relevantChunks.length > 0 && relevantChunks[0].score > RAG_CONFIDENCE_THRESHOLD;

        if (isContextSufficient) {
            console.log('[RAG Service] Context sufficient. Answering from document.');
            const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
            const prompt = this.buildStandardRagPrompt(correctedQuery, context);
            const answer = await serviceManager.geminiAI.generateText(prompt);
            return {
                message: answer,
                metadata: { searchType: 'rag', sources: this.formatSources(relevantChunks) }
            };
        } else {
            // --- UPDATED LOGIC: No more web search. Just give a fallback message. ---
            console.log('[RAG Service] Context insufficient. Returning fallback message.');
            return {
                message: "I couldn't find a confident answer for that in your document. Please try rephrasing your question or asking something else about the file.",
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