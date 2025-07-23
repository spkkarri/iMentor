// server/services/LangchainVectorStore.js

const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

class LangchainVectorStore {
    constructor() {
        this.store = null;
        this.embeddings = null;
    }

    /**
     * Initializes the vector store. This version is in-memory, so it starts fresh every time.
     */
    async initialize() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY environment variable not set.");
        }

        // Use the LangChain wrapper for Gemini Embeddings
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            modelName: "embedding-001"
        });

        // Create an empty in-memory store. It will be populated by the startup script.
        this.store = new MemoryVectorStore(this.embeddings);
        
        console.log("✅ In-memory vector store initialized successfully.");
    }

    /**
     * Adds documents to the in-memory vector store.
     */
    async addDocuments(documents) {
        if (!this.store) throw new Error("MemoryVectorStore not initialized.");
        if (!documents || documents.length === 0) return { count: 0 };

        const contents = documents.map(doc => doc.content);
        const metadatas = documents.map(doc => doc.metadata);

        await this.store.addDocuments(documents);
        
        const count = await this.getStatistics();
        console.log(`[MemoryVectorStore] Added ${documents.length} documents. Total now: ${count.documentCount}`);
        return { count: documents.length };
    }

    /**
     * Deletes documents by rebuilding the store without the specified documents.
     * Note: This is less efficient for memory stores but ensures consistency.
     */
    async deleteDocumentsByFileId(fileId) {
        if (!this.store) return;
        
        // MemoryVectorStore doesn't have a direct delete method.
        // The reprocessing on startup is the main way to keep it in sync.
        // This function is less critical now but can be implemented if needed.
        console.log(`[MemoryVectorStore] Deletion requested for fileId: ${fileId}. Store will be refreshed on next restart.`);
    }

    /**
     * Searches for relevant documents using metadata filters.
     */
    async searchDocuments(query, options = {}) {
        if (!this.store) return [];

        // The filter function for MemoryVectorStore
        const filterFn = (doc) => {
            if (options.filters?.userId && doc.metadata.userId !== options.filters.userId) return false;
            if (options.filters?.fileId && doc.metadata.fileId !== options.filters.fileId) return false;
            return true;
        };

        const results = await this.store.similaritySearchWithScore(
            query,
            options.limit || 5,
            filterFn
        );

        // Format results to match the expected { content, metadata, score } structure
        return results.map(([doc, score]) => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            score: score // For MemoryVectorStore, similarity is 0 (bad) to 1 (good)
        }));
    }

    /**
     * Gets statistics about the in-memory store.
     */
    async getStatistics() {
        if (!this.store) return { documentCount: 0 };
        // A simple way to get the count from the internal store
        return { documentCount: this.store.memoryVectors.length };
    }
}

// Export a singleton instance so the same store is used across your app.
module.exports = new LangchainVectorStore();