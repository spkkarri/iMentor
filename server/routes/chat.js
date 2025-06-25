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
    handleDeepSearch
} = require('../controllers/chatController');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');


// --- Session Management Endpoints ---

// Create a new session
router.post('/session', tempAuth, createSession);

// Get all sessions for user
router.get('/sessions', tempAuth, getSessions);

// Get the full details of a specific chat session
router.get('/session/:sessionId', tempAuth, getSessionDetails);

// Save chat history
router.post('/history', tempAuth, saveChatHistory);


// --- Core Chat Endpoints ---

// Handles standard chat messages without RAG
router.post('/message', tempAuth, handleStandardMessage);

// Handles chat messages that require RAG
router.post('/rag', tempAuth, handleRagMessage);

// Perform deep search with AI-powered query decomposition and synthesis
router.post('/deep-search', tempAuth, handleDeepSearch);

module.exports = router;