const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
const { performManualBackup } = require('../utils/assetCleanup');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

async function manualCleanup() {
    console.log('🧹 Manual Cleanup Script');
    console.log('This script will help you clean up files manually.\n');
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Show current file status
    console.log('📊 Current File Status:');
    const allFiles = await File.find({});
    console.log(`   • Files in database: ${allFiles.length}`);
    
    let existingFiles = 0;
    let missingFiles = 0;
    
    for (const file of allFiles) {
        if (fs.existsSync(file.path)) {
            existingFiles++;
        } else {
            missingFiles++;
            console.log(`   ⚠️  Missing file: ${file.originalname} (${file.path})`);
        }
    }
    
    console.log(`   • Files existing on disk: ${existingFiles}`);
    console.log(`   • Files missing from disk: ${missingFiles}\n`);

    // Ask user what they want to do
    console.log('Options:');
    console.log('1. Backup all current files to backup folder');
    console.log('2. Clean up orphaned database entries (files that don\'t exist on disk)');
    console.log('3. Clean up orphaned disk files (files on disk not in database)');
    console.log('4. Full cleanup (backup + clean both orphaned DB and disk files)');
    console.log('5. Exit without doing anything');
    
    // For now, we'll do a full cleanup since this is a manual script
    console.log('\n🔄 Performing full cleanup...\n');
    
    // Step 1: Backup current files
    console.log('📦 Step 1: Backing up current files...');
    await performManualBackup();
    
    // Step 2: Clean up orphaned DB entries
    console.log('\n🗑️  Step 2: Cleaning up orphaned database entries...');
    let orphanedDbCount = 0;
    
    for (const file of allFiles) {
        if (!file.path || !fs.existsSync(file.path)) {
            console.log(`   Deleting orphaned DB entry: ${file.originalname}`);
            await File.deleteOne({ _id: file._id });
            orphanedDbCount++;
        }
    }
    console.log(`   ✅ Deleted ${orphanedDbCount} orphaned DB entries`);

    // Step 3: Clean up orphaned disk files (files not in database)
    console.log('\n💾 Step 3: Cleaning up orphaned disk files...');
    
    const ASSETS_DIR = path.join(__dirname, '../assets');
    const currentDbFiles = await File.find({});
    const dbPaths = new Set(currentDbFiles.map(file => file.path));
    
    let orphanedDiskCount = 0;
    
    // Recursively find all files in assets directory
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
    
    // Check each file on disk
    for (const diskFile of diskFiles) {
        // Skip backup directories and system files
        if (diskFile.includes('backup_assets') || 
            diskFile.includes('.DS_Store') || 
            diskFile.includes('Thumbs.db')) {
            continue;
        }

        // Check if this file is referenced in the database
        if (!dbPaths.has(diskFile)) {
            console.log(`   Deleting orphaned disk file: ${path.basename(diskFile)}`);
            try {
                fs.unlinkSync(diskFile);
                orphanedDiskCount++;
            } catch (error) {
                console.log(`   ❌ Failed to delete: ${error.message}`);
            }
        }
    }
    
    console.log(`   ✅ Deleted ${orphanedDiskCount} orphaned disk files`);

    // Final summary
    console.log('\n📈 Cleanup Summary:');
    console.log(`   • Orphaned DB entries deleted: ${orphanedDbCount}`);
    console.log(`   • Orphaned disk files deleted: ${orphanedDiskCount}`);
    console.log(`   • All current files backed up to backup_assets folder`);
    
    // Final consistency check
    console.log('\n🔍 Final consistency check...');
    const finalDbFiles = await File.find({});
    let inconsistencies = 0;
    
    for (const file of finalDbFiles) {
        if (!fs.existsSync(file.path)) {
            console.log(`   ⚠️  Inconsistency found: DB entry exists but file missing: ${file.originalname}`);
            inconsistencies++;
        }
    }
    
    if (inconsistencies === 0) {
        console.log('   ✅ Database and file system are now in sync!');
    } else {
        console.log(`   ⚠️  Found ${inconsistencies} remaining inconsistencies`);
    }

    await mongoose.disconnect();
    console.log('\n🎉 Manual cleanup completed!');
    console.log('💡 Tip: You can now upload new files and they won\'t be automatically deleted.');
}

manualCleanup().catch(err => {
    console.error('❌ Error during manual cleanup:', err);
    process.exit(1);
}); 