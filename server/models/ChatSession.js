// server/models/ChatSession.js

const mongoose = require('mongoose');
const crypto = require('crypto');

// Message types
const MESSAGE_TYPES = {
    TEXT: 'text',
    AUDIO: 'audio',
    MINDMAP: 'mindmap',
    IMAGE: 'image',
    CODE: 'code'
};

// Session states
const SESSION_STATES = {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DELETED: 'deleted'
};

// Session contexts
const SESSION_CONTEXTS = {
    GENERAL: 'general',
    TECHNICAL: 'technical',
    CREATIVE: 'creative',
    ANALYTICAL: 'analytical'
};

const MessageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    parts: [{
        text: { type: String, required: true },
        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        }
    }],
    type: { 
        type: String, 
        default: MESSAGE_TYPES.TEXT,
        enum: Object.values(MESSAGE_TYPES)
    },
    timestamp: { type: Date, default: Date.now },
    context: {
        type: String,
        enum: Object.values(SESSION_CONTEXTS),
        default: SESSION_CONTEXTS.GENERAL
    }
});

const ChatSessionSchema = new mongoose.Schema({
    sessionId: { 
        type: String, 
        required: true, 
        unique: true,
        default: () => crypto.randomUUID()
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        default: 'New Conversation',
        required: true
    },
    description: { type: String },
    messages: [MessageSchema],
    systemPrompt: { 
        type: String, 
        default: '',
        required: true
    },
    state: { 
        type: String,
        enum: Object.values(SESSION_STATES),
        default: SESSION_STATES.ACTIVE
    },
    context: {
        type: String,
        enum: Object.values(SESSION_CONTEXTS),
        default: SESSION_CONTEXTS.GENERAL
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 }
});

// Middleware to update timestamps and message count
ChatSessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (this.isModified('messages')) {
        this.messageCount = this.messages.length;
        this.lastActive = Date.now();
    }
    next();
});

// Custom methods
ChatSessionSchema.methods = {
    addMessage(type, role, text) {
        this.messages.push({
            type,
            role,
            parts: [{ text }],
            timestamp: new Date()
        });
    },
    isActive() {
        return this.state === SESSION_STATES.ACTIVE;
    },
    isArchived() {
        return this.state === SESSION_STATES.ARCHIVED;
    },
    isDeleted() {
        return this.state === SESSION_STATES.DELETED;
    },
    updateState(newState) {
        if (Object.values(SESSION_STATES).includes(newState)) {
            this.state = newState;
            this.save();
        }
    },
    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.save();
        }
    },
    removeTag(tag) {
        this.tags = this.tags.filter(t => t !== tag);
        this.save();
    },
    addMetadata(key, value) {
        this.metadata.set(key, value);
        this.save();
    },
    getMessagesByType(type) {
        return this.messages.filter(msg => msg.type === type);
    },
    getMessagesByContext(context) {
        return this.messages.filter(msg => msg.context === context);
    }
};

// Static methods
ChatSessionSchema.statics = {
    async findByUser(userId) {
        return this.find({ user: userId }).sort({ lastActive: -1 });
    },
    async findByTags(tags) {
        return this.find({ tags: { $in: tags } }).sort({ lastActive: -1 });
    },
    async findByContext(context) {
        return this.find({ context }).sort({ lastActive: -1 });
    }
};

module.exports = {
    ChatSession: mongoose.model('ChatSession', ChatSessionSchema),
    SESSION_STATES,
    SESSION_CONTEXTS,
    MESSAGE_TYPES
};