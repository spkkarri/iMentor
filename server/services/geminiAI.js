// const geminiService = require('./geminiService');
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');

class GeminiAI {
    constructor(geminiService) {
        this.geminiService = geminiService;
        if (!this.geminiService || !this.geminiService.genAI) {
            this.logger = {
                debug: console.debug,
                info: console.info,
                warn: console.warn,
                error: console.error
            };
            this.logger.warn('Gemini AI service initialization failed. Using fallback mode.');
        }
    }

    /**
     * Generate a chat response using Gemini with document context
     * @param {string} userMessage - User's input message
     * @param {Array} documentChunks - Relevant document chunks from vectorStore
     * @param {Array} chatHistory - Previous messages in the session
     * @param {string} systemPrompt - Optional system prompt
     * @returns {Promise<string>} Generated response text
     */
    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        const context = this.buildContext(documentChunks);
        const prompt = this.buildSystemPrompt(systemPrompt, context, chatHistory) + `\nUser: ${userMessage}\nAssistant: `;
        
        try {
            // Check if Gemini service is properly initialized
            if (!this.geminiService || !this.geminiService.model) {
                console.warn('Gemini AI service not properly initialized. Using fallback response.');
                return this.getFallbackResponse(userMessage, context);
            }
            
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Gemini chat response error:', error.message);
            return this.getFallbackResponse(userMessage, context);
        }
    }

    /**
     * Get fallback response when Gemini AI is not available
     */
    getFallbackResponse(userMessage, context) {
        if (context && context !== 'No relevant document context available.') {
            return `I understand you're asking about: "${userMessage}". Based on the available documents, I can see relevant information, but I'm currently unable to provide a detailed AI-generated response. Please try again later or contact support if the issue persists.`;
        } else {
            return `I understand you're asking: "${userMessage}". I'm currently unable to provide an AI-generated response. Please try again later or contact support if the issue persists.`;
        }
    }

    /**
     * Generate a document summary using Gemini
     * @param {string} documentContent - Full document content
     * @param {Object} options - Summary options
     * @param {string} options.type - Type of summary (short, medium, long, bullet_points, conversational)
     * @param {string} options.style - Style of summary (formal, casual, technical, creative)
     * @param {number} options.length - Target length in words (optional)
     * @param {string} options.focus - Specific focus area (optional)
     * @returns {Promise<Object>} Summary object with text, key points, and metadata
     */
    async generateSummary(documentContent, options = {}) {
        // Defensive check for Gemini Service
        if (!this.geminiService?.model) {
            console.error('Gemini summary error: Gemini service or model is not initialized.');
            throw new Error('Failed to generate summary due to AI service initialization issues.');
        }

        const {
            type = SUMMARIZATION_TYPES.MEDIUM,
            style = SUMMARIZATION_STYLES.FORMAL,
            length,
            focus
        } = options;

        const prompt = `
You are an expert summarizer. Generate a ${style} summary of the following document:

${documentContent.substring(0, 4000)}...

Summary requirements:
1. Type: ${type}
2. Style: ${style}
3. Focus: ${focus || 'main points'}
4. Length: ${length ? `${length} words` : 'appropriate'}

Provide the summary in JSON format with these fields:
- text: The main summary text
- keyPoints: Array of bullet points highlighting main points
- sentiment: Overall sentiment (positive, negative, neutral)
- confidence: Confidence score (0-1)
- metadata: {
    wordCount: number of words,
    readingTime: estimated reading time in minutes,
    topics: array of main topics
}

Respond with ONLY a valid JSON object in this format.`;

        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

            // Clean response to extract JSON
            if (text.startsWith('```json')) {
                text = text.replace(/```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/```\s*/, '').replace(/\s*```$/, '');
            }

            // Try to extract JSON object
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
            }

            const summary = JSON.parse(jsonMatch[0]);
            
            // Validate the summary structure
            if (!summary || !summary.text || !summary.keyPoints) {
                throw new Error('Invalid summary format');
            }
            
            return summary;
        } catch (error) {
            console.error('Gemini summary error:', error.message);
            // Provide a structured fallback error to avoid breaking the caller
            throw new Error('Failed to generate summary');
        }
    }

    /**
     * Generate a podcast script using Gemini
     * @param {string} documentContent - Full document content
     * @returns {Promise<Array>} Array of script segments
     */
    async generatePodcastScript(documentContent) {
        // First generate a summary to use as context
        const summary = await this.generateSummary(documentContent, {
            type: SUMMARIZATION_TYPES.MEDIUM,
            style: SUMMARIZATION_STYLES.CONVERSATIONAL
        });

        const prompt = `
You are an expert podcast scriptwriter. Based on the following summary and key points, create a podcast script for two hosts (Host A and Host B) discussing the key topics in an engaging, conversational style. The script should be structured as an array of JSON objects, each with:
- speaker: "Host A" or "Host B"
- text: The dialogue text (keep each segment between 2-4 sentences for natural flow)
- duration: Estimated duration in seconds (approximate)
- focus: Main topic of discussion

Summary:
${summary.text}

Key Points:
${summary.keyPoints.join('\n')}

Main Topics:
${summary.metadata.topics.join(', ')}

Create a script with 8-12 segments, covering all key points from the summary, with a total duration of about 3-4 minutes. Use a friendly, informative tone suitable for a general audience. Make sure Host A and Host B alternate naturally and have distinct personalities - Host A can be more analytical, Host B more curious and engaging.

Each segment should be conversational and flow naturally into the next. Include questions, reactions, and natural transitions between topics.

Respond with ONLY a valid JSON array of script segments.
`;

        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

      // Clean response to extract JSON
      if (text.startsWith('```json')) {
        text = text.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/```\s*/, '').replace(/\s*```$/, '');
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const script = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(script) || script.length < 8) {
        throw new Error('Podcast script is too short or invalid');
      }

      return script;
    } catch (error) {
      console.error('Gemini podcast script error:', error.message);
      return [
        { speaker: 'Host A', text: 'Sorry, we could not generate the podcast script today.', duration: 10 },
        { speaker: 'Host B', text: 'Let us move on to another topic!', duration: 10 }
      ];
    }
  }

  /**
   * Generate mind map data using Gemini
   * @param {string} documentContent - Full document content
   * @param {string} title - The title of the document
   * @returns {Promise<Object>} Mind map data with nodes and edges
   */
  async generateMindMapFromTranscript(documentContent, title) {
    // Defensive check for Gemini Service
    if (!this.geminiService || !this.geminiService.model) {
        console.error('Gemini mind map error: Gemini service or model is not initialized.');
        throw new Error('Failed to generate mind map due to AI service initialization issues.');
    }

    const prompt = `
You are an expert in creating mind maps. Based on the following content from the document titled "${title}", generate a hierarchical mind map. The content is as follows:
---
${documentContent}
---
Provide the output in a structured JSON format with nodes and edges, suitable for a mind map visualization library like React Flow.
The JSON object should have two properties: "nodes" and "edges".
Each node in the "nodes" array must have an "id", a "position" (with "x" and "y" coordinates, which you should determine for a good layout), and a "data" object with a "label". The root node should be at position { x: 250, y: 5 }.
Each edge in the "edges" array must have an "id", a "source" node ID, and a "target" node ID.
The mind map should start with a central root node representing the main topic, and then branch out to main ideas, sub-ideas, and key concepts.
Ensure the structure is logical and easy to understand.
Example format:
{
  "nodes": [
    { "id": "1", "position": { "x": 250, "y": 5 }, "data": { "label": "Main Topic" } },
    { "id": "2", "position": { "x": 100, "y": 100 }, "data": { "label": "Branch 1" } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2" }
  ]
}
`;

    try {
        const result = await this.geminiService.model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        
        // Sanitize the response to get only the JSON part
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
            return JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("Failed to extract valid JSON from the AI's response for the mind map.");
        }
    } catch (error) {
        console.error('Error generating mind map with Gemini:', error);
        throw new Error('Failed to generate mind map data due to an AI service error.');
    }
  }

  /**
   * Check Gemini API quota status
   * @returns {Promise<Object>} Quota information
   */
  async checkQuota() {
    try {
      // Since Gemini doesn't provide a direct quota check API,
      // we'll make a minimal test request to check if we can generate content
      const testPrompt = "Hello";
      const result = await this.geminiService.model.generateContent(testPrompt);
      const response = result.response;
      
      // If we get here, the API is working
      return {
        remaining: 100, // Assume we have remaining quota
        limit: 200, // Gemini 2.0 Flash limit
        status: 'available'
      };
    } catch (error) {
      // Check if it's a quota error
      if (error.message && (
        error.message.includes('quota') ||
        error.message.includes('429') ||
        error.message.includes('Too Many Requests') ||
        error.message.includes('exceeded')
      )) {
        return {
          remaining: 0,
          limit: 200,
          status: 'quota_exceeded'
        };
      }
      
      // Other errors
      throw error;
    }
  }

  /**
   * Generate simple text response using Gemini
   * @param {string} prompt - The prompt to send to Gemini
   * @returns {Promise<string>} Generated text response
   */
  async generateText(prompt) {
    try {
      const result = await this.geminiService.model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini text generation error:', error.message);
      throw new Error('Failed to generate text response');
    }
  }

  /**
   * Build context from document chunks
   * @param {Array} documentChunks - Array of document chunks
   * @returns {string} Formatted context string
   */
  buildContext(documentChunks) {
    // Defensive: ensure documentChunks is an array
    if (!Array.isArray(documentChunks)) {
      documentChunks = [];
    }
    if (!documentChunks || documentChunks.length === 0) {
      return 'No relevant document context available.';
    }
    return documentChunks
      .map(chunk => `Document: ${chunk.metadata?.source || 'Unknown'}\n${chunk.content}`)
      .join('\n\n');
  }

  /**
   * Build system prompt with context and chat history
   * @param {string} systemPrompt - Base system prompt
   * @param {string} context - Document context
   * @param {Array} chatHistory - Array of { role: string, content: string }
   * @returns {string} Complete system prompt
   */
  buildSystemPrompt(systemPrompt, context, chatHistory) {
    const basePrompt = systemPrompt || 'You are a helpful AI assistant providing accurate and concise answers.';
    const contextSection = context ? `\n\nRelevant Context:\n${context}` : '';
    const historySection = chatHistory && chatHistory.length > 0
      ? `\n\nConversation History:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';
    return `${basePrompt}${contextSection}${historySection}`;
  }

  async synthesizeResults(results, query, decomposition) {
    if (!this.geminiService || !this.geminiService.model) {
        return {
            summary: `I'm sorry, but the AI service is unavailable. I found ${results.length} results for your query: "${query}".`,
            sources: results.map(r => r.metadata?.source || r.source || 'Unknown'),
            aiGenerated: false,
            fallback: true
        };
    }
    try {
        const context = results.map(result => `Source: ${result.metadata.source}\nSnippet: ${result.metadata.snippet}`).join('\n\n');
        const prompt = `Based on the following search results, provide a concise answer to the query: "${query}".\n\nContext:\n${context}`;
        
        const result = await this.geminiService.model.generateContent(prompt);
        const text = this.geminiService._processApiResponse(result.response);

        return {
            summary: text,
            sources: results.map(r => r.metadata?.source || r.source),
            aiGenerated: true,
            decomposition: decomposition || []
        };
    } catch (error) {
        console.error('Error in synthesizeResults:', error);
        throw new Error(`Failed to synthesize results for query: "${query}"`);
    }
  }
}

module.exports = { GeminiAI };