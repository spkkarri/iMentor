const VectorStore = require('./vectorStore');
const geminiService = require('./geminiService');
const { MESSAGE_TYPES } = require('../models/ChatSession');

const MAX_CONTEXT_LENGTH = 2048; // Maximum context length for Gemini
const MAX_DOCUMENTS = 5; // Maximum number of documents to consider

/**
 * RAG Service for handling retrieval-augmented generation
 */
class RagService {
    constructor() {
        this.vectorStore = new VectorStore();
        this.geminiService = geminiService;
    }

    /**
     * Get relevant documents for a query
     * @param {string} query - Search query
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Relevant documents
     */
    async getRelevantDocuments(query, userId) {
        try {
            const options = {
                userId,
                limit: MAX_DOCUMENTS,
                strategy: VectorStore.SEARCH_STRATEGIES.COSINE,
                boostRecency: true,
                boostContext: true
            };

            const documents = await this.vectorStore.searchDocuments(query, options);
            return documents.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Error getting relevant documents:', error);
            throw error;
        }
    }

    /**
     * Generate context from documents
     * @param {Array} documents - Relevant documents
     * @returns {string} Formatted context
     */
    generateContext(documents) {
        let context = '';
        let currentLength = 0;

        // Sort documents by relevance and add them until we reach max length
        documents.forEach(doc => {
            if (currentLength + doc.content.length + doc.metadata.source.length <= MAX_CONTEXT_LENGTH) {
                context += `\n\nDocument: ${doc.metadata.source}\n${doc.content}`;
                currentLength += doc.content.length + doc.metadata.source.length;
            }
        });

        return context.trim();
    }

    /**
     * Generate response using RAG
     * @param {string} query - User query
     * @param {string} userId - User ID
     * @param {Array} chatHistory - Chat history
     * @param {string} systemPrompt - System prompt
     * @param {string} messageType - Type of message (text, audio, etc.)
     * @returns {Promise<Object>} Generated response
     */
    async generateResponse(query, userId, chatHistory, systemPrompt, messageType = MESSAGE_TYPES.TEXT) {
        try {
            // Get relevant documents
            const documents = await this.getRelevantDocuments(query, userId);
            const context = this.generateContext(documents);

            // Generate response based on message type
            let response;
            switch (messageType) {
                case MESSAGE_TYPES.TEXT:
                    response = await this.geminiService.generateChatResponse(
                        query,
                        context,
                        chatHistory,
                        systemPrompt
                    );
                    break;
                case MESSAGE_TYPES.AUDIO:
                    response = await this.generateAudioResponse(query, context);
                    break;
                case MESSAGE_TYPES.MINDMAP:
                    response = await this.generateMindMap(query, context);
                    break;
                default:
                    throw new Error(`Unsupported message type: ${messageType}`);
            }

            return {
                response,
                documents: documents.map(doc => ({
                    source: doc.metadata.source,
                    score: doc.score,
                    content: doc.content.substring(0, 200) + '...'
                }))
            };
        } catch (error) {
            console.error('RAG response generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate audio response (podcast)
     * @param {string} query - User query
     * @param {string} context - Document context
     * @returns {Promise<Object>} Podcast data
     */
    async generateAudioResponse(query, context) {
        try {
            const podcastScript = await this.geminiService.generatePodcastScript(query, context);
            const scriptUrl = await this.generatePodcastScript(podcastScript);
            return { scriptUrl, script: podcastScript };
        } catch (error) {
            console.error('Podcast generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate mindmap response
     * @param {string} query - User query
     * @param {string} context - Document context
     * @returns {Promise<Object>} Mindmap data
     */
    async generateMindMap(query, context) {
        try {
            const mindMapData = await this.geminiService.generateMindMapData(query, context);
            return mindMapData;
        } catch (error) {
            console.error('Mindmap generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate podcast script
     * @param {string} script - Podcast script
     * @returns {Promise<string>} Script URL
     */
    async generatePodcastScript(script) {
        // Implementation for generating podcast script
        // This would typically involve a separate service
        return 'https://example.com/podcast/script.mp3';
    }
}

module.exports = new RagService();
