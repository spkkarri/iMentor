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