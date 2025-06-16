// server/workers/kgWorker.js
const { workerData, parentPort } = require('worker_threads');
const mongoose = require('mongoose');

const User = require('../models/User');
const connectDB = require('../config/db');
const kgService = require('../services/kgService');

async function runKgGeneration() {
    const { chunksForKg: allInitialChunks, userId, originalName, llmProvider, ollamaModel } = workerData;
    let dbConnected = false;
    let overallSuccess = false;
    let finalMessage = "KG processing encountered an issue.";
    const logPrefix = `[KG Worker ${process.pid}, Doc: ${originalName}]`;

    try {
        console.log(`${logPrefix} Received task. User: ${userId}, Initial Chunks: ${allInitialChunks ? allInitialChunks.length : 0}`);
        if (!process.env.MONGO_URI) throw new Error("MONGO_URI not set in KG worker environment.");
        if (!userId || !originalName) throw new Error("Missing userId or originalName in KG workerData.");

        await connectDB(process.env.MONGO_URI);
        dbConnected = true;
        console.log(`${logPrefix} DB Connected.`);

        await User.updateOne(
            { _id: userId, "uploadedDocuments.filename": originalName },
            { $set: { "uploadedDocuments.$.kgStatus": "processing" } }
        );
        console.log(`${logPrefix} Status set to 'processing'.`);

        if (!allInitialChunks || allInitialChunks.length === 0) {
            console.log(`${logPrefix} No chunks provided for KG generation. Marking as skipped.`);
            await User.updateOne(
                { _id: userId, "uploadedDocuments.filename": originalName },
                { $set: { "uploadedDocuments.$.kgStatus": "skipped_no_chunks", "uploadedDocuments.$.kgTimestamp": new Date() } }
            );
            finalMessage = "No chunks provided for KG generation.";
            overallSuccess = true; // Not a failure of this worker's process
        } else {
            const kgExtractionResult = await kgService.generateAndStoreKg(allInitialChunks, userId, originalName, llmProvider, ollamaModel);

            if (kgExtractionResult && kgExtractionResult.success) {
                await User.updateOne(
                    { _id: userId, "uploadedDocuments.filename": originalName },
                    { $set: {
                        "uploadedDocuments.$.kgStatus": "completed",
                        "uploadedDocuments.$.kgNodesCount": kgExtractionResult.finalKgNodesCount,
                        "uploadedDocuments.$.kgEdgesCount": kgExtractionResult.finalKgEdgesCount,
                        "uploadedDocuments.$.kgTimestamp": new Date()
                        }
                    }
                );
                overallSuccess = true;
                finalMessage = kgExtractionResult.message || "KG generation and storage completed successfully.";
                console.log(`${logPrefix} SUCCESS: ${finalMessage}`);
            } else {
                await User.updateOne(
                    { _id: userId, "uploadedDocuments.filename": originalName },
                    { $set: { "uploadedDocuments.$.kgStatus": "failed_extraction" } }
                );
                finalMessage = (kgExtractionResult && kgExtractionResult.message) ? kgExtractionResult.message : "KG detailed extraction or storage failed.";
                console.error(`${logPrefix} FAILED (Extraction/Store): ${finalMessage}`);
                overallSuccess = false;
            }
        }

        if (parentPort) {
            parentPort.postMessage({ success: overallSuccess, originalName, message: finalMessage });
        }

    } catch (error) {
        console.error(`${logPrefix} CRITICAL error:`, error.message, error.stack);
        finalMessage = error.message || "Unknown critical error in KG worker.";
        overallSuccess = false;
        if (dbConnected && userId && originalName) {
            try {
                await User.updateOne(
                    { _id: userId, "uploadedDocuments.filename": originalName },
                    { $set: { "uploadedDocuments.$.kgStatus": "failed_critical" } }
                );
            } catch (dbUpdateError) {
                console.error(`${logPrefix} DB update error on critical fail:`, dbUpdateError);
            }
        }
        if (parentPort) {
            parentPort.postMessage({ success: false, originalName, error: finalMessage });
        }
    } finally {
        if (dbConnected) {
            await mongoose.disconnect().catch(e => console.error(`${logPrefix} Error disconnecting DB:`, e));
            console.log(`${logPrefix} DB Disconnected.`);
        }
        console.log(`${logPrefix} Finished task. Overall Success: ${overallSuccess}`);
    }
}

runKgGeneration();