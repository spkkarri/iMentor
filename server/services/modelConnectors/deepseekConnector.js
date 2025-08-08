// server/services/modelConnectors/deepseekConnector.js
// Connector for DeepSeek models (specialized in reasoning and analysis)

const axios = require('axios');

class DeepSeekConnector {
    constructor(apiKey = null) {
        this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY;
        this.baseUrl = 'https://api.deepseek.com/v1';
        this.isAvailable = false;
        this.defaultModel = 'deepseek-chat';
        this.availableModels = [
            'deepseek-chat',
            'deepseek-coder',
            'deepseek-reasoner'
        ];
    }

    /**
     * Initialize DeepSeek connector
     */
    async initialize() {
        try {
            console.log('🧠 Initializing DeepSeek connector...');
            
            if (!this.apiKey) {
                throw new Error('DeepSeek API key not provided');
            }

            // Test API connection
            await this.testConnection();
            
            this.isAvailable = true;
            console.log('✅ DeepSeek connector initialized successfully');
            
        } catch (error) {
            console.warn('⚠️ DeepSeek not available:', error.message);
            this.isAvailable = false;
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.status === 200;
        } catch (error) {
            throw new Error(`DeepSeek connection test failed: ${error.message}`);
        }
    }

    /**
     * Generate chat response using DeepSeek
     */
    async generateChatResponse(query, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('DeepSeek is not available');
        }

        try {
            console.log(`🧠 Generating reasoning response with ${model}...`);
            
            const messages = [
                {
                    role: 'system',
                    content: this.getSystemPrompt(model, options.conversationType)
                },
                {
                    role: 'user',
                    content: query
                }
            ];

            const requestData = {
                model: model,
                messages: messages,
                temperature: options.temperature || 0.3, // Lower temperature for reasoning
                max_tokens: options.max_tokens || 2048,
                top_p: options.top_p || 0.8,
                frequency_penalty: options.frequency_penalty || 0,
                presence_penalty: options.presence_penalty || 0,
                stream: false
            };

            const response = await axios.post(`${this.baseUrl}/chat/completions`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 second timeout for complex reasoning
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                const choice = response.data.choices[0];
                
                return {
                    response: choice.message.content.trim(),
                    model: model,
                    finish_reason: choice.finish_reason,
                    usage: response.data.usage,
                    reasoning_steps: this.extractReasoningSteps(choice.message.content),
                    confidence: this.assessConfidence(choice.message.content)
                };
            } else {
                throw new Error('Invalid response from DeepSeek');
            }

        } catch (error) {
            console.error('DeepSeek generation error:', error.message);
            throw new Error(`DeepSeek generation failed: ${error.message}`);
        }
    }

    /**
     * Generate response with conversation history
     */
    async generateConversationResponse(messages, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('DeepSeek is not available');
        }

        try {
            // Add system prompt for reasoning
            const systemMessage = {
                role: 'system',
                content: this.getSystemPrompt(model, options.conversationType)
            };

            const requestData = {
                model: model,
                messages: [systemMessage, ...messages],
                temperature: options.temperature || 0.3,
                max_tokens: options.max_tokens || 2048,
                top_p: options.top_p || 0.8,
                stream: false
            };

            const response = await axios.post(`${this.baseUrl}/chat/completions`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                const choice = response.data.choices[0];
                
                return {
                    response: choice.message.content.trim(),
                    model: model,
                    finish_reason: choice.finish_reason,
                    usage: response.data.usage,
                    reasoning_steps: this.extractReasoningSteps(choice.message.content),
                    confidence: this.assessConfidence(choice.message.content)
                };
            } else {
                throw new Error('Invalid response from DeepSeek');
            }

        } catch (error) {
            console.error('DeepSeek conversation error:', error.message);
            throw error;
        }
    }

    /**
     * Get system prompt based on model and conversation type
     */
    getSystemPrompt(model, conversationType) {
        const basePrompt = "You are DeepSeek, an AI assistant specialized in reasoning and analysis.";
        
        switch (conversationType) {
            case 'reasoning':
                return `${basePrompt} Focus on logical reasoning, step-by-step analysis, and clear explanations. Break down complex problems into manageable steps and show your reasoning process.`;
            
            case 'problem_solving':
                return `${basePrompt} Approach problems systematically. Identify the core issue, consider multiple solutions, evaluate pros and cons, and provide a well-reasoned recommendation.`;
            
            case 'mathematics':
                return `${basePrompt} For mathematical problems, show all steps clearly, explain the reasoning behind each step, and verify your answers. Use proper mathematical notation when appropriate.`;
            
            case 'analysis':
                return `${basePrompt} Provide thorough analysis with logical structure. Consider multiple perspectives, identify key factors, and draw well-supported conclusions.`;
            
            default:
                return `${basePrompt} Provide thoughtful, well-reasoned responses with clear explanations and logical structure.`;
        }
    }

    /**
     * Extract reasoning steps from response
     */
    extractReasoningSteps(content) {
        const steps = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.match(/^(Step \d+|First|Second|Third|Next|Then|Finally|Therefore)/i)) {
                steps.push(trimmed);
            }
        }
        
        return steps;
    }

    /**
     * Assess confidence based on response characteristics
     */
    assessConfidence(content) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence for structured reasoning
        if (content.includes('Step') || content.includes('Therefore') || content.includes('Because')) {
            confidence += 0.2;
        }
        
        // Increase confidence for mathematical notation
        if (content.match(/\d+[\+\-\*\/]\d+/) || content.includes('=')) {
            confidence += 0.1;
        }
        
        // Decrease confidence for uncertainty indicators
        if (content.includes('might') || content.includes('possibly') || content.includes('uncertain')) {
            confidence -= 0.2;
        }
        
        return Math.max(0.1, Math.min(1.0, confidence));
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return this.availableModels.map(model => ({
            name: model,
            specialties: this.getModelSpecialties(model),
            available: this.isAvailable
        }));
    }

    /**
     * Get model specialties
     */
    getModelSpecialties(model) {
        switch (model) {
            case 'deepseek-chat':
                return ['reasoning', 'analysis', 'problem_solving', 'general_reasoning'];
            case 'deepseek-coder':
                return ['code_reasoning', 'algorithm_analysis', 'debugging', 'code_review'];
            case 'deepseek-reasoner':
                return ['complex_reasoning', 'logical_analysis', 'mathematical_reasoning'];
            default:
                return ['reasoning', 'analysis'];
        }
    }

    /**
     * Get connector status
     */
    getStatus() {
        return {
            name: 'DeepSeek',
            available: this.isAvailable,
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl,
            defaultModel: this.defaultModel,
            models: this.getAvailableModels(),
            specialties: ['reasoning', 'problem_solving', 'analysis', 'mathematics']
        };
    }

    /**
     * Test the connector
     */
    async test() {
        try {
            if (!this.isAvailable) {
                return { success: false, error: 'DeepSeek not available' };
            }

            const testQuery = "Solve this step by step: If x + 5 = 12, what is x?";
            const response = await this.generateChatResponse(testQuery, this.defaultModel, {
                max_tokens: 200,
                conversationType: 'mathematics'
            });

            return {
                success: true,
                model: this.defaultModel,
                response: response.response,
                reasoning_steps: response.reasoning_steps,
                confidence: response.confidence
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = DeepSeekConnector;
