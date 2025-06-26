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
    
    // Check custom vector store
    const customStorePath = path.join(__dirname, '../faiss_indices/vector_store.json');
    if (fs.existsSync(customStorePath)) {
        const stats = fs.statSync(customStorePath);
        console.log(`   • Custom Vector Store: ${formatFileSize(stats.size)}`);
        
        try {
            const vectorStore = new VectorStore();
            await vectorStore.initialize();
            console.log(`   • Documents in custom store: ${vectorStore.documents.length}`);
        } catch (error) {
            console.log(`   • Custom store error: ${error.message}`);
        }
    } else {
        console.log('   • Custom Vector Store: Not found');
    }
    
    // Check Langchain vector store
    const langchainStorePath = path.join(__dirname, '../vector_store_data');
    if (fs.existsSync(langchainStorePath)) {
        const stats = fs.statSync(langchainStorePath);
        console.log(`   • Langchain Vector Store: ${formatFileSize(stats.size)}`);
        
        try {
            await LangchainVectorStore.initialize();
            if (LangchainVectorStore.store) {
                const docCount = LangchainVectorStore.store.docstore._docs.size;
                console.log(`   • Documents in Langchain store: ${docCount}`);
            } else {
                console.log('   • Langchain store: Not initialized');
            }
        } catch (error) {
            console.log(`   • Langchain store error: ${error.message}`);
        }
    } else {
        console.log('   • Langchain Vector Store: Not found');
    }
}

// Helper to clean custom vector store
async function cleanCustomVectorStore() {
    console.log('\n🧹 Cleaning Custom Vector Store...');
    
    try {
        const vectorStore = new VectorStore();
        await vectorStore.initialize();
        
        const allFiles = await File.find({});
        const fileIds = new Set(allFiles.map(file => file._id.toString()));
        
        let removedCount = 0;
        const originalCount = vectorStore.documents.length;
        
        // Filter out documents that don't have corresponding files in the database
        vectorStore.documents = vectorStore.documents.filter(doc => {
            if (doc.metadata && doc.metadata.fileId) {
                // Ensure fileId is a string for comparison
                const docFileId = doc.metadata.fileId.toString();
                if (fileIds.has(docFileId)) {
                    return true;
                } else {
                    removedCount++;
                    return false;
                }
            }
            return true; // Keep documents without fileId metadata
        });
        
        // Save the cleaned store
        await vectorStore.saveStore();
        
        console.log(`   ✅ Removed ${removedCount} orphaned documents`);
        console.log(`   ✅ Store now contains ${vectorStore.documents.length} documents (was ${originalCount})`);
        
        return { removedCount, finalCount: vectorStore.documents.length };
    } catch (error) {
        console.error(`   ❌ Error cleaning custom vector store: ${error.message}`);
        return { removedCount: 0, finalCount: 0 };
    }
}

