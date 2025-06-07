// server/routes/files.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware');
const File = require('../models/File');

// GET all files for a user
router.get('/', tempAuth, async (req, res) => {
    try {
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// DELETE a file
router.delete('/:id', tempAuth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ msg: 'File not found in DB' });
        if (file.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

        // Delete file from the filesystem if it exists
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`✅ Deleted file from disk: ${file.path}`);
        } else {
            console.warn(`Could not find file on disk to delete (may already be gone): ${file.path}`);
        }

        // Delete the associated FAISS index for the user
        // A more advanced system would remove only vectors for this file.
        // For this project, re-uploading files will rebuild the index.
        const faissIndexPath = path.join(__dirname, '..', 'faiss_indices', `faiss_index_${req.user.id}`);
        if (fs.existsSync(faissIndexPath)) {
            fs.rmSync(faissIndexPath, { recursive: true, force: true });
            console.log(`✅ Deleted FAISS index for user: ${req.user.id}`);
        }

        // Delete file record from the database
        await File.findByIdAndDelete(req.params.id);
        
        res.json({ msg: 'File and associated data removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'File not found' });
        res.status(500).send('Server Error');
    }
});

module.exports = router;