// server/routes/audio.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const UserFile = require('../models/UserFile'); // Assuming you have this model
const { tempAuth } = require('../middleware/authMiddleware');

const AUDIO_SERVICE_URL = process.env.AUDIO_SERVICE_URL || 'http://localhost:5004';

// This endpoint is called by the React client
router.post('/generate', tempAuth, async (req, res) => {
    const { serverFilename } = req.body;
    const userId = req.user._id.toString();

    if (!serverFilename) {
        return res.status(400).json({ error: 'Missing serverFilename in request body.' });
    }

    console.log(`[Node Audio Route] Received request to generate podcast for file: ${serverFilename}`);

    try {
        // 1. Find the file's metadata in the database to get its full path
        const fileDoc = await UserFile.findOne({ userId: userId, serverFilename: serverFilename });

        if (!fileDoc) {
            return res.status(404).json({ error: 'File not found or you do not have permission to access it.' });
        }

        const fullFilePath = fileDoc.serverFilePath;
        console.log(`[Node Audio Route] Found file path: ${fullFilePath}`);

        // 2. Command the Python audio_service to do the heavy lifting
        console.log(`[Node Audio Route] Sending task to Python audio_service at ${AUDIO_SERVICE_URL}`);
        const audioServiceResponse = await axios.post(`${AUDIO_SERVICE_URL}/generate-conversational`, {
            file_path: fullFilePath,
            // We could add more options here in the future, like 'voice' or 'mode'
        }, { timeout: 600000 }); // 10 minute timeout for potentially long audio generation

        if (audioServiceResponse.data && audioServiceResponse.data.audioUrl) {
            console.log(`[Node Audio Route] Python service succeeded. Returning public URL: ${audioServiceResponse.data.audioUrl}`);
            // 3. Return the public URL to the React client
            res.status(200).json({
                message: 'Podcast generation started successfully!',
                audioUrl: audioServiceResponse.data.audioUrl
            });
        } else {
            throw new Error('Audio service did not return a valid audio URL.');
        }

    } catch (error) {
        let errorMessage = "Failed to generate podcast.";
        if (error.response) { // Error from the axios call to the Python service
            console.error('[Node Audio Route] Error from Python audio_service:', error.response.data);
            errorMessage = error.response.data.error || 'An unknown error occurred in the audio service.';
        } else { // Other errors (e.g., DB lookup, timeout)
            console.error('[Node Audio Route] General error:', error.message);
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

module.exports = router;