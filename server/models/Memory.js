// server/models/Memory.js

const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: [true, 'Memory content cannot be empty.'],
        trim: true,
        unique: true, // --- MODIFIED: Ensure content is unique per user to avoid duplicates
        maxlength: [500, 'Memory content cannot exceed 500 characters.']
    },
    category: {
        type: String,
        trim: true,
        default: 'General',
        enum: ['General', 'Personal', 'Professional', 'Project', 'Preferences']
    },
    // --- REMOVED: The 'status' field is no longer needed for autonomous memory ---
}, { timestamps: true });

// --- NEW: Compound index to ensure memory content is unique per user ---
MemorySchema.index({ user: 1, content: 1 }, { unique: true });

module.exports = mongoose.model('Memory', MemorySchema);