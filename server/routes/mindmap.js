// server/routes/mindmap.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
// --- FIX: Corrected the path to go UP one directory with '..' ---
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');

// @route   POST /api/mindmap/generate
// @desc    Generate a mind map from a file
// @access  Private
router.post('/generate', tempAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication failed." });
    }

    const { fileId } = req.body;
    const userId = req.user.id;

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
            console.error('FATAL: PYTHON_RAG_SERVICE_URL is not set in the environment.');
            return res.status(500).json({ message: 'Server configuration error: RAG service URL is missing.' });
        }

        console.log(`[MindMap] Requesting generation from Python service for file: ${file.path}`);

        const pythonResponse = await axios.post(`${pythonRagUrl}/generate_mindmap`, {
            file_path: file.path
        });

        if (pythonResponse.data && pythonResponse.data.nodes && pythonResponse.data.edges) {
            return res.json(pythonResponse.data);
        } else {
            throw new Error(pythonResponse.data?.error || 'Python service returned an invalid response for mind map.');
        }

    } catch (error) {
        console.error('Error in mind map generation route:', error.response ? error.response.data : error.message);
        const message = error.response?.data?.error || 'An internal server error occurred while generating the mind map.';
        const status = error.response?.status || 500;
        res.status(status).json({ message });
    }
});

module.exports = router;