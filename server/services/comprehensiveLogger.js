/**
 * Comprehensive Logging & Tracking System
 * Logs every user activity, interaction, model usage, and system event
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class ComprehensiveLogger extends EventEmitter {
    constructor() {
        super();
        
        this.logDirectory = path.join(__dirname, '..', 'logs');
        this.sessionLogs = new Map();
        this.userActivities = new Map();
        this.systemMetrics = {
            totalRequests: 0,
            totalUsers: 0,
            modelUsage: new Map(),
            errorCount: 0,
            averageResponseTime: 0
        };
        
        // Log categories
        this.logCategories = {
            USER_ACTIVITY: 'user_activity',
            MODEL_USAGE: 'model_usage',
            SYSTEM_EVENT: 'system_event',
            ERROR: 'error',
            PERFORMANCE: 'performance',
            SECURITY: 'security',
            API_CALL: 'api_call',
            CHAT_INTERACTION: 'chat_interaction'
        };
        
        this.initializeLogger();
    }

    /**
     * Initialize logging system
     */
    async initializeLogger() {
        try {
            // Ensure log directory exists
            await fs.mkdir(this.logDirectory, { recursive: true });
            
            // Create daily log files
            await this.createDailyLogFiles();
            
            // Start periodic log rotation
            this.startLogRotation();
            
            console.log('[Logger] Comprehensive logging system initialized');
            
        } catch (error) {
            console.error('[Logger] Failed to initialize:', error);
        }
    }

    /**
     * Create daily log files for different categories
     */
    async createDailyLogFiles() {
        const today = new Date().toISOString().split('T')[0];
        
        for (const category of Object.values(this.logCategories)) {
            const filename = `${category}_${today}.log`;
            const filepath = path.join(this.logDirectory, filename);
            
            try {
                await fs.access(filepath);
            } catch {
                // File doesn't exist, create it
                await fs.writeFile(filepath, `# ${category.toUpperCase()} LOG - ${today}\n`);
            }
        }
    }

    /**
     * Log user activity
     */
    async logUserActivity(userId, activity, details = {}) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userId,
            activity,
            details,
            sessionId: details.sessionId || null,
            ipAddress: details.ipAddress || null,
            userAgent: details.userAgent || null
        };
        
        // Store in memory for quick access
        if (!this.userActivities.has(userId)) {
            this.userActivities.set(userId, []);
        }
        this.userActivities.get(userId).push(logEntry);
        
        // Write to file
        await this.writeLogEntry(this.logCategories.USER_ACTIVITY, logEntry);
        
        // Emit event for real-time monitoring
        this.emit('userActivity', logEntry);
        
        console.log(`[Logger] User Activity: ${userId} - ${activity}`);
    }

    /**
     * Log chat interaction
     */
    async logChatInteraction(userId, sessionId, interaction) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userId,
            sessionId,
            query: interaction.query,
            response: interaction.response,
            model: interaction.model,
            responseTime: interaction.responseTime,
            tokens: interaction.tokens || null,
            success: interaction.success !== false,
            metadata: interaction.metadata || {}
        };
        
        // Store session logs
        if (!this.sessionLogs.has(sessionId)) {
            this.sessionLogs.set(sessionId, []);
        }
        this.sessionLogs.get(sessionId).push(logEntry);
        
        // Write to file
        await this.writeLogEntry(this.logCategories.CHAT_INTERACTION, logEntry);
        
        // Update metrics
        this.updateChatMetrics(logEntry);
        
        this.emit('chatInteraction', logEntry);
        
        console.log(`[Logger] Chat: ${userId} - ${interaction.query.substring(0, 50)}...`);
    }

    /**
     * Log model usage
     */
    async logModelUsage(modelName, userId, usage) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            modelName,
            userId,
            requestType: usage.requestType,
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            responseTime: usage.responseTime,
            success: usage.success !== false,
            cost: usage.cost || 0,
            metadata: usage.metadata || {}
        };
        
        // Update model usage metrics
        if (!this.systemMetrics.modelUsage.has(modelName)) {
            this.systemMetrics.modelUsage.set(modelName, {
                totalRequests: 0,
                totalTokens: 0,
                totalCost: 0,
                averageResponseTime: 0,
                successRate: 0
            });
        }
        
        const modelMetrics = this.systemMetrics.modelUsage.get(modelName);
        modelMetrics.totalRequests++;
        modelMetrics.totalTokens += (usage.inputTokens || 0) + (usage.outputTokens || 0);
        modelMetrics.totalCost += usage.cost || 0;
        
        // Update average response time
        modelMetrics.averageResponseTime = 
            ((modelMetrics.averageResponseTime * (modelMetrics.totalRequests - 1)) + usage.responseTime) / 
            modelMetrics.totalRequests;
        
        // Update success rate
        const successfulRequests = modelMetrics.successRate * (modelMetrics.totalRequests - 1) + (usage.success ? 1 : 0);
        modelMetrics.successRate = successfulRequests / modelMetrics.totalRequests;
        
        await this.writeLogEntry(this.logCategories.MODEL_USAGE, logEntry);
        
        this.emit('modelUsage', logEntry);
        
        console.log(`[Logger] Model Usage: ${modelName} - ${usage.requestType}`);
    }

    /**
     * Log system events
     */
    async logSystemEvent(event, details = {}) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            event,
            level: details.level || 'info',
            component: details.component || 'system',
            details,
            stackTrace: details.error ? details.error.stack : null
        };
        
        await this.writeLogEntry(this.logCategories.SYSTEM_EVENT, logEntry);
        
        this.emit('systemEvent', logEntry);
        
        console.log(`[Logger] System Event: ${event} (${details.level || 'info'})`);
    }

    /**
     * Log errors
     */
    async logError(error, context = {}) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            severity: context.severity || 'error',
            userId: context.userId || null,
            sessionId: context.sessionId || null
        };
        
        this.systemMetrics.errorCount++;
        
        await this.writeLogEntry(this.logCategories.ERROR, logEntry);
        
        this.emit('error', logEntry);
        
        console.error(`[Logger] Error: ${error.message}`);
    }

    /**
     * Log performance metrics
     */
    async logPerformance(metric, value, context = {}) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            metric,
            value,
            unit: context.unit || 'ms',
            component: context.component || 'system',
            context
        };
        
        await this.writeLogEntry(this.logCategories.PERFORMANCE, logEntry);
        
        this.emit('performance', logEntry);
        
        console.log(`[Logger] Performance: ${metric} = ${value}${context.unit || 'ms'}`);
    }

    /**
     * Log API calls
     */
    async logAPICall(endpoint, method, userId, response) {
        const logEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            endpoint,
            method,
            userId,
            statusCode: response.statusCode,
            responseTime: response.responseTime,
            requestSize: response.requestSize || 0,
            responseSize: response.responseSize || 0,
            success: response.statusCode < 400,
            metadata: response.metadata || {}
        };
        
        this.systemMetrics.totalRequests++;
        
        await this.writeLogEntry(this.logCategories.API_CALL, logEntry);
        
        this.emit('apiCall', logEntry);
        
        console.log(`[Logger] API: ${method} ${endpoint} - ${response.statusCode}`);
    }

    /**
     * Write log entry to file
     */
    async writeLogEntry(category, entry) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const filename = `${category}_${today}.log`;
            const filepath = path.join(this.logDirectory, filename);
            
            const logLine = JSON.stringify(entry) + '\n';
            await fs.appendFile(filepath, logLine);
            
        } catch (error) {
            console.error(`[Logger] Failed to write log entry:`, error);
        }
    }

    /**
     * Update chat metrics
     */
    updateChatMetrics(logEntry) {
        // Update average response time
        const totalRequests = this.systemMetrics.totalRequests;
        this.systemMetrics.averageResponseTime = 
            ((this.systemMetrics.averageResponseTime * totalRequests) + logEntry.responseTime) / 
            (totalRequests + 1);
    }

    /**
     * Get user activity summary
     */
    getUserActivitySummary(userId, timeRange = '24h') {
        const userLogs = this.userActivities.get(userId) || [];
        const cutoffTime = this.getTimeRangeCutoff(timeRange);
        
        const recentLogs = userLogs.filter(log => 
            new Date(log.timestamp) > cutoffTime
        );
        
        const summary = {
            totalActivities: recentLogs.length,
            uniqueSessions: new Set(recentLogs.map(log => log.sessionId)).size,
            activityTypes: {},
            timeRange
        };
        
        // Count activity types
        recentLogs.forEach(log => {
            summary.activityTypes[log.activity] = 
                (summary.activityTypes[log.activity] || 0) + 1;
        });
        
        return summary;
    }

    /**
     * Get system analytics
     */
    getSystemAnalytics(timeRange = '24h') {
        return {
            totalRequests: this.systemMetrics.totalRequests,
            totalUsers: this.userActivities.size,
            errorCount: this.systemMetrics.errorCount,
            averageResponseTime: this.systemMetrics.averageResponseTime,
            modelUsage: Object.fromEntries(this.systemMetrics.modelUsage),
            timeRange,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get chat session analytics
     */
    getChatSessionAnalytics(sessionId) {
        const sessionLogs = this.sessionLogs.get(sessionId) || [];
        
        if (sessionLogs.length === 0) {
            return null;
        }
        
        const analytics = {
            sessionId,
            totalInteractions: sessionLogs.length,
            averageResponseTime: sessionLogs.reduce((sum, log) => sum + log.responseTime, 0) / sessionLogs.length,
            totalTokens: sessionLogs.reduce((sum, log) => sum + (log.tokens || 0), 0),
            modelsUsed: [...new Set(sessionLogs.map(log => log.model))],
            successRate: sessionLogs.filter(log => log.success).length / sessionLogs.length,
            startTime: sessionLogs[0].timestamp,
            endTime: sessionLogs[sessionLogs.length - 1].timestamp
        };
        
        return analytics;
    }

    /**
     * Start log rotation
     */
    startLogRotation() {
        // Rotate logs daily at midnight
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.rotateLogs();
            // Set up daily rotation
            setInterval(() => this.rotateLogs(), 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
    }

    /**
     * Rotate log files
     */
    async rotateLogs() {
        try {
            await this.createDailyLogFiles();
            console.log('[Logger] Log files rotated');
        } catch (error) {
            console.error('[Logger] Failed to rotate logs:', error);
        }
    }

    /**
     * Get time range cutoff
     */
    getTimeRangeCutoff(timeRange) {
        const now = new Date();
        const cutoff = new Date(now);
        
        switch (timeRange) {
            case '1h':
                cutoff.setHours(cutoff.getHours() - 1);
                break;
            case '24h':
                cutoff.setDate(cutoff.getDate() - 1);
                break;
            case '7d':
                cutoff.setDate(cutoff.getDate() - 7);
                break;
            case '30d':
                cutoff.setDate(cutoff.getDate() - 30);
                break;
            default:
                cutoff.setDate(cutoff.getDate() - 1);
        }
        
        return cutoff;
    }

    /**
     * Export logs for analysis
     */
    async exportLogs(category, timeRange = '24h', format = 'json') {
        const cutoffTime = this.getTimeRangeCutoff(timeRange);
        const today = new Date().toISOString().split('T')[0];
        const filename = `${category}_${today}.log`;
        const filepath = path.join(this.logDirectory, filename);
        
        try {
            const logContent = await fs.readFile(filepath, 'utf8');
            const logs = logContent.split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line))
                .filter(log => new Date(log.timestamp) > cutoffTime);
            
            if (format === 'csv') {
                return this.convertToCSV(logs);
            }
            
            return logs;
            
        } catch (error) {
            console.error(`[Logger] Failed to export logs:`, error);
            return [];
        }
    }

    /**
     * Convert logs to CSV format
     */
    convertToCSV(logs) {
        if (logs.length === 0) return '';

        const headers = Object.keys(logs[0]);
        const csvContent = [
            headers.join(','),
            ...logs.map(log =>
                headers.map(header =>
                    JSON.stringify(log[header] || '')
                ).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    /**
     * Create Express middleware for automatic logging
     */
    createExpressMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();

            // Log API call
            res.on('finish', async () => {
                const responseTime = Date.now() - startTime;

                await this.logAPICall(
                    req.path,
                    req.method,
                    req.user?.id || 'anonymous',
                    {
                        statusCode: res.statusCode,
                        responseTime,
                        requestSize: req.get('content-length') || 0,
                        responseSize: res.get('content-length') || 0,
                        metadata: {
                            userAgent: req.get('user-agent'),
                            ipAddress: req.ip,
                            query: req.query,
                            body: req.method === 'POST' ? req.body : undefined
                        }
                    }
                );
            });

            next();
        };
    }

    /**
     * Get real-time dashboard data
     */
    getDashboardData() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Calculate recent activity
        let recentUserActivities = 0;
        let recentChatInteractions = 0;

        for (const userLogs of this.userActivities.values()) {
            recentUserActivities += userLogs.filter(log =>
                new Date(log.timestamp) > oneHourAgo
            ).length;
        }

        for (const sessionLogs of this.sessionLogs.values()) {
            recentChatInteractions += sessionLogs.filter(log =>
                new Date(log.timestamp) > oneHourAgo
            ).length;
        }

        return {
            overview: {
                totalUsers: this.userActivities.size,
                totalRequests: this.systemMetrics.totalRequests,
                errorCount: this.systemMetrics.errorCount,
                averageResponseTime: Math.round(this.systemMetrics.averageResponseTime)
            },
            recentActivity: {
                userActivities: recentUserActivities,
                chatInteractions: recentChatInteractions,
                timeRange: '1 hour'
            },
            modelUsage: Object.fromEntries(
                Array.from(this.systemMetrics.modelUsage.entries()).map(([model, stats]) => [
                    model,
                    {
                        requests: stats.totalRequests,
                        avgResponseTime: Math.round(stats.averageResponseTime),
                        successRate: Math.round(stats.successRate * 100)
                    }
                ])
            ),
            timestamp: now.toISOString()
        };
    }
}

// Create singleton instance
const logger = new ComprehensiveLogger();

module.exports = logger;
