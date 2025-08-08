// server/routes/modelRouter.js
// Routes for model management and switching

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const userSpecificAI = require('../services/userSpecificAI');
const intelligentMultiLLM = require('../services/intelligentMultiLLM');
const GroqAI = require('../services/groqAI');
const TogetherAI = require('../services/togetherAI');
const CohereAI = require('../services/cohereAI');
const HuggingFaceAI = require('../services/huggingFaceAI');

/**
 * GET /api/models/available
 * Get all available models for the user
 */
router.get('/available', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get available models - Only 2 models: Gemini and Llama
        const models = {
            available: [
                {
                    id: 'gemini-pro',
                    name: 'Gemini Pro',
                    type: 'comprehensive',
                    description: 'Google AI for comprehensive analysis and reasoning',
                    specialties: ['Analysis', 'Reasoning', 'Web Search'],
                    provider: 'Google',
                    status: 'available'
                },
                {
                    id: 'llama-model',
                    name: 'Llama Model',
                    type: 'chat',
                    description: 'Advanced conversational AI model',
                    specialties: ['Chat', 'Conversation', 'General'],
                    provider: 'Llama',
                    status: 'available'
                }
            ]
        };

        // No dynamic model fetching - use only the 2 predefined models
        const allModels = models.available;

        res.json({
            success: true,
            data: {
                models: allModels,
                totalCount: allModels.length,
                message: 'Only Gemini and Llama models available'
            }
        });

    } catch (error) {
        console.error('Error getting available models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get available models',
            details: error.message
        });
    }
});

/**
 * POST /api/models/generate
 * Generate response using specified model
 */
router.post('/generate', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { modelId, query, history = [], systemPrompt = '' } = req.body;

        if (!modelId || !query) {
            return res.status(400).json({
                success: false,
                error: 'Model ID and query are required'
            });
        }

        let response;
        const startTime = Date.now();

        // Route to appropriate service based on model ID
        if (modelId.startsWith('gemini-')) {
            // Use user-specific Gemini service
            const userServices = await userSpecificAI.getUserAIServices(userId);
            if (userServices.gemini) {
                response = await userServices.gemini.generateChatResponse(
                    query,
                    [],
                    history,
                    systemPrompt
                );
            } else {
                throw new Error('Gemini service not available');
            }

        } else if (modelId.startsWith('groq-')) {
            // Use Groq service
            const groqAI = new GroqAI();
            response = await groqAI.generateText(query);

        } else if (modelId.startsWith('together-')) {
            // Use Together AI service
            const togetherAI = new TogetherAI();
            response = await togetherAI.generateText(query);

        } else if (modelId.startsWith('cohere-')) {
            // Use Cohere service
            const cohereAI = new CohereAI();
            response = await cohereAI.generateText(query);

        } else if (modelId.startsWith('hf-')) {
            // Use HuggingFace service
            const hfAI = new HuggingFaceAI();
            response = await hfAI.generateText(query);

        } else if (modelId.startsWith('ollama-')) {
            // Use user's Ollama service
            const userServices = await userSpecificAI.getUserAIServices(userId);
            if (userServices.ollama) {
                const modelName = modelId.replace('ollama-', '').replace('_', ':');
                response = await userServices.ollama.generateResponse(query, modelName);
            } else {
                throw new Error('Ollama service not available');
            }

        } else {
            // Use Multi-LLM routing
            response = await intelligentMultiLLM.generateResponse(query, {
                userId,
                selectedModel: modelId,
                conversationHistory: history,
                systemPrompt
            });
        }

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                response: response.response || response,
                modelUsed: modelId,
                responseTime,
                metadata: response.metadata || {}
            }
        });

    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response',
            details: error.message
        });
    }
});

/**
 * GET /api/models/status
 * Get status of all models
 */
router.get('/status', tempAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const status = {
            google: 'available',
            multiLLM: 'checking',
            ollama: 'checking',
            groq: 'available',
            together: 'available',
            cohere: 'available',
            huggingface: 'available'
        };

        // Check Multi-LLM status
        try {
            const multiLLMStatus = await intelligentMultiLLM.getSystemStatus();
            status.multiLLM = multiLLMStatus.isOperational ? 'available' : 'unavailable';
        } catch {
            status.multiLLM = 'unavailable';
        }

        // Check Ollama status
        try {
            const userServices = await userSpecificAI.getUserAIServices(userId);
            status.ollama = userServices.ollama ? 'available' : 'unavailable';
        } catch {
            status.ollama = 'unavailable';
        }

        res.json({
            success: true,
            data: { status }
        });

    } catch (error) {
        console.error('Error checking model status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check model status',
            details: error.message
        });
    }
});

module.exports = router;
