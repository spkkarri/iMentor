// server/middleware/apiKeyMiddleware.js
// Middleware for handling user-specific API keys

const UserApiKeys = require('../models/UserApiKeys');
const User = require('../models/User');

/**
 * Middleware to inject user-specific API keys into requests
 * This ensures all AI services use the user's own API keys when available
 */
const injectUserApiKeys = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            // No authenticated user, continue with admin keys
            req.userApiConfig = {
                useUserKeys: false,
                service: 'admin',
                apiKeys: {},
                fallbackToAdmin: true
            };
            return next();
        }

        const userId = req.user.id;

        // Get user's API key configuration
        let userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            // Create default configuration for new user
            userApiKeys = new UserApiKeys({
                userId: userId,
                email: req.user.email,
                useAdminKeys: true,
                preferredService: 'admin'
            });
            await userApiKeys.save();
        }

        // Get user's preferred service configuration
        const serviceConfig = await getUserServiceConfig(userApiKeys);
        
        // Inject the configuration into the request
        req.userApiConfig = {
            useUserKeys: serviceConfig.service !== 'admin',
            service: serviceConfig.service,
            apiKeys: serviceConfig.config || {},
            canUseService: serviceConfig.canUseService,
            fallbackToAdmin: userApiKeys.useAdminKeys,
            userApiKeys: userApiKeys
        };

        // Add helper methods to request
        req.getUserApiKey = (service) => {
            if (req.userApiConfig.useUserKeys && req.userApiConfig.apiKeys) {
                return req.userApiConfig.apiKeys[service] || req.userApiConfig.apiKeys.apiKey;
            }
            return null;
        };

        req.shouldUseUserKeys = () => {
            return req.userApiConfig.useUserKeys && req.userApiConfig.canUseService;
        };

        req.canFallbackToAdmin = () => {
            return req.userApiConfig.fallbackToAdmin;
        };

        next();

    } catch (error) {
        console.error('Error in API key middleware:', error);
        
        // Fallback to admin keys on error
        req.userApiConfig = {
            useUserKeys: false,
            service: 'admin',
            apiKeys: {},
            fallbackToAdmin: true
        };
        
        next();
    }
};

/**
 * Get user's service configuration
 */
const getUserServiceConfig = async (userApiKeys) => {
    try {
        if (!userApiKeys) {
            return {
                service: 'admin',
                config: null,
                canUseService: true
            };
        }
        
        const preferredService = userApiKeys.getPreferredService();
        
        switch (preferredService) {
            case 'gemini':
                return {
                    service: 'gemini',
                    config: {
                        apiKey: userApiKeys.geminiApiKey
                    },
                    canUseService: !!userApiKeys.geminiApiKey && userApiKeys.geminiKeyValid
                };
                
            case 'ollama':
                return {
                    service: 'ollama',
                    config: {
                        url: userApiKeys.ollamaUrl,
                        model: userApiKeys.ollamaModel
                    },
                    canUseService: !!userApiKeys.ollamaUrl && userApiKeys.ollamaConnectionValid
                };
                
            case 'admin':
            default:
                return {
                    service: 'admin',
                    config: null,
                    canUseService: userApiKeys.canUseAdminKeys()
                };
        }
    } catch (error) {
        console.error('Error getting user service config:', error);
        return {
            service: 'admin',
            config: null,
            canUseService: true
        };
    }
};

/**
 * Middleware to enforce user API key usage for production
 * This can be enabled in production to require users to use their own keys
 */
const enforceUserApiKeys = (req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowAdminKeys = process.env.ALLOW_ADMIN_KEYS === 'true';
    
    if (isProduction && !allowAdminKeys) {
        if (!req.userApiConfig || !req.userApiConfig.useUserKeys) {
            return res.status(403).json({
                error: 'API key required',
                message: 'Please configure your own API keys to use this service',
                requiresApiKey: true
            });
        }
    }
    
    next();
};

/**
 * Create user-specific AI service instance
 */
const createUserAIService = async (userId, serviceType = 'gemini') => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (user.useOwnKeys && user.apiKeys) {
            switch (serviceType) {
                case 'gemini':
                    if (user.apiKeys.gemini) {
                        const geminiService = new GeminiService();
                        geminiService.apiKey = user.apiKeys.gemini;
                        await geminiService.initialize();
                        return new GeminiAI(geminiService);
                    }
                    break;
                    
                case 'deepseek':
                    if (user.apiKeys.deepseek) {
                        return new DeepSeekConnector(user.apiKeys.deepseek);
                    }
                    break;
                    
                case 'qwen':
                    if (user.apiKeys.qwen) {
                        return new QwenConnector(user.apiKeys.qwen);
                    }
                    break;
            }
        }

        // Fallback to admin service if user keys not available
        return null;

    } catch (error) {
        console.error(`Error creating user AI service (${serviceType}):`, error);
        return null;
    }
};

module.exports = {
    injectUserApiKeys,
    enforceUserApiKeys,
    createUserAIService,
    getUserServiceConfig
};
