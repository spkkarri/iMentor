// server/services/HybridRagService.js

const serviceManager = require('./serviceManager');
const File = require('../models/File'); // Import the File model to get file details

// A simple in-memory set to track which file IDs have been loaded into the vector store
const loadedFilesCache = new Set();

const RAG_CONFIDENCE_THRESHOLD = 0.7; // For cosine similarity, higher is better

class HybridRagService {
    /**
     * Ensures a specific file's content is loaded into the vector store.
     * @param {string} fileId - The ID of the file to load.
     * @param {string} userId - The ID of the user owning the file.
     */
    async ensureFileIsLoaded(fileId, userId) {
        if (loadedFilesCache.has(fileId)) {
            console.log(`[Hybrid RAG] File ${fileId} is already in the in-memory store.`);
            return;
        }

        console.log(`[Hybrid RAG] File ${fileId} not in memory. Processing on-demand...`);
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
        console.log(`[Hybrid RAG] Successfully processed and loaded file ${file.originalname} into memory.`);
    }

    async processQuery(query, userId, fileId, allowDeepSearch = false) {
        const { vectorStore } = serviceManager.getServices();

        if (!fileId) {
            return {
                message: "Please select a file to chat with from the 'My Files' list before asking a question in RAG mode.",
                metadata: { searchType: 'rag_error', sources: [] }
            };
        }

        // Step 1: Ensure the requested file is loaded into our in-memory store.
        await this.ensureFileIsLoaded(fileId, userId);

        // Step 2: Perform RAG search, now specifically filtering for the active file.
        const relevantChunks = await vectorStore.searchDocuments(query, {
            limit: 5,
            filters: { userId, fileId } // Filter by the specific file
        });

        const isContextSufficient = relevantChunks.length > 0 && relevantChunks[0].score > RAG_CONFIDENCE_THRESHOLD;

        if (isContextSufficient) {
            console.log('[Hybrid RAG] Context is sufficient. Answering from documents.');
            const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
            const prompt = this.buildStandardRagPrompt(query, context);
            const answer = await serviceManager.geminiAI.generateText(prompt);
            return {
                message: answer,
                metadata: { searchType: 'rag', sources: this.formatSources(relevantChunks) }
            };
        } else if (allowDeepSearch) {
            console.log('[Hybrid RAG] Context insufficient. Crossing over to Deep Search.');
            const deepSearchService = serviceManager.getDeepSearchService(userId);
            const augmentedQuery = await this.createAugmentedQuery(query, relevantChunks);
            const deepSearchResult = await deepSearchService.performSearch(augmentedQuery);
            return {
                message: `While I couldn't find a direct answer in your document, I performed a web search based on its content and found the following:\n\n${deepSearchResult.summary}`,
                metadata: { searchType: 'hybrid_rag_deep_search', sources: deepSearchResult.sources || [] }
            };
        } else {
            console.log('[Hybrid RAG] Context insufficient. Web search disabled. Providing fallback.');
            return {
                message: "I couldn't find a confident answer in your document. You can try rephrasing your question or enabling 'Deep Search on Document' to allow me to search the web for supplementary information.",
                metadata: { searchType: 'rag_fallback', sources: [] }
            };
        }
    }

    async createAugmentedQuery(originalQuery, documentChunks) {
        const { geminiAI } = serviceManager.getServices();
        const context = documentChunks.map(c => c.content).slice(0, 2).join('\n---\n');
        const prompt = `A user is asking a question, but the information in their document seems insufficient. Your task is to reformulate their question into a clear, standalone query suitable for a powerful web search. Incorporate key terms and concepts from the document's context to make the search more precise. Original Question: "${originalQuery}" Limited Context from Document: --- ${context || "No specific context was found."} --- Based on this, what is the best, single, reformulated question to send to a deep search engine?`;
        const augmentedQuery = await geminiAI.generateText(prompt);
        return augmentedQuery.trim();
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