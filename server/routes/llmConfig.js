// server/routes/llmConfig.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { encrypt } = require('../utils/crypto');

router.put('/config', async (req, res) => {
    const { llmProvider, apiKey } = req.body;
    const userId = req.user._id;

    try {
        const updates = {};
        if (llmProvider) updates.preferredLlmProvider = llmProvider;
        if (apiKey) updates.encryptedApiKey = encrypt(apiKey);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No update information provided." });
        }
        
        await User.updateOne({ _id: userId }, { $set: updates });
        res.status(200).json({ message: "LLM preferences updated successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error while updating LLM preferences." });
    }
});
module.exports = router;