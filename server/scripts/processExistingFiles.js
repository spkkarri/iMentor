// server/scripts/processExistingFiles.js

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit').default; // Corrected import
const File = require('../models/File');
const serviceManager = require('../services/serviceManager'); // Use the service manager to ensure services are initialized
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const limit = pLimit(3); // Limit to 3 concurrent file processes

async function processExistingFiles() {
    console.log('=== Processing Existing Files for RAG ===\n');
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB successfully\n');

        // Initialize services like DocumentProcessor and VectorStore
        await serviceManager.initialize();
        const { documentProcessor } = serviceManager.getServices();

        if (!documentProcessor) {
            throw new Error("DocumentProcessor service failed to initialize.");
        }
        
        // Get all files from database
        const allFiles = await File.find({}).sort({ createdAt: -1 });
        console.log(`📊 Found ${allFiles.length} files in database to process.\n`);
        
        let processedCount = 0;
        let errorCount = 0;

        const tasks = allFiles.map(file => limit(async () => {
            try {
                // Check if file exists on disk
                if (!fs.existsSync(file.path)) {
                    console.log(`❌ File not found on disk: ${file.originalname} (${file.path})`);
                    errorCount++;
                    return;
                }
                
                console.log(`🔄 Processing: ${file.originalname} (User: ${file.user})`);
                
                // Process the file and add to vector store
                const processingResult = await documentProcessor.processFile(file.path, {
                    userId: file.user.toString(),
                    fileId: file._id.toString(),
                    originalName: file.originalname,
                    fileType: path.extname(file.path).substring(1)
                });
                
                console.log(`✅ Processed: ${file.originalname} - ${processingResult.chunksAdded} chunks added`);
                processedCount++;
            } catch (error) {
                console.error(`❌ Error processing ${file.originalname}:`, error.message);
                errorCount++;
            }
        }));

        await Promise.all(tasks);
        
        console.log(`\n📈 Processing Summary:`);
        console.log(`   • Files processed successfully: ${processedCount}`);
        console.log(`  • Files with errors: ${errorCount}`);
        console.log(`  • Total files: ${allFiles.length}`);
        
        if (processedCount > 0) {
            console.log(`\n🎉 Successfully processed ${processedCount} files for RAG!`);
            console.log('💡 You can now ask questions and the RAG system will search through your documents.');
        }
        
    } catch (error) {
        console.error('❌ Error during file processing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n=== Processing Complete ===');
    }
}

processExistingFiles();