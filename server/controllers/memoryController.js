// server/controllers/memoryController.js

const Memory = require('../models/Memory');

// @desc    Get all memories for a user
// @route   GET /api/memory
exports.getMemories = async (req, res) => {
    try {
        const memories = await Memory.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(memories);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a new memory for a user
// @route   POST /api/memory
exports.addMemory = async (req, res) => {
    const { content, category } = req.body;
    if (!content) {
        return res.status(400).json({ message: 'Content is required.' });
    }
    try {
        const newMemory = new Memory({
            user: req.user.id,
            content,
            category: category || 'General',
            status: 'confirmed', // User-added memories are always confirmed
        });
        const memory = await newMemory.save();
        res.status(201).json(memory);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a memory (used for user deletion and rejecting suggestions)
// @route   DELETE /api/memory/:memoryId
exports.deleteMemory = async (req, res) => {
    try {
        const memory = await Memory.findById(req.params.memoryId);
        if (!memory) {
            return res.status(404).json({ message: 'Memory not found.' });
        }
        if (memory.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized.' });
        }
        await memory.deleteOne();
        res.json({ message: 'Memory removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// --- NEW: Confirm a pending memory suggestion ---
// @route   PATCH /api/memory/:memoryId/confirm
exports.confirmMemory = async (req, res) => {
    try {
        const memory = await Memory.findById(req.params.memoryId);
        if (!memory) {
            return res.status(404).json({ message: 'Memory not found.' });
        }
        if (memory.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized.' });
        }
        memory.status = 'confirmed';
        await memory.save();
        res.json(memory);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};