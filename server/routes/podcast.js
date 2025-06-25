// server/routes/podcast.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const { documentProcessor, geminiAI } = require('../services/serviceManager');
const { generatePodcastAudio } = require('../services/podcastGenerator');
const path = require('path');
const fs = require('fs');

// @route   POST /api/podcast/generate
// @desc    Generate a podcast from a file
// @access  Private
router.post('/generate', tempAuth, async (req, res) => {
    const { fileId } = req.body;
    const userId = req.user.id;

    if (!fileId) {
        return res.status(400).json({ message: 'File ID is required.' });
    }

    try {
        console.log(`[Podcast] Generation request for fileId: ${fileId}`);

        // 1. Find the file in the database
        const file = await File.findOne({ _id: fileId, user: userId });
        if (!file) {
            console.log(`[Podcast] File not found for id: ${fileId}`);
            return res.status(404).json({ message: 'File not found.' });
        }

        // 2. Ensure the file exists on disk
        if (!fs.existsSync(file.path)) {
            console.log(`[Podcast] File not found on disk: ${file.path}`);
            return res.status(404).json({ message: 'File not found on disk.' });
        }

        // 3. Process the document to get its text content
        // We use the documentProcessor's parsing capabilities
        const doc = await documentProcessor.parseFile(file.path, file.mimetype);
        // Support both string and object returns from parseFile
        let documentContent = '';
        if (typeof doc === 'string') {
            documentContent = doc;
        } else if (doc && typeof doc.pageContent === 'string') {
            documentContent = doc.pageContent;
        } else {
            documentContent = '';
        }
        // Add debug log for doc result
        console.log(`[Podcast][Debug] Parsed document:`, doc);
        if (documentContent) {
            console.log(`[Podcast][Debug] Document content length: ${documentContent.length}`);
            if (documentContent.length < 500) {
                console.log(`[Podcast][Debug] Document content preview:`, documentContent);
            }
        } else {
            console.log(`[Podcast][Debug] No document content extracted.`);
        }

        if (!documentContent || documentContent.trim().length < 500) {
            console.log(`[Podcast] Not enough content in file ${fileId} to generate a podcast.`);
            return res.status(400).json({ message: 'The document does not have enough content to generate a podcast.' });
        }
        
        console.log(`[Podcast] Generating script for "${file.originalname}"...`);

        // 4. Use GeminiAI service to generate the podcast script
        const script = await geminiAI.generatePodcastScript(documentContent);
        // Add debug log for script
        console.log(`[Podcast][Debug] Podcast script:`, script);

        console.log(`[Podcast] Script generated. Generating audio...`);

        // 5. Use the podcastGenerator service to create the audio file
        const podcastUrl = await generatePodcastAudio(script, file.originalname);
        // Add debug log for podcastAudio
        console.log(`[Podcast][Debug] Podcast audio result:`, podcastUrl);
        
        console.log(`[Podcast] Audio generated and saved at ${podcastUrl}`);

        // 6. Send back the path to the generated podcast
        res.json({
            message: 'Podcast generated successfully!',
            podcastUrl: podcastUrl,
            script: script, // Optionally return the script
        });

    } catch (error) {
        console.error('Error generating podcast:', error);
        res.status(500).json({ message: 'Failed to generate podcast.', error: error.message });
    }
});

module.exports = router;