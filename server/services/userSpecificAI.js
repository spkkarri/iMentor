// server/services/userSpecificAI.js
// Service that creates AI instances using user-specific API keys

const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');
const DeepSeekConnector = require('./modelConnectors/deepseekConnector');
const QwenConnector = require('./modelConnectors/qwenConnector');
const userOllamaConnector = require('./userOllamaConnector');
const User = require('../models/User');

class UserSpecificAI {
    constructor() {
        this.userServices = new Map(); // Cache user-specific services
        this.adminServices = null; // Fallback admin services
    }

    /**
     * Get or create AI services for a specific user
     */
    async getUserAIServices(userId) {
        try {
            // Check if we already have services for this user
            if (this.userServices.has(userId)) {
                return this.userServices.get(userId);
            }

            // Get user configuration
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            console.log(`🔧 Creating AI services for user ${userId} (useOwnKeys: ${user.useOwnKeys})`);

            const services = {
                gemini: null,
                deepseek: null,
                qwen: null,
                ollama: null,
                useOwnKeys: user.useOwnKeys
            };

            if (user.useOwnKeys) {
                // Create services using user's own API keys
                services.gemini = await this.createUserGeminiService(user);
                services.deepseek = await this.createUserDeepSeekService(user);
                services.qwen = await this.createUserQwenService(user);
            } else {
                // Use admin services (existing implementation)
                services.gemini = await this.getAdminGeminiService();
                services.deepseek = await this.getAdminDeepSeekService();
                services.qwen = await this.getAdminQwenService();
            }

            // Always try to create user-specific Ollama service
            services.ollama = await this.createUserOllamaService(userId);

            // Cache the services
            this.userServices.set(userId, services);

            return services;

        } catch (error) {
            console.error(`Failed to create AI services for user ${userId}:`, error);
            
            // Fallback to admin services
            return await this.getAdminServices();
        }
    }

    /**
     * Create Gemini service using user's API key
     */
    async createUserGeminiService(user) {
        try {
            if (!user.apiKeys?.gemini) {
                console.log('No Gemini API key provided by user, using admin key');
                return await this.getAdminGeminiService();
            }

            const geminiService = new GeminiService();
            geminiService.apiKey = user.apiKeys.gemini;
            await geminiService.initialize();

            const geminiAI = new GeminiAI(geminiService);
            
            // Test the service
            await geminiAI.generateText('Hello', [], [], 'Test');
            
            console.log(`✅ User Gemini service created successfully`);
            return geminiAI;

        } catch (error) {
            console.warn(`Failed to create user Gemini service: ${error.message}`);
            return await this.getAdminGeminiService();
        }
    }

    /**
     * Create DeepSeek service using user's API key
     */
    async createUserDeepSeekService(user) {
        try {
            if (!user.apiKeys?.deepseek) {
                console.log('No DeepSeek API key provided by user, using admin key');
                return await this.getAdminDeepSeekService();
            }

            const deepseekConnector = new DeepSeekConnector(user.apiKeys.deepseek);
            await deepseekConnector.initialize();

            console.log(`✅ User DeepSeek service created successfully`);
            return deepseekConnector;

        } catch (error) {
            console.warn(`Failed to create user DeepSeek service: ${error.message}`);
            return await this.getAdminDeepSeekService();
        }
    }

    /**
     * Create Qwen service using user's API key
     */
    async createUserQwenService(user) {
        try {
            if (!user.apiKeys?.qwen) {
                console.log('No Qwen API key provided by user, using admin key');
                return await this.getAdminQwenService();
            }

            const qwenConnector = new QwenConnector(user.apiKeys.qwen);
            await qwenConnector.initialize();

            console.log(`✅ User Qwen service created successfully`);
            return qwenConnector;

        } catch (error) {
            console.warn(`Failed to create user Qwen service: ${error.message}`);
            return await this.getAdminQwenService();
        }
    }

    /**
     * Create Ollama service using user's URL
     */
    async createUserOllamaService(userId) {
        try {
            const userOllamaService = await userOllamaConnector.getUserOllamaConnector(userId);
            
            if (userOllamaService && userOllamaService.connector.isAvailable) {
                console.log(`✅ User Ollama service created successfully`);
                return userOllamaService.connector;
            } else {
                console.log('User Ollama service not available');
                return null;
            }

        } catch (error) {
            console.warn(`Failed to create user Ollama service: ${error.message}`);
            return null;
        }
    }

