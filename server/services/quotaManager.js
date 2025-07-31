/**
 * Gemini API Quota Management Service
 * Handles rate limiting, quota tracking, and request prioritization
 */

const fs = require('fs').promises;
const path = require('path');
const geminiConfig = require('../config/geminiConfig');

class QuotaManager {
    constructor() {
        this.config = this.getConfig();
        this.quotaFile = path.join(__dirname, '../data/quota.json');
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            quotaExceeded: 0,
            lastReset: Date.now()
        };
        
        this.initialize();
    }

    getConfig() {
        const env = process.env.NODE_ENV || 'development';
        const baseConfig = geminiConfig.rateLimit;
        const envConfig = geminiConfig[env] || {};
        
        return {
            ...baseConfig,
            ...envConfig,
            quota: geminiConfig.quota,
            priority: geminiConfig.priority,
            monitoring: geminiConfig.monitoring
        };
    }

    async initialize() {
        try {
            await this.loadQuotaData();
            this.checkQuotaReset();
            
            if (this.config.monitoring.collectMetrics) {
                this.startMetricsCollection();
            }
            
            console.log('📊 Quota Manager initialized');
            console.log(`📈 Daily limit: ${this.config.dailyLimit} requests`);
            console.log(`⏱️ Request interval: ${this.config.minRequestInterval}ms`);
        } catch (error) {
            console.error('❌ Failed to initialize Quota Manager:', error);
        }
    }

    async loadQuotaData() {
        try {
            const data = await fs.readFile(this.quotaFile, 'utf8');
            const quotaData = JSON.parse(data);
            
            this.metrics = {
                ...this.metrics,
                ...quotaData.metrics
            };
            
            this.lastRequestTime = quotaData.lastRequestTime || 0;
            this.requestCount = quotaData.requestCount || 0;
            this.resetTime = quotaData.resetTime || this.getNextResetTime();
            
        } catch (error) {
            // File doesn't exist or is corrupted, start fresh
            this.requestCount = 0;
            this.lastRequestTime = 0;
            this.resetTime = this.getNextResetTime();
            await this.saveQuotaData();
        }
    }

    async saveQuotaData() {
        try {
            const quotaData = {
                requestCount: this.requestCount,
                lastRequestTime: this.lastRequestTime,
                resetTime: this.resetTime,
                metrics: this.metrics,
                lastSaved: Date.now()
            };
            
            // Ensure data directory exists
            const dataDir = path.dirname(this.quotaFile);
            await fs.mkdir(dataDir, { recursive: true });
            
            await fs.writeFile(this.quotaFile, JSON.stringify(quotaData, null, 2));
        } catch (error) {
            console.error('❌ Failed to save quota data:', error);
        }
    }

    getNextResetTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(this.config.quota.resetHour, 0, 0, 0);
        return tomorrow.getTime();
    }

    checkQuotaReset() {
        const now = Date.now();
        if (now >= this.resetTime) {
            console.log('🔄 Daily quota reset');
            this.requestCount = 0;
            this.resetTime = this.getNextResetTime();
            this.metrics.lastReset = now;
            this.saveQuotaData();
        }
    }

    canMakeRequest(priority = 'medium') {
        this.checkQuotaReset();
        
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        // STRICT 50 REQUEST LIMIT - No priority overrides
        const STRICT_LIMIT = 50;

        // Check BEFORE incrementing to prevent going over
        if (this.requestCount >= STRICT_LIMIT) {
            console.warn(`🚫 STRICT LIMIT REACHED: ${this.requestCount}/50 requests used`);
            return {
                allowed: false,
                reason: 'quota_exceeded',
                resetTime: this.resetTime,
                priority: priority,
                strictLimit: true
            };
        }
        
        // Check minimum interval
        if (timeSinceLastRequest < this.config.minRequestInterval) {
            return {
                allowed: false,
                reason: 'rate_limited',
                waitTime: this.config.minRequestInterval - timeSinceLastRequest,
                priority: priority
            };
        }
        
        return {
            allowed: true,
            remaining: STRICT_LIMIT - this.requestCount,
            priority: priority,
            strictLimit: true
        };
    }

    async requestPermission(requestType = 'general', priority = 'medium') {
        const permission = this.canMakeRequest(priority);
        
        if (!permission.allowed) {
            if (permission.reason === 'quota_exceeded') {
                const timeUntilReset = this.resetTime - Date.now();
                const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));
                
                throw new Error(`🚫 Daily request limit exceeded (${this.requestCount}/50). Quota resets in ${hoursUntilReset} hours at midnight UTC. Please try again tomorrow or use offline search features.`);
            } else if (permission.reason === 'rate_limited') {
                // Wait for rate limit
                await new Promise(resolve => setTimeout(resolve, permission.waitTime));
                return this.requestPermission(requestType, priority); // Retry after waiting
            }
        }
        
        // Grant permission and track request
        this.lastRequestTime = Date.now();
        // requestCount will be incremented in recordSuccess()
        this.metrics.totalRequests++;
        
        // Log quota status
        if (this.config.monitoring.logQuotaStatus) {
            const usagePercent = (this.requestCount / this.config.dailyLimit * 100).toFixed(1);
            console.log(`📊 Quota: ${this.requestCount}/${this.config.dailyLimit} (${usagePercent}%) - ${requestType}:${priority}`);
            
            // Warning thresholds
            if (usagePercent >= this.config.quota.criticalThreshold * 100) {
                console.warn(`🚨 CRITICAL: Quota usage at ${usagePercent}%`);
            } else if (usagePercent >= this.config.quota.warningThreshold * 100) {
                console.warn(`⚠️ WARNING: Quota usage at ${usagePercent}%`);
            }
        }
        
        await this.saveQuotaData();
        return permission;
    }

    recordSuccess() {
        // Only increment if we haven't exceeded the strict limit
        if (this.requestCount < 50) {
            this.requestCount++;
        }
        this.metrics.successfulRequests++;
        this.saveQuotaData();
    }

    recordFailure(error) {
        this.metrics.failedRequests++;
        
        if (error.message && (error.message.includes('quota') || error.message.includes('429'))) {
            this.metrics.quotaExceeded++;
            // Mark quota as exceeded
            this.requestCount = this.config.dailyLimit;
        }
        
        this.saveQuotaData();
    }

    getQuotaStatus() {
        this.checkQuotaReset();

        // STRICT 50 REQUEST LIMIT
        const STRICT_LIMIT = 50;
        const remaining = Math.max(0, STRICT_LIMIT - this.requestCount);
        const usagePercent = (this.requestCount / STRICT_LIMIT * 100);
        const timeUntilReset = this.resetTime - Date.now();

        return {
            used: this.requestCount,
            remaining: remaining,
            limit: STRICT_LIMIT,
            usagePercent: usagePercent,
            resetTime: this.resetTime,
            timeUntilReset: timeUntilReset,
            hoursUntilReset: Math.ceil(timeUntilReset / (1000 * 60 * 60)),
            metrics: this.metrics,
            status: this.requestCount >= STRICT_LIMIT ? 'exceeded' :
                   usagePercent >= 90 ? 'critical' :
                   usagePercent >= 80 ? 'warning' : 'normal',
            strictLimit: true,
            limitEnforced: this.requestCount >= STRICT_LIMIT
        };
    }

    startMetricsCollection() {
        setInterval(() => {
            const status = this.getQuotaStatus();
            if (this.config.monitoring.logQuotaStatus) {
                console.log(`📈 Quota Metrics: ${status.used}/${status.limit} (${status.usagePercent.toFixed(1)}%)`);
            }
        }, this.config.monitoring.metricsInterval);
    }
}

// Singleton instance
let quotaManagerInstance = null;

function getQuotaManager() {
    if (!quotaManagerInstance) {
        quotaManagerInstance = new QuotaManager();
    }
    return quotaManagerInstance;
}

module.exports = {
    QuotaManager,
    getQuotaManager
};
