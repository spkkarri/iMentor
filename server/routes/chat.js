// server/routes/chat.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');
const ChatSession = require('../models/ChatSession');

const getPythonUrl = () => {
    const url = process.env.PYTHON_RAG_SERVICE_URL;
    if (!url) {
        console.error('FATAL: PYTHON_RAG_SERVICE_URL is not set.');
        throw new Error('Server configuration error: RAG service URL is missing.');
    }
    return url;
};

// @route   POST /api/chat/message
// @desc    Send a message to the chatbot (now with history)
// @access  Private
router.post('/message', tempAuth, async (req, res, next) => {
    const { history, systemPrompt } = req.body;
    if (!history || history.length === 0) {
        return res.status(400).json({ message: 'Message history is required.' });
    }
    try {
        const pythonRagUrl = getPythonUrl();
        const pythonResponse = await axios.post(`${pythonRagUrl}/chat`, {
            history,
            system_prompt: systemPrompt
        });
        res.json(pythonResponse.data);
    } catch (error) {
        console.error("Error proxying to Python /chat:", error.response ? error.response.data : error.message);
        next(error);
    }
});

// @route   POST /api/chat/rag
// @desc    Query with RAG (now with history)
// @access  Private
router.post('/rag', tempAuth, async (req, res, next) => {
    const { history, systemPrompt } = req.body;
    const userId = req.user.id;
    if (!history || history.length === 0) {
        return res.status(400).json({ message: 'Message history is required.' });
    }
    try {
        const pythonRagUrl = getPythonUrl();
        const pythonResponse = await axios.post(`${pythonRagUrl}/query`, {
            user_id: userId,
            history: history,
            system_prompt: systemPrompt
        });
        res.json(pythonResponse.data);
    } catch (error) {
        console.error("Error proxying to Python /query:", error.response ? error.response.data : error.message);
        next(error);
    }
});

// @route   POST /api/chat/history
// @desc    Save or update a chat session
// @access  Private
router.post('/history', tempAuth, async (req, res) => {
    const { sessionId, messages, systemPrompt, title } = req.body;
    const userId = req.user.id;
    if (!sessionId || !messages || messages.length === 0) {
        return res.status(400).json({ message: 'Session ID and messages are required.' });
    }
    try {
        const finalTitle = title || (messages.find(m => m.role === 'user')?.parts[0].text.substring(0, 50) || 'New Conversation');
        const sessionData = { sessionId, user: userId, messages, systemPrompt, title: finalTitle, updatedAt: Date.now() };
        await ChatSession.findOneAndUpdate(
            { sessionId: sessionId, user: userId },
            { $set: sessionData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ message: 'Chat history saved.' });
    } catch (error) {
        console.error('Error saving chat history:', error);
        res.status(500).json({ message: 'Server error while saving chat history.' });
    }
});

// @route   GET /api/chat/sessions
// @desc    Get all chat session summaries for the logged-in user
// @access  Private
router.get('/sessions', tempAuth, async (req, res) => {
    try {
        const sessions = await ChatSession.find({ user: req.user.id })
            .sort({ updatedAt: -1 })
            .select('sessionId title updatedAt');
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/chat/session/:sessionId
// @desc    Get the full details of a specific chat session
// @access  Private
router.get('/session/:sessionId', tempAuth, async (req, res) => {
    try {
        const session = await ChatSession.findOne({ sessionId: req.params.sessionId, user: req.user.id });
        if (!session) return res.status(404).json({ message: 'Chat session not found.' });
        res.json(session);
    } catch (error) {
        console.error('Error fetching session details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;