// server/routes/podcasts.js
const express = require('express');
const router = express.Router();
const Podcast = require('../models/Podcast');
const { tempAuth } = require('../middleware/authMiddleware');

// @route   GET /api/podcasts
// @desc    Get all podcasts for the logged-in user
// @access  Private
router.get('/', tempAuth, async (req, res) => {
    try {
        const podcasts = await Podcast.find({ userId: req.user._id })
                                      .sort({ createdAt: -1 }); // Show newest first
        res.json(podcasts);
    } catch (error) {
        console.error('Error fetching podcast history:', error);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   DELETE /api/podcasts/:id
// @desc    Delete a podcast
// @access  Private
router.delete('/:id', tempAuth, async (req, res) => {
    try {
        // Find the podcast by its database ID and ensure it belongs to the user
        const podcast = await Podcast.findOne({ _id: req.params.id, userId: req.user._id });

        if (!podcast) {
            return res.status(404).json({ msg: 'Podcast not found or you do not have permission to delete it.' });
        }

        // Optional: Delete the actual MP3 file from disk
        // const fs = require('fs').promises;
        // const path = require('path');
        // const filePath = path.join(__dirname, '..', 'ai_core_service', 'generated_podcasts', `${podcast.podcastId}.mp3`);
        // try { await fs.unlink(filePath); } catch (e) { console.error("Could not delete file:", e.message); }

        await podcast.remove();
        res.json({ msg: 'Podcast removed' });
    } catch (error) {
        console.error('Error deleting podcast:', error);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;