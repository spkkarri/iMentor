// server/server.js
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mongoose = require('mongoose');

const langchainVectorStore = require('./services/LangchainVectorStore');
const connectDB = require('./config/db');
const { getLocalIPs } = require('./utils/networkUtils');
const { performAssetCleanup } = require('./utils/assetCleanup');
const File = require('./models/File');
const serviceManager = require('./services/serviceManager');

// Load environment variables from .env file (absolute path)
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Configurations
const PORT = process.env.PORT || 5007;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY environment variable is not set.");
    console.warn("⚠️  AI-powered features will be disabled, but the server will still run.");
    console.warn("⚠️  To enable AI features, set GEMINI_API_KEY in your .env file.");
}

const app = express();

// Middleware early registration
app.use(cors());
app.use(express.json());

// Handle Multer errors middleware
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File is too large. The maximum allowed size is 50MB.' });
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    next(err);
}
app.use(handleMulterError);

// Ensure necessary directories exist
const ensureDirectories = async () => {
    const dirs = [
        path.join(__dirname, 'assets'), 
        path.join(__dirname, 'backup_assets'),
        path.join(__dirname, 'public', 'podcasts')
    ];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    }
};

// Reprocess files for Retrieval-Augmented Generation (RAG)
const reprocessFilesForRAG = async () => {
    try {
        console.log("--- Starting RAG File Reprocessing ---");
        
        const allFiles = await File.find({}).sort({ createdAt: -1 });
        console.log(`📊 Found ${allFiles.length} files to reprocess for RAG`);
        
        if (allFiles.length === 0) {
            console.log("✅ No files to reprocess");
            return;
        }
        
        let processedCount = 0;
        let errorCount = 0;
        
        const { documentProcessor } = serviceManager.getServices();

        if (!documentProcessor) {
            console.error("❌ DocumentProcessor service not available. Skipping RAG reprocessing.");
            return;
        }

        for (const file of allFiles) {
            try {
                if (!fs.existsSync(file.path)) {
                    console.log(`❌ File not found on disk: ${file.originalname} (${file.path})`);
                    errorCount++;
                    continue;
                }
                console.log(`🔄 Reprocessing: ${file.originalname} (User: ${file.user})`);
                const processingResult = await documentProcessor.processFile(file.path, {
                    userId: file.user,
                    originalName: file.originalname,
                    fileType: path.extname(file.path).substring(1)
                });
                console.log(`✅ Reprocessed: ${file.originalname} - ${processingResult.chunksAdded} chunks added`);
                processedCount++;
            } catch (error) {
                console.error(`❌ Error reprocessing ${file.originalname}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`📈 RAG Reprocessing Summary:`);
        console.log(`  • Files reprocessed successfully: ${processedCount}`);
        console.log(`  • Files with errors: ${errorCount}`);
        console.log(`  • Total files: ${allFiles.length}`);
        
        if (processedCount > 0) {
            console.log(`🎉 Successfully reprocessed ${processedCount} files for RAG!`);
            console.log('💡 RAG system is now ready to answer questions from your documents.');
        }
        
        console.log("--- Finished RAG File Reprocessing ---\n");
        
    } catch (error) {
        console.error("❌ Error during RAG file reprocessing:", error);
    }
};

// Start server function
let server;
const startServer = async () => {
    try {
        console.log("--- Starting Server ---");

        await ensureDirectories();
        await connectDB(MONGO_URI);
        console.log("✓ MongoDB connected successfully");

        await langchainVectorStore.initialize();
        console.log("Vector store initialized successfully");

        await serviceManager.initialize();
        await performAssetCleanup();
        await reprocessFilesForRAG();

        // Inject serviceManager into requests
        app.use((req, res, next) => {
            req.serviceManager = serviceManager;
            next();
        });

        // Static files for podcasts with proper MIME types
        app.use('/podcasts', express.static(path.join(__dirname, 'public', 'podcasts'), {
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('.wav')) {
                    res.setHeader('Content-Type', 'audio/wav');
                } else if (filePath.endsWith('.mp3')) {
                    res.setHeader('Content-Type', 'audio/mpeg');
                }
            }
        }));

        // Routes
        app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));
        app.use('/api/network', require('./routes/network'));
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/chat', require('./routes/chat'));
        app.use('/api/upload', require('./routes/upload'));
        app.use('/api/files', require('./routes/files'));
        app.use('/api/podcast', require('./routes/podcast'));
        app.use('/api/mindmap', require('./routes/mindmap'));

        // Error handling middleware (last)
        app.use((err, req, res, next) => {
            console.error("Error in request:", err);
            res.status(500).send('Internal Server Error');
        });

        // Start listening
        const availableIPs = getLocalIPs();
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=== Server Ready ===');
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log('Access URLs:');
            const frontendPorts = [3004];
            availableIPs.forEach(ip => {
                frontendPorts.forEach(fp => {
                    console.log(`   - http://${ip}:${fp} (Frontend) -> Backend: http://${ip}:${PORT}`);
                });
            });
            console.log('==================\n');
        });
    } catch (error) {
        console.error("!!! Failed to start server:", error.message);
        process.exit(1);
    }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    try {
        if (server) {
            server.close(async () => {
                console.log('HTTP server closed.');
                await mongoose.connection.close();
                console.log('MongoDB connection closed.');
                process.exit(0);
            });
        } else {
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
            process.exit(0);
        }
        setTimeout(() => {
            console.error('Graceful shutdown timed out, forcing exit.');
            process.exit(1);
        }, 10000);
    } catch (error) {
        console.error("Error during graceful shutdown:", error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server if main module
if (require.main === module) {
    startServer();
}

module.exports = app;
