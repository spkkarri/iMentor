// server/server.js

/**
 * @fileoverview Main entry point for the Node.js backend server.
 * This file handles server configuration, middleware, route registration,
 * database connection, and graceful shutdown.
 */

// ==================================================================
//  START OF THE DEFINITIVE FIX: Corrected module imports
// ==================================================================
const express = require('express');
const cors = require('cors'); // CORRECT: Use require() to import the module
const path = require('path'); // CORRECT: Use require()
const fs = require('fs');     // CORRECT: Use require()
const axios = require('axios'); // CORRECT: Use require()
const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();
// ==================================================================
//  END OF THE DEFINITIVE FIX
// ==================================================================


// --- Local Module Imports ---
const connectDB = require('./config/db');
const { getLocalIPs } = require('./utils/networkUtils');
const { performAssetCleanup } = require('./utils/assetCleanup');
const User = require('./models/User'); // <-- Import the User model

// --- Constants & Configuration ---
const DEFAULT_PORT = 5000;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/chatbotGeminiDB6';
const DEFAULT_PYTHON_SERVICE_URL = 'http://localhost:9000';

let port = process.env.PORT || DEFAULT_PORT;
let mongoUri = process.env.MONGO_URI || '';
let pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL || '';

// --- Express App Setup ---
const app = express();
app.use(cors()); // This line will now work correctly
app.use(express.json());

// --- Route Registration ---
app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));
app.use('/api/network', require('./routes/network'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/files', require('./routes/files'));
app.use('/api/syllabus', require('./routes/syllabus'));
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin', require('./routes/admin'));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    const statusCode = err.status || 500;
    let message = err.message || 'An internal server error occurred.';
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'An internal server error occurred.';
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(statusCode).json({ message });
    }
    res.status(statusCode).send(message);
});

// --- Server Lifecycle & Helper Functions ---
let server;
const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ==================================================================
//  START OF NEW FEATURE MODIFICATION: Admin Seeding Logic
// ==================================================================
/**
 * Checks for and creates the default admin user from .env variables if it doesn't exist.
 */
async function seedAdminUser() {
    console.log("\n--- Checking for Admin User ---");
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        console.warn("! Admin credentials (ADMIN_USERNAME, ADMIN_PASSWORD) not found in .env file. Skipping admin user creation.");
        return;
    }

    try {
        const existingAdmin = await User.findOne({ username: adminUsername });
        if (existingAdmin) {
            console.log("✓ Admin user already exists in the database.");
            return;
        }

        console.log(`! Admin user '${adminUsername}' not found. Creating...`);
        const adminUser = new User({
            username: adminUsername,
            password: adminPassword, // The 'pre-save' hook will hash this automatically
            role: 'admin',
            // Admin is pre-approved to use system keys
            apiKeyAccessRequest: {
                status: 'approved',
                processedAt: Date.now()
            },
            hasProvidedApiKeys: true // The admin doesn't need to be prompted
        });

        await adminUser.save();
        console.log("✓ Admin user created successfully.");

    } catch (error) {
        console.error("!!! CRITICAL ERROR seeding admin user:", error);
        // This is a critical failure, so we exit to prevent running in a bad state.
        process.exit(1);
    }
}
// ==================================================================
//  END OF NEW FEATURE MODIFICATION
// ==================================================================


