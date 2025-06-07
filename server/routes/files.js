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


// DELETE a file (no changes here)
router.delete('/:id', tempAuth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ msg: 'File not found in DB' });
        if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`✅ Deleted file from disk: ${file.path}`);
        } else {
            console.warn(`Could not find file on disk to delete: ${file.path}`);
        }

        const faissIndexPath = path.join(__dirname, '..', 'faiss_indices', `faiss_index_${req.user.id}`);
        if (fs.existsSync(faissIndexPath)) {
            fs.rmSync(faissIndexPath, { recursive: true, force: true });
            console.log(`✅ Deleted FAISS index for user: ${req.user.id}`);
        }

        await File.findByIdAndDelete(req.params.id);
        
        res.json({ msg: 'File and associated data removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'File not found' });
        res.status(500).send('Server Error');
    }
});

module.exports = router;