// Helper to clean Langchain vector store
async function cleanLangchainVectorStore() {
    console.log('\n🧹 Cleaning Langchain Vector Store...');
    
    try {
        await LangchainVectorStore.initialize();
        
        if (!LangchainVectorStore.store) {
            console.log('   ℹ️  Langchain store not initialized, nothing to clean');
            return { removedCount: 0, finalCount: 0 };
        }
        
        const allFiles = await File.find({});
        const fileIds = new Set(allFiles.map(file => file._id.toString()));
        
        const allDocs = LangchainVectorStore.store.docstore._docs;
        const docsToKeep = [];
        let removedCount = 0;
        
        // Filter documents
        for (const doc of allDocs.values()) {
            if (doc.metadata && doc.metadata.fileId) {
                // Ensure fileId is a string for comparison
                const docFileId = doc.metadata.fileId.toString();
                if (fileIds.has(docFileId)) {
                    docsToKeep.push(doc);
                } else {
                    removedCount++;
                }
            } else {
                docsToKeep.push(doc); // Keep documents without fileId metadata
            }
        }
        
        if (docsToKeep.length > 0) {
            const contents = docsToKeep.map(doc => doc.pageContent);
            const metadatas = docsToKeep.map(doc => doc.metadata);
            
            // Rebuild the store
            const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
            const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/hf_transformers");
            
            const embeddings = new HuggingFaceTransformersEmbeddings({
                modelName: "sentence-transformers/all-MiniLM-L6-v2",
            });
            
            const STORE_PATH = path.resolve(__dirname, '..', 'vector_store_data');
            LangchainVectorStore.store = await HNSWLib.fromTexts(contents, metadatas, embeddings);
            await LangchainVectorStore.store.save(STORE_PATH);
        } else {
            // If no documents left, delete the store
            LangchainVectorStore.store = null;
            const STORE_PATH = path.resolve(__dirname, '..', 'vector_store_data');
            if (fs.existsSync(STORE_PATH)) {
                fs.rmSync(STORE_PATH, { recursive: true, force: true });
            }
        }
        
        console.log(`   ✅ Removed ${removedCount} orphaned documents`);
        console.log(`   ✅ Store now contains ${docsToKeep.length} documents`);
        
        return { removedCount, finalCount: docsToKeep.length };
    } catch (error) {
        console.error(`   ❌ Error cleaning Langchain vector store: ${error.message}`);
        return { removedCount: 0, finalCount: 0 };
    }
}

// Helper to completely reset vector stores
async function resetVectorStores() {
    console.log('\n🔄 Resetting Vector Stores...');
    
    // Reset custom vector store
    const customStorePath = path.join(__dirname, '../faiss_indices/vector_store.json');
    if (fs.existsSync(customStorePath)) {
        fs.unlinkSync(customStorePath);
        console.log('   ✅ Deleted custom vector store file');
    }
    
    // Reset Langchain vector store
    const langchainStorePath = path.join(__dirname, '../vector_store_data');
    if (fs.existsSync(langchainStorePath)) {
        fs.rmSync(langchainStorePath, { recursive: true, force: true });
        console.log('   ✅ Deleted Langchain vector store directory');
    }
    
    console.log('   ✅ All vector stores have been reset');
}

// Helper to show cleanup options
function showOptions() {
    console.log('\n🔧 Vector Database Cleanup Options:');
    console.log('1. Show current vector store status');
    console.log('2. Clean orphaned documents from custom vector store');
    console.log('3. Clean orphaned documents from Langchain vector store');
    console.log('4. Clean both vector stores (remove orphaned documents)');
    console.log('5. Reset all vector stores (delete everything)');
    console.log('6. Exit');
}

// Main cleanup function
async function cleanupVectorDB() {
    console.log('🧹 Vector Database Cleanup Tool\n');
    
    try {
        await connectToDB();
        
        // Show current status first
        await showVectorStoreStatus();
        
        // For now, perform a comprehensive cleanup
        console.log('\n🔄 Performing comprehensive vector database cleanup...\n');
        
        // Clean both vector stores
        const customResult = await cleanCustomVectorStore();
        const langchainResult = await cleanLangchainVectorStore();
        
        // Show final status
        console.log('\n📊 Final Vector Store Status:');
        await showVectorStoreStatus();
        
        // Summary
        console.log('\n📈 Cleanup Summary:');
        console.log(`   • Custom Vector Store: Removed ${customResult.removedCount} documents`);
        console.log(`   • Langchain Vector Store: Removed ${langchainResult.removedCount} documents`);
        console.log(`   • Total orphaned documents removed: ${customResult.removedCount + langchainResult.removedCount}`);
        
    } catch (error) {
        console.error('❌ Error during vector database cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🎉 Vector database cleanup completed!');
    }
}

// If you want to reset everything instead, uncomment this line:
// resetVectorStores().then(() => console.log('Vector stores reset complete!'));

cleanupVectorDB().catch(err => {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
}); 