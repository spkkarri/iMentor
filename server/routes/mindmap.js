// server/routes/mindmap.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const MindMapGenerator = require('../services/mindMapGenerator');
const universalAI = require('../services/universalAIService');

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
        const fsPath = file?.path;
        let fileExists = false;
        if (fsPath) {
            try {
                await fs.access(fsPath);
                fileExists = true;
            } catch (e) {
                fileExists = false;
            }
        }
        if (!file || !fileExists) {
            return res.status(404).json({ message: 'File not found on server. Please re-upload.' });
        }

        const { documentProcessor, geminiAI } = req.serviceManager.getServices();
        const fileContent = await documentProcessor.parseFile(file.path);
        console.log(`[MindMap] File content length: ${fileContent ? fileContent.length : 0}`);
        
        if (!fileContent || fileContent.trim().length === 0) {
            return res.status(400).json({ message: 'File is empty or contains no readable content.' });
        }

        let mermaidData = null;

        try {
            console.log('[MindMap] Attempting AI generation...');

            // Get selected model from request
            const selectedModel = req.body.selectedModel || 'gemini-flash';
            const userId = req.headers['x-user-id'] || req.user?.id;
            console.log(`[MindMap] Using model: ${selectedModel} for user: ${userId}`);

            mermaidData = await universalAI.generateMindMapFromTranscript(fileContent, file.originalname, selectedModel, userId);
            console.log('[MindMap] AI generation successful');
        } catch (aiError) {
            console.warn('[MindMap] AI generation failed, using fallback:', aiError.message);
            mermaidData = MindMapGenerator.createMermaidFallback(fileContent, file.originalname);
        }

        if (!mermaidData || typeof mermaidData !== 'string' || !mermaidData.trim().startsWith('mindmap')) {
            console.log('[MindMap] AI response was invalid or missing "mindmap" prefix, using final fallback.');
            console.log('[MindMap] Invalid response:', mermaidData);
            mermaidData = MindMapGenerator.createMermaidFallback(fileContent, file.originalname);
        }

        console.log(`[MindMap] Successfully generated Mermaid syntax for mind map.`);
        console.log(`[MindMap] Full Mermaid data:\n${mermaidData}`); // Keep this uncommented for debugging

        // Return both mermaid data and file content for the client
        return res.json({
            mermaidData,
            fileContent: fileContent
        });

    } catch (error) {
        console.error('[MindMap] Error in mind map generation route:', error.message, error.stack);
        const message = 'An internal server error occurred while generating the mind map.';
        res.status(500).json({ message });
    }
});

module.exports = router;