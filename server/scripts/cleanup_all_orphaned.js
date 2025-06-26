const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const ASSETS_DIR = path.join(__dirname, '../assets');

// Helper to connect to the database
async function connectToDB() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
}

// Helper to clean up orphaned database entries
async function cleanupOrphanedDbEntries() {
    console.log('\n📋 Step 1: Cleaning up orphaned database entries...');
    const allFiles = await File.find({});
    let orphanedDbCount = 0;

    for (const file of allFiles) {
        if (!file.path || !fs.existsSync(file.path)) {
            await File.deleteOne({ _id: file._id });
            orphanedDbCount++;
        }
    }
    console.log(`✅ Deleted ${orphanedDbCount} orphaned DB entries`);
    return orphanedDbCount;
}

// Helper to find all files in a directory recursively
function findFilesInDirectory(dir) {
    if (!fs.existsSync(dir)) return [];
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

// Helper to clean up orphaned disk files
async function cleanupOrphanedDiskFiles() {
    console.log('\n💾 Step 2: Cleaning up orphaned disk files...');
    const currentDbFiles = await File.find({});
    const dbPaths = new Set(currentDbFiles.map(file => file.path));
    const diskFiles = findFilesInDirectory(ASSETS_DIR);
    let orphanedDiskCount = 0;

    for (const diskFile of diskFiles) {
        if (diskFile.includes('.DS_Store') || diskFile.includes('Thumbs.db')) continue;

        if (!dbPaths.has(diskFile)) {
            try {
                fs.unlinkSync(diskFile);
                orphanedDiskCount++;
            } catch (error) {
                console.error(`   ❌ Failed to delete: ${diskFile}`, error.message);
            }
        }
    }
    console.log(`✅ Deleted ${orphanedDiskCount} orphaned disk files`);
    return { orphanedDiskCount, remainingDisk: diskFiles.length - orphanedDiskCount };
}

// Helper to run a final consistency check
async function runConsistencyCheck() {
    console.log('\n🔍 Step 3: Final consistency check...');
    const finalDbFiles = await File.find({});
    let inconsistencies = 0;

    for (const file of finalDbFiles) {
        if (!fs.existsSync(file.path)) {
            console.warn(`⚠️  Inconsistency found: DB entry for missing file ${file.originalname}`);
            inconsistencies++;
        }
    }
    if (inconsistencies === 0) {
        console.log('✅ Database and file system are in sync!');
    }
    return inconsistencies;
}

// Helper to print the summary
function printSummary(dbCount, diskInfo, finalInconsistencies) {
    console.log('\n📈 Cleanup Summary:');
    console.log(`   • Orphaned DB entries deleted: ${dbCount}`);
    console.log(`   • Orphaned disk files deleted: ${diskInfo.orphanedDiskCount}`);
    console.log(`   • Files remaining on disk: ${diskInfo.remainingDisk}`);
    if (finalInconsistencies > 0) {
        console.log(`   ⚠️  Remaining inconsistencies: ${finalInconsistencies}`);
    }
}

// Main cleanup function
async function cleanupAllOrphaned() {
    console.log('🔍 Starting comprehensive cleanup of orphaned files...\n');
    try {
        await connectToDB();
        const orphanedDbCount = await cleanupOrphanedDbEntries();
        const diskInfo = await cleanupOrphanedDiskFiles();
        const inconsistencies = await runConsistencyCheck();
        printSummary(orphanedDbCount, diskInfo, inconsistencies);
    } finally {
        await mongoose.disconnect();
        console.log('\n🎉 Cleanup process completed!');
    }
}

cleanupAllOrphaned().catch(err => {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
}); 