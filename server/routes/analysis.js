// FusedChatbot/server/routes/analysis.js
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');

const router = express.Router();
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
const logger = console; // Using console for logging as established in the project

const sanitizeForPath = (name) => name.replace(/[^a-zA-Z0-9_-]/g, '_');
const determineFileTypeSubfolder = (originalFilename) => {
    const ext = path.extname(originalFilename).toLowerCase();
    if (['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt'].includes(ext)) return 'docs';
    if (['.py', '.js', '.md', '.html', '.xml', '.json', '.csv', '.log'].includes(ext)) return 'code';
    if (['.jpg', '.jpeg', '.png', '.bmp', '.gif'].includes(ext)) return 'images';
    return 'others';
};

router.post('/document', tempAuth, async (req, res) => {
    const { documentName, serverFilename, analysisType, llmProvider, llmModelName } = req.body;
    const userId = req.user._id.toString();
    const sanitizedUsername = sanitizeForPath(req.user.username || 'unknown_user');

    if (!documentName || !serverFilename || !analysisType) {
        return res.status(400).json({ message: 'Missing required analysis fields.' });
    }
    if (!PYTHON_AI_SERVICE_URL) {
        return res.status(500).json({ message: "AI Service communication error." });
    }

    try {
        const user = await User.findById(userId).select('+geminiApiKey +grokApiKey +apiKeyAccessRequest +ollamaHost');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

         const keysForPython = {
            gemini: null,
            grok: null,
            ollama_host: null  // ✅ include this
        };

        const selectedLlmProvider = llmProvider || 'gemini';

        if (user.apiKeyAccessRequest?.status === 'approved') {
            logger.info(`>>> [Analysis] User ${userId} is using ADMIN keys.`);
            keysForPython.gemini = process.env.ADMIN_GEMINI_API_KEY;
            keysForPython.grok = process.env.ADMIN_GROQ_API_KEY;
        } else {
            logger.info(`>>> [Analysis] User ${userId} is using PERSONAL keys.`);
            if (user.geminiApiKey) keysForPython.gemini = decrypt(user.geminiApiKey);
            if (user.grokApiKey) keysForPython.grok = decrypt(user.grokApiKey);
        }

        if (selectedLlmProvider.startsWith('gemini') && !keysForPython.gemini) {
            return res.status(400).json({ message: "Analysis Error: A required Gemini API key was not available." });
        }
        if (selectedLlmProvider.startsWith('groq') && !keysForPython.grok) {
            return res.status(400).json({ message: "Analysis Error: A required Grok API key was not available." });
        }

        // ✅ FIX: resolve user's Ollama host or fallback to env
        const ollamaHost = user.ollamaHost || process.env.DEFAULT_OLLAMA_HOST || null;

        const fileTypeSubfolder = determineFileTypeSubfolder(documentName);
        const absoluteFilePath = path.resolve(__dirname, '..', 'assets', sanitizedUsername, fileTypeSubfolder, serverFilename);

        if (!fs.existsSync(absoluteFilePath)) {
            logger.error(`[NODE.JS-ERROR] File not found at constructed path: ${absoluteFilePath}`);
            return res.status(404).json({ message: `File system error: Document '${documentName}' could not be located on the server.` });
        }

        const pythonPayload = {
            user_id: userId,
            document_name: documentName,
            analysis_type: analysisType,
            file_path_for_analysis: absoluteFilePath,
            llm_provider: selectedLlmProvider,
            llm_model_name: llmModelName,
            api_keys: keysForPython,
            ollama_host: ollamaHost
        };
        console.log('[DEBUG] /analysis/document payload ollama_host:', pythonPayload.ollama_host);

        const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/analyze_document`, pythonPayload, { timeout: 180000 });

        if (pythonResponse.data?.status !== 'success') {
            throw new Error(pythonResponse.data?.error || "Failed to get valid analysis from AI service.");
        }

        res.status(200).json(pythonResponse.data);

    } catch (error) {
        logger.error(`!!! Node.js: Error in /analyze_document for ${documentName}:`, error.response?.data || error.message || error);
        res.status(error.response?.status || 500).json({ message: error.response?.data?.error || "Failed to perform document analysis." });
    }
});


module.exports = router;