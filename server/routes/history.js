// server/routes/history.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const ChatSession = require('../models/ChatSession');

// @route   POST /api/history
// @desc    Save or update a chat session
// @access  Private
router.post('/', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    const { sessionId, messages, systemPrompt, title } = req.body;
    if (!sessionId || !messages) {
        return res.status(400).json({ message: 'Session ID and messages are required.' });
    }
    try {
        const updatedSession = await ChatSession.findOneAndUpdate(
            { sessionId: sessionId, user: req.user.id },
            { 
                $set: {
                    messages: messages,
                    systemPrompt: systemPrompt,
                    title: title || 'New Conversation',
                    user: req.user.id
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(201).json(updatedSession);
    } catch (error) {
        console.error('Error saving chat session:', error);
        res.status(500).json({ message: 'Server error while saving chat history.' });
    }
});

// @route   GET /api/history
// @desc    Get all chat sessions for a user
// @access  Private
router.get('/', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        const sessions = await ChatSession.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select('sessionId title createdAt'); 
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Server error while fetching history.' });
    }
});

// @route   GET /api/history/:sessionId
// @desc    Get a single full chat session
// @access  Private
router.get('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        const session = await ChatSession.findOne({ 
            sessionId: req.params.sessionId, 
            user: req.user.id 
        });
        if (!session) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }
        res.json(session);
    } catch (error) {
        console.error('Error fetching single session:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


// --- NEW FEATURE: DELETE a chat session ---
// @route   DELETE /api/history/:sessionId
// @desc    Delete a chat session
// @access  Private
router.delete('/:sessionId', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        // Find and delete the session, ensuring it belongs to the logged-in user
        const session = await ChatSession.findOneAndDelete({ 
            sessionId: req.params.sessionId, 
            user: req.user.id 
        });

        if (!session) {
            // If no session was found/deleted, it either didn't exist or didn't belong to the user
            return res.status(404).json({ message: 'Chat session not found or you are not authorized to delete it.' });
        }
        
        res.json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ message: 'Server error while deleting session.' });
    }
});


module.exports = router;