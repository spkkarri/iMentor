const GeminiAI = require('./geminiAI');

class AIService {
  constructor() {
    try {
      this.gemini = GeminiAI;
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error.message);
      throw error;
    }
  }

  async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
    return await this.gemini.generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt);
  }

  async generatePodcastScript(documentContent) {
    return await this.gemini.generatePodcastScript(documentContent);
  }

  async generateMindMapData(documentContent, title) {
    return await this.gemini.generateMindMapFromTranscript(documentContent, title);
  }

  buildSystemPrompt(systemPrompt, context, chatHistory) {
    return this.gemini.buildSystemPrompt(systemPrompt, context, chatHistory);
  }

  buildContext(documentChunks) {
    return this.gemini.buildContext(documentChunks);
  }
}

module.exports = new AIService();