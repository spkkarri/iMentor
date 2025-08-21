// server/middleware/keyDecryptionMiddleware.js
const User = require('../models/User');
const encryptionService = require('../services/encryptionService');
const logger = require('../utils/logger');

const keyDecryptionMiddleware = async (req, res, next) => {
    if (!req.user || !req.user._id) {
        logger.warn('keyDecryptionMiddleware: req.user not found. Skipping key decryption.');
        req.decryptedApiKeys = { gemini: null, groq: null };
        return next();
    }

    try {
        // Fetch the user with all relevant fields, including the apiKeyAccessRequest object
        const user = await User.findById(req.user._id).select('+geminiApiKey +groqApiKey +apiKeyAccessRequest');

        if (!user) {
            logger.warn(`keyDecryptionMiddleware: User not found for ID: ${req.user._id}`);
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }
        
        let decryptedApiKeys = { gemini: null, groq: null };

        // SCENARIO 1: User has provided their own keys (This takes highest priority).
        if (user.geminiApiKey || user.groqApiKey) {
            logger.info(`Decrypting user-provided keys for user ${user._id}`);
            decryptedApiKeys = {
                gemini: user.geminiApiKey ? encryptionService.decrypt(user.geminiApiKey) : null,
                groq: user.groqApiKey ? encryptionService.decrypt(user.groqApiKey) : null
            };
        } 
        // SCENARIO 2: User is approved to use the admin's keys.
        // THIS IS THE CORRECTED LOGIC
        else if (user.apiKeyAccessRequest && user.apiKeyAccessRequest.status === 'approved') {
            logger.info(`User ${user._id} is using admin-provided keys.`);
            decryptedApiKeys = {
                gemini: process.env.ADMIN_GEMINI_API_KEY || null, // <-- FIX HERE
                groq: process.env.ADMIN_GROQ_API_KEY || null   // <-- FIX HERE
            };
        }
        // SCENARIO 3: User has no keys and is not approved.
        else {
            logger.info(`User ${user._id} has not provided API keys and is not approved for admin keys.`);
        }

        req.decryptedApiKeys = decryptedApiKeys;
        
        next();

    } catch (error) {
        logger.error({ err: error }, 'Error in keyDecryptionMiddleware');
        return res.status(500).json({ message: 'Server error during key handling' });
    }
};

module.exports = { keyDecryptionMiddleware };