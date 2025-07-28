// server/routes/files.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');

// GET all files for a user (no changes here)
router.get('/', tempAuth, async (req, res) => {
    try {
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- NEW: PATCH route to update a file's name ---
// @route   PATCH /api/files/:id
// @desc    Rename a file
// @access  Private
router.patch('/:id', tempAuth, async (req, res) => {
    const { newOriginalName } = req.body;

    if (!newOriginalName) {
        return res.status(400).json({ msg: 'New name is required.' });
    }

    try {
        let file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ msg: 'File not found' });
        }

        // Make sure user owns the file
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Update the originalname field
        file.originalname = newOriginalName;
        await file.save();

        res.json(file); // Return the updated file object
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


router.delete('/:id', tempAuth, async (req, res) => {
    try {
        console.log(`[DELETE FILE] Attempting to delete file with ID: ${req.params.id}`);
        const file = await File.findById(req.params.id);

        if (!file) {
            console.log(`[DELETE FILE] File not found in DB for ID: ${req.params.id}`);
            return res.status(404).json({ msg: 'File not found in DB' });
        }

        console.log(`[DELETE FILE] Found file: ${file.originalname}, Path: ${file.path}, User: ${file.user}`);
        if (file.user.toString() !== req.user.id) {
            console.log(`[DELETE FILE] Unauthorized attempt to delete file ID: ${req.params.id} by user: ${req.user.id}`);
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Step 1: Delete from disk
        console.log(`[DELETE FILE] Checking if file exists on disk: ${file.path}`);
        if (fs.existsSync(file.path)) {
            try {
                fs.unlinkSync(file.path);
                console.log(`[DELETE FILE] Successfully deleted file from disk: ${file.path}`);
            } catch (diskErr) {
                console.error(`[DELETE FILE] Error deleting file from disk ${file.path}: ${diskErr.message}`);
                return res.status(500).json({ msg: `Could not delete file from disk: ${diskErr.message}` });
            }
        } else {
            console.log(`[DELETE FILE] File not found on disk, skipping disk deletion: ${file.path}`);
        }

        // Step 2: Delete vectors from langchainvectordb
        console.log(`[DELETE FILE] Attempting to delete vectors for file ID: ${req.params.id}`);
        try {
            const { vectorStore } = req.serviceManager.getServices();
            await vectorStore.deleteDocumentsByFileId(req.params.id);
            console.log(`[DELETE FILE] Successfully deleted vectors for file ID: ${req.params.id}`);
        } catch (vectorErr) {
            console.error(`[DELETE FILE] Error deleting vectors for file ID ${req.params.id}: ${vectorErr.message}`);
            // Decide if this error should prevent file deletion from DB. For now, we'll allow it to proceed.
            // return res.status(500).json({ msg: `Could not delete vectors: ${vectorErr.message}` });
        }

        // Step 3: Delete from MongoDB
        console.log(`[DELETE FILE] Attempting to delete file record from MongoDB for ID: ${req.params.id}`);
        try {
            await File.findByIdAndDelete(req.params.id);
            console.log(`[DELETE FILE] Successfully deleted file record from MongoDB for ID: ${req.params.id}`);
        } catch (dbErr) {
            console.error(`[DELETE FILE] Error deleting file record from MongoDB ${req.params.id}: ${dbErr.message}`);
            return res.status(500).json({ msg: `Could not delete file record from DB: ${dbErr.message}` });
        }
        
        res.json({ msg: 'File and all associated data removed' });
    } catch (err) {
        console.error(`[DELETE FILE] General server error during file deletion: ${err.message}`);
        res.status(500).send('Server Error');
    }
});

// --- NEW: POST route to get a file's overview ---
// @route   POST /api/files/overview
// @desc    Generate an overview/summary of a file
// @access  Private
router.post('/overview', tempAuth, async (req, res) => {
    const { fileId } = req.body;

    if (!fileId) {
        return res.status(400).json({ msg: 'File ID is required.' });
    }

    try {
        const file = await File.findById(fileId);

        if (!file) {
            return res.status(404).json({ msg: 'File not found' });
        }

        // Make sure user owns the file
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Use services from the service manager
        const { documentProcessor, geminiAI } = req.serviceManager.getServices();
        const fileContent = await documentProcessor.parseFile(file.path);

        if (!fileContent || fileContent.trim().length < 100) {
             return res.status(400).json({ overview: "The file is too short to generate a meaningful overview." });
        }

        // Use GeminiAI to generate a short summary
        const summary = await geminiAI.generateSummary(fileContent, {
            type: 'short',
            style: 'formal',
            focus: 'the main purpose and key topics of the document'
        });

        res.json({ overview: summary.text });

    } catch (err) {
        console.error('Error generating file overview:', err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;