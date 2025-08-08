// server/routes/userOllama.js
// Routes for user-specific Ollama configuration

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const userOllamaConnector = require('../services/userOllamaConnector');
const User = require('../models/User');

/**
 * GET /api/user-ollama/status
 * Get user's Ollama configuration and connection status
 */
router.get('/status', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await userOllamaConnector.getUserOllamaStatus(userId);
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('Error getting user Ollama status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Ollama status',
            details: error.message
        });
    }
});

/**
 * POST /api/user-ollama/test
 * Test user's Ollama connection
 */
router.post('/test', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const testResult = await userOllamaConnector.testUserConnection(userId);
        
        res.json({
            success: true,
            data: testResult
        });
        
    } catch (error) {
        console.error('Error testing user Ollama connection:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test Ollama connection',
            details: error.message
        });
    }
});

/**
 * PUT /api/user-ollama/url
 * Update user's Ollama URL
 */
router.put('/url', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ollamaUrl } = req.body;
        
        if (!ollamaUrl) {
            return res.status(400).json({
                success: false,
                error: 'Ollama URL is required'
            });
        }
        
        // Validate URL format
        try {
            new URL(ollamaUrl);
        } catch (urlError) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid URL (e.g., http://localhost:11434 or http://your-server:11434)'
            });
        }
        
        const updateResult = await userOllamaConnector.updateUserOllamaUrl(userId, ollamaUrl);
        
        res.json({
            success: updateResult.success,
            data: updateResult
        });
        
    } catch (error) {
        console.error('Error updating user Ollama URL:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update Ollama URL',
            details: error.message
        });
    }
});

/**
 * GET /api/user-ollama/models
 * Get available models from user's Ollama server
 */
router.get('/models', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const models = await userOllamaConnector.getUserAvailableModels(userId);
        
        res.json({
            success: true,
            data: {
                models: models,
                count: models.length
            }
        });
        
    } catch (error) {
        console.error('Error getting user Ollama models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Ollama models',
            details: error.message
        });
    }
});

/**
 * POST /api/user-ollama/chat
 * Test chat with user's Ollama server
 */
router.post('/chat', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { query, model } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }
        
        console.log(`[User Ollama] Testing chat for user ${userId}: "${query.substring(0, 50)}..."`);
        
        const response = await userOllamaConnector.generateUserResponse(userId, query, {
            model: model || 'llama3.2:latest',
            max_tokens: 500,
            temperature: 0.7
        });
        
        res.json({
            success: true,
            data: {
                query: query,
                response: response.response,
                model: response.model,
                metadata: {
                    total_duration: response.total_duration,
                    load_duration: response.load_duration,
                    prompt_eval_count: response.prompt_eval_count,
                    eval_count: response.eval_count,
                    eval_duration: response.eval_duration
                }
            }
        });
        
    } catch (error) {
        console.error('Error testing user Ollama chat:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test Ollama chat',
            details: error.message
        });
    }
});

/**
 * GET /api/user-ollama/config
 * Get user's current Ollama configuration
 */
router.get('/config', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('username ollamaUrl');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                username: user.username,
                ollamaUrl: user.ollamaUrl,
                defaultUrl: 'http://localhost:11434'
            }
        });
        
    } catch (error) {
        console.error('Error getting user Ollama config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Ollama configuration',
            details: error.message
        });
    }
});

/**
 * GET /api/user-ollama/system-status
 * Get system-wide Ollama status (admin only)
 */
router.get('/system-status', tempAuth, async (req, res) => {
    try {
        // Note: In a real app, you'd check if user is admin
        const systemStatus = userOllamaConnector.getSystemStatus();
        
        res.json({
            success: true,
            data: systemStatus
        });
        
    } catch (error) {
        console.error('Error getting system Ollama status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system status',
            details: error.message
        });
    }
});

/**
 * POST /api/user-ollama/cleanup
 * Clean up old cached connectors (admin only)
 */
router.post('/cleanup', tempAuth, async (req, res) => {
    try {
        const { maxAgeMinutes = 30 } = req.body;
        
        userOllamaConnector.cleanupOldConnectors(maxAgeMinutes);
        
        res.json({
            success: true,
            data: {
                message: `Cleaned up connectors older than ${maxAgeMinutes} minutes`,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error cleaning up Ollama connectors:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup connectors',
            details: error.message
        });
    }
});

module.exports = router;
