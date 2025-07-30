/**
 * Basic Embedding Service for Deep Search
 * Provides text embedding functionality
 */

class EmbeddingService {
    constructor(model = null) {
        this.model = model;
        console.log('EmbeddingService initialized');
    }

    /**
     * Generate embeddings for text (fast deterministic approach)
     */
    async generateEmbedding(text) {
        if (!text || typeof text !== 'string') {
            return new Array(128).fill(0); // Reduced dimension for speed
        }

        // Fast deterministic embedding based on text content
        const words = text.toLowerCase().match(/\w+/g) || [];
        const embedding = new Array(128).fill(0);

        // Simple word frequency approach
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Map words to embedding dimensions deterministically
        Object.keys(wordFreq).forEach((word) => {
            const hash = this.simpleHash(word) % 128;
            embedding[hash] += wordFreq[word];
        });

        // Quick normalization
        const sum = embedding.reduce((a, b) => a + Math.abs(b), 0);
        if (sum > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= sum;
            }
        }

        return embedding;
    }

    /**
     * Simple hash function for words
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Calculate similarity between embeddings (optimized)
     */
    calculateSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denominator > 0 ? dotProduct / denominator : 0;
    }

    /**
     * Chunk text into smaller pieces for processing (optimized)
     */
    chunkText(text, chunkSize = 800, overlap = 100) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // For short texts, return as single chunk
        if (text.length <= chunkSize) {
            return [{
                text: text.trim(),
                start: 0,
                end: text.length,
                index: 0
            }];
        }

        const chunks = [];
        let start = 0;

        // Limit total chunks to prevent excessive processing
        const maxChunks = 5;

        while (start < text.length && chunks.length < maxChunks) {
            let end = start + chunkSize;

            // If we're not at the end, try to break at a sentence or word boundary
            if (end < text.length) {
                // Look for sentence boundary
                const sentenceEnd = text.lastIndexOf('.', end);
                const questionEnd = text.lastIndexOf('?', end);
                const exclamationEnd = text.lastIndexOf('!', end);

                const sentenceBoundary = Math.max(sentenceEnd, questionEnd, exclamationEnd);

                if (sentenceBoundary > start + chunkSize * 0.5) {
                    end = sentenceBoundary + 1;
                } else {
                    // Look for word boundary
                    const wordBoundary = text.lastIndexOf(' ', end);
                    if (wordBoundary > start + chunkSize * 0.5) {
                        end = wordBoundary;
                    }
                }
            }

            const chunk = text.slice(start, end).trim();
            if (chunk.length > 50) { // Only include meaningful chunks
                chunks.push({
                    text: chunk,
                    start: start,
                    end: end,
                    index: chunks.length
                });
            }

            // Move start position with overlap
            start = Math.max(start + chunkSize - overlap, end);
        }

        return chunks;
    }

    /**
     * Embed multiple text chunks (optimized for performance)
     */
    async embedChunks(chunks) {
        const embeddings = [];

        // Process in smaller batches to avoid overwhelming the system
        const batchSize = 3;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            // Process batch in parallel for better performance
            const batchPromises = batch.map(async (chunk) => {
                const text = typeof chunk === 'string' ? chunk : chunk.text || '';
                // Limit text length to improve performance
                const limitedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
                const embedding = await this.generateEmbedding(limitedText);
                return {
                    text: limitedText,
                    embedding: embedding,
                    chunk: chunk
                };
            });

            const batchResults = await Promise.all(batchPromises);
            embeddings.push(...batchResults);

            // Small delay between batches to prevent overwhelming
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return embeddings;
    }

    /**
     * Find most similar texts
     */
    async findSimilar(queryText, texts, topK = 5) {
        const queryEmbedding = await this.generateEmbedding(queryText);
        const similarities = [];

        for (let i = 0; i < texts.length; i++) {
            const textEmbedding = await this.generateEmbedding(texts[i]);
            const similarity = this.calculateSimilarity(queryEmbedding, textEmbedding);
            similarities.push({ index: i, text: texts[i], similarity });
        }

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
    }

    /**
     * Static method for cosine similarity calculation (optimized)
     */
    static cosineSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denominator > 0 ? dotProduct / denominator : 0;
    }
}

module.exports = EmbeddingService;