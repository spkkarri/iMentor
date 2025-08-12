// server/controllers/userApiKeysController.js
// Controller for managing user API keys and service configurations

const UserApiKeys = require('../models/UserApiKeys');
const User = require('../models/User');

// Get user's API key configuration
const getUserApiKeys = async (req, res) => {
    try {
        const userId = req.user.id;
        
        let userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            // Create default configuration for new user
            userApiKeys = new UserApiKeys({
                userId: userId,
                email: req.user.email || `${req.user.username}@example.com`, // Fallback email
                useAdminKeys: true,
                preferredService: 'admin',
                adminAccessStatus: 'pending'
            });
            await userApiKeys.save();
        }
        
        // Don't send the actual API key to frontend for security
        const response = {
            hasGeminiKey: !!userApiKeys.geminiApiKey,
            hasOllamaConfig: !!userApiKeys.ollamaUrl,
            ollamaUrl: userApiKeys.ollamaUrl,
            ollamaModel: userApiKeys.ollamaModel,
            preferredService: userApiKeys.preferredService,
            useAdminKeys: userApiKeys.useAdminKeys,
            adminAccessStatus: userApiKeys.adminAccessStatus,
            adminAccessRequestedAt: userApiKeys.adminAccessRequestedAt,
            adminAccessApprovedAt: userApiKeys.adminAccessApprovedAt,
            geminiKeyValid: userApiKeys.geminiKeyValid,
            ollamaConnectionValid: userApiKeys.ollamaConnectionValid,
            lastValidationAt: userApiKeys.lastValidationAt,
            totalRequests: userApiKeys.totalRequests,
            lastUsed: userApiKeys.lastUsed
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching user API keys:', error);
        res.status(500).json({ message: 'Failed to fetch API key configuration' });
    }
};

// Update user's API key configuration
const updateUserApiKeys = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            geminiApiKey, 
            ollamaUrl, 
            ollamaModel, 
            preferredService, 
            useAdminKeys,
            adminAccessReason 
        } = req.body;
        
        let userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            userApiKeys = new UserApiKeys({
                userId: userId,
                email: req.user.email || `${req.user.username}@example.com` // Fallback email
            });
        }
        
        // Update fields if provided
        if (geminiApiKey !== undefined) {
            userApiKeys.geminiApiKey = geminiApiKey;
            userApiKeys.geminiKeyValid = null; // Reset validation status
        }
        
        if (ollamaUrl !== undefined) {
            userApiKeys.ollamaUrl = ollamaUrl;
            userApiKeys.ollamaConnectionValid = null; // Reset validation status
        }
        
        if (ollamaModel !== undefined) {
            userApiKeys.ollamaModel = ollamaModel;
        }
        
        if (preferredService !== undefined) {
            userApiKeys.preferredService = preferredService;
        }
        
        if (useAdminKeys !== undefined) {
            userApiKeys.useAdminKeys = useAdminKeys;
            
            if (useAdminKeys && userApiKeys.adminAccessStatus === 'denied') {
                // Reset to pending if user wants to request admin access again
                userApiKeys.adminAccessStatus = 'pending';
                userApiKeys.adminAccessRequestedAt = new Date();
            }
        }
        
        if (adminAccessReason !== undefined) {
            userApiKeys.adminAccessReason = adminAccessReason;
        }
        
        await userApiKeys.save();

        // 🔥 CRITICAL: Clear all cached services for this user
        console.log(`🗑️ Clearing cached services for user ${userId} after API key update`);

        // Clear UserServiceManager cache
        if (req.serviceManager && req.serviceManager.clearUserCache) {
            req.serviceManager.clearUserCache(userId);
        }

        // Clear UserSpecificAI cache
        const userSpecificAI = require('../services/userSpecificAI');
        if (userSpecificAI && userSpecificAI.clearUserServices) {
            userSpecificAI.clearUserServices(userId);
        }

        // Clear UserAwareServiceFactory cache
        const userAwareServiceFactory = require('../services/userAwareServiceFactory');
        if (userAwareServiceFactory && userAwareServiceFactory.clearUserCache) {
            userAwareServiceFactory.clearUserCache(userId);
        }

        console.log(`✅ All service caches cleared for user ${userId}`);

        // Validate the new configuration
        await validateUserServices(userApiKeys);

        res.json({
            message: 'API key configuration updated successfully - services refreshed',
            configuration: {
                hasGeminiKey: !!userApiKeys.geminiApiKey,
                hasOllamaConfig: !!userApiKeys.ollamaUrl,
                preferredService: userApiKeys.preferredService,
                useAdminKeys: userApiKeys.useAdminKeys,
                adminAccessStatus: userApiKeys.adminAccessStatus
            },
            cacheCleared: true
        });
    } catch (error) {
        console.error('Error updating user API keys:', error);
        res.status(500).json({ message: 'Failed to update API key configuration' });
    }
};

