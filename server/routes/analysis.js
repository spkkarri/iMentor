// server/routes/analysis.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET /api/analysis/:documentFilename
// @desc    Get analysis data (faq, topics, mindmap) for a specific document
// @access  Private (requires auth)
router.get('/:documentFilename', authMiddleware, async (req, res) => {
    const userId = req.user._id; // From authMiddleware
    const { documentFilename } = req.params;
    
    if (!documentFilename) {
        return res.status(400).json({ message: 'Document filename parameter is required.' });
    }

    try {
        const user = await User.findById(userId).select('uploadedDocuments');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const document = user.uploadedDocuments.find(doc => doc.filename === documentFilename);

        if (!document) {
            return res.status(404).json({ message: `Document '${documentFilename}' not found for this user.` });
        }

        if (!document.analysis) {
            // This case might happen if the analysis object itself is missing, though schema has defaults.
            console.warn(`Analysis object missing for document '${documentFilename}', user '${userId}'. Sending empty analysis.`);
            return res.status(200).json({
                faq: "",
                topics: "",
                mindmap: ""
            });
        }
        
        // Send the analysis sub-document
        res.status(200).json(document.analysis);

    } catch (error) {
        console.error(`Error fetching analysis for document '${documentFilename}', user '${userId}':`, error);
        res.status(500).json({ message: 'Server error while retrieving document analysis.' });
    }
});

module.exports = router;