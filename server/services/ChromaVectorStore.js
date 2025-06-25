// server/services/ChromaVectorStore.js

const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require('@google/generative-ai');



/**
 * Custom Embedding Function for ChromaDB using Google's Gemini API.
 * This class implements the IEmbeddingFunction interface required by ChromaDB.
 */
class GeminiEmbeddingFunction {
    constructor() {
        // 1. Check for the API Key
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY environment variable not set.");
        }
        // 2. Initialize the Google Generative AI client
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // 3. Get the specific model for text embedding
        this.model = genAI.getGenerativeModel({ model: "embedding-001" });
    }

    /**
     * Generates embeddings for a batch of documents.
     * @param {string[]} texts - An array of document texts.
     * @returns {Promise<number[][]>} A promise that resolves to an array of embeddings.
     */
    async embedDocuments(texts) {
        // Use batchEmbedContents for efficiency with multiple documents
        const result = await this.model.batchEmbedContents({
            requests: texts.map(text => ({
                content: { parts: [{ text }] },
                // taskType is important for getting the right kind of embedding
                taskType: "RETRIEVAL_DOCUMENT", 
            })),
        });
        return result.embeddings.map(e => e.values);
    }    
    /**
     * Generates an embedding for a single query text.
     * @param {string} text - The query text.
     * @returns {Promise<number[]>} A promise that resolves to a single embedding.
     */
    async embedQuery(text) {
        const result = await this.model.embedContent({
            content: { parts: [{ text }] },
            taskType: "RETRIEVAL_QUERY", // Use a different task type for queries
        });
        return result.embedding.values;
    }
}




// Helper function to initialize the embedding model.
// NOTE: This uses OpenAI's embeddings, which is a reliable and high-quality choice.
// Ensure your OPENAI_API_KEY is set in your .env file.
const getEmbeddingFunction = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY environment variable not set. It's required for the embedding function.");
    }
    return new OpenAIEmbeddingFunction({ openai_api_key: process.env.OPENAI_API_KEY });
};

class ChromaVectorStore {
    constructor() {
        this.client = new ChromaClient({ path: "http://localhost:8000" });
        this.collectionName = "document_collection_gemini"; // Use a new collection name
        this.collection = null;
    }

    /**
     * Initializes the connection to ChromaDB using our custom Gemini embedding function.
     */
    async initialize() {
        try {
            // Instantiate our custom embedding function
            const embedder = new GeminiEmbeddingFunction();

            this.collection = await this.client.getOrCreateCollection({
                name: this.collectionName,
                embeddingFunction: embedder // Provide the custom function to ChromaDB
            });

            console.log(`✅ ChromaDB collection "${this.collectionName}" is ready with Gemini embeddings.`);
        } catch (error) {
            console.error("❌ Failed to initialize ChromaDB with Gemini embeddings:", error);
            throw error;
        }
    }

    async addDocuments(documents) {
        if (!this.collection) throw new Error("ChromaVectorStore not initialized.");
        if (!documents || documents.length === 0) return { count: 0 };

        const ids = documents.map(doc => doc.metadata.chunkId);
        const contents = documents.map(doc => doc.content);
        const metadatas = documents.map(doc => doc.metadata);

        try {
            await this.collection.add({ ids, documents: contents, metadatas });
            console.log(`[ChromaVectorStore] Added ${documents.length} documents using Gemini.`);
            return { count: documents.length };
        } catch (error) {
            console.error("❌ Error adding documents to Chroma:", error);
            throw error;
        }
    }


    async deleteDocumentsByFileId(fileId) {
        if (!this.collection) throw new Error("ChromaVectorStore not initialized.");
        try {
            await this.collection.delete({ where: { "fileId": fileId } });
            console.log(`[ChromaVectorStore] Deleted documents for fileId: ${fileId}`);
        } catch (error) {
            console.error(`❌ Error deleting documents for fileId ${fileId}:`, error);
        }
    }

    async searchDocuments(query, options = {}) {
        if (!this.collection) throw new Error("ChromaVectorStore not initialized.");
        const whereFilter = options.filters || {};
        try {
            const results = await this.collection.query({
                queryTexts: [query],
                nResults: options.limit || 5,
                where: whereFilter,
            });

            if (!results.documents || results.documents.length === 0) return [];
            
            return results.ids[0].map((id, index) => ({
                id: id,
                content: results.documents[0][index],
                metadata: results.metadatas[0][index],
                score: 1 - results.distances[0][index] // Convert distance to similarity
            }));
        } catch (error) {
            console.error('❌ ChromaDB search error:', error);
            return [];
        }
    }
}



// Export a singleton instance
module.exports = new ChromaVectorStore();