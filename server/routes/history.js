// server/routes/history.js
const express = require('express');
const router = express.Router();
const ChatHistory = require('../models/ChatHistory');

// ==================================================================
//  START OF FIX:
//  We now correctly destructure the 'tempAuth' function from the
//  object that is exported by the authMiddleware.js file.
// ==================================================================
const { tempAuth } = require('../middleware/authMiddleware');

// @route   DELETE /api/history/session/:sessionId
// @desc    Delete a specific chat session for the logged-in user
// @access  Private
// FIX: We now use 'tempAuth' as the middleware function.
router.delete('/session/:sessionId', tempAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id; // From the token validated by tempAuth

        // Using findOneAndDelete is an atomic and robust operation.
        const deletedSession = await ChatHistory.findOneAndDelete({
            sessionId: sessionId,
            userId: userId
        });

        if (!deletedSession) {
            return res.status(404).json({ message: 'Session not found or you do not have permission to delete it.' });
        }

        res.json({ status: 'success', message: 'Chat session deleted successfully.' });

    } catch (error) {
        console.error('Error deleting chat session:', error);
        res.status(500).json({ message: 'Server error while deleting chat session.' });
    }
});
// ==================================================================
//  END OF FIX
// ==================================================================

module.exports = router;