// Universal AI Service - Routes all AI requests to the selected model

class UniversalAIService {
    constructor() {
        // Lazy load dependencies to avoid circular imports
        this.geminiService = null;
        this.geminiAI = null;
        this.userSpecificAI = null;
    }

    /**
     * Initialize Gemini service (fallback)
     */
    async initializeGemini() {
        if (!this.geminiService) {
            const GeminiService = require('./geminiService');
            const { GeminiAI } = require('./geminiAI');

            this.geminiService = new GeminiService();
            await this.geminiService.initialize();
            this.geminiAI = new GeminiAI(this.geminiService);
        }
    }

    /**
     * Get user specific AI service
     */
    async getUserSpecificAI() {
        if (!this.userSpecificAI) {
            this.userSpecificAI = require('./userSpecificAI');
        }
        return this.userSpecificAI;
    }

    /**
     * Get the appropriate AI service based on selected model
     */
    async getAIService(selectedModel, userId) {
        console.log(`🤖 UniversalAI: Getting service for model ${selectedModel}, user ${userId}`);

        if (selectedModel.startsWith('ollama-') || selectedModel === 'llama-model' || selectedModel.includes('llama')) {
            // Use Ollama service
            if (!userId) {
                throw new Error('User ID required for Ollama service');
            }

            const userSpecificAI = await this.getUserSpecificAI();
            const userServices = await userSpecificAI.getUserAIServices(userId);
            if (!userServices.ollama) {
                throw new Error('Ollama service not available for user');
            }

            return {
                type: 'ollama',
                service: userServices.ollama,
                modelName: selectedModel.replace('ollama-', '').replace('_', ':').replace('llama-model', 'llama3.2:latest')
            };
        } else {
            // Use Gemini service (default)
            await this.initializeGemini();
            return {
                type: 'gemini',
                service: this.geminiAI,
                modelName: selectedModel
            };
        }
    }

    /**
     * Generate text using the selected model
     */
    async generateText(prompt, selectedModel = 'gemini-flash', userId = null) {
        try {
            const aiService = await this.getAIService(selectedModel, userId);
            
            if (aiService.type === 'ollama') {
                console.log(`🦙 Using Ollama model: ${aiService.modelName}`);
                const result = await aiService.service.generateChatResponse(prompt, aiService.modelName);
                return typeof result === 'string' ? result : result.response;
            } else {
                console.log(`🤖 Using Gemini model: ${aiService.modelName}`);
                return await aiService.service.generateText(prompt);
            }
        } catch (error) {
            console.error('UniversalAI generateText error:', error);
            throw error;
        }
    }

    /**
     * Generate chat response using the selected model
     */
    async generateChatResponse(query, tools = [], history = [], systemPrompt = '', selectedModel = 'gemini-flash', userId = null) {
        try {
            const aiService = await this.getAIService(selectedModel, userId);
            
            if (aiService.type === 'ollama') {
                console.log(`🦙 Using Ollama for chat: ${aiService.modelName}`);
                const result = await aiService.service.generateChatResponse(query, aiService.modelName);
                const responseText = typeof result === 'string' ? result : result.response;
                return { response: responseText, followUpQuestions: [] };
            } else {
                console.log(`🤖 Using Gemini for chat: ${aiService.modelName}`);
                return await aiService.service.generateChatResponse(query, tools, history, systemPrompt);
            }
        } catch (error) {
            console.error('UniversalAI generateChatResponse error:', error);
            throw error;
        }
    }

    /**
     * Generate podcast script using the selected model
     */
    async generatePodcastScript(documentContent, selectedModel = 'gemini-flash', userId = null) {
        try {
            const prompt = `Create a natural, engaging podcast script based on this content. Make it conversational and informative:

${documentContent}

Write a single-host podcast script that:
1. Introduces the topic naturally
2. Explains key concepts clearly
3. Uses conversational language
4. Includes smooth transitions
5. Ends with a thoughtful conclusion

Write ONLY the natural monologue without any names, no JSON, no formatting, just natural single-host presentation.`;

            const script = await this.generateText(prompt, selectedModel, userId);
            return script;
        } catch (error) {
            console.error('UniversalAI generatePodcastScript error:', error);
            throw error;
        }
    }

    /**
     * Generate mind map data using the selected model
     */
    async generateMindMapFromTranscript(documentContent, title, selectedModel = 'gemini-flash', userId = null) {
        try {
            const truncatedContent = documentContent.substring(0, 8000);
            
            const prompt = `Create a comprehensive mind map in Mermaid syntax for the following document content.

Title: ${title}
Content: ${truncatedContent}

Generate a mind map that:
1. Uses proper Mermaid mindmap syntax
2. Starts with "mindmap" keyword
3. Has a clear root node
4. Includes main topics and subtopics
5. Uses proper indentation

Example format:
mindmap
  root((${title}))
    Topic 1
      Subtopic 1.1
      Subtopic 1.2
    Topic 2
      Subtopic 2.1

Generate the mind map now:`;

            const mindMapData = await this.generateText(prompt, selectedModel, userId);
            return mindMapData;
        } catch (error) {
            console.error('UniversalAI generateMindMapFromTranscript error:', error);
            throw error;
        }
    }

    /**
     * Generate PPT content using the selected model
     */
    async generatePPTContent(topic, slideTitle, selectedModel = 'gemini-flash', userId = null) {
        try {
            const prompt = `Generate content for a PowerPoint slide about "${topic}".

Slide Title: ${slideTitle}

Provide:
1. A clear, engaging title
2. 3-5 bullet points with key information
3. Keep content concise and professional
4. Make it suitable for a business presentation

Format the response as:
Title: [slide title]
Content:
• [bullet point 1]
• [bullet point 2]
• [bullet point 3]
• [bullet point 4]
• [bullet point 5]`;

            const content = await this.generateText(prompt, selectedModel, userId);
            return content;
        } catch (error) {
            console.error('UniversalAI generatePPTContent error:', error);
            throw error;
        }
    }

    /**
     * Generate report summary using the selected model
     */
    async generateReportSummary(topic, searchResults, selectedModel = 'gemini-flash', userId = null) {
        try {
            const prompt = `Create a comprehensive report summary about "${topic}" based on the following research data:

${searchResults}

Generate a well-structured summary that:
1. Provides an overview of the topic
2. Highlights key findings
3. Includes relevant statistics or data
4. Maintains professional tone
5. Is suitable for a business report

Write a detailed summary (500-800 words):`;

            const summary = await this.generateText(prompt, selectedModel, userId);
            return summary;
        } catch (error) {
            console.error('UniversalAI generateReportSummary error:', error);
            throw error;
        }
    }

    /**
     * Build system prompt (compatible with existing code)
     */
    buildSystemPrompt(systemPrompt, context, chatHistory) {
        // This method maintains compatibility with existing code
        let fullPrompt = systemPrompt || 'You are a helpful AI assistant.';
        
        if (context && context.length > 0) {
            fullPrompt += '\n\nContext:\n' + context.join('\n');
        }
        
        if (chatHistory && chatHistory.length > 0) {
            fullPrompt += '\n\nPrevious conversation:\n';
            chatHistory.forEach(msg => {
                fullPrompt += `${msg.role}: ${msg.content}\n`;
            });
        }
        
        return fullPrompt;
    }
}

// Export singleton instance
module.exports = new UniversalAIService();
