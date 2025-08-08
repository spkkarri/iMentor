// server/routes/userSettings.js
// Routes for user settings and API key management

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { GeminiAI } = require('../services/geminiAI');
const GeminiService = require('../services/geminiService');

/**
 * GET /api/user/settings
 * Get user's current settings and API keys
 */
router.get('/settings', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Return settings without exposing full API keys
        res.json({
            success: true,
            data: {
                username: user.username,
                ollamaUrl: user.ollamaUrl,
                useOwnKeys: user.useOwnKeys,
                apiKeys: {
                    gemini: user.apiKeys?.gemini ? '***' + user.apiKeys.gemini.slice(-4) : '',
                    deepseek: user.apiKeys?.deepseek ? '***' + user.apiKeys.deepseek.slice(-4) : '',
                    qwen: user.apiKeys?.qwen ? '***' + user.apiKeys.qwen.slice(-4) : ''
                },
                hasApiKeys: {
                    gemini: !!(user.apiKeys?.gemini),
                    deepseek: !!(user.apiKeys?.deepseek),
                    qwen: !!(user.apiKeys?.qwen)
                }
            }
        });
        
    } catch (error) {
        console.error('Error getting user settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user settings',
            details: error.message
        });
    }
});

/**
 * PUT /api/user/settings
 * Update user's settings and API keys
 */
router.put('/settings', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { apiKeys, ollamaUrl, useOwnKeys } = req.body;
        
        // Validate Ollama URL if provided
        if (ollamaUrl && ollamaUrl.trim()) {
            try {
                new URL(ollamaUrl);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Please provide a valid Ollama URL'
                });
            }
        }
        
        // Prepare update data
        const updateData = {
            useOwnKeys: useOwnKeys || false,
            ollamaUrl: ollamaUrl || 'http://localhost:11434'
        };
        
        // Update API keys if provided
        if (apiKeys) {
            updateData.apiKeys = {
                gemini: apiKeys.gemini?.trim() || '',
                deepseek: apiKeys.deepseek?.trim() || '',
                qwen: apiKeys.qwen?.trim() || ''
            };
        }
        
        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: {
                username: user.username,
                ollamaUrl: user.ollamaUrl,
                useOwnKeys: user.useOwnKeys,
                hasApiKeys: {
                    gemini: !!(user.apiKeys?.gemini),
                    deepseek: !!(user.apiKeys?.deepseek),
                    qwen: !!(user.apiKeys?.qwen)
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user settings',
            details: error.message
        });
    }
});

/**
 * GET /api/user/api-keys/status
 * Check the status of user's API keys
 */
router.get('/api-keys/status', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const status = {
            gemini: 'unknown',
            deepseek: 'unknown',
            qwen: 'unknown',
            ollama: 'unknown'
        };
        
        // Test Gemini API key if provided
        if (user.apiKeys?.gemini) {
            try {
                const geminiService = new GeminiService();
                geminiService.apiKey = user.apiKeys.gemini;
                await geminiService.initialize();
                
                const geminiAI = new GeminiAI(geminiService);
                await geminiAI.generateText('Hello', [], [], 'Test');
                status.gemini = 'valid';
            } catch (error) {
                status.gemini = 'invalid';
            }
        }
        
        // Test DeepSeek API key if provided
        if (user.apiKeys?.deepseek) {
            try {
                const response = await fetch('https://api.deepseek.com/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${user.apiKeys.deepseek}`
                    },
                    timeout: 5000
                });
                status.deepseek = response.ok ? 'valid' : 'invalid';
            } catch (error) {
                status.deepseek = 'invalid';
            }
        }
        
        // Test Qwen API key if provided
        if (user.apiKeys?.qwen) {
            try {
                const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${user.apiKeys.qwen}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'qwen-turbo',
                        input: { messages: [{ role: 'user', content: 'test' }] },
                        parameters: { max_tokens: 1 }
                    }),
                    timeout: 5000
                });
                status.qwen = response.ok ? 'valid' : 'invalid';
            } catch (error) {
                status.qwen = 'invalid';
            }
        }
        
        // Test Ollama connection
        if (user.ollamaUrl) {
            try {
                const response = await fetch(`${user.ollamaUrl}/api/tags`, {
                    timeout: 5000
                });
                status.ollama = response.ok ? 'valid' : 'invalid';
            } catch (error) {
                status.ollama = 'invalid';
            }
        }
        
        res.json({
            success: true,
            data: {
                status,
                useOwnKeys: user.useOwnKeys,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error checking API key status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check API key status',
            details: error.message
        });
    }
});

/**
 * POST /api/user/api-keys/test
 * Test a specific API key without saving it
 */
router.post('/api-keys/test', tempAuth, async (req, res) => {
    try {
        const { provider, apiKey, url } = req.body;
        
        if (!provider) {
            return res.status(400).json({
                success: false,
                error: 'Provider is required'
            });
        }
        
        let testResult = { success: false, message: '' };
        
        switch (provider) {
            case 'gemini':
                if (!apiKey) {
                    testResult.message = 'Gemini API key is required';
                    break;
                }
                try {
                    const geminiService = new GeminiService();
                    geminiService.apiKey = apiKey;
                    await geminiService.initialize();
                    
                    const geminiAI = new GeminiAI(geminiService);
                    await geminiAI.generateText('Hello', [], [], 'Test');
                    testResult = { success: true, message: 'Gemini API key is valid' };
                } catch (error) {
                    testResult.message = `Gemini API key test failed: ${error.message}`;
                }
                break;
                
            case 'deepseek':
                if (!apiKey) {
                    testResult.message = 'DeepSeek API key is required';
                    break;
                }
                try {
                    const response = await fetch('https://api.deepseek.com/v1/models', {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`
                        },
                        timeout: 10000
                    });
                    testResult = {
                        success: response.ok,
                        message: response.ok ? 'DeepSeek API key is valid' : 'DeepSeek API key is invalid'
                    };
                } catch (error) {
                    testResult.message = `DeepSeek API key test failed: ${error.message}`;
                }
                break;
                
            case 'qwen':
                if (!apiKey) {
                    testResult.message = 'Qwen API key is required';
                    break;
                }
                try {
                    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'qwen-turbo',
                            input: { messages: [{ role: 'user', content: 'test' }] },
                            parameters: { max_tokens: 1 }
                        }),
                        timeout: 10000
                    });
                    testResult = {
                        success: response.ok,
                        message: response.ok ? 'Qwen API key is valid' : 'Qwen API key is invalid'
                    };
                } catch (error) {
                    testResult.message = `Qwen API key test failed: ${error.message}`;
                }
                break;
                
            case 'ollama':
                const testUrl = url || 'http://localhost:11434';
                try {
                    const response = await fetch(`${testUrl}/api/tags`, {
                        timeout: 10000
                    });
                    if (response.ok) {
                        const data = await response.json();
                        testResult = {
                            success: true,
                            message: `Ollama server is accessible. Found ${data.models?.length || 0} models.`
                        };
                    } else {
                        testResult.message = 'Ollama server is not accessible';
                    }
                } catch (error) {
                    testResult.message = `Ollama connection test failed: ${error.message}`;
                }
                break;
                
            default:
                testResult.message = 'Unknown provider';
        }
        
        res.json({
            success: true,
            data: testResult
        });
        
    } catch (error) {
        console.error('Error testing API key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test API key',
            details: error.message
        });
    }
});

module.exports = router;
