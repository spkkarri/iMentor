// server/server.js
const dotenv = require("dotenv");
dotenv.config();


require('./instrument.js');
const { register, httpRequestDurationMicroseconds } = require('./utils/metrics');
const Sentry = require("@sentry/node"); // Sentry must be required

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const mongoose = require("mongoose");

// --- Custom Modules & Middleware ---
const connectDB = require("./config/db");
const { getLocalIPs } = require("./utils/networkUtils");
const { performAssetCleanup } = require("./utils/assetCleanup");
const { authMiddleware } = require("./middleware/authMiddleware");
const {
  fixedAdminAuthMiddleware,
} = require("./middleware/fixedAdminAuthMiddleware");
const { ipFilterMiddleware } = require("./middleware/ipFilterMiddleware");
const { connectRedis } = require("./config/redisClient");
const { logger } = require('./utils/logger');

logger.info('--- WINSTON LOGGER INITIALIZED IN SERVER.JS ---');

// --- Route Imports ---
const networkRoutes = require("./routes/network");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chat");
const uploadRoutes = require("./routes/upload");
const analysisRoutes = require("./routes/analysis");
const adminMasterRouter = require('./routes/index'); 
const subjectsRoutes = require("./routes/subjects");
const generationRoutes = require("./routes/generationRoutes");
const exportRoutes = require("./routes/export");
const kgRoutes = require("./routes/kg");
const llmConfigRoutes = require("./routes/llmConfig");
const toolsRoutes = require("./routes/tools");
const learningRoutes = require("./routes/learning");
const learningPathRoutes = require("./routes/learningPath");
const knowledgeSourceRoutes = require("./routes/knowledgeSource");
const analyticsRoutes = require('./routes/analytics');
const feedbackRoutes = require('./routes/feedback');
const finetuningRoutes = require('./routes/finetuning');


// --- Configuration & Express App Setup ---
const port = process.env.PORT || 5001;
const mongoUri = process.env.MONGO_URI;
const pythonRagUrl = process.env.PYTHON_RAG_SERVICE_URL;

if (!process.env.JWT_SECRET || !process.env.ENCRYPTION_SECRET) {
  logger.error("!!! FATAL: JWT_SECRET or ENCRYPTION_SECRET is not set in .env file.");
  process.exit(1);
}
if (!mongoUri) {
  logger.error("!!! FATAL: MONGO_URI is not set in .env file.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        end({ route: req.route?.path || req.path, code: res.statusCode, method: req.method });
    });
    next();
});

// --- API Route Mounting ---
app.get("/", (req, res) => res.send("AI Tutor Backend API is running..."));
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});
app.use("/api/network", networkRoutes);
app.use("/api/auth", authRoutes);

// --- Admin Routes ---
// Apply the fixed admin auth middleware to the single MASTER admin router.
// This ensures all routes defined in ./routes/admin/* are protected correctly.
app.use('/api/admin/analytics', fixedAdminAuthMiddleware, analyticsRoutes);
app.use('/api/admin/finetuning', fixedAdminAuthMiddleware, finetuningRoutes);
app.use("/api/admin", fixedAdminAuthMiddleware, adminMasterRouter); // General route goes LAST

// All subsequent routes are protected by the general JWT authMiddleware
app.use(authMiddleware);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/learning/paths", learningPathRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/subjects", subjectsRoutes);
app.use("/api/generate", generationRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/kg", kgRoutes);
app.use("/api/llm", llmConfigRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/knowledge-sources", knowledgeSourceRoutes);

// --- SENTRY ERROR HANDLER ---
// This must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// --- YOUR CUSTOM ERROR HANDLER ---
app.use('/api/feedback', feedbackRoutes);

// --- Centralized Error Handling ---
app.use((err, req, res, next) => {
  logger.error("Unhandled Error:", {
      message: err.message,
      stack: err.stack,
      status: err.status,
      url: req.originalUrl,
      method: req.method
  });

  const statusCode = err.status || 500;
  const message = err.message || "An internal server error occurred.";
  if (!res.headersSent) {
    res.status(statusCode).json({ message });
  }
});


// --- Server Startup Logic ---
async function startServer() {
  logger.info("--- Starting Server Initialization ---");
  try {
    await ensureServerDirectories();
    await connectDB(mongoUri);
    await performAssetCleanup();
    await checkRagService(pythonRagUrl);
    await connectRedis();

    const server = app.listen(port, "0.0.0.0", () => {
      logger.info("=== Node.js Server Ready ===");
      logger.info(`🚀 Server listening on port ${port}`);
      getLocalIPs().forEach((ip) => {
        logger.info(`   - http://${ip}:${port}`);
      });
      logger.info("============================");
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down...`);
      server.close(() => {
        mongoose.connection.close(false, () => {
          logger.info("MongoDB connection closed.");
          process.exit(0);
        });
      });
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("!!! Failed to start Node.js server:", { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Helper functions
async function ensureServerDirectories() {
  const dirs = [
    path.join(__dirname, "assets"),
    path.join(__dirname, "backup_assets"),
    path.join(__dirname, "generated_docs"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
  }
}
async function checkRagService(url) {
  if (!url) {
    logger.warn("Python RAG service URL not configured.");
    return;
  }
  try {
    const response = await axios.get(`${url}/health`, { timeout: 7000 });
    if (response.data.status === "ok") {
      logger.info("✓ Python RAG service is available.");
    } else {
      logger.warn(
        `! Python RAG service responded but is not healthy. Status: ${response.data.status}`
      );
    }
  } catch (error) {
    logger.warn("! Python RAG service is not reachable.");
  }
}

startServer();