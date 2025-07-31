/**
 * Gemini API Configuration and Rate Limiting
 */

module.exports = {
    // Rate limiting configuration
    rateLimit: {
        // Daily request limits - STRICT 50 REQUEST LIMIT
        dailyLimit: 50,           // Strict limit: exactly 50 requests per day
        
        // Request interval limits
        minRequestInterval: 2000,  // 2 seconds between requests
        burstLimit: 5,            // Max 5 requests in burst
        burstWindow: 60000,       // 1 minute burst window
        
        // Retry configuration
        maxRetries: 3,
        retryDelay: 1000,         // Base retry delay (exponential backoff)
        
        // Queue configuration
        maxQueueSize: 50,         // Max requests in queue
        queueTimeout: 300000,     // 5 minutes queue timeout
    },

    // Quota management
    quota: {
        // Warning thresholds
        warningThreshold: 0.8,    // Warn at 80% usage
        criticalThreshold: 0.95,  // Critical at 95% usage
        
        // Reset timing
        resetHour: 0,             // UTC hour for quota reset (midnight)
        
        // Fallback behavior
        enableFallback: true,     // Use fallback when quota exceeded
        fallbackDelay: 3600000,   // 1 hour delay before retry after quota exceeded
    },

    // Request prioritization
    priority: {
        // High priority request types
        high: ['chat', 'search'],
        
        // Medium priority request types  
        medium: ['summarize', 'analyze'],
        
        // Low priority request types
        low: ['generate', 'creative'],
        
        // Emergency bypass (use sparingly)
        emergency: false,
    },

    // Monitoring and logging
    monitoring: {
        logRequests: true,
        logQuotaStatus: true,
        logErrors: true,
        
        // Metrics collection
        collectMetrics: true,
        metricsInterval: 300000,  // 5 minutes
        
        // Alerts
        enableAlerts: true,
        alertThresholds: {
            quotaWarning: 0.8,
            quotaCritical: 0.95,
            errorRate: 0.1,        // 10% error rate
        }
    },

    // Development/testing overrides
    development: {
        // STRICT 50 REQUEST LIMIT - NO EXCEPTIONS
        dailyLimit: 50,
        minRequestInterval: 2000,  // 2 seconds for testing

        // Enhanced logging
        verboseLogging: true,
        debugMode: true,
    },

    // Production optimizations
    production: {
        // STRICT 50 REQUEST LIMIT - NO EXCEPTIONS
        dailyLimit: 50,
        minRequestInterval: 1000,  // 1 second in production

        // Reduced logging
        verboseLogging: false,
        debugMode: false,

        // Performance optimizations
        enableCaching: true,
        cacheTimeout: 3600000,    // 1 hour cache
    }
};
