const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

async function main() {
    console.log('=== RAG Diagnostics ===\n');
    await mongoose.connect(MONGO_URI);
    const files = await File.find({});
    if (files.length === 0) {
        console.log('No files found in the database.');
        await mongoose.disconnect();
        return;
    }
    let missingFiles = 0;
    let okFiles = 0;
    console.log(`Found ${files.length} files in the database.\n`);
    for (const file of files) {
        const exists = fs.existsSync(file.path);
        const status = exists ? '✅ Exists' : '❌ MISSING';
        if (exists) okFiles++; else missingFiles++;
        console.log(`- ${file.originalname} | User: ${file.user} | Path: ${file.path} | Uploaded: ${file.uploadDate || 'N/A'} | ${status}`);
    }
    console.log(`\nSummary:`);
    console.log(`  Files OK: ${okFiles}`);
    console.log(`  Files missing: ${missingFiles}`);
    // Vector store check (if implemented as files or DB entries)
    // If you have a vector DB or index, add checks here
    // For now, just print a reminder
    console.log('\n[NOTE] To check vector store contents, inspect your vector DB or embedding index.');
    await mongoose.disconnect();
    console.log('\n=== Diagnostics Complete ===');
}

main().catch(err => {
    console.error('Error during RAG diagnostics:', err);
    process.exit(1);
}); 