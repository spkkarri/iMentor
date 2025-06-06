// server/models/File.js

const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    // Link to the user who uploaded the file
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // The unique, timestamped name of the file on the server
    filename: {
        type: String,
        required: true,
    },
    // The user's original filename (e.g., "my_document.pdf")
    originalname: {
        type: String,
        required: true,
    },
    // The absolute path to the file on the server's disk
    path: {
        type: String,
        required: true,
    },
    // The file's MIME type (e.g., "application/pdf")
    mimetype: {
        type: String,
        required: true,
    },
    // The file's size in bytes
    size: {
        type: Number,
        required: true,
    },
    // The date the file was uploaded
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('File', FileSchema);