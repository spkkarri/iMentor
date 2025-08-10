// server/routes/podcast.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const { documentProcessor } = require('../services/serviceManager');
const SimplePodcastGenerator = require('../services/simplePodcastGenerator');
const path = require('path');
const fs = require('fs');

// In-memory podcast script (replace with DB for production)
let podcastScript = [
    // Initial segments...
];

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

        // 4. Use SimplePodcastGenerator to create the podcast script (Gemini AI only)
        const podcastGenerator = new SimplePodcastGenerator();

        // Always use single-host style
        let podcastResult;
        try {
            podcastResult = await podcastGenerator.generateSingleHostPodcast(documentContent, file.originalname);
            console.log(`[Podcast][Debug] Podcast generation result:`, podcastResult);
        } catch (podcastError) {
            console.error(`[Podcast] Error during generation:`, podcastError);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate podcast script.',
                error: podcastError.message
            });
        }

        if (!podcastResult || !podcastResult.success) {
            console.log(`[Podcast] Failed to generate podcast for "${file.originalname}"`);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate podcast script.',
                error: podcastResult?.error || 'Unknown error'
            });
        }

        console.log(`[Podcast] Podcast script generated successfully for "${file.originalname}"`);

        // 5. Send back the podcast data (no audio file, uses browser TTS)
        res.json({
            success: true,
            message: 'Podcast generated successfully!',
            title: podcastResult.title,
            script: podcastResult.script,
            duration_estimate: podcastResult.duration_estimate,
            key_points: podcastResult.key_points,
            instructions: podcastResult.instructions
        });

    } catch (error) {
        console.error('Error generating podcast:', error);
        res.status(500).json({ message: 'Failed to generate podcast.', error: error.message });
    }
});

// @route   POST /api/podcast/ask
// @desc    Ask a question and get a podcast-style answer
// @access  Public
router.post('/ask', async (req, res) => {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    // Generate answer (replace with Gemini/OpenAI integration)
    const answerSegment = {
        speaker: 'Host A',
        text: `Great question! Here's what I think: ${question}`,
        duration: 15,
        focus: 'User Q&A'
    };

    // Append user question and host answer to the script
    podcastScript.push({
        speaker: 'User',
        text: question,
        duration: 10,
        focus: 'User Question'
    });
    podcastScript.push(answerSegment);

    // Regenerate podcast audio
    const audioUrl = await generatePodcastAudio(podcastScript, 'interactive_podcast');

    res.json({
        transcript: podcastScript,
        audioUrl
    });
});

module.exports = router;