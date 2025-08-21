// server/models/Podcast.js
const mongoose = require('mongoose');

const PodcastSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Add an index for faster lookups
    },
    podcastId: { // This is the UUID for the file
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    audioUrl: {
        type: String,
        required: true
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

const Podcast = mongoose.model('Podcast', PodcastSchema);

module.exports = Podcast;