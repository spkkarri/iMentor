// server/routes/memory.js

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const memoryController = require('../controllers/memoryController');

// All routes are protected
router.route('/')
    .get(tempAuth, memoryController.getMemories)
    .post(tempAuth, memoryController.addMemory);

router.route('/:memoryId')
    .delete(tempAuth, memoryController.deleteMemory);

// --- NEW: Route to confirm a pending memory ---
router.route('/:memoryId/confirm')
    .patch(tempAuth, memoryController.confirmMemory);

module.exports = router;