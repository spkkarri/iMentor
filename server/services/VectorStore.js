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
            // Ensure pipeline is initialized only once during application startup
            // or when explicitly needed, not on every embedding generation.
            // This helps prevent EMFILE errors by reducing repeated file open attempts.
            await this.initPipeline();
            console.log('Vector store initialized');
        } catch (error) {
            console.error('Vector store initialization failed:', error);
            throw error;
        }
    }

    async initPipeline() {
        // Only initialize the pipeline if it hasn't been already
        if (this.embeddingPipeline) {
            console.log('Vector store pipeline already initialized. Skipping re-initialization.');
            return;
        }
        try {
            const hfApiKey = process.env.HF_API_KEY;
            if (!hfApiKey) {
                console.error('HF_API_KEY not found in environment variables. Please set it to access Hugging Face models.');
                throw new Error('HF_API_KEY not found');
            }
            console.log(`[VectorStore] Attempting to initialize pipeline with HF_API_KEY present: ${!!hfApiKey}`);
            const { pipeline } = await import('@xenova/transformers');
            this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                token: hfApiKey
            });
            console.log('✅ Vector store pipeline initialized');
        } catch (error) {
            console.error('❌ Error initializing vector store pipeline:', error);
            console.error('Detailed error during pipeline initialization:', error.message, error.stack);
            if (error.cause) {
                console.error('Caused by:', error.cause);
            }
            throw error;
        }
    }

    async generateEmbedding(text) {
        try {
            // The pipeline should ideally be initialized once during VectorStore initialization.
            // This check ensures it's available, but repeated calls to initPipeline here
            // are what caused the EMFILE error.
            if (!this.embeddingPipeline) {
                console.warn('[VectorStore] Embedding pipeline not initialized during embedding generation. This should ideally be initialized once during startup. Attempting to initialize now.');
                await this.initPipeline();
            }
            console.log(`[VectorStore] Generating embedding for text (first 50 chars): "${text.substring(0, 50)}..."`);
            const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            console.log('[VectorStore] Embedding generated successfully.');
            return embedding.map(val => val / magnitude);
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            console.error('Detailed error during embedding generation:', error.message, error.stack);
            if (error.cause) {
                console.error('Caused by:', error.cause);
            }
            throw error;
        }
    }

    async addDocuments(documents) {
        try {
            // Ensure pipeline is initialized before processing documents
            if (!this.embeddingPipeline) {
                console.log('[VectorStore] Pipeline not initialized before adding documents. Initializing now.');
                await this.initPipeline();
            }
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

    // Apply minimum relevance threshold (default 0.3, can be overridden in options)
    const minThreshold = options.minThreshold || 0.3;
    const relevantResults = results.filter(result => result.score >= minThreshold);

    console.log(`[VectorStore] Found ${results.length} total results, ${relevantResults.length} above threshold ${minThreshold}`);

    // Limit results and format output
    return relevantResults.slice(0, options.limit || 5).map(result => ({
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