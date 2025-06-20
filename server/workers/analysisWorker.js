// server/workers/analysisWorker.js
const { workerData, parentPort } = require('worker_threads');
const mongoose = require('mongoose');
const path = require('path');

// Import models and services
const User = require('../models/User');
const connectDB = require('../config/db');
const geminiService = require('../services/geminiService');
const ollamaService = require('../services/ollamaService');
const { ANALYSIS_PROMPTS } = require('../config/promptTemplates');

// Load .env variables from the server's root directory for the worker
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Performs the actual analysis generation for FAQ, Topics, and Mindmap.
 * This function is designed to be called by the main 'run' function of the worker.
 */
async function performFullAnalysis(userId, originalName, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl) {
    const logPrefix = `[Analysis Worker ${process.pid}, Doc: ${originalName}]`;
    console.log(`${logPrefix} Starting analysis. Using provider: ${llmProvider}`);

    const analysisResults = { faq: "", topics: "", mindmap: "" };
    let allIndividualAnalysesSuccessful = true;

    // Validate credentials based on the selected provider
    if (llmProvider === 'gemini' && !apiKey) {
        const errorMessage = "Error: Analysis failed because no valid user Gemini API key was provided to the worker.";
        console.error(`${logPrefix} ${errorMessage}`);
        // Return a failure object that can be stored in the DB
        return { 
            success: false, 
            results: { faq: errorMessage, topics: errorMessage, mindmap: errorMessage }
        };
    }

    // Inner helper function to generate a single type of analysis
    async function generateSingleAnalysis(type, promptContentForLLM) {
        try {
            console.log(`${logPrefix} Generating ${type} for '${originalName}'.`);
            const historyForLLM = [{ role: 'user', parts: [{ text: "Perform the requested analysis based on the system instruction provided." }] }];
            
            let generatedText;
            
            // Prepare options object with user-specific credentials
            const llmOptions = { 
                apiKey: apiKey,       // For Gemini
                ollamaUrl: ollamaUrl  // For Ollama
            };

            if (llmProvider === 'ollama') {
                generatedText = await ollamaService.generateContentWithHistory(
                    historyForLLM,
                    promptContentForLLM,
                    null,
                    { ...llmOptions, model: ollamaModel, maxOutputTokens: ollamaService.DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT }
                );
            } else { // Default to Gemini
                generatedText = await geminiService.generateContentWithHistory(
                    historyForLLM,
                    promptContentForLLM,
                    null,
                    llmOptions
                );
            }

            if (!generatedText || typeof generatedText !== 'string' || generatedText.trim() === "") {
                console.warn(`${logPrefix} LLM returned empty content for ${type}.`);
                return { success: false, content: `Notice: No content generated for ${type}.` };
            }
            console.log(`${logPrefix} ${type} generation successful.`);
            return { success: true, content: generatedText.trim() };
        } catch (error) {
            console.error(`${logPrefix} Error during ${type} generation: ${error.message}`);
            allIndividualAnalysesSuccessful = false;
            return { success: false, content: `Error generating ${type}: ${error.message.substring(0, 250)}` };
        }
    }

    // --- Generate FAQ, Topics, and Mindmap IN PARALLEL ---
    const analysisPromises = [
        generateSingleAnalysis('FAQ', ANALYSIS_PROMPTS.faq.getPrompt(textForAnalysis)),
        generateSingleAnalysis('Topics', ANALYSIS_PROMPTS.topics.getPrompt(textForAnalysis)),
        generateSingleAnalysis('Mindmap', ANALYSIS_PROMPTS.mindmap.getPrompt(textForAnalysis))
    ];

    const [faqOutcome, topicsOutcome, mindmapOutcome] = await Promise.allSettled(analysisPromises);

    // Process outcomes
    if (faqOutcome.status === 'fulfilled') {
        analysisResults.faq = faqOutcome.value.content;
        if (!faqOutcome.value.success) allIndividualAnalysesSuccessful = false;
    } else {
        analysisResults.faq = `Error generating FAQ: ${faqOutcome.reason?.message?.substring(0,100) || 'Promise rejected'}`;
        allIndividualAnalysesSuccessful = false;
    }

    if (topicsOutcome.status === 'fulfilled') {
        analysisResults.topics = topicsOutcome.value.content;
        if (!topicsOutcome.value.success) allIndividualAnalysesSuccessful = false;
    } else {
        analysisResults.topics = `Error generating Topics: ${topicsOutcome.reason?.message?.substring(0,100) || 'Promise rejected'}`;
        allIndividualAnalysesSuccessful = false;
    }

    if (mindmapOutcome.status === 'fulfilled') {
        analysisResults.mindmap = mindmapOutcome.value.content;
        if (!mindmapOutcome.value.success) allIndividualAnalysesSuccessful = false;
    } else {
        analysisResults.mindmap = `Error generating Mindmap: ${mindmapOutcome.reason?.message?.substring(0,100) || 'Promise rejected'}`;
        allIndividualAnalysesSuccessful = false;
    }
    
    // Update MongoDB with all results
    const finalAnalysisStatus = allIndividualAnalysesSuccessful ? "completed" : "failed_partial";
    try {
        await User.updateOne(
            { _id: userId, "uploadedDocuments.filename": originalName },
            {
                $set: {
                    "uploadedDocuments.$.analysis.faq": analysisResults.faq,
                    "uploadedDocuments.$.analysis.topics": analysisResults.topics,
                    "uploadedDocuments.$.analysis.mindmap": analysisResults.mindmap,
                    "uploadedDocuments.$.analysisStatus": finalAnalysisStatus,
                    "uploadedDocuments.$.analysisTimestamp": new Date()
                }
            }
        );
        console.log(`${logPrefix} Analysis results (Status: ${finalAnalysisStatus}) stored in DB.`);
        return { success: allIndividualAnalysesSuccessful, message: `Analysis ${allIndividualAnalysesSuccessful ? 'completed' : 'completed with failures'}.`, results: analysisResults };
    } catch (dbError) {
        console.error(`${logPrefix} DB Error storing analysis results:`, dbError);
        return { success: false, message: `DB Error storing analysis: ${dbError.message}`, results: analysisResults };
    }
}