const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    cli.close();
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
            try { await mongoose.connection.close(); console.log('MongoDB connection closed.'); } 
            catch (dbCloseError) { console.error("Error closing MongoDB connection:", dbCloseError); }
            process.exit(0);
        }
        setTimeout(() => { console.error('Graceful shutdown timed out, forcing exit.'); process.exit(1); }, 10000);
    } catch (shutdownError) {
        console.error("Error during graceful shutdown initiation:", shutdownError);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function checkPythonService(url) {
    console.log(`\nChecking Python AI Core service health at ${url}...`);
    try {
        const response = await axios.get(`${url}/health`, { timeout: 7000 });
        if (response.status === 200 && response.data?.status === 'ok') {
            console.log('✓ Python AI Core service is available and healthy.');
            if (response.data.embedding_model_type) { console.log(`  Embedding: ${response.data.embedding_model_type} (${response.data.embedding_model_name || 'N/A'})`); }
            if (response.data.default_index_loaded !== undefined) { console.log(`  Default Index Loaded: ${response.data.default_index_loaded}`); }
            if (response.data.message?.includes("Warning:")) { console.warn(`  Python Service Health Warning: ${response.data.message}`); }
            return true;
        } else {
            console.warn(`! Python AI Core service responded but status is not OK: ${response.status} - ${JSON.stringify(response.data)}`);
            return false;
        }
    } catch (error) {
        console.warn('! Python AI Core service is not reachable.');
        if (error.code === 'ECONNREFUSED') { console.warn(`  Connection refused at ${url}. Ensure the Python AI Core service is running.`); } 
        else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) { console.warn(`  Connection timed out to ${url}. The service might be slow to start or unresponsive.`); } 
        else { console.warn(`  Error: ${error.message}`); }
        console.warn('  Features dependent on this service (e.g., RAG) may be impaired.');
        return false;
    }
}

async function ensureServerDirectories() {
    const dirs = [path.join(__dirname, 'assets'), path.join(__dirname, 'backup_assets')];
    console.log("\nEnsuring server directories exist...");
    try {
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) { await fs.promises.mkdir(dir, { recursive: true }); console.log(`  Created directory: ${dir}`); }
        }
        console.log("✓ Server directories checked/created.");
    } catch (error) {
        console.error('!!! Error creating essential server directories:', error);
        throw error;
    }
}

function askQuestion(query) { return new Promise(resolve => cli.question(query, resolve)); }

async function configureAndStart() {
    console.log("--- Starting Server Configuration ---");
    console.log("✓ API keys are handled per-user. No global key check needed.");
    if (!mongoUri) { const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `); mongoUri = answer.trim() || DEFAULT_MONGO_URI; }
    console.log(`Using MongoDB URI: ${mongoUri}`);
    if (!pythonServiceUrl) { const answer = await askQuestion(`Enter Python AI Core Service URL or press Enter for default (${DEFAULT_PYTHON_SERVICE_URL}): `); pythonServiceUrl = answer.trim() || DEFAULT_PYTHON_SERVICE_URL; }
    console.log(`Using Python AI Core Service URL: ${pythonServiceUrl}`);
    console.log(`Node.js server will attempt to listen on port: ${port} (from .env or default)`);
    cli.close();
    process.env.MONGO_URI = mongoUri;
    process.env.PYTHON_AI_CORE_SERVICE_URL = pythonServiceUrl;
    console.log("--- Configuration Complete ---");
    await startServer();
}

async function startServer() {
    console.log("\n--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories();
        await connectDB(mongoUri);

        // ==================================================================
        //  START OF NEW FEATURE MODIFICATION: Call the seeding function
        // ==================================================================
        await seedAdminUser(); // Call the new function right after DB connection
        // ==================================================================
        //  END OF NEW FEATURE MODIFICATION
        // ==================================================================
        
        await performAssetCleanup();
        await checkPythonService(pythonServiceUrl);
        const PORT = parseInt(port, 10);
        server = app.listen(PORT, '0.0.0.0', () => {
            const nodeEnv = process.env.NODE_ENV || 'development';
            const availableIPs = getLocalIPs();
            const networkIP = availableIPs.length > 0 ? availableIPs[0] : 'your-network-ip';
            console.log(`\n=== Node.js Server Ready ===`);
            console.log(`🚀 Server running on port ${PORT} in ${nodeEnv} mode.`);
            console.log(`   - Local:   http://localhost:${PORT}`);
            if (networkIP !== 'your-network-ip' && networkIP !== '127.0.0.1') {
                console.log(`   - Network: http://${networkIP}:${PORT}`);
            }
            console.log('============================\n');
        });
    } catch (error) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!! FAILED TO START NODE.JS SERVER:", error.message);
        if (error.code === 'EADDRINUSE') {
            console.error(`!!! Port ${port} is already in use.`);
            console.error(`!!! Please stop the other application or change the PORT in your .env file.`);
        }
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit(1);
    }
}

// --- Start the Application ---
configureAndStart();