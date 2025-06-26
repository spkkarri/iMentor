const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

async function detailedRAGCheck() {
    console.log('=== Detailed RAG Diagnostics ===\n');
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB successfully\n');
        
        // Get all files
        const allFiles = await File.find({}).sort({ createdAt: -1 });
        console.log(`📊 Total files in database: ${allFiles.length}\n`);
        
        // Check for specific user (Solomon)
        const solomonUserId = '684b06f1b7a1ab61b0ccf477';
        const solomonFiles = await File.find({ user: solomonUserId }).sort({ createdAt: -1 });
        console.log(`👤 Files for user ${solomonUserId} (Solomon): ${solomonFiles.length}\n`);
        
        if (solomonFiles.length > 0) {
            console.log('📁 Solomon\'s files:');
            for (const file of solomonFiles) {
                const exists = fs.existsSync(file.path);
                const status = exists ? '✅' : '❌';
                console.log(`  ${status} ${file.originalname || 'unnamed'} | Path: ${file.path} | Created: ${file.createdAt || 'N/A'}`);
            }
        } else {
            console.log('⚠️  No files found for Solomon in database!');
        }
        
        // Check recent uploads (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentFiles = await File.find({ 
            createdAt: { $gte: oneDayAgo } 
        }).sort({ createdAt: -1 });
        
        console.log(`\n🕒 Recent files (last 24 hours): ${recentFiles.length}`);
        if (recentFiles.length > 0) {
            for (const file of recentFiles) {
                const exists = fs.existsSync(file.path);
                const status = exists ? '✅' : '❌';
                console.log(`  ${status} ${file.originalname || 'unnamed'} | User: ${file.user} | Created: ${file.createdAt}`);
            }
        }
        
        // Check for files with missing metadata
        const filesWithIssues = allFiles.filter(f => !f.originalname || !f.user || !f.path);
        if (filesWithIssues.length > 0) {
            console.log(`\n⚠️  Files with missing metadata: ${filesWithIssues.length}`);
            for (const file of filesWithIssues) {
                console.log(`  - ID: ${file._id} | Name: ${file.originalname || 'undefined'} | User: ${file.user || 'undefined'} | Path: ${file.path || 'undefined'}`);
            }
        }
        
        // Check file existence on disk
        let existingFiles = 0;
        let missingFiles = 0;
        
        for (const file of allFiles) {
            if (fs.existsSync(file.path)) {
                existingFiles++;
            } else {
                missingFiles++;
                if (file.user === solomonUserId) {
                    console.log(`\n❌ Solomon's missing file: ${file.originalname} at ${file.path}`);
                }
            }
        }
        
        console.log(`\n📈 File Status Summary:`);
        console.log(`  • Files existing on disk: ${existingFiles}`);
        console.log(`  • Files missing from disk: ${missingFiles}`);
        console.log(`  • Files for Solomon: ${solomonFiles.length}`);
        console.log(`  • Recent uploads: ${recentFiles.length}`);
        
        // Check if Solomon's files are in the expected directory
        const expectedSolomonPath = path.join(__dirname, '../assets/Solomon/docs');
        if (fs.existsSync(expectedSolomonPath)) {
            const solomonDiskFiles = fs.readdirSync(expectedSolomonPath);
            console.log(`\n💾 Files in Solomon's docs directory: ${solomonDiskFiles.length}`);
            if (solomonDiskFiles.length > 0) {
                console.log('  Files found:');
                solomonDiskFiles.forEach(file => console.log(`    - ${file}`));
            }
        } else {
            console.log(`\n❌ Expected Solomon docs directory not found: ${expectedSolomonPath}`);
        }
        
    } catch (error) {
        console.error('❌ Error during detailed RAG check:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n=== Detailed Diagnostics Complete ===');
    }
}

detailedRAGCheck(); 