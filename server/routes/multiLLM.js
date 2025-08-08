// server/routes/multiLLM.js
// Routes for Multi-LLM functionality

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const IntelligentMultiLLM = require('../services/intelligentMultiLLM');

// Global Multi-LLM instance
let multiLLMInstance = null;

/**
 * Initialize Multi-LLM system
 */
async function getMultiLLMInstance() {
    if (!multiLLMInstance) {
        multiLLMInstance = new IntelligentMultiLLM();
        await multiLLMInstance.initialize();
    }
    return multiLLMInstance;
}

/**
 * GET /api/multi-llm/status
 * Get Multi-LLM system status and available models
 */
router.get('/status', tempAuth, async (req, res) => {
    try {
        const multiLLM = await getMultiLLMInstance();
        const stats = multiLLM.getRoutingStats();
        
        res.json({
            success: true,
            data: {
                systemStatus: 'operational',
                totalModels: stats.availableModels.length,
                availableModels: stats.availableModels,
                connectorStatus: stats.connectorStatus,
                routingStats: {
                    totalQueries: stats.totalQueries,
                    routingDecisions: stats.routingDecisions,
                    modelPerformance: stats.modelPerformance
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error getting Multi-LLM status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system status',
            details: error.message
        });
    }
});

/**
 * POST /api/multi-llm/route
 * Test query routing without generating response
 */
router.post('/route', tempAuth, async (req, res) => {
    try {
        const { query, conversationHistory = [] } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }
        
        const multiLLM = await getMultiLLMInstance();
        const routing = await multiLLM.routeQuery(query, conversationHistory);
        
        res.json({
            success: true,
            data: {
                query: query,
                selectedModel: {
                    name: routing.selectedModel.name,
                    specialties: routing.selectedModel.specialties,
                    available: routing.selectedModel.available
                },
                conversationType: routing.conversationType,
                confidence: routing.confidence,
                reasoning: routing.reasoning,
                fallbackModels: routing.fallbackModels.map(model => ({
                    name: model.name,
                    specialties: model.specialties
                })),
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error routing query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to route query',
            details: error.message
        });
    }
});

/**
 * POST /api/multi-llm/chat
 * Generate response using Multi-LLM system
 */
router.post('/chat', tempAuth, async (req, res) => {
    try {
        const { query, conversationHistory = [], userPreferences = {} } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }
        
        console.log(`[Multi-LLM] Processing query: "${query.substring(0, 50)}..."`);
        
        const multiLLM = await getMultiLLMInstance();
        const response = await multiLLM.generateResponse(query, conversationHistory, userPreferences);
        
        res.json({
            success: true,
            data: {
                response: response.response,
                model: response.model,
                conversationType: response.conversationType,
                confidence: response.confidence,
                reasoning: response.reasoning,
                followUpQuestions: response.followUpQuestions,
                metadata: response.metadata,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error generating Multi-LLM response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate response',
            details: error.message
        });
    }
});

/**
 * POST /api/multi-llm/test
 * Test Multi-LLM system with predefined queries
 */
router.post('/test', tempAuth, async (req, res) => {
    try {
        const testQueries = [
            { query: "Hello! How are you?", expectedType: "general_chat" },
            { query: "Solve: 2x + 5 = 15", expectedType: "reasoning" },
            { query: "Write a Python function to reverse a string", expectedType: "technical" },
            { query: "Write a short poem about AI", expectedType: "creative_writing" },
            { query: "What are the latest AI developments?", expectedType: "research" }
        ];
        
        const multiLLM = await getMultiLLMInstance();
        const results = [];
        
        for (const test of testQueries) {
            try {
                const routing = await multiLLM.routeQuery(test.query, []);
                results.push({
                    query: test.query,
                    expectedType: test.expectedType,
                    actualType: routing.conversationType.type,
                    match: routing.conversationType.type === test.expectedType,
                    selectedModel: routing.selectedModel.name,
                    confidence: routing.confidence,
                    reasoning: routing.reasoning
                });
            } catch (error) {
                results.push({
                    query: test.query,
                    expectedType: test.expectedType,
                    error: error.message
                });
            }
        }
        
        const stats = multiLLM.getRoutingStats();
        const accuracy = results.filter(r => r.match).length / results.length;
        
        res.json({
            success: true,
            data: {
                testResults: results,
                accuracy: accuracy,
                systemStats: stats,
                summary: {
                    totalTests: results.length,
                    successful: results.filter(r => !r.error).length,
                    accurate: results.filter(r => r.match).length,
                    accuracyPercentage: Math.round(accuracy * 100)
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error running Multi-LLM test:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run test',
            details: error.message
        });
    }
});

/**
 * GET /api/multi-llm/models
 * Get detailed information about available models
 */
router.get('/models', tempAuth, async (req, res) => {
    try {
        const multiLLM = await getMultiLLMInstance();
        const stats = multiLLM.getRoutingStats();
        
        const modelDetails = stats.connectorStatus.map(connector => ({
            name: connector.name,
            available: connector.available,
            status: connector.status,
            models: connector.status?.models || [],
            specialties: connector.status?.specialties || [],
            hasApiKey: connector.status?.hasApiKey,
            baseUrl: connector.status?.baseUrl
        }));
        
        res.json({
            success: true,
            data: {
                models: modelDetails,
                summary: {
                    totalConnectors: modelDetails.length,
                    availableConnectors: modelDetails.filter(m => m.available).length,
                    totalSpecialties: [...new Set(modelDetails.flatMap(m => m.specialties))].length
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error getting model details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model details',
            details: error.message
        });
    }
});

/**
 * POST /api/multi-llm/analyze
 * Analyze conversation type without routing
 */
router.post('/analyze', tempAuth, async (req, res) => {
    try {
        const { query, conversationHistory = [] } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }
        
        const multiLLM = await getMultiLLMInstance();
        const analysis = await multiLLM.analyzeConversationType(query, conversationHistory);
        
        res.json({
            success: true,
            data: {
                query: query,
                analysis: analysis,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error analyzing conversation type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze conversation type',
            details: error.message
        });
    }
});

module.exports = router;
