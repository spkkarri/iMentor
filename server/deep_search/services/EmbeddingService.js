
// EmbeddingService.js
// Service for chunking text and generating multilingual embeddings
// Now with language detection and sentence-based chunking



const axios = require('axios');
let sbd;
try {
  sbd = require('sbd'); // npm install sbd
} catch (e) {
  sbd = null;
}



/**
 * Service for chunking text and generating multilingual embeddings.
 * Includes language detection, sentence-based chunking, and in-memory embedding cache.
 */

class EmbeddingService {
    /**
     * @param {object|string|null} optionsOrModel
     * If object: { model, apiKey, cache }, else legacy: model string
     */
    constructor(optionsOrModel = null) {
        let model, apiKey, cache;
        if (optionsOrModel && typeof optionsOrModel === 'object' && !Array.isArray(optionsOrModel)) {
            model = optionsOrModel.model;
            apiKey = optionsOrModel.apiKey;
            cache = optionsOrModel.cache;
        } else {
            model = optionsOrModel;
        }
        this.model = model || 'sentence-transformers/all-MiniLM-L6-v2';
        this.apiKey = apiKey || process.env.HF_API_KEY;
        this.embeddingCache = cache || new Map();
    }


    /**
     * Detect language of the text (stub: returns 'eng' for English, 'fra' for French, else 'unk')
     * @param {string} text
     * @returns {string} Language code (e.g., 'eng', 'fra', 'unk')
     */
    detectLanguage(text) {
        if (!text) return 'unk';
        if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
        if (/[一-龯]/.test(text)) return 'zh';
        if (/\b(le|la|et|est|sont|ceci|cela|avec|pour|de|à|en|sur|du)\b/i.test(text)) return 'fra';
        if (/\b(the|and|is|are|this|that|with|for|from|to|in|on|of)\b/i.test(text)) return 'eng';
        return 'unk';
    }


    /**
     * Split text into sentence-based chunks (late-chunking)
     * @param {string} text
     * @param {number} chunkSize Number of sentences per chunk
     * @returns {string[]} Array of chunked text
     */
    chunkText(text, chunkSize = 3) {
        // Use sbd for robust sentence splitting if available
        const sentences = sbd
            ? sbd.sentences(text, { newline_boundaries: true })
            : (text.match(/[^.!?]+[.!?]+/g) || [text]);
        const chunks = [];
        for (let i = 0; i < sentences.length; i += chunkSize) {
            chunks.push(sentences.slice(i, i + chunkSize).join(' '));
        }
        return chunks;
    }



    /**
     * Generate embeddings for each chunk (stub, with multilingual model selection and caching)
     * @param {string[]} chunks Array of text chunks
     * @param {string} lang Language code
     * @returns {Promise<Array<{chunk: string, embedding: number[], lang: string, cached: boolean}>>}
     */
    async embedChunks(chunks, lang = 'eng') {
        // Batch embedding requests for efficiency
        const results = [];
        for (const chunk of chunks) {
            const cacheKey = `${lang}:${chunk}`;
            if (this.embeddingCache.has(cacheKey)) {
                results.push({ chunk, embedding: this.embeddingCache.get(cacheKey), lang, cached: true });
                continue;
            }
            try {
                const response = await axios.post(
                    `https://api-inference.huggingface.co/pipeline/feature-extraction/${this.model}`,
                    { inputs: chunk },
                    { headers: { Authorization: `Bearer ${this.apiKey}` } }
                );
                const embedding = response.data[0];
                this.embeddingCache.set(cacheKey, embedding);
                results.push({ chunk, embedding, lang, cached: false });
            } catch (e) {
                // Fallback to dummy vector
                const embedding = Array(768).fill(Math.random());
                this.embeddingCache.set(cacheKey, embedding);
                results.push({ chunk, embedding, lang, cached: false, error: e.message });
            }
        }
        return results;
    }


    /**
     * Compute cosine similarity between two vectors
     * @param {number[]} vecA
     * @param {number[]} vecB
     * @returns {number} Cosine similarity (-1 to 1)
     */
    static cosineSimilarity(vecA, vecB) {
        const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        return dot / (normA * normB);
    }
}


module.exports = EmbeddingService;
