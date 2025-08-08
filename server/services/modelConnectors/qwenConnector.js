// server/services/modelConnectors/qwenConnector.js
// Connector for Qwen models (specialized in technical and programming tasks)

const axios = require('axios');

class QwenConnector {
    constructor(apiKey = null) {
        this.apiKey = apiKey || process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
        this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        this.isAvailable = false;
        this.defaultModel = 'qwen-turbo';
        this.availableModels = [
            'qwen-turbo',
            'qwen-plus',
            'qwen-max',
            'qwen-coder-turbo',
            'qwen-coder-plus'
        ];
    }

    /**
     * Initialize Qwen connector
     */
    async initialize() {
        try {
            console.log('⚡ Initializing Qwen connector...');
            
            if (!this.apiKey) {
                throw new Error('Qwen API key not provided');
            }

            // Test API connection
            await this.testConnection();
            
            this.isAvailable = true;
            console.log('✅ Qwen connector initialized successfully');
            
        } catch (error) {
            console.warn('⚠️ Qwen not available:', error.message);
            this.isAvailable = false;
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            // Simple test request
            const testData = {
                model: this.defaultModel,
                input: {
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ]
                },
                parameters: {
                    max_tokens: 10
                }
            };

            const response = await axios.post(this.baseUrl, testData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            return response.status === 200;
        } catch (error) {
            throw new Error(`Qwen connection test failed: ${error.message}`);
        }
    }

    /**
     * Generate chat response using Qwen
     */
    async generateChatResponse(query, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Qwen is not available');
        }

        try {
            console.log(`⚡ Generating technical response with ${model}...`);
            
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
                input: {
                    messages: messages
                },
                parameters: {
                    temperature: options.temperature || 0.1, // Low temperature for technical accuracy
                    max_tokens: options.max_tokens || 2048,
                    top_p: options.top_p || 0.8,
                    repetition_penalty: options.repetition_penalty || 1.1,
                    result_format: 'message'
                }
            };

