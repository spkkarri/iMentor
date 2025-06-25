// server/routes/mindmap.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
// --- FIX: Corrected the path to go UP one directory with '..' ---
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const AIService = require('../services/aiService');
const MindMapGenerator = require('../services/mindMapGenerator');
const DocumentProcessor = require('../services/documentProcessor');

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
        // Add file existence check
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

        console.log(`[MindMap] Requesting generation from local AI service for file: ${file.path}`);

        // Use DocumentProcessor to extract text from any file type
        // Pass a dummy vectorStore since we only need text extraction
        const dummyVectorStore = { addDocuments: async () => ({ count: 0 }), getStatistics: async () => ({}) };
        const docProcessor = new DocumentProcessor(dummyVectorStore);
        const fileContent = await docProcessor.parseFile(file.path);
        
        if (!fileContent || fileContent.trim().length === 0) {
            return res.status(400).json({ message: 'File is empty or contains no readable content.' });
        }

        let mindMapData = null;
        
        // Try AI generation first
        try {
            // Create an instance of AIService
            const aiService = require('../services/aiService');
            mindMapData = await aiService.generateMindMapData(fileContent, file.originalname);
        } catch (aiError) {
            console.warn('[MindMap] AI generation failed, using fallback:', aiError.message);
        }

        // If AI generation failed or returned invalid data, use fallback
        if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
            console.log('[MindMap] Using enhanced fallback mind map generation');
            // Try hierarchical generation first, then basic, then simple fallback
            try {
                mindMapData = MindMapGenerator.createHierarchicalMindMap(fileContent);
                if (!mindMapData.nodes || mindMapData.nodes.length === 0) {
                    mindMapData = MindMapGenerator.createBasicMindMap(fileContent);
                }
            } catch (hierarchicalError) {
                console.warn('[MindMap] Hierarchical generation failed, using basic:', hierarchicalError.message);
                mindMapData = MindMapGenerator.createBasicMindMap(fileContent);
            }
            
            // If still no data, use simple fallback
            if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
                mindMapData = MindMapGenerator.createFallbackMindMap(fileContent);
            }
        }

        // Use MindMapGenerator to format the data for React Flow
        try {
            const formattedMindMapData = MindMapGenerator.formatForReactFlow(mindMapData);
            
            // Validate the formatted data
            if (!formattedMindMapData.nodes || formattedMindMapData.nodes.length === 0) {
                throw new Error('No nodes generated in mind map');
            }

            console.log(`[MindMap] Successfully generated mind map with ${formattedMindMapData.nodes.length} nodes and ${formattedMindMapData.edges.length} edges`);
            
            return res.json(formattedMindMapData);
        } catch (formatError) {
            console.error('[MindMap] Error formatting mind map data:', formatError);
            
            // Try basic mind map as last resort
            const basicMindMap = MindMapGenerator.createBasicMindMap(fileContent);
            return res.json(basicMindMap);
        }
    } catch (error) {
        console.error('Error in mind map generation route:', error.message);
        const message = 'An internal server error occurred while generating the mind map.';
        res.status(500).json({ message });
    }
});

module.exports = router;