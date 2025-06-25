// server/services/LangchainVectorStore.js

const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const fs = require('fs');
const path = require('path');

// Define the path where the vector store files will be saved.
const STORE_PATH = path.resolve(__dirname, '..', 'vector_store_data');

class LangchainVectorStore {
    constructor() {
        this.store = null;
        this.embeddings = null;
    }

    /**
     * Initializes the vector store. It will load from disk if the files exist,
     * or prepare for creation if they don't.
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

        // Check if a store already exists on disk
        if (fs.existsSync(STORE_PATH)) {
            try {
                console.log("Found existing vector store. Loading from disk...");
                this.store = await HNSWLib.load(STORE_PATH, this.embeddings);
                console.log("✅ Vector store loaded successfully from disk.");
            } catch (e) {
                console.error("Error loading vector store from disk. It might be corrupted.", e);
            }
        } else {
            console.log("No vector store found on disk. A new one will be created when the first document is added.");
            // We can't create an empty store, so we wait for the first `addDocuments` call.
        }
    }

    /**
     * Adds documents to the vector store and saves it to disk.
     */
    async addDocuments(documents) {
        if (!documents || documents.length === 0) return { count: 0 };

        const contents = documents.map(doc => doc.content);
        const metadatas = documents.map(doc => doc.metadata);

        if (!this.store) {
            // If the store doesn't exist yet, create it from the first batch of documents.
            this.store = await HNSWLib.fromTexts(contents, metadatas, this.embeddings);
        } else {
            // Otherwise, add the new documents to the existing store.
            await this.store.addDocuments(documents);
        }

        // Persist the changes to the file system.
        await this.store.save(STORE_PATH);
        console.log(`[LangchainVectorStore] Added ${documents.length} documents and saved to disk.`);
        return { count: documents.length };
    }

    /**
     * Deletes documents associated with a fileId.
     * This is done by rebuilding the store without the deleted documents.
     */
    async deleteDocumentsByFileId(fileId) {
        if (!this.store) return;

        console.log(`Attempting to delete documents for fileId: ${fileId}`);
        const allDocs = this.store.docstore._docs;
        const docsToKeep = [];

        // HNSWLib uses a Map, so we iterate over its values
        for (const doc of allDocs.values()) {
            if (doc.metadata.fileId !== fileId) {
                docsToKeep.push(doc);
            }
        }
        
        const numDeleted = allDocs.size - docsToKeep.length;
        console.log(`Found ${numDeleted} documents to delete.`);

        if (docsToKeep.length > 0) {
            const contents = docsToKeep.map(doc => doc.pageContent);
            const metadatas = docsToKeep.map(doc => doc.metadata);
            // Rebuild the store from the documents we want to keep.
            this.store = await HNSWLib.fromTexts(contents, metadatas, this.embeddings);
            await this.store.save(STORE_PATH);
        } else {
            // If no documents are left, delete the store directory entirely.
            this.store = null;
            if (fs.existsSync(STORE_PATH)) {
                fs.rmSync(STORE_PATH, { recursive: true, force: true });
            }
        }
        console.log(`[LangchainVectorStore] Documents for fileId ${fileId} removed. Store updated.`);
    }

    /**
     * Searches for relevant documents using metadata filters.
     */
    async searchDocuments(query, options = {}) {
        if (!this.store) return [];

        const results = await this.store.similaritySearchWithScore(
            query,
            options.limit || 5,
            (doc) => {
                // This is LangChain's powerful metadata filtering function.
                if (options.filters?.userId && doc.metadata.userId !== options.filters.userId) return false;
                if (options.filters?.fileId && doc.metadata.fileId !== options.filters.fileId) return false;
                return true; // Keep the document if it passes all filters
            }
        );

        // Format the results to match what the rest of your app expects.
        return results.map(([doc, score]) => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            score: score
        }));
    }
}

// Export a singleton instance so the same store is used across your app.
module.exports = new LangchainVectorStore();