// C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Chatbot-geminiV3\server\routes\analysis.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');
const UserFile = require('../models/UserFile'); // Ensure this is imported
require('dotenv').config();

const router = express.Router();
const NOTEBOOK_ANALYSIS_API_URL = process.env.NOTEBOOK_ANALYSIS_API_URL;

async function handleAnalysisRequest(req, res, analysisType) {
    const { filename: clientSentOriginalFilename } = req.body; // Only gets filename
    const user = req.user;

    if (!user || !user._id) {
        return res.status(401).json({ error: 'User authentication required.' });
    }
    if (!clientSentOriginalFilename) {
        return res.status(400).json({ error: 'Original filename is required for analysis.' });
    }

    console.log(`[Node Backend - Reverted] Received ${analysisType.toUpperCase()} request for ORIGINAL file: '${clientSentOriginalFilename}'`);

    try {
        const fileMeta = await UserFile.findOne({
            userId: user._id,
            originalFilename: clientSentOriginalFilename.trim()
        });

        if (!fileMeta) {
            return res.status(404).json({ error: `Metadata for document '${clientSentOriginalFilename}' not found.` });
        }

        const fullServerPath = fileMeta.serverFilePath;

        // The original check, which is fine if the path is correct.
        if (!fs.existsSync(fullServerPath)) {
            return res.status(404).json({ error: `Document file for '${clientSentOriginalFilename}' not found on server.` });
        }

        // --- The ORIGINAL, simple payload ---
        const notebookPayload = {
            analysis_type: analysisType,
            full_file_path: fullServerPath 
        };
        
        console.log(`[Node Backend - Reverted] Forwarding request to Notebook. Payload:`, JSON.stringify(notebookPayload));
        const notebookResponse = await axios.post(NOTEBOOK_ANALYSIS_API_URL, notebookPayload, { timeout: 180000 });

        if (notebookResponse.data && notebookResponse.data.content !== undefined) {
            res.json({
                analysisType: analysisType,
                filename: clientSentOriginalFilename,
                result: notebookResponse.data.content,
                thinking: notebookResponse.data.thinking || "Analysis completed."
            });
        } else {
            const errorDetail = notebookResponse.data?.error || 'Received an invalid response from the analysis service.';
            res.status(500).json({ error: errorDetail });
        }

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || `Failed to perform ${analysisType} analysis.`;
        const status = error.response?.status || 500;
        res.status(status).json({ error: errorMsg });
    }
}


// POST /api/analyze/faq
router.post('/faq', tempAuth, async (req, res) => {
    await handleAnalysisRequest(req, res, 'faq');
});

// POST /api/analyze/topics  // <--- UNCOMMENTED AND IMPLEMENTED
router.post('/topics', tempAuth, async (req, res) => {
    await handleAnalysisRequest(req, res, 'topics');
});

// POST /api/analyze/mindmap // <--- UNCOMMENTED AND IMPLEMENTED
router.post('/mindmap',tempAuth, async (req, res) => {
    await handleAnalysisRequest(req, res, 'mindmap');
});

module.exports = router;