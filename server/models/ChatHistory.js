// server/models/ChatHistory.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessagePartSchema = new Schema({
    text: {
        type: String,
        required: true
    }
}, { _id: false });

const MessageSchema = new Schema({
    role: {
        type: String,
        enum: ['user', 'model'], // Ensure your application uses these roles consistently
        required: true
    },
    parts: [MessagePartSchema],
    timestamp: {
        type: Date,
        default: Date.now
    },
    references: {
        type: Array,
        default: undefined
    },
    thinking: {
        type: String,
        default: undefined
    },
    provider: {
        type: String,
        default: undefined
    }
}, { _id: false });

const ChatHistorySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: { // This will be set by $setOnInsert for new docs, and $set for updates
        type: Date,
        default: Date.now,
    }
});

// Middleware to update `updatedAt` timestamp when a document is saved (e.g., via .save())
// This is less relevant if you primarily use findOneAndUpdate for modifications.
ChatHistorySchema.pre('save', function (next) {
    if (this.isNew) { // Only set createdAt if it's a new document and not already set
        this.createdAt = this.createdAt || Date.now();
    }
    this.updatedAt = Date.now(); // Always update updatedAt on save
    next();
});

// Note: The pre('findOneAndUpdate') hook for updatedAt has been removed
// as it's better handled by the $set operator in the findOneAndUpdate call
// within the saveChatMessage function.

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);

module.exports = ChatHistory;