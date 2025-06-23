// server/routes/settings.js
const express = require('express');
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { encrypt, decrypt } = require('../services/encryptionService');

const router = express.Router();

// --- GET /api/settings (Unchanged) ---
router.get('/', tempAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('+geminiApiKey +grokApiKey');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const settings = {
            geminiApiKey: user.geminiApiKey ? decrypt(user.geminiApiKey) : '',
            grokApiKey: user.grokApiKey ? decrypt(user.grokApiKey) : '',
            ollamaHost: user.ollamaHost || '',
        };
        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ message: 'Server error while fetching settings.' });
    }
});


// --- POST /api/settings (MODIFIED FOR NEW SPECIFICATION) ---
router.post('/', tempAuth, async (req, res) => {
    const { geminiApiKey, grokApiKey, ollamaHost } = req.body;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // ==================================================================
        //  START OF THE DEFINITIVE FIX
        // ==================================================================

        const isProvidingPersonalKeys = geminiApiKey || grokApiKey;

        if (isProvidingPersonalKeys) {
            console.log(`User ${userId} is providing personal API keys. Resetting API key access status.`);
            
            // If the user provides their own keys, their admin access status is reset.
            // This ensures their personal keys are prioritized from now on.
            user.apiKeyAccessRequest.status = 'none';
            user.apiKeyAccessRequest.requestedAt = null;
            user.apiKeyAccessRequest.processedAt = null;

            if (geminiApiKey) user.geminiApiKey = encrypt(geminiApiKey);
            if (grokApiKey) user.grokApiKey = encrypt(grokApiKey);
            
            user.hasProvidedApiKeys = true;
        }
        
        // ==================================================================
        //  END OF THE DEFINITIVE FIX
        // ==================================================================

        // Update Ollama host regardless of key changes.
        user.ollamaHost = ollamaHost || null; 

        await user.save();

        res.status(200).json({ message: 'Settings saved successfully.' });

    } catch (error) {
        console.error('Error saving user settings:', error);
        res.status(500).json({ message: 'Server error while saving settings.' });
    }
});

module.exports = router;