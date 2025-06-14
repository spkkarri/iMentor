// server/routes/history.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const ChatSession = require('../models/ChatSession');

// @route   POST /api/history
// @desc    Save or update a chat session
router.post('/', tempAuth, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    const { sessionId, messages, systemPrompt, title } = req.body;
    if (!sessionId || !messages) return res.status(400).json({ message: 'Session ID and messages are required.' });
    try {
        await ChatSession.findOneAndUpdate(
            { sessionId: sessionId, user: req.user.id },
            { $set: { messages, systemPrompt, title: title || 'New Conversation', user: req.user.id } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ message: 'History saved.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while saving chat history.' });
    }
});

// @route   GET /api/history
// @desc    Get all chat sessions for a user
router.get('/', tempAuth, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    try {
        const sessions = await ChatSession.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select('sessionId title createdAt');
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching history.' });
    }
});

// @route   GET /api/history/:sessionId
// @desc    Get a single full chat session
router.get('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    try {
        const session = await ChatSession.findOne({ sessionId: req.params.sessionId, user: req.user.id });
        if (!session) return res.status(404).json({ message: 'Chat session not found.' });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- THIS IS THE IMPORTANT PART ---
// @route   DELETE /api/history/:sessionId
// @desc    Delete a chat session
router.delete('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        const session = await ChatSession.findOneAndDelete({ sessionId: req.params.sessionId, user: req.user.id });
        if (!session) return res.status(404).json({ message: 'Chat session not found or not authorized.' });
        res.json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting session.' });
    }
});

module.exports = router;