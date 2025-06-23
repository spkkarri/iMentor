// FusedChatbot/server/models/ChatHistory.js
const mongoose = require('mongoose');

const ReferenceSchema = new mongoose.Schema({
    documentName: { type: String },
    preview_snippet: { type: String },
    score: { type: Number }
}, { _id: false }); // Don't create separate _id for each reference object

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'model'],
        required: true
    },
    parts: [{
        text: {
            type: String,
            required: true
        }
        // _id: false
    }],
    timestamp: {
        type: Date,
        default: Date.now
    },
    // --- NEW FIELDS FOR MODEL MESSAGES ---
    references: {
        type: [ReferenceSchema], // Array of reference objects
        required: false // Only present for model messages that have RAG references
    },
    thinking: {
        type: String,
        required: false // Only present for model messages if CoT is available
    }
    // --- END NEW FIELDS ---
}, { _id: false });

const ChatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
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
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Update `updatedAt` timestamp before saving any changes
ChatHistorySchema.pre('save', function (next) {
    // No need to check this.isModified() here, as 'save' implies a change or new doc.
    // For new documents, this will set updatedAt to match createdAt initially.
    // For existing documents being saved after modification, it updates.
    this.updatedAt = Date.now();
    next();
});

// Also update `updatedAt` on findOneAndUpdate operations
ChatHistorySchema.pre('findOneAndUpdate', function(next) {
  // 'this' refers to the query object, not the document.
  // To update the document directly, use this.set() or pass to update operator.
  this.set({ updatedAt: new Date() });
  next();
});


const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);

module.exports = ChatHistory;