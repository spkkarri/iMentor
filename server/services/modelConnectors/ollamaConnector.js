// server/services/modelConnectors/ollamaConnector.js
// Connector for Ollama models (Llama 3.2, etc.)

const axios = require('axios');

class OllamaConnector {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.isAvailable = false;
        this.availableModels = [];
        this.defaultModel = 'llama3.1:latest';
    }

    /**
     * Initialize and check Ollama availability
     */
    async initialize() {
        try {
            console.log('🦙 Initializing Ollama connector...');

            // Check if Ollama is running
            await this.checkHealth();

            // Get available models
            await this.getAvailableModels();

            // Auto-select the best available model
            this.selectBestAvailableModel();

            this.isAvailable = true;
            console.log(`✅ Ollama connector initialized with ${this.availableModels.length} models`);
            console.log(`📝 Using model: ${this.defaultModel}`);

        } catch (error) {
            console.warn('⚠️ Ollama not available:', error.message);
            this.isAvailable = false;
        }
    }

    /**
     * Select the best available model from the installed models
     */
    selectBestAvailableModel() {
        if (!this.availableModels || this.availableModels.length === 0) {
            console.warn('⚠️ No Ollama models available');
            return;
        }

        // Priority list of preferred models
        const preferredModels = [
            'llama3.2:1b',      // Small, fast model we just downloaded
            'llama3.2:latest',
            'llama3.1:latest',
            'llama3:latest',
            'qwen3:latest',
            'wizardcoder:7b-python',
            'devstral:latest'
        ];

        // Find the first available preferred model
        for (const preferredModel of preferredModels) {
            const foundModel = this.availableModels.find(model =>
                model.name === preferredModel || model.name.startsWith(preferredModel.split(':')[0])
            );
            if (foundModel) {
                this.defaultModel = foundModel.name;
                console.log(`✅ Selected model: ${this.defaultModel}`);
                return;
            }
        }

        // If no preferred model found, use the first available
        this.defaultModel = this.availableModels[0].name;
        console.log(`✅ Selected first available model: ${this.defaultModel}`);
    }

    /**
     * Check Ollama health
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            throw new Error(`Ollama health check failed: ${error.message}`);
        }
    }

    /**
     * Get available models from Ollama
     */
    async getAvailableModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            this.availableModels = response.data.models || [];

            console.log('📋 Available Ollama models:');
            this.availableModels.forEach(model => {
                console.log(`   - ${model.name} (${this.formatSize(model.size)})`);
            });

            return this.availableModels;
        } catch (error) {
            console.warn('Failed to get Ollama models:', error.message);
            return [];
        }
    }

    /**
     * Generate chat response using Ollama
     */
    async generateChatResponse(query, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Ollama is not available');
        }

        try {
            console.log(`🦙 Generating response with ${model}...`);

            const requestData = {
                model: model,
                prompt: query,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    top_p: options.top_p || 0.9,
                    max_tokens: options.max_tokens || 2048,
                    ...options
                }
            };

            const response = await axios.post(`${this.baseUrl}/api/generate`, requestData, {
                timeout: 30000 // 30 second timeout
            });

            if (response.data && response.data.response) {
                return {
                    response: response.data.response.trim(),
                    model: model,
                    done: response.data.done,
                    context: response.data.context,
                    total_duration: response.data.total_duration,
                    load_duration: response.data.load_duration,
                    prompt_eval_count: response.data.prompt_eval_count,
                    eval_count: response.data.eval_count,
                    eval_duration: response.data.eval_duration
                };
            } else {
                throw new Error('Invalid response from Ollama');
            }

        } catch (error) {
            console.error('Ollama generation error:', error.message);
            throw new Error(`Ollama generation failed: ${error.message}`);
        }
    }

    /**
     * Generate chat response with conversation history
     */
    async generateConversationResponse(messages, model = this.defaultModel, options = {}) {
        if (!this.isAvailable) {
            throw new Error('Ollama is not available');
        }

        try {
            // Convert messages to a single prompt (Ollama doesn't support chat format directly)
            const prompt = this.formatMessagesAsPrompt(messages);

            return await this.generateChatResponse(prompt, model, options);

        } catch (error) {
            console.error('Ollama conversation error:', error.message);
            throw error;
        }
    }

    /**
     * Format messages array as a single prompt
     */
    formatMessagesAsPrompt(messages) {
        return messages.map(msg => {
            if (msg.role === 'user') {
                return `Human: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                return `Assistant: ${msg.content}`;
            } else if (msg.role === 'system') {
                return `System: ${msg.content}`;
            }
            return msg.content;
        }).join('\n\n') + '\n\nAssistant:';
    }

    /**
     * Check if a specific model is available
     */
    isModelAvailable(modelName) {
        return this.availableModels.some(model =>
            model.name === modelName || model.name.startsWith(modelName)
        );
    }

    /**
     * Pull a model from Ollama registry
     */
    async pullModel(modelName) {
        try {
            console.log(`📥 Pulling model ${modelName} from Ollama registry...`);

            const response = await axios.post(`${this.baseUrl}/api/pull`, {
                name: modelName
            }, {
                timeout: 300000 // 5 minute timeout for model pulling
            });

            console.log(`✅ Model ${modelName} pulled successfully`);

            // Refresh available models
            await this.getAvailableModels();

            return true;
        } catch (error) {
            console.error(`Failed to pull model ${modelName}:`, error.message);
            return false;
        }
    }

    /**
     * Format file size for display
     */
    formatSize(bytes) {
        if (!bytes) return 'Unknown size';

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get model information
     */
    async getModelInfo(modelName) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/show`, {
                name: modelName
            });

            return response.data;
        } catch (error) {
            console.error(`Failed to get model info for ${modelName}:`, error.message);
            return null;
        }
    }

    /**
     * Get connector status
     */
    getStatus() {
        return {
            name: 'Ollama',
            available: this.isAvailable,
            baseUrl: this.baseUrl,
            modelsCount: this.availableModels.length,
            defaultModel: this.defaultModel,
            models: this.availableModels.map(model => ({
                name: model.name,
                size: this.formatSize(model.size),
                modified: model.modified_at
            }))
        };
    }

    /**
     * Test the connector with a simple query
     */
    async test() {
        try {
            if (!this.isAvailable) {
                return { success: false, error: 'Ollama not available' };
            }

            const testQuery = "Hello! Please respond with 'Ollama is working correctly.'";
            const response = await this.generateChatResponse(testQuery, this.defaultModel, {
                max_tokens: 50
            });

            return {
                success: true,
                model: this.defaultModel,
                response: response.response,
                duration: response.total_duration
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = OllamaConnector;
