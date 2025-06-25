// server/routes/files.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');
const vectorStore = require('../services/LangchainVectorStore');

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
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ msg: 'File not found in DB' });
        if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

        // Step 1: Delete from disk
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // Step 2: **Delete vectors from langchainvectordb*
        await vectorStore.deleteDocumentsByFileId(req.params.id);

        // Step 3: Delete from MongoDB
        await File.findByIdAndDelete(req.params.id);
        
        res.json({ msg: 'File and all associated data removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;