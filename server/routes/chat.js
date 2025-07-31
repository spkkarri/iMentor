const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const {
    getSessions,
    getSessionDetails,
    createSession,
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
    testDeepSearch
} = require('../controllers/chatController');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const quotaMonitor = require('../utils/quotaMonitor');


// --- Session Management Endpoints ---
router.post('/session', tempAuth, createSession);
router.get('/sessions', tempAuth, getSessions);
router.get('/session/:sessionId', tempAuth, getSessionDetails);
router.post('/history', tempAuth, saveChatHistory);

// --- Core Chat Endpoints ---
router.post('/message', tempAuth, handleStandardMessage);
router.post('/rag', tempAuth, handleRagMessage);
// Hybrid RAG endpoint temporarily disabled
// router.post('/rag-v2', tempAuth, handleHybridRagMessage);
router.post('/deep-search', tempAuth, handleDeepSearch);

// Test endpoint for DeepSearch debugging
router.post('/test-deep-search', tempAuth, testDeepSearch);

// Health check endpoint
router.get('/health', (req, res) => {
    try {
        const serviceManager = req.serviceManager;
        const services = serviceManager ? serviceManager.getServices() : null;

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                serviceManager: !!serviceManager,
                geminiAI: !!services?.geminiAI,
                duckDuckGo: !!services?.duckDuckGo,
                vectorStore: !!services?.vectorStore
            },
            endpoints: {
                message: '/api/chat/message',
                deepSearch: '/api/chat/deep-search',
                testDeepSearch: '/api/chat/test-deep-search'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get API quota status
router.get('/quota-status', tempAuth, (req, res) => {
    try {
        const stats = quotaMonitor.getUsageStats();
        const timeUntilReset = quotaMonitor.getTimeUntilReset();
        const warning = quotaMonitor.getQuotaWarning();

        res.json({
            success: true,
            quota: {
                ...stats,
                timeUntilReset,
                warning
            }
        });
    } catch (error) {
        console.error('Error getting quota status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get quota status'
        });
    }
});

// Reload DeepSearch configuration endpoint
router.post('/reload-deepsearch-config', tempAuth, async (req, res) => {
    try {
        console.log('🔄 Reloading DeepSearch configuration...');

        // Get the service manager
        const serviceManager = req.serviceManager;
        if (!serviceManager) {
            return res.status(500).json({
                success: false,
                error: 'ServiceManager not available'
            });
        }

        // Get all services that need configuration reload
        const services = serviceManager.getServices();

        // Reload DuckDuckGo service configuration
        if (services.duckDuckGo && typeof services.duckDuckGo.reloadConfiguration === 'function') {
            services.duckDuckGo.reloadConfiguration();
        }

        // Also reload for all user-specific DeepSearch services
        const userServices = serviceManager.deepSearchServices || new Map();
        for (const [userId, deepSearchService] of userServices) {
            if (deepSearchService.duckDuckGo && typeof deepSearchService.duckDuckGo.reloadConfiguration === 'function') {
                deepSearchService.duckDuckGo.reloadConfiguration();
            }
        }

        res.json({
            success: true,
            message: 'DeepSearch configuration reloaded successfully',
            timestamp: new Date().toISOString(),
            config: {
                DEEP_SEARCH_MOCK_ONLY: process.env.DEEP_SEARCH_MOCK_ONLY,
                DEEP_SEARCH_USE_SIMULATED: process.env.DEEP_SEARCH_USE_SIMULATED
            }
        });

    } catch (error) {
        console.error('❌ Failed to reload DeepSearch configuration:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;