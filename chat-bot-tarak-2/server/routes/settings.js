// server/routes/settings.js
const express = require('express');
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { encrypt, decrypt } = require('../services/encryptionService');

const router = express.Router();

// --- GET /api/settings (Using the more robust version) ---
router.get('/', tempAuth, async (req, res) => {
    try {
        // Also select the access request status to make a better decision.
        const user = await User.findById(req.user.id).select('+geminiApiKey +grokApiKey +ollamaHost +apiKeyAccessRequest');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // If user is approved to use admin keys, we don't need to decrypt their personal keys.
        // This avoids decryption errors if their stored keys are stale or invalid.
        if (user.apiKeyAccessRequest?.status === 'approved') {
            return res.status(200).json({
                geminiApiKey: '', // Return empty as they use admin keys
                grokApiKey: '',   // Return empty as they use admin keys
                ollamaHost: user.ollamaHost || '',
            });
        }

        let decryptedGemini = '';
        let decryptedGrok = '';

        // Safely decrypt Gemini key.
        if (user.geminiApiKey) {
            try {
                decryptedGemini = decrypt(user.geminiApiKey);
            } catch (e) {
                console.warn(`Could not decrypt Gemini key for user ${user._id}: ${e.message}. Treating as empty.`);
                // This is a non-fatal error; we can continue.
            }
        }

        // Safely decrypt Grok key.
        if (user.grokApiKey) {
            try {
                decryptedGrok = decrypt(user.grokApiKey);
            } catch (e) {
                console.warn(`Could not decrypt Grok key for user ${user._id}: ${e.message}. Treating as empty.`);
            }
        }

        const settings = {
            geminiApiKey: decryptedGemini,
            grokApiKey: decryptedGrok,
            ollamaHost: user.ollamaHost || '',
        };
        res.status(200).json(settings);

    } catch (error) {
        // This will now only catch major errors like the DB being down.
        console.error('Error fetching user settings:', error);
        res.status(500).json({ message: 'Server error while fetching settings.' });
    }
});


// --- POST /api/settings (Using the more robust and complete version) ---
router.post('/', tempAuth, async (req, res) => {
    // Trim inputs to prevent saving whitespace-only keys.
    const geminiApiKey = req.body.geminiApiKey?.trim() || '';
    const grokApiKey = req.body.grokApiKey?.trim() || '';
    const ollamaHost = req.body.ollamaHost?.trim() || '';
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isProvidingPersonalKeys = geminiApiKey || grokApiKey;

        // Encrypt and save keys if they are provided. If empty, clear the key.
        user.geminiApiKey = geminiApiKey ? encrypt(geminiApiKey) : null;
        user.grokApiKey = grokApiKey ? encrypt(grokApiKey) : null;
        
        // Update Ollama host. If empty, set to null.
        user.ollamaHost = ollamaHost || null;

        // If the user is providing any personal keys, this implies they are no longer
        // relying on an admin-approved status. We should reset their request status.
        if (isProvidingPersonalKeys) {
            console.log(`User ${userId} is providing personal API keys. Resetting admin access request status.`);
            user.apiKeyAccessRequest.status = 'none';
            user.apiKeyAccessRequest.requestedAt = null;
            user.apiKeyAccessRequest.processedAt = null;
            user.hasProvidedApiKeys = true;
        }

        await user.save();

        res.status(200).json({ message: 'Settings saved successfully.' });

    } catch (error) {
        console.error('Error saving user settings:', error);
        res.status(500).json({ message: 'Server error while saving settings.' });
    }
});

module.exports = router;