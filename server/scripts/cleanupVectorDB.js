// server/scripts/cleanupVectorDB.js

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');
const VectorStore = require('../services/vectorStore');
const LangchainVectorStore = require('../services/LangchainVectorStore');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';

// Helper to connect to the database
async function connectToDB() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
}

// Helper to get file size in human readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to show current vector store status
async function showVectorStoreStatus() {
    console.log('\n📊 Current Vector Store Status:');
    
    // Check Langchain vector store
    const langchainStorePath = path.join(__dirname, '..', 'vector_store_data');
    if (fs.existsSync(langchainStorePath)) {
        try {
            console.log(`   • Langchain Vector Store found.`);
            await LangchainVectorStore.initialize();
            if (LangchainVectorStore.store) {
                const docCount = LangchainVectorStore.store.docstore._docs.size;
                console.log(`   • Documents in Langchain store: ${docCount}`);
            } else {
                console.log('   • Langchain store: Found but not initialized (likely empty).');
            }
        } catch (error) {
            console.log(`   • Langchain store error: ${error.message}`);
        }
    } else {
        console.log('   • Langchain Vector Store: Not found');
    }
}

// Helper to clean Langchain vector store
async function cleanLangchainVectorStore() {
    console.log('\n🧹 Cleaning Langchain Vector Store...');
    
    try {
        await LangchainVectorStore.initialize();
        
        if (!LangchainVectorStore.store) {
            console.log('   ℹ️  Langchain store not initialized, nothing to clean');
            return { removedCount: 0, finalCount: 0 };
        }
        
        const allFiles = await File.find({});
        const validFileIds = new Set(allFiles.map(file => file._id.toString()));
        
        const allDocs = LangchainVectorStore.store.docstore._docs;
        const docsToKeep = [];
        let removedCount = 0;
        
        for (const doc of allDocs.values()) {
            if (doc.metadata && doc.metadata.fileId && validFileIds.has(doc.metadata.fileId.toString())) {
                docsToKeep.push(doc);
            } else {
                removedCount++;
            }
        }
        
        if (docsToKeep.length > 0) {
            const contents = docsToKeep.map(doc => doc.pageContent);
            const metadatas = docsToKeep.map(doc => doc.metadata);
            
            const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
            const embeddings = LangchainVectorStore.embeddings; // Reuse initialized embeddings
            
            const STORE_PATH = path.resolve(__dirname, '..', 'vector_store_data');
            LangchainVectorStore.store = await HNSWLib.fromTexts(contents, metadatas, embeddings);
            await LangchainVectorStore.store.save(STORE_PATH);
        } else {
            LangchainVectorStore.store = null;
            const STORE_PATH = path.resolve(__dirname, '..', 'vector_store_data');
            if (fs.existsSync(STORE_PATH)) {
                fs.rmSync(STORE_PATH, { recursive: true, force: true });
            }
        }
        
        console.log(`   ✅ Removed ${removedCount} orphaned documents`);
        console.log(`   ✅ Store now contains ${docsToKeep.length} documents`);
        
        return { removedCount, finalCount: docsToKeep.length };
    } catch (error) {
        console.error(`   ❌ Error cleaning Langchain vector store: ${error.message}`);
        return { removedCount: 0, finalCount: 0 };
    }
}


// Main cleanup function
async function cleanupVectorDB() {
    console.log('🧹 Vector Database Cleanup Tool\n');
    
    try {
        await connectToDB();
        await showVectorStoreStatus();
        console.log('\n🔄 Performing comprehensive vector database cleanup...\n');
        await cleanLangchainVectorStore();
        console.log('\n📊 Final Vector Store Status:');
        await showVectorStoreStatus();
        
    } catch (error) {
        console.error('❌ Error during vector database cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🎉 Vector database cleanup completed!');
    }
}

cleanupVectorDB().catch(err => {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
});