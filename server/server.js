
// server/server.js

// --- DOTENV MUST BE THE VERY FIRST THING TO RUN ---
const dotenv = require('dotenv');
dotenv.config();
// --- END DOTENV ---

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const os = require('os');
const mongoose = require('mongoose');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

// --- Custom Modules & Middleware ---
const connectDB = require('./config/db');
const { getLocalIPs } = require('./utils/networkUtils');
const { performAssetCleanup } = require('./utils/assetCleanup');
const { authMiddleware } = require('./middleware/authMiddleware');
const { fixedAdminAuthMiddleware } = require('./middleware/fixedAdminAuthMiddleware'); 

// --- Route Imports ---
const networkRoutes = require('./routes/network');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const filesRoutes = require('./routes/files');
const syllabusRoutes = require('./routes/syllabus');
const mindmapRoutes = require('./routes/mindmap');
const analysisRoutes = require('./routes/analysis');
const adminDocsRoutes = require('./routes/adminDocuments');
const subjectsRoutes = require('./routes/subjects');
const generationRoutes = require('./routes/generation');
const exportRoutes = require('./routes/export');
const kgRoutes = require('./routes/kg');
const llmConfigRoutes = require('./routes/llmConfig');

// --- Configuration Defaults & Variables (Now safely read after dotenv.config) ---
const DEFAULT_PORT = 5001;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/chatbotGeminiDB';
const DEFAULT_PYTHON_RAG_URL = 'http://localhost:5000';

let port = process.env.PORT || DEFAULT_PORT;
let mongoUri = process.env.MONGO_URI || '';
let pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL || '';
let geminiApiKey = process.env.GEMINI_API_KEY || '';

if (!process.env.JWT_SECRET || !process.env.ENCRYPTION_SECRET) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!! FATAL: JWT_SECRET or ENCRYPTION_SECRET is not set.           !!!");
    console.error("!!! Please ensure both are set in your .env file before running. !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1);
}

// --- Express Application Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Basic Root Route ---
app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));

// --- API Route Mounting ---
// Public routes
app.use('/api/network', networkRoutes);
app.use('/api/auth', authRoutes);

// Protected routes (authMiddleware applied)
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes); // <<< THIS IS THE CORRECTED LINE
app.use('/api/files', authMiddleware, filesRoutes);
app.use('/api/syllabus', authMiddleware, syllabusRoutes);
app.use('/api/mindmap', authMiddleware, mindmapRoutes);
app.use('/api/analysis', authMiddleware, analysisRoutes);
app.use('/api/subjects', authMiddleware, subjectsRoutes);
app.use('/api/generate', authMiddleware, generationRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/kg', authMiddleware, kgRoutes);
app.use('/api/llm', authMiddleware, llmConfigRoutes);

// Admin routes (uses its own dedicated middleware)
app.use('/api/admin/documents', adminDocsRoutes);


// --- Centralized Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const statusCode = err.status || 500;
    let message = err.message || 'An internal server error occurred.';
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'An internal server error occurred.';
    }
    if (req.originalUrl.startsWith('/api/')) {
         return res.status(statusCode).json({ message: message });
    }
    res.status(statusCode).send(message);
});

// --- Server Instance Variable ---
let server;

