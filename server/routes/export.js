// server/routes/export.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');

// Note: authMiddleware will be applied to this router in server.js

// @route   POST /api/export/podcast
// @desc    Generate a podcast from a document analysis
// @access  Private
router.post('/podcast', async (req, res) => {
    const { analysisContent, sourceDocumentName, podcastOptions } = req.body;
    const userId = req.user._id;

    if (!analysisContent || !sourceDocumentName || !podcastOptions) {
        return res.status(400).json({ message: 'analysisContent, sourceDocumentName, and podcastOptions are required.' });
    }

    try {
        let sourceDocumentText = null;

        // Unified lookup for the document text
        const user = await User.findById(userId).select('uploadedDocuments.filename uploadedDocuments.text');
        const userDoc = user?.uploadedDocuments.find(doc => doc.filename === sourceDocumentName);
        if (userDoc && userDoc.text) {
            sourceDocumentText = userDoc.text;
        } else {
            const adminDoc = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text');
            if (adminDoc && adminDoc.text) {
                sourceDocumentText = adminDoc.text;
            }
        }
        
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Audio generation service is not configured." });
        }

        const generationUrl = `${pythonServiceUrl}/export_podcast`;
        
        console.log(`[Node Export] Forwarding podcast request to Python: ${generationUrl}`);
        const fileResponse = await axios.post(generationUrl, {
            sourceDocumentText: sourceDocumentText,
            outlineContent: analysisContent, // The original analysis content is used as the 'study_focus'
            podcastOptions: podcastOptions
        }, {
            responseType: 'stream', // Crucial for handling file streams
            timeout: 600000 // 10 minute timeout for script generation and TTS
        });

        // Stream the audio file directly back to the client
        const filename = `Study-Podcast-${sourceDocumentName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        fileResponse.data.pipe(res);

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || "Failed to generate podcast.";
        console.error(`[Node Export] Error proxying podcast generation: ${errorMsg}`);
        // Ensure error is sent as JSON, not streamed HTML/text
        if (!res.headersSent) {
            res.status(500).json({ message: errorMsg });
        }
    }
});

module.exports = router;