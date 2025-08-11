// server/services/userAwareServiceFactory.js
// Factory for creating AI services that use user-specific API keys

const GeminiService = require('./geminiService');
const { GeminiAI } = require('./geminiAI');
const GroqAI = require('./groqAI');
const TogetherAI = require('./togetherAI');
const CohereAI = require('./cohereAI');
const HuggingFaceAI = require('./huggingFaceAI');
const DeepSeekConnector = require('./modelConnectors/deepseekConnector');
const QwenConnector = require('./modelConnectors/qwenConnector');
const UserApiKeys = require('../models/UserApiKeys');
const User = require('../models/User');

class UserAwareServiceFactory {
    constructor() {
        this.serviceCache = new Map(); // Cache services per user
        this.adminServices = new Map(); // Cache admin services
    }

    /**
     * Get AI service for user with their API keys
     */
    async getAIService(userId, serviceType = 'gemini', userApiConfig = null) {
        try {
            const cacheKey = `${userId}-${serviceType}`;
            
            // Return cached service if available
            if (this.serviceCache.has(cacheKey)) {
                return this.serviceCache.get(cacheKey);
            }

            let service = null;

            // Use provided config or fetch user config
            const apiConfig = userApiConfig || await this.getUserApiConfig(userId);

            if (apiConfig.useUserKeys && apiConfig.apiKeys) {
                service = await this.createUserService(serviceType, apiConfig.apiKeys);
            }

            // Fallback to admin service if user service creation failed
            if (!service && apiConfig.fallbackToAdmin) {
                service = await this.getAdminService(serviceType);
            }

            // Cache the service
            if (service) {
                this.serviceCache.set(cacheKey, service);
            }

            return service;

        } catch (error) {
            console.error(`Error getting AI service for user ${userId}:`, error);
            
            // Fallback to admin service
            return await this.getAdminService(serviceType);
        }
    }

    /**
     * Create service using user's API keys
     */
    async createUserService(serviceType, apiKeys) {
        try {
            switch (serviceType) {
                case 'gemini':
                    if (apiKeys.gemini || apiKeys.apiKey) {
                        const geminiService = new GeminiService();
                        geminiService.apiKey = apiKeys.gemini || apiKeys.apiKey;
                        await geminiService.initialize();
                        return new GeminiAI(geminiService);
                    }
                    break;

                case 'groq':
                    if (apiKeys.groq || apiKeys.apiKey) {
                        const groqService = new GroqAI();
                        groqService.apiKey = apiKeys.groq || apiKeys.apiKey;
                        return groqService;
                    }
                    break;

                case 'together':
                    if (apiKeys.together || apiKeys.apiKey) {
                        const togetherService = new TogetherAI();
                        togetherService.apiKey = apiKeys.together || apiKeys.apiKey;
                        return togetherService;
                    }
                    break;

                case 'cohere':
                    if (apiKeys.cohere || apiKeys.apiKey) {
                        const cohereService = new CohereAI();
                        cohereService.apiKey = apiKeys.cohere || apiKeys.apiKey;
                        return cohereService;
                    }
                    break;

                case 'huggingface':
                    if (apiKeys.huggingface || apiKeys.apiKey) {
                        const hfService = new HuggingFaceAI();
                        hfService.apiKey = apiKeys.huggingface || apiKeys.apiKey;
                        return hfService;
                    }
                    break;

                case 'deepseek':
                    if (apiKeys.deepseek || apiKeys.apiKey) {
                        return new DeepSeekConnector(apiKeys.deepseek || apiKeys.apiKey);
                    }
                    break;

                case 'qwen':
                    if (apiKeys.qwen || apiKeys.apiKey) {
                        return new QwenConnector(apiKeys.qwen || apiKeys.apiKey);
                    }
                    break;
            }

            return null;

        } catch (error) {
            console.error(`Error creating user ${serviceType} service:`, error);
            return null;
        }
    }

    /**
     * Get admin service (fallback)
     */
    async getAdminService(serviceType) {
        try {
            const cacheKey = `admin-${serviceType}`;
            
            if (this.adminServices.has(cacheKey)) {
                return this.adminServices.get(cacheKey);
            }

            let service = null;

            switch (serviceType) {
                case 'gemini':
                    if (process.env.GEMINI_API_KEY) {
                        const geminiService = new GeminiService();
                        geminiService.apiKey = process.env.GEMINI_API_KEY;
                        await geminiService.initialize();
                        service = new GeminiAI(geminiService);
                    }
                    break;

                case 'groq':
                    if (process.env.GROQ_API_KEY) {
                        service = new GroqAI();
                        service.apiKey = process.env.GROQ_API_KEY;
                    }
                    break;

                case 'together':
                    if (process.env.TOGETHER_API_KEY) {
                        service = new TogetherAI();
                        service.apiKey = process.env.TOGETHER_API_KEY;
                    }
                    break;

                case 'cohere':
                    if (process.env.COHERE_API_KEY) {
                        service = new CohereAI();
                        service.apiKey = process.env.COHERE_API_KEY;
                    }
                    break;

                case 'huggingface':
                    if (process.env.HUGGINGFACE_API_KEY) {
                        service = new HuggingFaceAI();
                        service.apiKey = process.env.HUGGINGFACE_API_KEY;
                    }
                    break;

                case 'deepseek':
                    if (process.env.DEEPSEEK_API_KEY) {
                        service = new DeepSeekConnector(process.env.DEEPSEEK_API_KEY);
                    }
                    break;

                case 'qwen':
                    if (process.env.QWEN_API_KEY) {
                        service = new QwenConnector(process.env.QWEN_API_KEY);
                    }
                    break;
            }

            if (service) {
                this.adminServices.set(cacheKey, service);
            }

            return service;

        } catch (error) {
            console.error(`Error creating admin ${serviceType} service:`, error);
            return null;
        }
    }

    /**
     * Get user's API configuration
     */
    async getUserApiConfig(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return { useUserKeys: false, fallbackToAdmin: true };
            }

            return {
                useUserKeys: user.useOwnKeys,
                apiKeys: user.apiKeys,
                fallbackToAdmin: true
            };

        } catch (error) {
            console.error('Error getting user API config:', error);
            return { useUserKeys: false, fallbackToAdmin: true };
        }
    }

    /**
     * Clear cache for a specific user (useful when API keys are updated)
     */
    clearUserCache(userId) {
        const keysToDelete = [];
        for (const key of this.serviceCache.keys()) {
            if (key.startsWith(`${userId}-`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.serviceCache.delete(key));
        console.log(`Cleared service cache for user ${userId}`);
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.serviceCache.clear();
        this.adminServices.clear();
        console.log('Cleared all service caches');
    }
}

// Export singleton instance
const serviceFactory = new UserAwareServiceFactory();
module.exports = serviceFactory;