    /**
     * Get admin Gemini service (fallback)
     */
    async getAdminGeminiService() {
        try {
            if (!this.adminServices?.gemini) {
                const geminiService = new GeminiService();
                await geminiService.initialize();
                
                if (!this.adminServices) this.adminServices = {};
                this.adminServices.gemini = new GeminiAI(geminiService);
            }
            
            return this.adminServices.gemini;
        } catch (error) {
            console.error('Failed to create admin Gemini service:', error);
            return null;
        }
    }

    /**
     * Get admin DeepSeek service (fallback)
     */
    async getAdminDeepSeekService() {
        try {
            if (!this.adminServices?.deepseek) {
                const deepseekConnector = new DeepSeekConnector();
                await deepseekConnector.initialize();
                
                if (!this.adminServices) this.adminServices = {};
                this.adminServices.deepseek = deepseekConnector;
            }
            
            return this.adminServices.deepseek;
        } catch (error) {
            console.error('Failed to create admin DeepSeek service:', error);
            return null;
        }
    }

    /**
     * Get admin Qwen service (fallback)
     */
    async getAdminQwenService() {
        try {
            if (!this.adminServices?.qwen) {
                const qwenConnector = new QwenConnector();
                await qwenConnector.initialize();
                
                if (!this.adminServices) this.adminServices = {};
                this.adminServices.qwen = qwenConnector;
            }
            
            return this.adminServices.qwen;
        } catch (error) {
            console.error('Failed to create admin Qwen service:', error);
            return null;
        }
    }

    /**
     * Get admin services (complete fallback)
     */
    async getAdminServices() {
        return {
            gemini: await this.getAdminGeminiService(),
            deepseek: await this.getAdminDeepSeekService(),
            qwen: await this.getAdminQwenService(),
            ollama: null,
            useOwnKeys: false
        };
    }

    /**
     * Get the primary AI service for a user (usually Gemini)
     */
    async getUserPrimaryAI(userId) {
        const services = await this.getUserAIServices(userId);
        return services.gemini || services.deepseek || services.qwen;
    }

    /**
     * Generate response using user's preferred AI service
     */
    async generateUserResponse(userId, query, options = {}) {
        try {
            const services = await this.getUserAIServices(userId);
            
            // Use Gemini as primary service
            if (services.gemini) {
                return await services.gemini.generateChatResponse(
                    query,
                    options.tools || [],
                    options.history || [],
                    options.systemPrompt || 'You are a helpful AI assistant.'
                );
            }
            
            throw new Error('No AI service available for user');

        } catch (error) {
            console.error(`Failed to generate response for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Clear cached services for a user (call when user updates API keys)
     */
    clearUserServices(userId) {
        this.userServices.delete(userId);
        console.log(`🧹 Cleared cached services for user ${userId}`);
    }

    /**
     * Get service status for a user
     */
    async getUserServiceStatus(userId) {
        try {
            const services = await this.getUserAIServices(userId);
            
            return {
                gemini: {
                    available: !!services.gemini,
                    usingOwnKey: services.useOwnKeys
                },
                deepseek: {
                    available: !!services.deepseek,
                    usingOwnKey: services.useOwnKeys
                },
                qwen: {
                    available: !!services.qwen,
                    usingOwnKey: services.useOwnKeys
                },
                ollama: {
                    available: !!services.ollama,
                    usingOwnKey: true // Always user-specific
                },
                useOwnKeys: services.useOwnKeys
            };

        } catch (error) {
            console.error(`Failed to get service status for user ${userId}:`, error);
            return {
                gemini: { available: false, usingOwnKey: false },
                deepseek: { available: false, usingOwnKey: false },
                qwen: { available: false, usingOwnKey: false },
                ollama: { available: false, usingOwnKey: false },
                useOwnKeys: false
            };
        }
    }

    /**
     * Clean up old cached services
     */
    cleanup() {
        const maxAge = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        
        for (const [userId, services] of this.userServices.entries()) {
            if (services.lastUsed && (now - services.lastUsed) > maxAge) {
                this.userServices.delete(userId);
                console.log(`🧹 Cleaned up old services for user ${userId}`);
            }
        }
    }
}

// Export singleton instance
module.exports = new UserSpecificAI();
