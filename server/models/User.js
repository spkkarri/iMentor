// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt } = require('../utils/crypto'); // Import the new encrypt utility

// Profile sub-schema remains the same
const ProfileSchema = new mongoose.Schema({
    name: { type: String, default: '', trim: true },
    college: { type: String, default: '', trim: true },
    universityNumber: { type: String, default: '', trim: true },
    degreeType: { type: String, default: '', trim: true },
    branch: { type: String, default: '', trim: true },
    year: { type: String, default: '', trim: true },
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },
  profile: {
    type: ProfileSchema,
    default: () => ({})
  },
  
  // CORRECTED: Single field for the encrypted API key.
  encryptedApiKey: {
    type: String,
    select: false, // Don't return this field by default in queries
  },
  
  preferredLlmProvider: {
    type: String,
    enum: ['gemini', 'ollama'],
    default: 'gemini',
  },
  ollamaModel: {
    type: String,
    default: process.env.OLLAMA_DEFAULT_MODEL || 'llama3',
  },
  uploadedDocuments: [
    {
      filename: { type: String },
      text: { type: String, default: "" },
      analysis: {
        faq: { type: String, default: "" },
        topics: { type: String, default: "" },
        mindmap: { type: String, default: "" },
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// CORRECTED: Pre-save hook to hash password and ENCRYPT API key
UserSchema.pre('save', async function (next) {
  // Hash password if it has been modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  // Encrypt API key if it has been modified
  if (this.isModified('encryptedApiKey') && this.encryptedApiKey) {
    this.encryptedApiKey = encrypt(this.encryptedApiKey);
  }
  next();
});

// Method to compare password (no change)
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by credentials (no change)
UserSchema.statics.findByCredentials = async function(email, password) {
    const user = await this.findOne({ email }).select('+password');
    if (!user) {
        return null;
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return null;
    }
    return user;
};

const User = mongoose.model('User', UserSchema);
module.exports = User;