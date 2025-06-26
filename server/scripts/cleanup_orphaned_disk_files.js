const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const ASSETS_DIR = path.join(__dirname, '../assets');

async function cleanupOrphanedDiskFiles() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Get all file paths from the database
    const dbFiles = await File.find({});
    const dbPaths = new Set(dbFiles.map(file => file.path));
    console.log(`Found ${dbPaths.size} files in database`);

    let orphanedCount = 0;
    let totalFilesChecked = 0;

    // Recursively find all files in the assets directory
    function findFilesInDirectory(dir) {
        if (!fs.existsSync(dir)) {
            return [];
        }

        const items = fs.readdirSync(dir);
        const files = [];

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                files.push(...findFilesInDirectory(fullPath));
            } else if (stat.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }

    const diskFiles = findFilesInDirectory(ASSETS_DIR);
    console.log(`Found ${diskFiles.length} files on disk in assets directory`);

    // Check each file on disk
    for (const diskFile of diskFiles) {
        totalFilesChecked++;
        
        // Skip backup directories
        if (diskFile.includes('backup_assets')) {
            continue;
        }

        // Check if this file is referenced in the database
        if (!dbPaths.has(diskFile)) {
            console.log(`Orphaned disk file: ${diskFile}`);
            try {
                fs.unlinkSync(diskFile);
                orphanedCount++;
                console.log(`  ✅ Deleted orphaned file`);
            } catch (error) {
                console.log(`  ❌ Failed to delete: ${error.message}`);
            }
        }
    }

    console.log(`\nCleanup complete:`);
    console.log(`- Files checked: ${totalFilesChecked}`);
    console.log(`- Orphaned files deleted: ${orphanedCount}`);
    console.log(`- Files remaining: ${diskFiles.length - orphanedCount}`);

    await mongoose.disconnect();
}

cleanupOrphanedDiskFiles().catch(err => {
    console.error('Error during cleanup:', err);
    process.exit(1);
}); 