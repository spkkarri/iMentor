/**
 * Performance Monitoring and Metrics Collection System
 * Comprehensive monitoring for the multi-model LLM system
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

class MetricsCollector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            enableFileLogging: true,
            logDirectory: options.logDirectory || path.join(__dirname, '..', 'logs'),
            metricsInterval: options.metricsInterval || 60000, // 1 minute
            retentionDays: options.retentionDays || 7,
            enableRealTimeMetrics: true,
            ...options
        };

        // Metrics storage
        this.metrics = {
            system: {
                startTime: Date.now(),
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                peakMemoryUsage: 0,
                peakCpuUsage: 0
            },
            models: new Map(),
            routing: {
                totalRoutes: 0,
                successfulRoutes: 0,
                fallbackRoutes: 0,
                routingErrors: 0,
                subjectDistribution: new Map(),
                averageRoutingTime: 0
            },
            classification: {
                totalClassifications: 0,
                accurateClassifications: 0,
                averageConfidence: 0,
                subjectAccuracy: new Map()
            },
            performance: {
                responseTimeHistory: [],
                memoryUsageHistory: [],
                cpuUsageHistory: [],
                errorRateHistory: []
            }
        };

        // Real-time metrics
        this.realtimeMetrics = {
            currentRequests: 0,
            requestsPerMinute: 0,
            averageResponseTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };

        // Initialize
        this.init();
    }

    async init() {
        // Create log directory
        if (this.options.enableFileLogging) {
            await this.ensureLogDirectory();
        }

        // Start metrics collection
        this.startMetricsCollection();

        // Start cleanup routine
        this.startCleanupRoutine();

        console.log('📊 Metrics Collector initialized');
    }

    async ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.options.logDirectory)) {
                fs.mkdirSync(this.options.logDirectory, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    startMetricsCollection() {
        // Collect system metrics periodically
        setInterval(() => {
            this.collectSystemMetrics();
            this.updateRealtimeMetrics();
            this.saveMetricsToFile();
        }, this.options.metricsInterval);

        // Collect real-time metrics more frequently
        if (this.options.enableRealTimeMetrics) {
            setInterval(() => {
                this.updateRealtimeMetrics();
            }, 5000); // Every 5 seconds
        }
    }

    collectSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        // Update system metrics
        this.metrics.system.peakMemoryUsage = Math.max(
            this.metrics.system.peakMemoryUsage,
            memoryUsage.heapUsed
        );

        // Store historical data
        this.metrics.performance.memoryUsageHistory.push({
            timestamp: Date.now(),
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
            rss: memoryUsage.rss
        });

        this.metrics.performance.cpuUsageHistory.push({
            timestamp: Date.now(),
            user: cpuUsage.user,
            system: cpuUsage.system
        });

        // Keep only recent history (last 24 hours)
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        this.metrics.performance.memoryUsageHistory = this.metrics.performance.memoryUsageHistory
            .filter(entry => entry.timestamp > cutoffTime);
        this.metrics.performance.cpuUsageHistory = this.metrics.performance.cpuUsageHistory
            .filter(entry => entry.timestamp > cutoffTime);
    }

    updateRealtimeMetrics() {
        const memoryUsage = process.memoryUsage();
        const loadAverage = os.loadavg();

        this.realtimeMetrics.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
        this.realtimeMetrics.cpuUsage = loadAverage[0]; // 1-minute load average

        // Calculate requests per minute
        const oneMinuteAgo = Date.now() - 60000;
        const recentRequests = this.metrics.performance.responseTimeHistory
            .filter(entry => entry.timestamp > oneMinuteAgo);
        this.realtimeMetrics.requestsPerMinute = recentRequests.length;

        // Calculate average response time (last 100 requests)
        const recentResponseTimes = this.metrics.performance.responseTimeHistory
            .slice(-100)
            .map(entry => entry.responseTime);
        
        if (recentResponseTimes.length > 0) {
            this.realtimeMetrics.averageResponseTime = 
                recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length;
        }

        // Calculate error rate
        const totalRequests = this.metrics.system.totalRequests;
        const failedRequests = this.metrics.system.failedRequests;
        this.realtimeMetrics.errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

        // Emit real-time metrics event
        this.emit('realtimeMetrics', this.realtimeMetrics);
    }

    // Request tracking
    recordRequest(requestData) {
        const startTime = Date.now();
        this.metrics.system.totalRequests++;
        this.realtimeMetrics.currentRequests++;

        return {
            finish: (success = true, responseTime = null) => {
                const endTime = Date.now();
                const actualResponseTime = responseTime || (endTime - startTime);

                if (success) {
                    this.metrics.system.successfulRequests++;
                } else {
                    this.metrics.system.failedRequests++;
                }

                // Update average response time
                const totalSuccessful = this.metrics.system.successfulRequests;
                this.metrics.system.averageResponseTime = 
                    ((this.metrics.system.averageResponseTime * (totalSuccessful - 1)) + actualResponseTime) / totalSuccessful;

                // Store response time history
                this.metrics.performance.responseTimeHistory.push({
                    timestamp: endTime,
                    responseTime: actualResponseTime,
                    success: success,
                    ...requestData
                });

                this.realtimeMetrics.currentRequests--;

                // Emit request completed event
                this.emit('requestCompleted', {
                    success,
                    responseTime: actualResponseTime,
                    ...requestData
                });
            }
        };
    }

    // Model performance tracking
    recordModelUsage(modelId, subject, responseTime, success = true) {
        if (!this.metrics.models.has(modelId)) {
            this.metrics.models.set(modelId, {
                subject,
                totalUsage: 0,
                successfulUsage: 0,
                failedUsage: 0,
                averageResponseTime: 0,
                lastUsed: Date.now()
            });
        }

        const modelMetrics = this.metrics.models.get(modelId);
        modelMetrics.totalUsage++;
        modelMetrics.lastUsed = Date.now();

        if (success) {
            modelMetrics.successfulUsage++;
            // Update average response time
            modelMetrics.averageResponseTime = 
                ((modelMetrics.averageResponseTime * (modelMetrics.successfulUsage - 1)) + responseTime) / modelMetrics.successfulUsage;
        } else {
            modelMetrics.failedUsage++;
        }

        this.emit('modelUsage', { modelId, subject, responseTime, success });
    }

    // Routing performance tracking
    recordRouting(routingData) {
        this.metrics.routing.totalRoutes++;

        if (routingData.success) {
            this.metrics.routing.successfulRoutes++;
        } else {
            this.metrics.routing.routingErrors++;
        }

        if (routingData.fallbackUsed) {
            this.metrics.routing.fallbackRoutes++;
        }

        // Update subject distribution
        const subject = routingData.subject || 'unknown';
        const currentCount = this.metrics.routing.subjectDistribution.get(subject) || 0;
        this.metrics.routing.subjectDistribution.set(subject, currentCount + 1);

        // Update average routing time
        if (routingData.routingTime) {
            const totalSuccessful = this.metrics.routing.successfulRoutes;
            this.metrics.routing.averageRoutingTime = 
                ((this.metrics.routing.averageRoutingTime * (totalSuccessful - 1)) + routingData.routingTime) / totalSuccessful;
        }

        this.emit('routing', routingData);
    }

    // Classification accuracy tracking
    recordClassification(classificationData) {
        this.metrics.classification.totalClassifications++;

        if (classificationData.accurate) {
            this.metrics.classification.accurateClassifications++;
        }

        // Update average confidence
        if (classificationData.confidence !== undefined) {
            const total = this.metrics.classification.totalClassifications;
            this.metrics.classification.averageConfidence = 
                ((this.metrics.classification.averageConfidence * (total - 1)) + classificationData.confidence) / total;
        }

        // Update subject-specific accuracy
        const subject = classificationData.subject;
        if (subject) {
            if (!this.metrics.classification.subjectAccuracy.has(subject)) {
                this.metrics.classification.subjectAccuracy.set(subject, {
                    total: 0,
                    accurate: 0,
                    accuracy: 0
                });
            }

            const subjectMetrics = this.metrics.classification.subjectAccuracy.get(subject);
            subjectMetrics.total++;
            
            if (classificationData.accurate) {
                subjectMetrics.accurate++;
            }
            
            subjectMetrics.accuracy = subjectMetrics.accurate / subjectMetrics.total;
        }

        this.emit('classification', classificationData);
    }

    // Get comprehensive metrics
    getMetrics() {
        return {
            ...this.metrics,
            realtime: this.realtimeMetrics,
            uptime: Date.now() - this.metrics.system.startTime,
            timestamp: Date.now()
        };
    }

    // Get performance summary
    getPerformanceSummary() {
        const uptime = Date.now() - this.metrics.system.startTime;
        const uptimeHours = uptime / (1000 * 60 * 60);

        return {
            uptime: {
                milliseconds: uptime,
                hours: uptimeHours,
                formatted: this.formatUptime(uptime)
            },
            requests: {
                total: this.metrics.system.totalRequests,
                successful: this.metrics.system.successfulRequests,
                failed: this.metrics.system.failedRequests,
                successRate: this.metrics.system.totalRequests > 0 ? 
                    (this.metrics.system.successfulRequests / this.metrics.system.totalRequests) * 100 : 0,
                averageResponseTime: this.metrics.system.averageResponseTime,
                requestsPerHour: uptimeHours > 0 ? this.metrics.system.totalRequests / uptimeHours : 0
            },
            routing: {
                total: this.metrics.routing.totalRoutes,
                successful: this.metrics.routing.successfulRoutes,
                fallback: this.metrics.routing.fallbackRoutes,
                errors: this.metrics.routing.routingErrors,
                successRate: this.metrics.routing.totalRoutes > 0 ? 
                    (this.metrics.routing.successfulRoutes / this.metrics.routing.totalRoutes) * 100 : 0,
                averageRoutingTime: this.metrics.routing.averageRoutingTime
            },
            classification: {
                total: this.metrics.classification.totalClassifications,
                accurate: this.metrics.classification.accurateClassifications,
                accuracy: this.metrics.classification.totalClassifications > 0 ? 
                    (this.metrics.classification.accurateClassifications / this.metrics.classification.totalClassifications) * 100 : 0,
                averageConfidence: this.metrics.classification.averageConfidence
            },
            models: Array.from(this.metrics.models.entries()).map(([id, metrics]) => ({
                id,
                ...metrics,
                successRate: metrics.totalUsage > 0 ? (metrics.successfulUsage / metrics.totalUsage) * 100 : 0
            })),
            system: {
                memoryUsage: this.realtimeMetrics.memoryUsage,
                cpuUsage: this.realtimeMetrics.cpuUsage,
                peakMemoryUsage: this.metrics.system.peakMemoryUsage / 1024 / 1024, // MB
                requestsPerMinute: this.realtimeMetrics.requestsPerMinute
            }
        };
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Save metrics to file
    async saveMetricsToFile() {
        if (!this.options.enableFileLogging) return;

        try {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const filename = `metrics-${timestamp}.json`;
            const filepath = path.join(this.options.logDirectory, filename);

            const metricsData = {
                timestamp: Date.now(),
                summary: this.getPerformanceSummary(),
                detailed: this.getMetrics()
            };

            await fs.promises.writeFile(filepath, JSON.stringify(metricsData, null, 2));
        } catch (error) {
            console.error('Failed to save metrics to file:', error);
        }
    }

    // Cleanup old log files
    startCleanupRoutine() {
        // Run cleanup daily
        setInterval(() => {
            this.cleanupOldLogs();
        }, 24 * 60 * 60 * 1000);

        // Run initial cleanup
        this.cleanupOldLogs();
    }

    async cleanupOldLogs() {
        if (!this.options.enableFileLogging) return;

        try {
            const files = await fs.promises.readdir(this.options.logDirectory);
            const cutoffTime = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);

            for (const file of files) {
                if (file.startsWith('metrics-') && file.endsWith('.json')) {
                    const filepath = path.join(this.options.logDirectory, file);
                    const stats = await fs.promises.stat(filepath);
                    
                    if (stats.mtime.getTime() < cutoffTime) {
                        await fs.promises.unlink(filepath);
                        console.log(`🗑️ Cleaned up old metrics file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    // Reset metrics
    reset() {
        this.metrics = {
            system: {
                startTime: Date.now(),
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0,
                peakMemoryUsage: 0,
                peakCpuUsage: 0
            },
            models: new Map(),
            routing: {
                totalRoutes: 0,
                successfulRoutes: 0,
                fallbackRoutes: 0,
                routingErrors: 0,
                subjectDistribution: new Map(),
                averageRoutingTime: 0
            },
            classification: {
                totalClassifications: 0,
                accurateClassifications: 0,
                averageConfidence: 0,
                subjectAccuracy: new Map()
            },
            performance: {
                responseTimeHistory: [],
                memoryUsageHistory: [],
                cpuUsageHistory: [],
                errorRateHistory: []
            }
        };

        console.log('📊 Metrics reset');
    }
}

module.exports = MetricsCollector;
