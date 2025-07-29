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
    deleteSession,
    handleHybridRagMessage,
    summarizeConversation, // <-- Import the function
} = require('../controllers/chatController');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const quotaMonitor = require('../utils/quotaMonitor');


// --- Session Management Endpoints ---
router.post('/session', tempAuth, createSession);
router.get('/sessions', tempAuth, getSessions);
router.get('/session/:sessionId', tempAuth, getSessionDetails);
router.delete('/session/:sessionId', tempAuth, deleteSession);
router.post('/history', tempAuth, saveChatHistory);

// --- Core Chat Endpoints ---
router.post('/message', tempAuth, handleStandardMessage);
router.post('/rag', tempAuth, handleRagMessage);
router.post('/rag-v2', tempAuth, handleHybridRagMessage);
router.post('/deep-search', tempAuth, handleDeepSearch);

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

module.exports = router;