/**
 * Main worker function to orchestrate the entire process.
 */
async function run() {
    const { userId, originalName, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl } = workerData;
    let dbConnected = false;
    let overallTaskSuccess = false;
    let finalMessageToParent = "Analysis worker encountered an issue.";

    try {
        console.log(`[Analysis Worker ${process.pid}] Received task for: ${originalName}, User: ${userId}`);
        if (!process.env.MONGO_URI) throw new Error("MONGO_URI not set in worker environment.");
        if (!userId || !originalName) throw new Error("Missing userId or originalName in workerData.");
        
        await connectDB(process.env.MONGO_URI);
        dbConnected = true;
        console.log(`[Analysis Worker ${process.pid}] DB Connected for ${originalName}.`);

        await User.updateOne(
            { _id: userId, "uploadedDocuments.filename": originalName },
            { $set: { "uploadedDocuments.$.analysisStatus": "processing" } }
        );
        console.log(`[Analysis Worker ${process.pid}] Set analysisStatus to 'processing' for ${originalName}.`);

        if (!textForAnalysis || textForAnalysis.trim() === '') {
            console.warn(`[Analysis Worker ${process.pid}] No text provided for analysis for ${originalName}. Marking as skipped.`);
            await User.updateOne(
                { _id: userId, "uploadedDocuments.filename": originalName },
                { $set: { "uploadedDocuments.$.analysisStatus": "skipped_no_text", "uploadedDocuments.$.analysisTimestamp": new Date() } }
            );
            overallTaskSuccess = true;
            finalMessageToParent = "Analysis skipped: No text provided.";
        } else {
            const analysisServiceResult = await performFullAnalysis(
                userId, originalName, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl
            );
            overallTaskSuccess = analysisServiceResult.success;
            finalMessageToParent = analysisServiceResult.message;
        }

        if (parentPort) {
            parentPort.postMessage({ success: overallTaskSuccess, originalName, message: finalMessageToParent });
        }

    } catch (error) {
        console.error(`[Analysis Worker ${process.pid}] Critical error processing '${originalName}':`, error);
        finalMessageToParent = error.message || "Unknown critical error in Analysis worker.";
        overallTaskSuccess = false;
        if (dbConnected && userId && originalName) {
            try {
                await User.updateOne(
                    { _id: userId, "uploadedDocuments.filename": originalName },
                    { $set: { "uploadedDocuments.$.analysisStatus": "failed_critical" } }
                );
            } catch (dbUpdateError) {
                console.error(`[Analysis Worker ${process.pid}] Failed to update status to 'failed_critical':`, dbUpdateError);
            }
        }
        if (parentPort) {
            parentPort.postMessage({ success: false, originalName, error: finalMessageToParent });
        }
    } finally {
        if (dbConnected) {
            await mongoose.disconnect();
            console.log(`[Analysis Worker ${process.pid}] DB Disconnected for ${originalName}.`);
        }
        console.log(`[Analysis Worker ${process.pid}] Finished task for ${originalName}. Overall Success: ${overallTaskSuccess}`);
    }
}

run();