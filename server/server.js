// server/server.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables FIRST before importing any services
dotenv.config({ path: path.resolve(__dirname, '.env') });

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
const { injectUserApiKeys, enforceUserApiKeys } = require('./middleware/apiKeyMiddleware');
const MCPWebSocketHandler = require('./mcp_system/websocket_handler');

const PORT = process.env.PORT || 4007;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotGeminiDB4';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    console.warn("AI-powered features will be disabled, but the server will still run.");
    console.warn("To enable AI features, set GEMINI_API_KEY in your .env file.");
}

const app = express();
app.use(cors());
app.use(express.json());

// Apply user API key middleware to all routes
app.use('/api', injectUserApiKeys);

// Optionally enforce user API keys in production
// Uncomment the next line to require users to use their own API keys in production
// app.use('/api', enforceUserApiKeys);

const startServer = async () => {
    try {
        console.log("--- Starting Server ---");

        // Try to connect to MongoDB with fallback
        try {
            await connectDB(MONGO_URI);
            console.log("MongoDB connected successfully");
        } catch (dbError) {
            console.warn("MongoDB connection failed:", dbError.message);
            console.warn("Server will continue without database features");
        }

        await serviceManager.initialize();

        // Initialize user service manager
        const userServiceManager = require('./services/userServiceManager');
        await userServiceManager.initialize();

        try {
            await performAssetCleanup();
        } catch (cleanupError) {
            console.warn("Asset cleanup failed:", cleanupError.message);
        }

        app.use((req, res, next) => {
            req.serviceManager = serviceManager;
            next();
        });

        app.use('/podcasts', express.static(path.join(__dirname, 'public', 'podcasts')));
        app.use('/audio', express.static(path.join(__dirname, 'public', 'audio')));

        // Routes
        app.get('/', (req, res) => res.send('Chatbot Backend API is running...'));
        app.use('/api/network', require('./routes/network'));
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/chat', require('./routes/chat'));
        app.use('/api/upload', require('./routes/upload'));
        app.use('/api/files', require('./routes/files'));
        app.use('/api/podcast', require('./routes/podcast'));
        app.use('/api/mindmap', require('./routes/mindmap'));
        app.use('/api/memory', require('./routes/memory')); // <-- ADD THIS LINE
        app.use('/api/mcp', require('./routes/mcp')); // MCP (Model Context Protocol) routes
        app.use('/api/multi-model', require('./routes/multiModel')); // Multi-model LLM routes
        app.use('/api/multi-llm', require('./routes/multiLLM')); // Intelligent Multi-LLM routing
        app.use('/api/user-ollama', require('./routes/userOllama')); // User-specific Ollama configuration
        app.use('/api/user', require('./routes/userSettings')); // User settings and API key management
        app.use('/api/models', require('./routes/modelRouter')); // Model management and switching
        app.use('/api/training', require('./routes/training')); // LLM Training routes
        app.use('/api/subjects', require('./routes/subjects')); // Custom subjects and model management
        app.use('/api/user-api-keys', require('./routes/userApiKeys')); // User API key management
        app.use('/api/admin', require('./routes/admin')); // Admin dashboard and user management
        app.use('/api/research', require('./routes/testResearch')); // Advanced Deep Research testing
        app.use('/api/agents', require('./routes/agents')); // MCP Agent system
        app.use('/api/agent-monitoring', require('./routes/agentMonitoring')); // Agent monitoring and analytics
        app.use('/api/enhanced', require('./routes/enhancedFeaturesSimple')); // Enhanced features (reports, training, personalization)

        // Initialize monitoring routes with metrics collector
        const monitoringRoutes = require('./routes/monitoring');
        monitoringRoutes.setMetricsCollector(serviceManager.getMetricsCollector());
        app.use('/api/monitoring', monitoringRoutes);

        const availableIPs = getLocalIPs();
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=== Server Ready ===');
            console.log(`Server listening on port ${PORT}`);
            console.log('Access URLs:');
            availableIPs.forEach(ip => {
                console.log(`   - http://${ip}:4004 (Frontend) -> Backend: http://${ip}:${PORT}`);
            });
            console.log('==================\n');
        });

        // Initialize WebSocket handler for MCP agents
        const mcpWebSocketHandler = new MCPWebSocketHandler(server);
        console.log('🔌 MCP WebSocket handler initialized');

        // Graceful shutdown handling
        const gracefulShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

            server.close(async () => {
                console.log('HTTP server closed');

                try {
                    await serviceManager.cleanup();
                    console.log('Services cleaned up');

                    // Only close MongoDB if it's connected
                    if (mongoose.connection.readyState === 1) {
                        await mongoose.connection.close();
                        console.log('Database connection closed');
                    }

                    console.log('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
        console.error("!!! Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();
module.exports = app;