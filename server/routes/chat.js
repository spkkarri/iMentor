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
    handleHybridRagMessage,
    summarizeConversation, // <-- Import the function
} = require('../controllers/chatController');

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

// --- NEW: Endpoint for short-term memory summarization ---
// --- FIX: Use the imported controller function ---
router.post('/summarize', tempAuth, summarizeConversation);

module.exports = router;