// Validate user's service configurations
const validateUserServices = async (userApiKeys) => {
    try {
        // Validate Gemini API key
        if (userApiKeys.geminiApiKey) {
            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(userApiKeys.geminiApiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                
                // Test with a simple prompt
                await model.generateContent('Hello');
                userApiKeys.geminiKeyValid = true;
                console.log(`✅ Gemini API key validated for user ${userApiKeys.email}`);
            } catch (error) {
                userApiKeys.geminiKeyValid = false;
                console.log(`❌ Invalid Gemini API key for user ${userApiKeys.email}:`, error.message);
            }
        }
        
        // Validate Ollama connection
        if (userApiKeys.ollamaUrl) {
            try {
                const axios = require('axios');
                const response = await axios.get(`${userApiKeys.ollamaUrl}/api/tags`, { timeout: 5000 });
                
                if (response.status === 200) {
                    userApiKeys.ollamaConnectionValid = true;
                    console.log(`✅ Ollama connection validated for user ${userApiKeys.email}`);
                } else {
                    userApiKeys.ollamaConnectionValid = false;
                }
            } catch (error) {
                userApiKeys.ollamaConnectionValid = false;
                console.log(`❌ Invalid Ollama URL for user ${userApiKeys.email}:`, error.message);
            }
        }
        
        userApiKeys.lastValidationAt = new Date();
        await userApiKeys.save();
        
    } catch (error) {
        console.error('Error validating user services:', error);
    }
};

// Test user's service configuration
const testUserServices = async (req, res) => {
    try {
        const userId = req.user.id;
        const userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            return res.status(404).json({ message: 'No API key configuration found' });
        }
        
        await validateUserServices(userApiKeys);
        
        const results = {
            gemini: {
                configured: !!userApiKeys.geminiApiKey,
                valid: userApiKeys.geminiKeyValid,
                message: userApiKeys.geminiKeyValid ? 'Gemini API key is working' : 
                        userApiKeys.geminiKeyValid === false ? 'Gemini API key is invalid' : 'Not tested yet'
            },
            ollama: {
                configured: !!userApiKeys.ollamaUrl,
                valid: userApiKeys.ollamaConnectionValid,
                url: userApiKeys.ollamaUrl,
                model: userApiKeys.ollamaModel,
                message: userApiKeys.ollamaConnectionValid ? 'Ollama connection is working' : 
                        userApiKeys.ollamaConnectionValid === false ? 'Ollama connection failed' : 'Not tested yet'
            },
            admin: {
                available: userApiKeys.canUseAdminKeys(),
                status: userApiKeys.adminAccessStatus,
                message: userApiKeys.canUseAdminKeys() ? 'Admin API keys are available' : 
                        `Admin access is ${userApiKeys.adminAccessStatus}`
            },
            preferredService: userApiKeys.getPreferredService(),
            lastValidationAt: userApiKeys.lastValidationAt
        };
        
        res.json(results);
    } catch (error) {
        console.error('Error testing user services:', error);
        res.status(500).json({ message: 'Failed to test service configuration' });
    }
};

// Request admin access
const requestAdminAccess = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reason } = req.body;
        
        let userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            userApiKeys = new UserApiKeys({
                userId: userId,
                email: req.user.email
            });
        }
        
        userApiKeys.useAdminKeys = true;
        userApiKeys.adminAccessStatus = 'pending';
        userApiKeys.adminAccessRequestedAt = new Date();
        userApiKeys.adminAccessReason = reason || 'User requested access to admin API keys';
        
        await userApiKeys.save();
        
        console.log(`📝 Admin access requested by user ${req.user.email}: ${reason}`);
        
        res.json({ 
            message: 'Admin access request submitted successfully',
            status: 'pending',
            requestedAt: userApiKeys.adminAccessRequestedAt
        });
    } catch (error) {
        console.error('Error requesting admin access:', error);
        res.status(500).json({ message: 'Failed to submit admin access request' });
    }
};

// Get user's effective service configuration (for internal use)
const getUserServiceConfig = async (userId) => {
    try {
        const userApiKeys = await UserApiKeys.findByUserId(userId);
        
        if (!userApiKeys) {
            return {
                service: 'admin',
                config: null,
                canUseService: false
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
                    canUseService: true
                };
                
            case 'ollama':
                return {
                    service: 'ollama',
                    config: {
                        url: userApiKeys.ollamaUrl,
                        model: userApiKeys.ollamaModel
                    },
                    canUseService: true
                };
                
            case 'admin':
                return {
                    service: 'admin',
                    config: null,
                    canUseService: userApiKeys.canUseAdminKeys()
                };
                
            default:
                return {
                    service: 'none',
                    config: null,
                    canUseService: false
                };
        }
    } catch (error) {
        console.error('Error getting user service config:', error);
        return {
            service: 'none',
            config: null,
            canUseService: false
        };
    }
};

module.exports = {
    getUserApiKeys,
    updateUserApiKeys,
    testUserServices,
    requestAdminAccess,
    getUserServiceConfig,
    validateUserServices
};
