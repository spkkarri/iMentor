// server/routes/podcast.js

const express = require('express');
const router = express.Router();
const axios = require('axios');

// --- FINAL CORRECTED IMPORT ---
// We are now importing the ONLY available middleware function: tempAuth
const { tempAuth } = require('../middleware/authMiddleware');

const File = require('../models/File');

// @route   POST /api/podcast
// @desc    Generate a podcast from a file
// @access  Private
router.post('/', tempAuth, async (req, res) => { // <-- USE tempAuth HERE
    // The tempAuth middleware ensures req.user is attached if the header is valid
    if (!req.user) {
        // This is a fallback, though tempAuth should have already sent a 401
        return res.status(401).json({ message: "Authentication failed." });
    }

    const { fileId } = req.body;
    const userId = req.user.id; // req.user is attached by tempAuth

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required.' });
    }

    try {
        const file = await File.findOne({ _id: fileId, user: userId });
        if (!file) {
            return res.status(404).json({ message: 'File not found or you do not have permission.' });
        }

        const pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonRagUrl) {
            return res.status(500).json({ message: 'Server configuration error: RAG service URL is missing.' });
        }

        console.log(`Requesting podcast generation from Python service for file: ${file.path}`);

        const pythonResponse = await axios.post(`${pythonRagUrl}/generate_podcast`, {
            user_id: userId.toString(),
            file_path: file.path,
            original_name: file.originalname
        });

        if (pythonResponse.data && pythonResponse.data.audioUrl) {
            return res.json({ audioUrl: pythonResponse.data.audioUrl });
        } else {
            throw new Error(pythonResponse.data?.error || 'Python service failed to generate podcast.');
        }

    } catch (error) {
        console.error('Error in podcast generation route:', error.response ? error.response.data : error.message);
        const message = error.response?.data?.error || 'Failed to generate podcast.';
        res.status(500).json({ message });
    }
});

module.exports = router;