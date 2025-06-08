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
    const { filename: clientSentOriginalFilename } = req.body; // This is the ORIGINAL filename
    const user = req.user;

    if (!user || !user._id) { // Check for user and user._id
        console.error(`[Node Backend - Analysis Route] Error for ${analysisType.toUpperCase()}: User not properly authenticated or ID missing.`);
        return res.status(401).json({ error: 'User authentication required.' });
    }
    if (!clientSentOriginalFilename || typeof clientSentOriginalFilename !== 'string' || clientSentOriginalFilename.trim() === '') {
        console.error(`[Node Backend - Analysis Route] Error: Original filename missing for ${analysisType.toUpperCase()} by User ID: ${user._id}.`);
        return res.status(400).json({ error: 'Original filename is required for analysis.' });
    }
    if (!NOTEBOOK_ANALYSIS_API_URL) { /* ... existing check ... */ }

    console.log(`[Node Backend - Analysis Route] Received ${analysisType.toUpperCase()} request for ORIGINAL file: '${clientSentOriginalFilename}' by User ID: ${user._id}`);

    try {
        // --- Fetch File Metadata from DB using userId and ORIGINAL filename ---
        
        console.log(`[ANALYSIS.JS PRE-QUERY] Querying DB for: userId=${user._id}, originalFilename='${clientSentOriginalFilename.trim()}'`);
        const fileMeta = await UserFile.findOne({
            userId: user._id,
            originalFilename: clientSentOriginalFilename.trim() // Query by original name
        });

        if (!fileMeta) {
            console.error(`[Node Backend - Analysis Route] File metadata NOT FOUND in DB for: User ${user._id}, Original Filename '${clientSentOriginalFilename}'`);
            return res.status(404).json({ error: `Metadata for document '${clientSentOriginalFilename}' not found. Has it been uploaded and processed correctly?` });
        }

        // --- Use the serverFilePath and serverFilename from the metadata ---
        const fullServerPath = fileMeta.serverFilePath; // This is the ABSOLUTE path stored during upload
        const actualServerFilename = fileMeta.serverFilename; // This is the TIMESTAMPED name on disk

        console.log(`[Node Backend - Analysis Route] Retrieved from DB - Server Filename: '${actualServerFilename}', Full Server Path: '${fullServerPath}'`);

        if (!fs.existsSync(fullServerPath)) {
            console.error(`[Node Backend - Analysis Route] SERVER-SIDE FILE NOT FOUND at stored path: ${fullServerPath}. DB metadata might be stale or file was moved/deleted.`);
            return res.status(404).json({ error: `Document file for '${clientSentOriginalFilename}' (expected at '${actualServerFilename}') not found on server. Path checked: ${fullServerPath}` });
        }
        console.log(`[Node Backend - Analysis Route] File confirmed by Node.js to exist at: ${fullServerPath}`);

        const notebookPayload = {
            analysis_type: analysisType,
            full_file_path: fullServerPath // Send the correct ABSOLUTE path to the file on disk
        };
        
        console.log(`[Node Backend - Analysis Route] Forwarding ${analysisType.toUpperCase()} request to Notebook. Payload:`, JSON.stringify(notebookPayload));
        const startTime = Date.now();
        const notebookResponse = await axios.post(NOTEBOOK_ANALYSIS_API_URL, notebookPayload, { /* ...headers, timeout... */ });
        const endTime = Date.now();
        console.log(`[Node Backend - Analysis Route] Notebook response for ${analysisType.toUpperCase()} on '${actualServerFilename}' in ${endTime - startTime} ms. Status: ${notebookResponse.status}`);

        if (notebookResponse.data && notebookResponse.data.content !== undefined) {
            res.json({
                analysisType: analysisType,
                filename: clientSentOriginalFilename, // Return original filename to client for consistency
                result: notebookResponse.data.content,
                thinking: notebookResponse.data.thinking || "Analysis completed."
            });
        } else if (notebookResponse.data && notebookResponse.data.error) {
            // ... (your existing error handling for notebookResponse) ...
             console.error(`[Node Backend - Analysis Route] Python Notebook API error for ${analysisType.toUpperCase()} on '${actualServerFilename}':`, notebookResponse.data.error);
            res.status(notebookResponse.status || 500).json({ 
                error: `Analysis service (${analysisType}) reported: ${notebookResponse.data.error}`,
                details: notebookResponse.data.thinking || null
            });
        } else {
            // ... (your existing unexpected response handling) ...
            console.error(`[Node Backend - Analysis Route] Unexpected Notebook response format for ${analysisType.toUpperCase()} on '${actualServerFilename}'. Data:`, notebookResponse.data);
            res.status(500).json({ error: 'Received an unexpected response format from the analysis service.' });
        }

    } catch (error) { // This catch block handles DB errors or errors before calling axios
        const logFilenameForError = clientSentOriginalFilename || "Unknown file";
        console.error(`[Node Backend - Analysis Route] Error in analysis request pipeline for ${analysisType.toUpperCase()} on '${logFilenameForError}':`, error);
        
        let errorMsg = `Failed to perform ${analysisType} analysis. An unexpected server error occurred.`;
        let status = 500;

        // Refine error messages based on where the error might have occurred
        if (error.code === 'ECONNREFUSED') { /* ... */ }
        else if (error.code === 'ETIMEDOUT' || (error.isAxiosError && error.message.toLowerCase().includes('timeout'))) { /* ... */ }
        else if (error.isAxiosError && error.response) { /* This case is for when Notebook app returns an error status */
            errorMsg = error.response.data?.error || error.response.data?.message || `Analysis service responded with status ${error.response.status}`;
            status = error.response.status;
        } else if (error.isAxiosError && error.request) { /* ... */ }
        else { /* Default if not an Axios error, e.g. DB error */ errorMsg = `Server error while processing analysis for '${logFilenameForError}': ${error.message}`; }
        
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