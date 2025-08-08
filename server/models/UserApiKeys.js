// server/models/UserApiKeys.js
// Model for storing user's API keys and service configurations

const mongoose = require('mongoose');

const userApiKeysSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    
    // API Key Configuration
    geminiApiKey: {
        type: String,
        default: null,
        select: false // Don't include in queries by default for security
    },
    
    // Ollama Configuration
    ollamaUrl: {
        type: String,
        default: null
    },
    ollamaModel: {
        type: String,
        default: 'llama2' // Default Ollama model
    },
    
    // Service Preferences
    preferredService: {
        type: String,
        enum: ['gemini', 'ollama', 'admin'],
        default: 'admin'
    },
    
    // Admin API Key Usage
    useAdminKeys: {
        type: Boolean,
        default: true
    },
    adminAccessStatus: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'revoked'],
        default: 'pending'
    },
    adminAccessRequestedAt: {
        type: Date,
        default: Date.now
    },
    adminAccessApprovedAt: {
        type: Date,
        default: null
    },
    adminAccessApprovedBy: {
        type: String,
        default: null
    },
    adminAccessReason: {
        type: String,
        default: 'User requested access to admin API keys'
    },
    
    // Usage Tracking
    totalRequests: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date,
        default: null
    },
    
    // Service Status
    geminiKeyValid: {
        type: Boolean,
        default: null
    },
    ollamaConnectionValid: {
        type: Boolean,
        default: null
    },
    lastValidationAt: {
        type: Date,
        default: null
    },
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
userApiKeysSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Instance methods
userApiKeysSchema.methods.hasValidGeminiKey = function() {
    return this.geminiApiKey && this.geminiApiKey.length > 0 && this.geminiKeyValid !== false;
};

userApiKeysSchema.methods.hasValidOllamaConfig = function() {
    return this.ollamaUrl && this.ollamaUrl.length > 0 && this.ollamaConnectionValid !== false;
};

userApiKeysSchema.methods.canUseAdminKeys = function() {
    return this.useAdminKeys && this.adminAccessStatus === 'approved';
};

userApiKeysSchema.methods.getPreferredService = function() {
    if (this.preferredService === 'gemini' && this.hasValidGeminiKey()) {
        return 'gemini';
    } else if (this.preferredService === 'ollama' && this.hasValidOllamaConfig()) {
        return 'ollama';
    } else if (this.canUseAdminKeys()) {
        return 'admin';
    }
    return null;
};

userApiKeysSchema.methods.incrementUsage = function() {
    this.totalRequests += 1;
    this.lastUsed = new Date();
    return this.save();
};

// Static methods
userApiKeysSchema.statics.findByUserId = function(userId) {
    return this.findOne({ userId }).select('+geminiApiKey');
};

userApiKeysSchema.statics.findByEmail = function(email) {
    return this.findOne({ email }).select('+geminiApiKey');
};

userApiKeysSchema.statics.getPendingAdminRequests = function() {
    return this.find({ 
        useAdminKeys: true, 
        adminAccessStatus: 'pending' 
    }).sort({ adminAccessRequestedAt: -1 });
};

userApiKeysSchema.statics.getApprovedUsers = function() {
    return this.find({ 
        useAdminKeys: true, 
        adminAccessStatus: 'approved' 
    }).sort({ adminAccessApprovedAt: -1 });
};

userApiKeysSchema.statics.getUserStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                usersWithGeminiKeys: { 
                    $sum: { 
                        $cond: [{ $ne: ['$geminiApiKey', null] }, 1, 0] 
                    } 
                },
                usersWithOllama: { 
                    $sum: { 
                        $cond: [{ $ne: ['$ollamaUrl', null] }, 1, 0] 
                    } 
                },
                pendingAdminRequests: { 
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $eq: ['$useAdminKeys', true] },
                                { $eq: ['$adminAccessStatus', 'pending'] }
                            ]}, 
                            1, 
                            0
                        ] 
                    } 
                },
                approvedAdminUsers: { 
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $eq: ['$useAdminKeys', true] },
                                { $eq: ['$adminAccessStatus', 'approved'] }
                            ]}, 
                            1, 
                            0
                        ] 
                    } 
                },
                totalRequests: { $sum: '$totalRequests' }
            }
        }
    ]);
};

// Indexes for performance
userApiKeysSchema.index({ userId: 1 }, { unique: true });
userApiKeysSchema.index({ email: 1 });
userApiKeysSchema.index({ useAdminKeys: 1, adminAccessStatus: 1 });
userApiKeysSchema.index({ preferredService: 1 });
userApiKeysSchema.index({ lastUsed: -1 });

const UserApiKeys = mongoose.model('UserApiKeys', userApiKeysSchema);

module.exports = UserApiKeys;
