const mongoose = require('mongoose');
const fs = require('fs');
const File = require('../models/File');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

async function cleanupOrphanedFiles() {
    await mongoose.connect(MONGO_URI);
    const allFiles = await File.find({});
    let deletedCount = 0;

    for (const file of allFiles) {
        if (!fs.existsSync(file.path)) {
            await File.deleteOne({ _id: file._id });
            console.log(`Deleted DB record for missing file: ${file.originalname} (${file.path})`);
            deletedCount++;
        }
    }

    console.log(`\nCleanup complete. Deleted ${deletedCount} orphaned file records.`);
    await mongoose.disconnect();
}

cleanupOrphanedFiles();