            const response = await axios.post(this.baseUrl, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // 60 second timeout for complex code generation
            });

            if (response.data && response.data.output && response.data.output.choices) {
                const choice = response.data.output.choices[0];
                
                return {
                    response: choice.message.content.trim(),
                    model: model,
                    finish_reason: choice.finish_reason,
                    usage: response.data.usage,
                    code_blocks: this.extractCodeBlocks(choice.message.content),
                    technical_terms: this.extractTechnicalTerms(choice.message.content),
                    complexity: this.assessComplexity(choice.message.content)
                };
            } else {
                throw new Error('Invalid response from Qwen');
            }

        } catch (error) {
            console.error('Qwen generation error:', error.message);
            throw new Error(`Qwen generation failed: ${error.message}`);
        }
    }

    /**
     * Generate response with conversation history
     */
    async generateConversationResponse(messages, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Qwen is not available');
        }

        try {
            // Add system prompt for technical assistance
            const systemMessage = {
                role: 'system',
                content: this.getSystemPrompt(model, options.conversationType)
            };

            const requestData = {
                model: model,
                input: {
                    messages: [systemMessage, ...messages]
                },
                parameters: {
                    temperature: options.temperature || 0.1,
                    max_tokens: options.max_tokens || 2048,
                    top_p: options.top_p || 0.8,
                    repetition_penalty: options.repetition_penalty || 1.1,
                    result_format: 'message'
                }
            };

            const response = await axios.post(this.baseUrl, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            if (response.data && response.data.output && response.data.output.choices) {
                const choice = response.data.output.choices[0];
                
                return {
                    response: choice.message.content.trim(),
                    model: model,
                    finish_reason: choice.finish_reason,
                    usage: response.data.usage,
                    code_blocks: this.extractCodeBlocks(choice.message.content),
                    technical_terms: this.extractTechnicalTerms(choice.message.content),
                    complexity: this.assessComplexity(choice.message.content)
                };
            } else {
                throw new Error('Invalid response from Qwen');
            }

        } catch (error) {
            console.error('Qwen conversation error:', error.message);
            throw error;
        }
    }

    /**
     * Get system prompt based on model and conversation type
     */
    getSystemPrompt(model, conversationType) {
        const basePrompt = "You are Qwen, an AI assistant specialized in technical and programming tasks.";
        
        switch (conversationType) {
            case 'technical':
                return `${basePrompt} Provide accurate technical information with proper terminology. Include code examples when relevant and explain technical concepts clearly.`;
            
            case 'programming':
                return `${basePrompt} Focus on code quality, best practices, and clear explanations. Provide working code examples with comments and explain the logic behind your solutions.`;
            
            case 'code_review':
                return `${basePrompt} Analyze code for bugs, performance issues, security vulnerabilities, and adherence to best practices. Provide specific suggestions for improvement.`;
            
            case 'debugging':
                return `${basePrompt} Help identify and fix bugs systematically. Explain the debugging process, potential causes, and provide corrected code with explanations.`;
            
            case 'system_design':
                return `${basePrompt} Provide architectural guidance, design patterns, and scalability considerations. Focus on practical, implementable solutions with trade-off analysis.`;
            
            default:
                return `${basePrompt} Provide clear, accurate technical assistance with practical examples and explanations.`;
        }
    }

    /**
     * Extract code blocks from response
     */
    extractCodeBlocks(content) {
        const codeBlocks = [];
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        
        while ((match = codeBlockRegex.exec(content)) !== null) {
            codeBlocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }
        
        return codeBlocks;
    }

    /**
     * Extract technical terms from response
     */
    extractTechnicalTerms(content) {
        const technicalTerms = [];
        const terms = [
            'API', 'REST', 'GraphQL', 'JSON', 'XML', 'HTTP', 'HTTPS', 'SSL', 'TLS',
            'database', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL',
            'JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'Express',
            'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'microservices',
            'algorithm', 'data structure', 'array', 'object', 'function', 'class',
            'async', 'await', 'promise', 'callback', 'event', 'listener'
        ];
        
        const lowerContent = content.toLowerCase();
        for (const term of terms) {
            if (lowerContent.includes(term.toLowerCase())) {
                technicalTerms.push(term);
            }
        }
        
        return [...new Set(technicalTerms)]; // Remove duplicates
    }

    /**
     * Assess technical complexity of response
     */
    assessComplexity(content) {
        let complexity = 'low';
        
        const codeBlocks = this.extractCodeBlocks(content);
        const technicalTerms = this.extractTechnicalTerms(content);
        
        if (codeBlocks.length > 2 || technicalTerms.length > 10) {
            complexity = 'high';
        } else if (codeBlocks.length > 0 || technicalTerms.length > 5) {
            complexity = 'medium';
        }
        
        return complexity;
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
            case 'qwen-turbo':
                return ['general_programming', 'web_development', 'scripting'];
            case 'qwen-plus':
                return ['advanced_programming', 'system_design', 'architecture'];
            case 'qwen-max':
                return ['complex_programming', 'optimization', 'advanced_algorithms'];
            case 'qwen-coder-turbo':
                return ['code_generation', 'debugging', 'code_review'];
            case 'qwen-coder-plus':
                return ['advanced_coding', 'refactoring', 'performance_optimization'];
            default:
                return ['programming', 'technical'];
        }
    }

    /**
     * Get connector status
     */
    getStatus() {
        return {
            name: 'Qwen',
            available: this.isAvailable,
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl,
            defaultModel: this.defaultModel,
            models: this.getAvailableModels(),
            specialties: ['programming', 'technical', 'code_review', 'debugging', 'system_design']
        };
    }

    /**
     * Test the connector
     */
    async test() {
        try {
            if (!this.isAvailable) {
                return { success: false, error: 'Qwen not available' };
            }

            const testQuery = "Write a simple Python function to calculate factorial of a number.";
            const response = await this.generateChatResponse(testQuery, this.defaultModel, {
                max_tokens: 300,
                conversationType: 'programming'
            });

            return {
                success: true,
                model: this.defaultModel,
                response: response.response,
                code_blocks: response.code_blocks,
                technical_terms: response.technical_terms,
                complexity: response.complexity
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = QwenConnector;
