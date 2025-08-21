// server/routes/planner.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');
const { keyDecryptionMiddleware } = require('../middleware/keyDecryptionMiddleware');

const AI_CORE_SERVICE_URL = process.env.AI_CORE_URL || 'http://localhost:9000';

/**
 * @route   POST /api/planner/generate
 * @desc    Generate a personalized study plan
 * @access  Private
 */
router.post('/generate', [tempAuth, keyDecryptionMiddleware], async (req, res) => {
    try {
        const { tasks, days, hoursPerDay } = req.body;

        if (!tasks || !days || !hoursPerDay) {
            return res.status(400).json({ msg: 'Tasks, days, and hoursPerDay are required fields.' });
        }

        // The keyDecryptionMiddleware has already prepared req.decryptedApiKeys for us.
        
        const responseFromAI = await axios.post(`${AI_CORE_SERVICE_URL}/planner/generate`, {
            tasks,
            days,
            hoursPerDay,
            api_keys: req.decryptedApiKeys // Pass the decrypted keys to the Python service
        });

        // Forward the JSON plan from the Python service directly to the client.
        res.json(responseFromAI.data);

    } catch (error) {
        console.error('Error in /planner/generate route:', error.message);
        if (error.response) {
            console.error('Downstream service error data:', error.response.data);
            // Forward the specific error from the Python service
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ msg: 'Server error while generating study plan' });
    }
});

module.exports = router;