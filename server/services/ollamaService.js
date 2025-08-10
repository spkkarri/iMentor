/**
 * Ollama Integration Service
 * Provides integration with Ollama for local LLM management and inference
 */

const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class OllamaService {
    constructor(baseUrl = null) {
        // Try to get Ollama URL from environment variables or use default
        this.baseUrl = baseUrl ||
                      process.env.OLLAMA_HOST ||
                      process.env.OLLAMA_URL ||
                      'http://localhost:11434';

        // Ensure the URL has http:// prefix
        if (!this.baseUrl.startsWith('http://') && !this.baseUrl.startsWith('https://')) {
            this.baseUrl = 'http://' + this.baseUrl;
        }

        this.isConnected = false;
        this.availableModels = [];
        this.runningModels = [];

        console.log(`🦙 Ollama Service initialized with URL: ${this.baseUrl}`);
    }

    /**
     * Check if Ollama is running and accessible
     */
    async checkConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/version`, {
                timeout: 5000
            });
            this.isConnected = true;
            console.log('✅ Ollama service connected:', response.data);
            return true;
        } catch (error) {
            this.isConnected = false;
            console.log('❌ Ollama service not available:', error.message);
            return false;
        }
    }

    /**
     * Get list of available models from Ollama
     */
    async getAvailableModels() {
        try {
            if (!this.isConnected) {
                await this.checkConnection();
            }

            const response = await axios.get(`${this.baseUrl}/api/tags`);
            this.availableModels = response.data.models || [];
            
            return this.availableModels.map(model => ({
                id: `ollama_${model.name.replace(':', '_')}`,
                name: model.name,
                size: this.formatSize(model.size),
                modified: model.modified_at,
                digest: model.digest,
                type: 'ollama',
                source: 'ollama',
                compatible_subjects: this.getCompatibleSubjects(model.name),
                description: this.getModelDescription(model.name),
                parameters: this.estimateParameters(model.name, model.size)
            }));
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            return [];
        }
    }

    /**
     * Get list of currently running models
     */
    async getRunningModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/ps`);
            this.runningModels = response.data.models || [];
            return this.runningModels;
        } catch (error) {
            console.error('Error fetching running models:', error);
            return [];
        }
    }

    /**
     * Pull a model from Ollama registry
     */
    async pullModel(modelName, onProgress = null) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/pull`, {
                name: modelName,
                stream: true
            }, {
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let buffer = '';
                
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer
                    
                    lines.forEach(line => {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                if (onProgress) {
                                    onProgress(data);
                                }
                            } catch (e) {
                                // Ignore malformed JSON
                            }
                        }
                    });
                });

                response.data.on('end', () => {
                    resolve({ success: true, message: `Model ${modelName} pulled successfully` });
                });

                response.data.on('error', (error) => {
                    reject(error);
                });
            });
        } catch (error) {
            throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
        }
    }

    /**
     * Delete a model from Ollama
     */
    async deleteModel(modelName) {
        try {
            await axios.delete(`${this.baseUrl}/api/delete`, {
                data: { name: modelName }
            });
            return { success: true, message: `Model ${modelName} deleted successfully` };
        } catch (error) {
            throw new Error(`Failed to delete model ${modelName}: ${error.message}`);
        }
    }

    /**
     * Load a model into memory
     */
    async loadModel(modelName) {
        try {
            await axios.post(`${this.baseUrl}/api/generate`, {
                model: modelName,
                prompt: '',
                stream: false
            });
            return { success: true, message: `Model ${modelName} loaded successfully` };
        } catch (error) {
            throw new Error(`Failed to load model ${modelName}: ${error.message}`);
        }
    }

    /**
     * Unload a model from memory
     */
    async unloadModel(modelName) {
        try {
            await axios.post(`${this.baseUrl}/api/generate`, {
                model: modelName,
                prompt: '',
                keep_alive: 0
            });
            return { success: true, message: `Model ${modelName} unloaded successfully` };
        } catch (error) {
            throw new Error(`Failed to unload model ${modelName}: ${error.message}`);
        }
    }

    /**
     * Generate chat response using Ollama
     */
    async generateChatResponse(message, documentChunks = [], chatHistory = [], systemPrompt = '') {
        if (!this.isConnected) {
            await this.checkConnection();
            if (!this.isConnected) {
                throw new Error('Ollama service is not available');
            }
        }

        try {
            // Get the best available model
            const models = await this.getAvailableModels();
            if (!models || models.length === 0) {
                throw new Error('No Ollama models available');
            }

            // Prioritize llama3.2:1b if available, otherwise use first available
            let modelName = models[0].name;
            const preferredModel = models.find(m => m.name === 'llama3.2:1b');
            if (preferredModel) {
                modelName = preferredModel.name;
            }
            console.log(`🦙 Using Ollama model: ${modelName}`);

            // Build the prompt with context
            let fullPrompt = systemPrompt || "You are a helpful AI assistant.";

            // Add document context if available
            if (documentChunks && documentChunks.length > 0) {
                const context = documentChunks.map(chunk => chunk.pageContent).join('\n\n');
                fullPrompt += `\n\nContext from documents:\n${context}`;
            }

            // Add chat history
            if (chatHistory && chatHistory.length > 0) {
                fullPrompt += '\n\nPrevious conversation:';
                chatHistory.slice(-5).forEach(msg => {
                    fullPrompt += `\n${msg.role}: ${msg.content}`;
                });
            }

            fullPrompt += `\n\nUser: ${message}\nAssistant:`;

            console.log(`🦙 Sending request to Ollama: ${this.baseUrl}/api/generate`);

            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: modelName,
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    num_predict: 1000
                }
            }, {
                timeout: 30000 // 30 second timeout
            });

            if (response.data && response.data.response) {
                console.log('✅ Ollama response generated successfully');
                return {
                    response: response.data.response.trim(),
                    followUpQuestions: [] // Ollama doesn't provide follow-up questions by default
                };
            } else {
                throw new Error('No response from Ollama');
            }

        } catch (error) {
            console.error('❌ Ollama generation error:', error.message);
            throw new Error(`Failed to generate response with Ollama: ${error.message}`);
        }
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
            throw new Error(`Failed to get model info for ${modelName}: ${error.message}`);
        }
    }

    /**
     * Create a custom model from a Modelfile
     */
    async createModel(modelName, modelfile, onProgress = null) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/create`, {
                name: modelName,
                modelfile: modelfile,
                stream: true
            }, {
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let buffer = '';
                
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();
                    
                    lines.forEach(line => {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                if (onProgress) {
                                    onProgress(data);
                                }
                            } catch (e) {
                                // Ignore malformed JSON
                            }
                        }
                    });
                });

                response.data.on('end', () => {
                    resolve({ success: true, message: `Model ${modelName} created successfully` });
                });

                response.data.on('error', (error) => {
                    reject(error);
                });
            });
        } catch (error) {
            throw new Error(`Failed to create model ${modelName}: ${error.message}`);
        }
    }

    /**
     * Get popular models from Ollama library
     */
    getPopularModels() {
        return [
            {
                name: 'llama3.2:3b',
                description: 'Meta Llama 3.2 3B - Fast and efficient for most tasks',
                size: '2.0GB',
                subjects: ['general', 'programming', 'science', 'mathematics']
            },
            {
                name: 'llama3.2:1b',
                description: 'Meta Llama 3.2 1B - Ultra-fast for simple tasks',
                size: '1.3GB',
                subjects: ['general', 'literature', 'history']
            },
            {
                name: 'codellama:7b',
                description: 'Code Llama 7B - Specialized for programming tasks',
                size: '3.8GB',
                subjects: ['programming', 'science']
            },
            {
                name: 'mistral:7b',
                description: 'Mistral 7B - High-quality general purpose model',
                size: '4.1GB',
                subjects: ['general', 'science', 'mathematics', 'literature']
            },
            {
                name: 'phi3:mini',
                description: 'Microsoft Phi-3 Mini - Compact but powerful',
                size: '2.3GB',
                subjects: ['general', 'programming', 'mathematics']
            },
            {
                name: 'gemma2:2b',
                description: 'Google Gemma 2 2B - Efficient and capable',
                size: '1.6GB',
                subjects: ['general', 'science', 'programming']
            }
        ];
    }

    // Helper methods
    formatSize(bytes) {
        if (!bytes) return 'Unknown';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    getCompatibleSubjects(modelName) {
        const name = modelName.toLowerCase();
        if (name.includes('code') || name.includes('programming')) {
            return ['programming', 'science'];
        } else if (name.includes('math') || name.includes('reasoning')) {
            return ['mathematics', 'science'];
        } else if (name.includes('chat') || name.includes('instruct')) {
            return ['general', 'literature', 'history', 'science'];
        } else {
            return ['general', 'science', 'mathematics', 'programming', 'literature'];
        }
    }

    getModelDescription(modelName) {
        const descriptions = {
            'llama': 'Meta\'s Llama model family - versatile and powerful',
            'codellama': 'Specialized for code generation and programming tasks',
            'mistral': 'High-quality general purpose model with strong reasoning',
            'phi': 'Microsoft\'s efficient small language model',
            'gemma': 'Google\'s open-source language model',
            'qwen': 'Alibaba\'s multilingual large language model',
            'deepseek': 'DeepSeek\'s coding and reasoning specialized model'
        };

        for (const [key, desc] of Object.entries(descriptions)) {
            if (modelName.toLowerCase().includes(key)) {
                return desc;
            }
        }
        return 'Local language model available through Ollama';
    }

    estimateParameters(modelName, size) {
        // Rough estimation based on model size
        if (!size) return 'Unknown';
        const sizeInGB = parseFloat(this.formatSize(size));
        
        if (sizeInGB < 1.5) return '1B';
        else if (sizeInGB < 2.5) return '2B';
        else if (sizeInGB < 4) return '3B';
        else if (sizeInGB < 6) return '7B';
        else if (sizeInGB < 15) return '13B';
        else if (sizeInGB < 25) return '30B';
        else return '70B+';
    }
}

// Global instance
let ollamaService = null;

function getOllamaService() {
    // Check if there's a custom instance from configuration
    if (global.customOllamaService) {
        return global.customOllamaService;
    }

    if (!ollamaService) {
        ollamaService = new OllamaService();
    }
    return ollamaService;
}

module.exports = {
    OllamaService,
    getOllamaService
};
