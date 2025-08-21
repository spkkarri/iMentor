// server/routes/podcast.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const { tempAuth } = require('../middleware/authMiddleware');
const { keyDecryptionMiddleware } = require('../middleware/keyDecryptionMiddleware');
const Podcast = require('../models/Podcast'); // <-- IMPORT THE PODCAST MODEL

const upload = multer({ storage: multer.memoryStorage() });
const AI_CORE_SERVICE_URL = process.env.AI_CORE_URL || 'http://localhost:9000';

// HANDLER 1: For File Uploads
router.post('/generate/file', tempAuth, keyDecryptionMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded.' });
        
        const { title } = req.body;
        const form = new FormData();
        form.append('file', req.file.buffer, { filename: req.file.originalname });
        form.append('title', title || 'AI Generated Podcast');
        form.append('api_keys', JSON.stringify(req.decryptedApiKeys));

        const responseFromAI = await axios.post(`${AI_CORE_SERVICE_URL}/podcast/generate/file`, form, {
            headers: { ...form.getHeaders() },
        });

        // ================== ADD THIS NEW BLOCK ==================
        const { podcastId, audioUrl } = responseFromAI.data;
        const newPodcast = new Podcast({
            userId: req.user._id,
            podcastId,
            title: title || 'AI Generated Podcast',
            audioUrl
        });
        await newPodcast.save();
        // ========================================================

        res.json(responseFromAI.data);
    } catch (error) {
        console.error('Error in /podcast/generate/file route:', error.message);
        if (error.response) {
            console.error('Downstream service error data:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ msg: 'Server error while generating podcast from file' });
    }
});

// HANDLER 2: For JSON
router.post('/generate/json', tempAuth, keyDecryptionMiddleware, async (req, res) => {
    try {
        const { inputType, inputData, title } = req.body;
        if (!inputType || !inputData) return res.status(400).json({ msg: 'inputType and inputData are required.' });

        const responseFromAI = await axios.post(`${AI_CORE_SERVICE_URL}/podcast/generate/json`, {
            inputType,
            inputData,
            title: title || 'AI Generated Podcast',
            api_keys: req.decryptedApiKeys 
        });

        // ================== ADD THIS NEW BLOCK ==================
        const { podcastId, audioUrl } = responseFromAI.data;
        const newPodcast = new Podcast({
            userId: req.user._id,
            podcastId,
            title: title || 'AI Generated Podcast',
            audioUrl
        });
        await newPodcast.save();
        // ========================================================

        res.json(responseFromAI.data);
    } catch (error) {
        console.error('Error in /podcast/generate/json route:', error.message);
        if (error.response) {
            console.error('Downstream service error data:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ msg: 'Server error while generating podcast from text/url' });
    }
});

// The /ask route uses the middleware for keys
router.post('/ask', tempAuth, keyDecryptionMiddleware, async (req, res) => {
    try {
        const { podcastId, question } = req.body;
        if (!podcastId || !question) return res.status(400).json({ msg: 'podcastId and question are required.' });
        
        const responseFromAI = await axios.post(`${AI_CORE_SERVICE_URL}/podcast/ask`, {
            podcastId, 
            question, 
            api_keys: req.decryptedApiKeys, 
        });
        res.json(responseFromAI.data);
    } catch (error) {
        console.error('Error in /podcast/ask route:', error.message);
        if (error.response) {
            console.error('Downstream service error data:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ msg: 'Server error while asking question' });
    }
});

module.exports = router;