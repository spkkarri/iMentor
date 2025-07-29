// backend/services/VectorStore.js

// REMOVE: const geminiServiceInstance = require('./geminiService'); // No longer directly required here

// In-memory store for document chunks and their embeddings
let documentStore = []; 

class VectorStore {
    // CRITICAL CHANGE: Accept geminiService as a constructor argument
    constructor(geminiService) { 
        if (VectorStore.instance) {
            return VectorStore.instance;
        }
        VectorStore.instance = this;
        this.documents = documentStore; 
        this.SEARCH_STRATEGIES = {
            COSINE: 'cosine_similarity',
        };
        // Assign the passed-in geminiService instance
        if (!geminiService) {
            throw new Error("GeminiService instance must be provided to VectorStore constructor.");
        }
        this.geminiService = geminiService; // <-- Assign the passed-in instance
        console.log("✅ In-memory vector store initialized successfully.");
    }

    async addDocument(doc) {
        if (!doc.content || !doc.metadata || !doc.metadata.userId || !doc.metadata.fileId || !doc.metadata.chunkId) {
            throw new Error("Document must have content, metadata, userId, fileId, and chunkId.");
        }
        try {
            // Use the geminiService instance provided at construction
            const embedding = await this.geminiService.generateEmbedding(doc.content); 
            this.documents.push({
                id: doc.metadata.chunkId, 
                content: doc.content,
                embedding: embedding,
                metadata: {
                    userId: doc.metadata.userId,
                    fileId: doc.metadata.fileId,
                    fileName: doc.metadata.fileName,
                    pageNumber: doc.metadata.pageNumber || null,
                    uploadedAt: new Date().toISOString(), 
                },
            });
        } catch (error) {
            console.error("Error adding document to vector store:", error);
            throw error;
        }
    }

    async removeDocumentsByFileId(userId, fileId) {
        const initialLength = this.documents.length;
        this.documents = this.documents.filter(doc => 
            !(doc.metadata.userId === userId && doc.metadata.fileId === fileId)
        );
        console.log(`Removed ${initialLength - this.documents.length} document chunks for file ${fileId} by user ${userId}.`);
    }

    async clearUserDocuments(userId) {
        const initialLength = this.documents.length;
        this.documents = this.documents.filter(doc => doc.metadata.userId !== userId);
        console.log(`Removed ${initialLength - this.documents.length} document chunks for user ${userId}.`);
    }

    async searchDocuments(query, options = {}) {
        const { userId, limit = 5, fileId = null } = options;

        if (!query) {
            throw new Error("Query is required for searchDocuments.");
        }
        if (!userId) {
            throw new Error("userId is required for searchDocuments.");
        }

        let queryVector;
        try {
            // Use the geminiService instance provided at construction
            queryVector = await this.geminiService.generateEmbedding(query); 
        } catch (error) {
            console.error("Error generating embedding for query:", error);
            throw new Error(`Failed to generate embedding for search query: ${error.message}`); 
        }

        let relevantDocuments = this.documents.filter(doc => {
            const isUserDoc = doc.metadata.userId === userId;
            const isSpecificFile = fileId ? doc.metadata.fileId === fileId : true; 
            return isUserDoc && isSpecificFile;
        });

        if (relevantDocuments.length === 0) {
            console.warn(`No documents found for user ${userId}${fileId ? ` and file ${fileId}` : ''}.`);
            return [];
        }

        const calculateCosineSimilarity = (vecA, vecB) => {
            if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
            let dotProduct = 0;
            let magnitudeA = 0;
            let magnitudeB = 0;
            for (let i = 0; i < vecA.length; i++) {
                dotProduct += vecA[i] * vecB[i];
                magnitudeA += vecA[i] * vecA[i];
                magnitudeB += vecB[i] * vecB[i];
            }
            magnitudeA = Math.sqrt(magnitudeA);
            magnitudeB = Math.sqrt(magnitudeB);
            if (magnitudeA === 0 || magnitudeB === 0) return 0;
            return dotProduct / (magnitudeA * magnitudeB);
        };

        const scoredDocuments = relevantDocuments.map(doc => ({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata,
            score: calculateCosineSimilarity(queryVector, doc.embedding)
        }));

        const sortedResults = scoredDocuments
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return sortedResults;
    }
}

module.exports = VectorStore;