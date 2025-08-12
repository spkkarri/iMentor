// server/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: false,
        unique: true,
        trim: true,
        sparse: true // Allow null/undefined values but enforce uniqueness when present
    },
    password: {
        type: String,
        required: true
    },
    // --- NEW: Field to store the evolving user profile ---
    personalizationProfile: {
        type: String,
        default: ''
    },
    // --- Ollama Configuration ---
    ollamaUrl: {
        type: String,
        default: process.env.OLLAMA_URL || 'http://localhost:11434',
        trim: true,
        validate: {
            validator: function(v) {
                // Basic URL validation
                if (!v) return true; // Allow empty/default
                try {
                    new URL(v);
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Please provide a valid Ollama URL (e.g., http://localhost:11434)'
        }
    },
    // --- User-Specific API Keys ---
    apiKeys: {
        gemini: {
            type: String,
            default: '',
            trim: true
        },
        deepseek: {
            type: String,
            default: '',
            trim: true
        },
        qwen: {
            type: String,
            default: '',
            trim: true
        }
    },
    // --- API Key Preferences ---
    useOwnKeys: {
        type: Boolean,
        default: false // Whether to use user's own keys or admin keys
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// This middleware automatically hashes the password before saving a new user
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error); // Pass errors to the next middleware
    }
});

module.exports = mongoose.model('User', UserSchema);