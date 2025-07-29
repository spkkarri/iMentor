// server/routes/chat.js
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
    handleHybridRagMessage, // <-- Import the new controller function
} = require('../controllers/chatController');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const quotaMonitor = require('../utils/quotaMonitor');


// --- Session Management Endpoints ---

// Create a new session
router.post('/session', tempAuth, createSession);

// Get all sessions for user
router.get('/sessions', tempAuth, getSessions);

// Get the full details of a specific chat session
router.get('/session/:sessionId', tempAuth, getSessionDetails);

// Delete a specific chat session
router.delete('/session/:sessionId', tempAuth, deleteSession);

// Save chat history
router.post('/history', tempAuth, saveChatHistory);


// --- Core Chat Endpoints ---

// Handles standard chat messages without RAG
router.post('/message', tempAuth, handleStandardMessage);

// Handles chat messages that require RAG (Legacy - can be removed later)
router.post('/rag', tempAuth, handleRagMessage);

// NEW EFFICIENT RAG ROUTE
router.post('/rag-v2', tempAuth, handleHybridRagMessage);

// Perform deep search with AI-powered query decomposition and synthesis
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