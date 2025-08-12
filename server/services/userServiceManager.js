// server/services/userServiceManager.js
// Service manager that handles user-specific API keys and service configurations

const { getUserServiceConfig } = require('../controllers/userApiKeysController');
const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class UserServiceManager {
    constructor() {
        this.userServices = new Map(); // Cache user services
        this.adminGeminiAI = null; // Admin's Gemini AI service
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    async initialize() {
        // Initialize admin Gemini AI service
        try {
            const adminGeminiService = new GeminiService();
            await adminGeminiService.initialize();
            this.adminGeminiAI = new GeminiAI(adminGeminiService);
            console.log('✅ Admin Gemini AI service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize admin Gemini AI:', error);
        }
    }

    /**
     * Get AI service for a specific user
     */
    async getUserAIService(userId) {
        try {
            // Check cache first
            const cached = this.userServices.get(userId);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.service;
            }

            // Get user's service configuration
            const serviceConfig = await getUserServiceConfig(userId);
            
            if (!serviceConfig.canUseService) {
                throw new Error('User does not have access to any AI service');
            }

            let aiService = null;

            switch (serviceConfig.service) {
                case 'gemini':
                    aiService = await this.createUserGeminiService(serviceConfig.config.apiKey);
                    break;
                    
                case 'ollama':
                    aiService = await this.createUserOllamaService(serviceConfig.config);
                    break;
                    
                case 'admin':
                    aiService = this.adminGeminiAI;
                    if (!aiService) {
                        throw new Error('Admin Gemini AI service not available');
                    }
                    break;
                    
                default:
                    throw new Error(`Unsupported service type: ${serviceConfig.service}`);
            }

            // Cache the service
            this.userServices.set(userId, {
                service: aiService,
                timestamp: Date.now(),
                serviceType: serviceConfig.service
            });

            console.log(`✅ AI service ready for user ${userId}: ${serviceConfig.service}`);
            return aiService;

        } catch (error) {
            console.error(`❌ Failed to get AI service for user ${userId}:`, error);
            
            // Fallback to admin service if available
            if (this.adminGeminiAI) {
                console.log(`🔄 Falling back to admin service for user ${userId}`);
                return this.adminGeminiAI;
            }
            
            throw error;
        }
    }

    /**
     * Create Gemini AI service with user's API key
     */
    async createUserGeminiService(apiKey) {
        try {
            const geminiService = new GeminiService();
            
            // Override the API key
            geminiService.apiKey = apiKey;
            geminiService.genAI = null; // Reset to force re-initialization
            
            await geminiService.initialize();
            return new GeminiAI(geminiService);
        } catch (error) {
            console.error('Failed to create user Gemini service:', error);
            throw new Error('Invalid Gemini API key or service unavailable');
        }
    }

    /**
     * Create Ollama service with user's configuration
     */
    async createUserOllamaService(config) {
        try {
            // Create a simple Ollama service wrapper
            const ollamaService = {
                generateText: async (prompt) => {
                    const axios = require('axios');
                    const response = await axios.post(`${config.url}/api/generate`, {
                        model: config.model,
                        prompt: prompt,
                        stream: false
                    }, { timeout: 30000 });
                    
                    return response.data.response;
                },
                
                generateChatResponse: async (query, context = [], history = [], systemPrompt = '') => {
                    const axios = require('axios');
                    
                    // Format messages for Ollama
                    const messages = [];
                    if (systemPrompt) {
                        messages.push({ role: 'system', content: systemPrompt });
                    }
                    
                    // Add history
                    history.forEach(msg => {
                        if (msg.role && msg.parts && msg.parts[0] && msg.parts[0].text) {
                            messages.push({
                                role: msg.role === 'model' ? 'assistant' : msg.role,
                                content: msg.parts[0].text
                            });
                        }
                    });
                    
                    // Add current query
                    messages.push({ role: 'user', content: query });
                    
                    const response = await axios.post(`${config.url}/api/chat`, {
                        model: config.model,
                        messages: messages,
                        stream: false
                    }, { timeout: 30000 });
                    
                    return {
                        response: response.data.message.content,
                        followUpQuestions: [] // Ollama doesn't generate follow-up questions
                    };
                }
            };
            
            // Test the connection
            const axios = require('axios');
            await axios.get(`${config.url}/api/tags`, { timeout: 5000 });
            
            console.log(`✅ Ollama service created: ${config.url} with model ${config.model}`);
            return ollamaService;
            
        } catch (error) {
            console.error('Failed to create user Ollama service:', error);
            throw new Error('Ollama service unavailable or invalid configuration');
        }
    }

    /**
     * Get user's service type
     */
    async getUserServiceType(userId) {
        try {
            const serviceConfig = await getUserServiceConfig(userId);
            return serviceConfig.service;
        } catch (error) {
            console.error(`Failed to get service type for user ${userId}:`, error);
            return 'admin'; // Default fallback
        }
    }

    /**
     * Clear user service cache (called when API keys are updated)
     */
    clearUserCache(userId) {
        const deleted = this.userServices.delete(userId);
        if (deleted) {
            console.log(`🗑️ Cleared UserServiceManager cache for user ${userId}`);
        } else {
            console.log(`ℹ️ No cached service found for user ${userId} in UserServiceManager`);
        }
    }

    /**
     * Force refresh user service (clears cache and gets fresh service)
     */
    async refreshUserService(userId) {
        this.clearUserCache(userId);
        return await this.getUserAIService(userId);
    }

    /**
     * Clear all user caches
     */
    clearAllCaches() {
        this.userServices.clear();
        console.log('🗑️ Cleared all user service caches');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            totalCachedUsers: this.userServices.size,
            cacheEntries: []
        };

        this.userServices.forEach((value, userId) => {
            stats.cacheEntries.push({
                userId,
                serviceType: value.serviceType,
                cachedAt: new Date(value.timestamp),
                ageMinutes: Math.round((Date.now() - value.timestamp) / 60000)
            });
        });

        return stats;
    }

    /**
     * Validate user's service configuration
     */
    async validateUserService(userId) {
        try {
            const serviceConfig = await getUserServiceConfig(userId);
            
            if (!serviceConfig.canUseService) {
                return {
                    valid: false,
                    error: 'User does not have access to any AI service',
                    serviceType: 'none'
                };
            }

            // Try to create the service to validate it
            let testService = null;
            
            switch (serviceConfig.service) {
                case 'gemini':
                    testService = await this.createUserGeminiService(serviceConfig.config.apiKey);
                    // Test with a simple prompt
                    await testService.generateText('Hello');
                    break;
                    
                case 'ollama':
                    testService = await this.createUserOllamaService(serviceConfig.config);
                    // Test connection
                    const axios = require('axios');
                    await axios.get(`${serviceConfig.config.url}/api/tags`, { timeout: 5000 });
                    break;
                    
                case 'admin':
                    if (!this.adminGeminiAI) {
                        throw new Error('Admin service not available');
                    }
                    break;
            }

            return {
                valid: true,
                serviceType: serviceConfig.service,
                config: serviceConfig.config
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message,
                serviceType: 'unknown'
            };
        }
    }

    /**
     * Get service usage statistics
     */
    getUsageStats() {
        const serviceTypes = {};
        
        this.userServices.forEach((value) => {
            serviceTypes[value.serviceType] = (serviceTypes[value.serviceType] || 0) + 1;
        });

        return {
            totalActiveUsers: this.userServices.size,
            serviceDistribution: serviceTypes,
            adminServiceAvailable: !!this.adminGeminiAI
        };
    }

    /**
     * Cleanup expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        let cleanedCount = 0;

        this.userServices.forEach((value, userId) => {
            if (now - value.timestamp > this.cacheTimeout) {
                this.userServices.delete(userId);
                cleanedCount++;
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
        }

        return cleanedCount;
    }
}

// Create singleton instance
const userServiceManager = new UserServiceManager();

module.exports = userServiceManager;