// --- Graceful Shutdown Logic ---
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    readline.close();
    try {
        if (server) {
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    await mongoose.connection.close();
                    console.log('MongoDB connection closed.');
                } catch (dbCloseError) {
                    console.error("Error closing MongoDB connection:", dbCloseError);
                }
                process.exit(0);
            });
        } else {
             try {
                 await mongoose.connection.close();
                 console.log('MongoDB connection closed (no HTTP server instance).');
             } catch (dbCloseError) {
                 console.error("Error closing MongoDB connection:", dbCloseError);
             }
            process.exit(0);
        }

        setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit.');
            process.exit(1);
        }, 10000);

    } catch (shutdownError) {
        console.error("Error during graceful shutdown initiation:", shutdownError);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- RAG Service Health Check ---
async function checkRagService(url) {
    console.log(`\nChecking RAG service health at ${url}...`);
    try {
        const response = await axios.get(`${url}/health`, { timeout: 7000 });
        if (response.status === 200 && response.data?.status === 'ok') {
            console.log('✓ Python RAG service is available and healthy.');
            const neo4jStatus = response.data?.neo4j_connection || 'unknown';
            const qdrantStatus = response.data?.qdrant_collection_status || 'unknown';
            const embeddingModel = response.data?.document_embedding_model || 'N/A';
            
            console.log(`  Embedding Model: ${embeddingModel}`);
            console.log(`  Qdrant Status: ${qdrantStatus}`);
            console.log(`  Neo4j Status: ${neo4jStatus}`);

            if (response.data.message && response.data.message.includes("Warning:")) {
                 console.warn(`  RAG Health Warning: ${response.data.message}`);
            }
            return true;
        } else {
             console.warn(`! Python RAG service responded but status is not OK: ${response.status} - ${JSON.stringify(response.data)}`);
             return false;
        }
    } catch (error) {
        console.warn('! Python RAG service is not reachable.');
        if (error.code === 'ECONNREFUSED') {
             console.warn(`  Connection refused at ${url}. Ensure the Python RAG service (e.g., server/rag_service/app.py) is running.`);
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
             console.warn(`  Connection timed out to ${url}. The Python RAG service might be slow to start or unresponsive.`);
        } else {
             console.warn(`  Error connecting to Python RAG Service: ${error.message}`);
        }
        console.warn('  RAG-dependent features (document upload processing, context retrieval) will be unavailable.');
        return false;
    }
}

// --- Directory Structure Check ---
async function ensureServerDirectories() {
    const dirs = [
        path.join(__dirname, 'assets'),
        path.join(__dirname, 'backup_assets'),
        path.join(__dirname, 'syllabi')
    ];
    console.log("\nEnsuring server directories exist...");
    try {
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
                console.log(`  Created directory: ${dir}`);
            }
        }
        console.log("✓ Server directories checked/created.");
    } catch (error) {
        console.error('!!! Error creating essential server directories:', error);
        throw error;
    }
}

// --- Prompt for Configuration ---
function askQuestion(query) {
    return new Promise(resolve => readline.question(query, resolve));
}

async function configureAndStart() {
    console.log("--- Starting Server Configuration ---");
    
    if (!geminiApiKey) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FATAL: GEMINI_API_KEY environment variable is not set. !!!");
        console.error("!!! Please set it before running the server:               !!!");
        console.error("!!! export GEMINI_API_KEY='YOUR_API_KEY'                   !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    } else {
        console.log("✓ GEMINI_API_KEY found.");
    }

    if (!mongoUri) {
        const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `);
        mongoUri = answer.trim() || DEFAULT_MONGO_URI;
    }
    console.log(`Using MongoDB URI: ${mongoUri}`);

    if (!pythonRagUrl) {
        const answer = await askQuestion(`Enter Python RAG Service URL or press Enter for default (${DEFAULT_PYTHON_RAG_URL}): `);
        pythonRagUrl = answer.trim() || DEFAULT_PYTHON_RAG_URL;
    }
    console.log(`Using Python RAG Service URL: ${pythonRagUrl}`);
    console.log(`Node.js server will listen on port: ${port}`);
    readline.close();

    process.env.MONGO_URI = mongoUri;
    process.env.PYTHON_RAG_SERVICE_URL = pythonRagUrl;

    console.log("--- Configuration Complete ---");
    await startServer();
}

// --- Asynchronous Server Startup Function ---
async function startServer() {
    console.log("\n--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories();
        await connectDB(mongoUri); 
        await performAssetCleanup(); 
        await checkRagService(pythonRagUrl);

        const PORT = port;
        const availableIPs = getLocalIPs();

        server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=== Node.js Server Ready ===');
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log('   Access the application via these URLs (using common frontend ports):');
            const frontendPorts = [3000, 3001, 8080, 5173]; 
            availableIPs.forEach(ip => {
                 frontendPorts.forEach(fp => {
                    console.log(`   - http://${ip}:${fp} (Frontend) -> Connects to Backend at http://${ip}:${PORT}`);
                 });
            });
            console.log('============================\n');
            console.log("💡 Hint: Client automatically detects backend IP based on how you access the frontend.");
            console.log(`   Ensure firewalls allow connections on port ${PORT} (Backend) and your frontend port.`);
            console.log("--- Server Initialization Complete ---");
        });

    } catch (error) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! Failed to start Node.js server:", error.message);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    }
}

// --- Execute Configuration and Server Start ---
configureAndStart();