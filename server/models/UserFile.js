// C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Chatbot-geminiV3\server\models\UserFile.js
const mongoose = require('mongoose');

const UserFileSchema = new mongoose.Schema({
    userId: { // To associate the file with a user
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming your User model is named 'User' (e.g., from models/User.js)
        required: true,
        index: true // Good to have an index on userId for faster lookups
    },
    originalFilename: { // The name of the file as uploaded by the user (e.g., "My Report.pdf")
        type: String,
        required: true,
        trim: true
    },
    serverFilename: { // The unique name of the file as stored on the server's disk (e.g., "timestamp-My_Report.pdf")
        type: String,
        required: true,
        // unique: true // Making this globally unique might be too restrictive if different users upload 'file.txt'.
                     // Uniqueness should be per user or within a user's context, or rely on timestamping.
                     // For now, let's rely on the timestamp in the filename for uniqueness on disk.
    },
    serverFilePath: { // The full absolute path to where the file is stored on the server
        type: String,
        required: true,
        unique: true // The full path to a file on the server should indeed be unique
    },
    fileTypeSubfolder: { // The subfolder based on type, e.g., 'docs', 'images', 'code', 'others'
        type: String,
        required: true,
        trim: true
    },
    userAssetSubFolder: { // The sanitized username/email used for the user's main asset directory, e.g., 'john_doe_com'
        type: String,
        required: true,
        trim: true
    },
    size: { // File size in bytes
        type: Number,
        required: true
    },
    mimetype: { // File's MIME type as detected during upload
        type: String,
        required: true,
        trim: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    // Optional fields you might add later:
    // isProcessedByRAG: { type: Boolean, default: false },
    // processingStatusRAG: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    // lastAccessedForAnalysis: { type: Date }
});

// Compound index to quickly find a file by a user and its original name.
// This can also enforce that a user cannot have two files with the exact same originalFilename,
// if you add `unique: true` to this index definition. For now, it just speeds up lookups.
UserFileSchema.index({ userId: 1, originalFilename: 1 });

// Index on serverFilename could be useful if you need to quickly find a file by its on-disk name.
// UserFileSchema.index({ serverFilename: 1 });

module.exports = mongoose.model('UserFile', UserFileSchema);