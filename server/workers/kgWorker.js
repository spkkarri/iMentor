// server/workers/kgWorker.js
const { workerData, parentPort } = require('worker_threads');
const mongoose = require('mongoose');

// --- REFACTORED MODELS ---
const KnowledgeSource = require('../models/KnowledgeSource');
const connectDB = require('../config/db');
const kgService = require('../services/kgService');

async function runKgGeneration() {
    // --- REFACTORED DESTRUCTURING ---
    const { chunksForKg, userId, originalName, llmProvider, ollamaModel, sourceId } = workerData;
    let dbConnected = false;
    let overallSuccess = false;
    let finalMessage = "KG processing encountered an issue.";
    const logPrefix = `[KG Worker ${process.pid}, SourceID: ${sourceId}]`;

    try {
        console.log(`${logPrefix} Received task. Chunks: ${chunksForKg ? chunksForKg.length : 0}`);
        if (!process.env.MONGO_URI || !sourceId || !userId || !originalName) {
            throw new Error("Missing critical worker data (MONGO_URI, sourceId, userId, or originalName).");
        }

        await connectDB(process.env.MONGO_URI);
        dbConnected = true;
        console.log(`${logPrefix} DB Connected.`);

        // --- REFACTORED DB UPDATE LOGIC ---
        await KnowledgeSource.updateOne({ _id: sourceId }, { $set: { "kgStatus": "processing" } });
        console.log(`${logPrefix} Status set to 'processing'.`);

        if (!chunksForKg || chunksForKg.length === 0) {
            finalMessage = "No chunks provided for KG generation.";
            await KnowledgeSource.updateOne({ _id: sourceId }, { $set: { "kgStatus": "skipped_no_chunks" } });
            overallSuccess = true;
        } else {
            // NOTE: The `userId` and `originalName` are still passed to kgService for populating metadata in Neo4j.
            const kgExtractionResult = await kgService.generateAndStoreKg(chunksForKg, userId, originalName, llmProvider, ollamaModel);

            if (kgExtractionResult && kgExtractionResult.success) {
                await KnowledgeSource.updateOne(
                    { _id: sourceId }, 
                    { $set: { "kgStatus": "completed" } }
                );
                overallSuccess = true;
                finalMessage = kgExtractionResult.message || "KG generation and storage completed successfully.";
            } else {
                await KnowledgeSource.updateOne({ _id: sourceId }, { $set: { "kgStatus": "failed_extraction" } });
                finalMessage = kgExtractionResult?.message || "KG detailed extraction or storage failed.";
                overallSuccess = false;
            }
        }
        // --- END REFACTOR ---

    } catch (error) {
        console.error(`${logPrefix} CRITICAL error:`, error);
        finalMessage = error.message || "Unknown critical error in KG worker.";
        overallSuccess = false;
        if (dbConnected && sourceId) {
            try {
                await KnowledgeSource.updateOne({ _id: sourceId }, { $set: { "kgStatus": "failed_critical" } });
            } catch (dbUpdateError) {
                console.error(`${logPrefix} DB update error on critical fail:`, dbUpdateError);
            }
        }
    } finally {
        if (dbConnected) {
            await mongoose.disconnect();
        }
        console.log(`${logPrefix} Finished task. Overall Success: ${overallSuccess}`);
    }
}

runKgGeneration();