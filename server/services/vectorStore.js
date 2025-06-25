const path = require("path");
const fs = require('fs').promises;

class VectorStore {
    static cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
    }

    constructor() {
        this.documents = [];
        this.dimension = 384; // For MiniLM
        this.embeddingPipeline = null;
        this.storePath = path.join(__dirname, '..', 'faiss_indices', 'vector_store.json');
    }

    async initialize() {
        try {
            await this.loadStore();
            console.log('Vector store initialized');
        } catch (error) {
            console.error('Vector store initialization failed:', error);
            throw error;
        }
    }

    async initPipeline() {
        try {
            const hfApiKey = process.env.HF_API_KEY;
            if (!hfApiKey) {
                throw new Error('HF_API_KEY not found in environment variables');
            }
            const { pipeline } = await import('@xenova/transformers');
            this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                token: hfApiKey
            });
            console.log('✅ Vector store pipeline initialized');
        } catch (error) {
            console.error('❌ Error initializing vector store pipeline:', error);
            throw error;
        }
    }

    async generateEmbedding(text) {
        try {
            if (!this.embeddingPipeline) {
                await this.initPipeline();
            }
            const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            return embedding.map(val => val / magnitude);
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw error;
        }
    }

    async addDocuments(documents) {
        try {
            const processedDocs = await Promise.all(
                documents.map(async (doc) => {
                    const embedding = await this.generateEmbedding(doc.content);
                    return {
                        content: doc.content,
                        embedding,
                        metadata: { ...doc.metadata }
                    };
                })
            );
            this.documents.push(...processedDocs);
            await this.saveStore();
            console.log(`[VectorStore] Added ${processedDocs.length} documents. Total now: ${this.documents.length}`);
            return { count: processedDocs.length };
        } catch (error) {
            console.error('❌ Error adding documents:', error);
            throw error;
        }
    }
    
    async searchDocuments(query, options = {}) {
  try {
    // Validate input
    if (!query) throw new Error('Query is required');
    if (!options.filters?.userId) throw new Error('userId is required in filters');

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Apply filters
    let filteredDocs = this.documents.filter(doc => {
      // Always filter by userId
      if (doc.metadata.userId !== options.filters.userId) return false;
      // Only filter by fileId if provided
      if (options.filters.fileId && doc.metadata.fileId !== options.filters.fileId) return false;
      return true;
    });

    // Compute cosine similarity and map results
    const results = filteredDocs.map(doc => {
      const score = VectorStore.cosineSimilarity(queryEmbedding, doc.embedding);
      return { ...doc, score };
    });

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results and format output
    return results.slice(0, options.limit || 5).map(result => ({
      content: result.content,
      metadata: result.metadata,
      score: result.score
    }));
  } catch (error) {
    console.error('❌ Search documents error:', error);
    return [];
  }
}

    async saveStore() {
        try {
            const dir = path.dirname(this.storePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.storePath, JSON.stringify(this.documents, null, 2));
        } catch (error) {
            console.error('❌ Error saving vector store:', error);
        }
    }

    async loadStore() {
        try {
            const data = await fs.readFile(this.storePath, 'utf8');
            if (data) {
                this.documents = JSON.parse(data);
                console.log(`[VectorStore] Store loaded from ${this.storePath}. Documents: ${this.documents.length}`);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Error loading vector store:', error);
            }
        }
    }
    
    getStatistics() {
        const totalDocs = this.documents.length;
        const stats = {
            totalDocuments: totalDocs,
        };
        return stats;
    }
}

module.exports = VectorStore;