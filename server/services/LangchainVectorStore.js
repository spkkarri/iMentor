// server/services/LangchainVectorStore.js

const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Document } = require("@langchain/core/documents");

class LangchainVectorStore {
    constructor() {
        this.documents = [];
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

        // Initialize empty document store
        this.documents = [];

        console.log("✅ In-memory vector store initialized successfully.");
    }

    /**
     * Adds documents to the in-memory vector store.
     */
    async addDocuments(documents) {
        if (!this.embeddings) throw new Error("LangchainVectorStore not initialized.");
        if (!documents || documents.length === 0) return { count: 0 };

        // Convert documents to LangChain Document format if needed
        const langchainDocs = documents.map(doc => {
            if (doc.pageContent) {
                return doc; // Already a LangChain Document
            }
            return new Document({
                pageContent: doc.content,
                metadata: doc.metadata || {}
            });
        });

        // Generate embeddings and store documents
        for (const doc of langchainDocs) {
            const embedding = await this.embeddings.embedQuery(doc.pageContent);
            this.documents.push({
                document: doc,
                embedding: embedding
            });
        }

        console.log(`[LangchainVectorStore] Added ${documents.length} documents. Total now: ${this.documents.length}`);
        return { count: documents.length };
    }

    /**
     * Deletes documents by rebuilding the store without the specified documents.
     */
    async deleteDocumentsByFileId(fileId) {
        if (!this.embeddings) return;

        const initialCount = this.documents.length;
        this.documents = this.documents.filter(item =>
            item.document.metadata.fileId !== fileId
        );

        const deletedCount = initialCount - this.documents.length;
        console.log(`[LangchainVectorStore] Deleted ${deletedCount} documents for fileId: ${fileId}`);
    }

    /**
     * Searches for relevant documents using metadata filters and cosine similarity.
     */
    async searchDocuments(query, options = {}) {
        if (!this.embeddings || this.documents.length === 0) return [];

        // Generate embedding for the query
        const queryEmbedding = await this.embeddings.embedQuery(query);

        // Calculate similarities and filter
        const results = [];
        for (const item of this.documents) {
            const doc = item.document;

            // Apply filters
            if (options.filters?.userId && doc.metadata.userId !== options.filters.userId) continue;
            if (options.filters?.fileId && doc.metadata.fileId !== options.filters.fileId) continue;

            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);

            results.push({
                content: doc.pageContent,
                metadata: doc.metadata,
                score: similarity
            });
        }

        // Sort by similarity (highest first) and limit results
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, options.limit || 5);
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
    }

    /**
     * Gets statistics about the in-memory store.
     */
    async getStatistics() {
        return { documentCount: this.documents.length };
    }
}

// Export a singleton instance so the same store is used across your app.
module.exports = new LangchainVectorStore();