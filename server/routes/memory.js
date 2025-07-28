// server/routes/memory.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { getMemories, addMemory, deleteMemory, confirmMemory } = require('../controllers/memoryController');

// All routes are protected
router.route('/')
    .get(tempAuth, getMemories)
    .post(tempAuth, addMemory);

router.route('/:memoryId')
    .delete(tempAuth, deleteMemory);

// --- NEW: Route to confirm a pending memory ---
router.route('/:memoryId/confirm')
    .patch(tempAuth, confirmMemory);

module.exports = router;