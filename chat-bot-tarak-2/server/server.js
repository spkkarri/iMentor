// server/server.js

/**
 * @fileoverview Main entry point for the Node.js backend server.
 * This file handles server configuration, middleware, route registration,
 * database connection, and graceful shutdown.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// PINOLOGGER: Step 1 - Import the logger and pino-http
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');

// --- Local Module Imports ---
const connectDB = require('./config/db');
const { getLocalIPs } = require('./utils/networkUtils');
const { performAssetCleanup } = require('./utils/assetCleanup');
const User = require('./models/User');

// Route Imports
const generationRoutes = require('./routes/generation');
const podcastRoutes = require('./routes/podcast');
const podcastsRoutes = require('./routes/podcasts'); // <-- ADDED IMPORT

// --- Constants & Configuration ---
const DEFAULT_PORT = 6002;
const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/chatbotGeminiDB6';
const DEFAULT_PYTHON_SERVICE_URL = 'http://localhost:9000';

let port = process.env.PORT || DEFAULT_PORT;
let mongoUri = process.env.MONGO_URI || '';
let pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL || '';

// --- Express App Setup ---
const app = express();

// PINOLOGGER: Step 2 - Add the pino-http middleware. This should be one of the first middleware.
// It will automatically log every incoming request and its response.
app.use(pinoHttp({ logger }));

app.use(cors());
app.use(express.json());

// Serve static files from the generated_podcasts directory
app.use('/podcasts', express.static(path.join(__dirname, 'ai_core_service', 'generated_podcasts')));


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
app.use('/api/generation', generationRoutes);
app.use('/api/podcast', podcastRoutes);
app.use('/api/podcasts', podcastsRoutes); // <-- ADDED ROUTE REGISTRATION


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    // PINOLOGGER: Step 3 - Use the logger for unhandled errors.
    // req.log is attached by pino-http and is the child logger for this request.
    const errorLogger = req.log || logger;
    errorLogger.error({ err, stack: err.stack }, "Unhandled Error caught by global error handler");

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

async function seedAdminUser() {
    // PINOLOGGER: Replaced console logs with logger
    logger.info("--- Checking for Admin User ---");
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        logger.warn("Admin credentials (ADMIN_USERNAME, ADMIN_PASSWORD) not found in .env file. Skipping admin user creation.");
        return;
    }

    try {
        const existingAdmin = await User.findOne({ username: adminUsername });
        if (existingAdmin) {
            logger.info("Admin user already exists in the database.");
            return;
        }

        logger.info(`Admin user '${adminUsername}' not found. Creating...`);
        const adminUser = new User({
            username: adminUsername,
            password: adminPassword,
            role: 'admin',
            apiKeyAccessRequest: { status: 'approved', processedAt: Date.now() },
            hasProvidedApiKeys: true
        });

        await adminUser.save();
        logger.info("Admin user created successfully.");

    } catch (error) {
        logger.fatal({ err: error }, "CRITICAL ERROR seeding admin user. Exiting.");
        process.exit(1);
    }
}

const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    cli.close();
    try {
        if (server) {
            server.close(async () => {
                logger.info('HTTP server closed.');
                try {
                    await mongoose.connection.close();
                    logger.info('MongoDB connection closed.');
                } catch (dbCloseError) {
                    logger.error({ err: dbCloseError }, "Error closing MongoDB connection.");
                }
                process.exit(0);
            });
        } else {
            try { await mongoose.connection.close(); logger.info('MongoDB connection closed.'); } 
            catch (dbCloseError) { logger.error({ err: dbCloseError }, "Error closing MongoDB connection."); }
            process.exit(0);
        }
        setTimeout(() => { logger.error('Graceful shutdown timed out, forcing exit.'); process.exit(1); }, 10000);
    } catch (shutdownError) {
        logger.error({ err: shutdownError }, "Error during graceful shutdown initiation.");
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function checkPythonService(url) {
    logger.info(`Checking Python AI Core service health at ${url}...`);
    try {
        const response = await axios.get(`${url}/health`, { timeout: 7000 });
        if (response.status === 200 && response.data?.status === 'ok') {
            logger.info('Python AI Core service is available and healthy.');
            if (response.data.embedding_model_type) { logger.info(`  Embedding: ${response.data.embedding_model_type} (${response.data.embedding_model_name || 'N/A'})`); }
            if (response.data.default_index_loaded !== undefined) { logger.info(`  Default Index Loaded: ${response.data.default_index_loaded}`); }
            if (response.data.message?.includes("Warning:")) { logger.warn(`  Python Service Health Warning: ${response.data.message}`); }
            return true;
        } else {
            logger.warn(`Python AI Core service responded but status is not OK: ${response.status} - ${JSON.stringify(response.data)}`);
            return false;
        }
    } catch (error) {
        logger.warn('Python AI Core service is not reachable.');
        if (error.code === 'ECONNREFUSED') { logger.warn(`  Connection refused at ${url}. Ensure the Python AI Core service is running.`); } 
        else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) { logger.warn(`  Connection timed out to ${url}. The service might be slow to start or unresponsive.`); } 
        else { logger.warn(`  Error: ${error.message}`); }
        logger.warn('  Features dependent on this service (e.g., RAG) may be impaired.');
        return false;
    }
}

async function ensureServerDirectories() {
    const dirs = [path.join(__dirname, 'assets'), path.join(__dirname, 'backup_assets'), path.join(__dirname, 'logs')]; // PINOLOGGER: Added logs dir
    logger.info("Ensuring server directories exist...");
    try {
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) { await fs.promises.mkdir(dir, { recursive: true }); logger.info(`  Created directory: ${dir}`); }
        }
        logger.info("Server directories checked/created.");
    } catch (error) {
        logger.fatal({ err: error }, 'Error creating essential server directories. Exiting.');
        throw error;
    }
}

function askQuestion(query) { return new Promise(resolve => cli.question(query, resolve)); }

async function configureAndStart() {
    logger.info("--- Starting Server Configuration ---");
    logger.info("API keys are handled per-user. No global key check needed.");
    if (!mongoUri) { const answer = await askQuestion(`Enter MongoDB URI or press Enter for default (${DEFAULT_MONGO_URI}): `); mongoUri = answer.trim() || DEFAULT_MONGO_URI; }
    logger.info(`Using MongoDB URI: ${mongoUri.replace(/:.*@/, ':****@')}`); // Avoid logging password
    if (!pythonServiceUrl) { const answer = await askQuestion(`Enter Python AI Core Service URL or press Enter for default (${DEFAULT_PYTHON_SERVICE_URL}): `); pythonServiceUrl = answer.trim() || DEFAULT_PYTHON_SERVICE_URL; }
    logger.info(`Using Python AI Core Service URL: ${pythonServiceUrl}`);
    logger.info(`Node.js server will attempt to listen on port: ${port} (from .env or default)`);
    cli.close();
    process.env.MONGO_URI = mongoUri;
    process.env.PYTHON_AI_CORE_SERVICE_URL = pythonServiceUrl;
    logger.info("--- Configuration Complete ---");
    await startServer();
}

async function startServer() {
    logger.info("--- Starting Server Initialization ---");
    try {
        await ensureServerDirectories();
        await connectDB(mongoUri);
        await seedAdminUser();
        await performAssetCleanup();
        await checkPythonService(pythonServiceUrl);
        const PORT = parseInt(port, 10);
        server = app.listen(PORT, '0.0.0.0', () => {
            const nodeEnv = process.env.NODE_ENV || 'development';
            const availableIPs = getLocalIPs();
            const networkIP = availableIPs.length > 0 ? availableIPs[0] : 'your-network-ip';

            // PINOLOGGER: Final startup message using logger
            const startupMessage = `
=====================================================
🚀 SERVER READY!
   - Environment: ${nodeEnv}
   - Port: ${PORT}
   - Local:   http://localhost:${PORT}
   - Network: http://${networkIP}:${PORT}
=====================================================`;
            logger.info(startupMessage);
        });
    } catch (error) {
        logger.fatal({ err: error }, `FAILED TO START NODE.JS SERVER`);
        if (error.code === 'EADDRINUSE') {
            logger.fatal(`Port ${port} is already in use. Please stop the other application or change the PORT in your .env file.`);
        }
        process.exit(1);
    }
}

// --- Start the Application ---
configureAndStart();