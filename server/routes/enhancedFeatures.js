/**
 * Enhanced Features API Routes
 * Provides endpoints for all new enhanced features
 */

const express = require('express');
const router = express.Router();

// Import enhanced services
const EnhancedPromptSystem = require('../services/enhancedPromptSystem');
const PerformanceOptimizer = require('../services/performanceOptimizer');
const AgenticProtocolManager = require('../services/agenticProtocolManager');
const logger = require('../services/comprehensiveLogger');
const EnhancedContentGenerator = require('../services/enhancedContentGenerator');
const EnhancedPersonalization = require('../services/enhancedPersonalization');
const LLMTrainer = require('../services/llmTrainer');

// Initialize services
const promptSystem = new EnhancedPromptSystem();
const performanceOptimizer = new PerformanceOptimizer();
const agenticManager = new AgenticProtocolManager();
const contentGenerator = new EnhancedContentGenerator();
const personalization = new EnhancedPersonalization();
const llmTrainer = new LLMTrainer();

// Middleware for logging all requests
router.use(logger.createExpressMiddleware());

/**
 * Content Generation Endpoints
 */

// Generate report from chat input
router.post('/generate/report', async (req, res) => {
    try {
        const { input, options = {} } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'generate_report', { input: input.substring(0, 100) });
        
        const result = await contentGenerator.generateFromChatInput(input, 'report', options);
        
        res.json({
            success: result.success,
            data: result.success ? result.result : null,
            error: result.error || null,
            metadata: result.metadata
        });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/generate/report', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate presentation from chat input
router.post('/generate/presentation', async (req, res) => {
    try {
        const { input, options = {} } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'generate_presentation', { input: input.substring(0, 100) });
        
        const result = await contentGenerator.generateFromChatInput(input, 'presentation', options);
        
        res.json({
            success: result.success,
            data: result.success ? result.result : null,
            error: result.error || null,
            metadata: result.metadata
        });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/generate/presentation', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate podcast script from chat input
router.post('/generate/podcast', async (req, res) => {
    try {
        const { input, options = {} } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'generate_podcast', { input: input.substring(0, 100) });
        
        const result = await contentGenerator.generateFromChatInput(input, 'podcast', options);
        
        res.json({
            success: result.success,
            data: result.success ? result.result : null,
            error: result.error || null,
            metadata: result.metadata
        });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/generate/podcast', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * LLM Training Endpoints
 */

// Start subject-specific training
router.post('/training/start', async (req, res) => {
    try {
        const { subject, config = {} } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'start_llm_training', { subject });
        
        const result = await llmTrainer.startSubjectTraining(subject, config);
        
        res.json(result);
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/training/start', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get training status
router.get('/training/status/:trainingId', async (req, res) => {
    try {
        const { trainingId } = req.params;
        const status = llmTrainer.getTrainingStatus(trainingId);
        
        if (!status) {
            return res.status(404).json({ success: false, error: 'Training job not found' });
        }
        
        res.json({ success: true, data: status });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/training/status', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available subject experts
router.get('/training/experts', async (req, res) => {
    try {
        const experts = llmTrainer.getAvailableExperts();
        res.json({ success: true, data: experts });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/training/experts', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get training analytics
router.get('/training/analytics', async (req, res) => {
    try {
        const analytics = llmTrainer.getTrainingAnalytics();
        res.json({ success: true, data: analytics });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/training/analytics', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Personalization Endpoints
 */

// Get user profile
router.get('/personalization/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const profile = personalization.getUserProfile(userId);
        
        if (!profile) {
            return res.status(404).json({ success: false, error: 'User profile not found' });
        }
        
        res.json({ success: true, data: profile });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/personalization/profile', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user profile from interaction
router.post('/personalization/update', async (req, res) => {
    try {
        const { userId, interaction } = req.body;
        
        await personalization.updateProfileFromInteraction(userId, interaction);
        
        res.json({ success: true, message: 'Profile updated successfully' });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/personalization/update', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get personalized configuration
router.post('/personalization/config', async (req, res) => {
    try {
        const { userId, query, conversationHistory = [] } = req.body;
        
        const config = await personalization.generatePersonalizedConfig(userId, query, conversationHistory);
        
        res.json({ success: true, data: config });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/personalization/config', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Agentic Protocol Endpoints
 */

// Start agentic workflow
router.post('/agentic/workflow/start', async (req, res) => {
    try {
        const { workflowConfig } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'start_agentic_workflow', { type: workflowConfig.type });
        
        const result = await agenticManager.startAgenticWorkflow(workflowConfig);
        
        res.json({ success: true, data: result });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/agentic/workflow/start', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Register agent
router.post('/agentic/agent/register', async (req, res) => {
    try {
        const { agentConfig } = req.body;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'register_agent', { name: agentConfig.name });
        
        const agentId = agenticManager.registerAgent(agentConfig);
        
        res.json({ success: true, data: { agentId } });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/agentic/agent/register', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get system status
router.get('/agentic/status', async (req, res) => {
    try {
        const status = agenticManager.getSystemStatus();
        res.json({ success: true, data: status });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/agentic/status', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Performance & Analytics Endpoints
 */

// Get performance metrics
router.get('/performance/metrics', async (req, res) => {
    try {
        const metrics = performanceOptimizer.getMetrics();
        res.json({ success: true, data: metrics });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/performance/metrics', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get system analytics
router.get('/analytics/system', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        const analytics = logger.getSystemAnalytics(timeRange);
        res.json({ success: true, data: analytics });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/analytics/system', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user activity summary
router.get('/analytics/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange = '24h' } = req.query;
        
        const summary = logger.getUserActivitySummary(userId, timeRange);
        res.json({ success: true, data: summary });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/analytics/user', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get dashboard data
router.get('/analytics/dashboard', async (req, res) => {
    try {
        const dashboardData = logger.getDashboardData();
        res.json({ success: true, data: dashboardData });
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/analytics/dashboard', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export logs
router.get('/analytics/export/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { timeRange = '24h', format = 'json' } = req.query;
        const userId = req.headers['x-user-id'] || 'anonymous';
        
        await logger.logUserActivity(userId, 'export_logs', { category, timeRange, format });
        
        const logs = await logger.exportLogs(category, timeRange, format);
        
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${category}_${timeRange}.csv"`);
            res.send(logs);
        } else {
            res.json({ success: true, data: logs });
        }
        
    } catch (error) {
        await logger.logError(error, { endpoint: '/analytics/export', userId: req.headers['x-user-id'] });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * File Download Endpoint
 */
router.get('/files/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const userId = req.headers['x-user-id'] || 'anonymous';
        const path = require('path');
        const fs = require('fs').promises;

        await logger.logUserActivity(userId, 'download_file', { filename });

        const filePath = path.join(__dirname, '..', 'generated_content', filename);

        // Check if file exists
        await fs.access(filePath);

        // Set appropriate headers for download
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'application/octet-stream';

        if (ext === '.pptx') {
            contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        } else if (ext === '.pdf') {
            contentType = 'application/pdf';
        } else if (ext === '.docx') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (ext === '.xlsx') {
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (ext === '.txt') {
            contentType = 'text/plain';
        }

        // Set CORS headers for download
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

        // Set download headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Send file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[EnhancedDownload] Error sending file ${filename}:`, err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading file' });
                }
            } else {
                console.log(`[EnhancedDownload] Successfully sent file: ${filename}`);
            }
        });

    } catch (error) {
        await logger.logError(error, { endpoint: '/files/download', userId: req.headers['x-user-id'] });
        res.status(404).json({ success: false, error: 'File not found' });
    }
});

module.exports = router;
