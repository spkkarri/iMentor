// server/routes/files.js

const express = require('express');
const router = express.Router();
const fs = require('fs'); // Node.js File System module
const path = require('path');
const { tempAuth } = require('../middleware/authMiddleware'); // Using your established auth
const File = require('../models/File');

// @route   GET /api/files
// @desc    Get all files for the logged-in user
// @access  Private
router.get('/', tempAuth, async (req, res) => {
    try {
        // Find all files in the database that belong to the current user
        // req.user.id is attached by the tempAuth middleware
        // We sort by createdAt: -1 to show the newest files first
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        
        // Send the list of files back as a JSON response
        res.json(files);

    } catch (error) {
        console.error('Error fetching user files:', error);
        res.status(500).json({ message: 'Server error while fetching files.' });
    }
});

// @route   DELETE /api/files/:id
// @desc    Delete a file for the logged-in user
// @access  Private
router.delete('/:id', tempAuth, async (req, res) => {
    try {
        // Find the file record in the database by its ID
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found.' });
        }

        // Security Check: Make sure the user trying to delete the file is the one who owns it
        if (file.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized to delete this file.' });
        }

        // 1. Delete the actual file from the server's hard drive
        fs.unlink(file.path, async (err) => {
            if (err) {
                // Log the error, but don't stop. The DB record is the source of truth.
                // This can happen if the file was already manually deleted.
                console.error(`Could not delete file from disk, but will proceed with DB record deletion. Path: ${file.path}`, err);
            }

            // 2. Delete the file's record from the database
            await file.deleteOne(); // Mongoose v6+ uses deleteOne() on the document
            console.log(`Successfully deleted file record from DB: ${file.originalname}`);
            res.json({ message: 'File deleted successfully.' });
        });

    } catch (error) {
        console.error('Error deleting file:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid file ID format.' });
        }
        res.status(500).json({ message: 'Server error while deleting file.' });
    }
});

module.exports = router;