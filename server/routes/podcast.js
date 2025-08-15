// server/routes/podcast.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const { documentProcessor } = require('../services/serviceManager');
const SimplePodcastGenerator = require('../services/simplePodcastGenerator');
const TextToSpeechService = require('../services/textToSpeech');
const universalAI = require('../services/universalAIService');
const path = require('path');
const fs = require('fs');

// Initialize services
const ttsService = new TextToSpeechService();

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

        // 4. Generate podcast script using selected model
        const selectedModel = req.body.selectedModel || 'gemini-flash';
        console.log(`[Podcast] Using model: ${selectedModel} for user: ${userId}`);

        // Generate podcast script using selected model
        let podcastResult;
        try {
            console.log(`[Podcast] Generating podcast using model: ${selectedModel}`);

            // Use SimplePodcastGenerator for both Gemini and Ollama models
            const podcastGenerator = new SimplePodcastGenerator(selectedModel, userId);
            await podcastGenerator.initialize();
            const result = await podcastGenerator.generateSingleHostPodcast(documentContent, file.originalname);

            // Format the result
            podcastResult = {
                success: true,
                title: result.title || `Podcast: ${file.originalname}`,
                script: result.script,
                word_count: result.word_count || result.script.split(' ').length,
                duration_estimate: result.estimated_duration || result.duration_estimate || Math.ceil(result.script.split(' ').length / 150) + " minutes",
                key_points: result.key_points || ["Generated using " + selectedModel],
                format: result.format || "single-host",
                model: result.model || selectedModel,
                note: result.note || null
            };


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

        // 5. Generate MP3 audio file
        try {
            const audioFilename = `podcast_${fileId}_${Date.now()}`;
            console.log(`[Podcast] Generating MP3 audio for: ${audioFilename}`);

            const audioPath = await ttsService.generateAudio(podcastResult.script, audioFilename);
            const audioUrl = ttsService.getAudioUrl(audioFilename);
            const fileSize = ttsService.getFileSize(audioFilename);

            console.log(`[Podcast] MP3 generated successfully: ${audioUrl} (${fileSize}MB)`);

            // 6. Send back the podcast data with MP3 file
            res.json({
                success: true,
                message: 'Podcast MP3 generated successfully!',
                title: podcastResult.title,
                script: podcastResult.script,
                audioUrl: audioUrl,
                audioPath: audioPath,
                fileSize: `${fileSize}MB`,
                duration_estimate: podcastResult.duration_estimate,
                key_points: podcastResult.key_points,
                instructions: 'Click the audio player below to listen to your podcast!'
            });
        } catch (audioError) {
            console.error(`[Podcast] Audio generation failed:`, audioError);

            // Fallback: Send script without audio
            res.json({
                success: true,
                message: 'Podcast script generated! (Audio generation failed - using text fallback)',
                title: podcastResult.title,
                script: podcastResult.script,
                duration_estimate: podcastResult.duration_estimate,
                key_points: podcastResult.key_points,
                instructions: 'Use your browser\'s text-to-speech or copy the script below.',
                audioError: audioError.message
            });
        }

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

// @route   POST /api/podcast/test
// @desc    Test podcast generation with sample content
// @access  Public
router.post('/test', async (req, res) => {
    try {
        console.log('[Podcast Test] Testing podcast generation...');

        const testContent = `
        Artificial Intelligence is transforming our world in remarkable ways.
        From healthcare to transportation, AI systems are helping us solve complex problems
        and make better decisions. Machine learning algorithms can analyze vast amounts of data
        to identify patterns and predict outcomes. This technology is enabling breakthroughs
        in medical diagnosis, autonomous vehicles, and personalized education.
        `;

        const selectedModel = req.body.selectedModel || 'gemini-flash';
        const userId = req.body.userId || null;

        const podcastGenerator = new SimplePodcastGenerator(selectedModel, userId);
        await podcastGenerator.initialize();
        const result = await podcastGenerator.generateSingleHostPodcast(testContent, 'AI_Test');

        // Generate audio
        const audioFilename = `test_podcast_${Date.now()}`;
        const audioPath = await ttsService.generateAudio(result.script, audioFilename);
        const audioUrl = ttsService.getAudioUrl(audioFilename);
        const fileSize = ttsService.getFileSize(audioFilename);

        res.json({
            success: true,
            message: 'Test podcast generated successfully!',
            title: result.title,
            script: result.script,
            audioUrl: audioUrl,
            fileSize: `${fileSize}MB`,
            duration_estimate: result.estimated_duration || result.duration_estimate,
            test: true
        });

    } catch (error) {
        console.error('[Podcast Test] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Test podcast generation failed',
            error: error.message
        });
    }
});

module.exports = router;