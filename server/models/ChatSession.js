// server/models/ChatSession.js

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    parts: [{
        text: { type: String, required: true }
    }],
    // We don't need to store complex objects like nodes/edges in the DB
    // The type will be enough to know what kind of message it was.
    type: { type: String, default: 'text', enum: ['text', 'audio', 'mindmap'] },
    timestamp: { type: Date, default: Date.now }
});

const ChatSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Conversation' }, // <-- NEW: A title for the chat
    messages: [MessageSchema],
    systemPrompt: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now } // <-- NEW: To sort by most recent
});

// Middleware to update the 'updatedAt' field on save
ChatSessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ChatSession', ChatSessionSchema);