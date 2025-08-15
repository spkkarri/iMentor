/**
 * Performance Optimizer for Enhanced Latency and Accuracy
 * Implements caching, connection pooling, and response optimization
 */

const NodeCache = require('node-cache');
const EventEmitter = require('events');

class PerformanceOptimizer extends EventEmitter {
    constructor() {
        super();
        
        // Response cache with TTL
        this.responseCache = new NodeCache({ 
            stdTTL: 300, // 5 minutes default
            checkperiod: 60, // Check for expired keys every minute
            useClones: false
        });
        
        // Model connection pool
        this.connectionPool = new Map();
        
        // Performance metrics
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            totalRequests: 0,
            averageLatency: 0,
            modelPerformance: new Map()
        };
        
        // Optimization settings
        this.settings = {
            enableCaching: true,
            enableCompression: true,
            enableStreaming: true,
            maxConcurrentRequests: 10,
            requestTimeout: 30000,
            cacheStrategy: 'intelligent' // 'aggressive', 'conservative', 'intelligent'
        };
        
        this.initializeOptimizations();
    }

    /**
     * Initialize performance optimizations
     */
    initializeOptimizations() {
        // Set up cache event listeners
        this.responseCache.on('set', (key, value) => {
            console.log(`[Cache] Stored response for key: ${key.substring(0, 50)}...`);
        });
        
        this.responseCache.on('expired', (key, value) => {
            console.log(`[Cache] Expired key: ${key.substring(0, 50)}...`);
        });
        
        // Performance monitoring
        setInterval(() => {
            this.analyzePerformance();
        }, 60000); // Every minute
    }

    /**
     * Optimize request with caching and performance enhancements
     */
    async optimizeRequest(requestData, modelType, userId) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            // Generate cache key
            const cacheKey = this.generateCacheKey(requestData, modelType, userId);
            
            // Check cache first
            if (this.settings.enableCaching) {
                const cachedResponse = this.getCachedResponse(cacheKey, requestData);
                if (cachedResponse) {
                    this.metrics.cacheHits++;
                    const latency = Date.now() - startTime;
                    this.updateLatencyMetrics(latency);
                    
                    return {
                        ...cachedResponse,
                        cached: true,
                        latency: latency
                    };
                }
                this.metrics.cacheMisses++;
            }
            
            // Optimize request parameters
            const optimizedRequest = this.optimizeRequestParameters(requestData, modelType);
            
            // Execute request with optimizations
            const response = await this.executeOptimizedRequest(optimizedRequest, modelType, userId);
            
            // Cache response if appropriate
            if (this.shouldCacheResponse(requestData, response)) {
                this.cacheResponse(cacheKey, response, requestData);
            }
            
            // Update performance metrics
            const latency = Date.now() - startTime;
            this.updateLatencyMetrics(latency);
            this.updateModelPerformance(modelType, latency, true);
            
            return {
                ...response,
                cached: false,
                latency: latency
            };
            
        } catch (error) {
            const latency = Date.now() - startTime;
            this.updateModelPerformance(modelType, latency, false);
            throw error;
        }
    }

    /**
     * Generate intelligent cache key
     */
    generateCacheKey(requestData, modelType, userId) {
        const { query, systemPrompt, temperature, maxTokens } = requestData;
        
        // Create hash of relevant parameters
        const keyData = {
            query: query?.toLowerCase().trim(),
            model: modelType,
            temp: Math.round(temperature * 10) / 10, // Round to 1 decimal
            tokens: maxTokens,
            system: systemPrompt?.substring(0, 100) // First 100 chars of system prompt
        };
        
        // For personalized responses, include user context
        if (requestData.personalized) {
            keyData.user = userId;
        }
        
        return Buffer.from(JSON.stringify(keyData)).toString('base64');
    }

    /**
     * Get cached response with intelligent matching
     */
    getCachedResponse(cacheKey, requestData) {
        // Direct cache hit
        let cached = this.responseCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        // Intelligent cache matching for similar queries
        if (this.settings.cacheStrategy === 'intelligent') {
            cached = this.findSimilarCachedResponse(requestData);
            if (cached) {
                console.log('[Cache] Found similar cached response');
                return cached;
            }
        }
        
        return null;
    }

    /**
     * Find similar cached responses for intelligent caching
     */
    findSimilarCachedResponse(requestData) {
        const query = requestData.query?.toLowerCase().trim();
        if (!query || query.length < 10) return null;
        
        // Get all cache keys
        const keys = this.responseCache.keys();
        
        for (const key of keys) {
            try {
                const keyData = JSON.parse(Buffer.from(key, 'base64').toString());
                
                // Check for similar queries (simple similarity check)
                if (keyData.query && this.calculateSimilarity(query, keyData.query) > 0.8) {
                    const cached = this.responseCache.get(key);
                    if (cached) {
                        return cached;
                    }
                }
            } catch (error) {
                // Skip invalid keys
                continue;
            }
        }
        
        return null;
    }

    /**
     * Calculate simple text similarity
     */
    calculateSimilarity(text1, text2) {
        const words1 = text1.split(' ');
        const words2 = text2.split(' ');
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        
        return intersection.length / union.length;
    }

    /**
     * Optimize request parameters for better performance
     */
    optimizeRequestParameters(requestData, modelType) {
        const optimized = { ...requestData };
        
        // Model-specific optimizations
        switch (modelType) {
            case 'llama3.2':
                optimized.temperature = Math.min(optimized.temperature || 0.7, 0.8);
                optimized.maxTokens = Math.min(optimized.maxTokens || 2048, 4096);
                break;
                
            case 'deepseek':
                optimized.temperature = Math.min(optimized.temperature || 0.3, 0.5);
                optimized.maxTokens = Math.min(optimized.maxTokens || 4096, 8192);
                break;
                
            case 'qwen':
                optimized.temperature = Math.min(optimized.temperature || 0.2, 0.4);
                optimized.maxTokens = Math.min(optimized.maxTokens || 6144, 8192);
                break;
                
            default:
                optimized.temperature = optimized.temperature || 0.7;
                optimized.maxTokens = optimized.maxTokens || 2048;
        }
        
        // Enable streaming for better perceived performance
        if (this.settings.enableStreaming) {
            optimized.stream = true;
        }
        
        return optimized;
    }

    /**
     * Execute optimized request (placeholder - to be implemented by specific services)
     */
    async executeOptimizedRequest(requestData, modelType, userId) {
        // This would be implemented by the calling service
        throw new Error('executeOptimizedRequest must be implemented by the calling service');
    }

    /**
     * Determine if response should be cached
     */
    shouldCacheResponse(requestData, response) {
        if (!this.settings.enableCaching) return false;
        
        // Don't cache personalized responses
        if (requestData.personalized) return false;
        
        // Don't cache error responses
        if (response.error) return false;
        
        // Don't cache very short responses
        if (response.content && response.content.length < 50) return false;
        
        // Cache based on strategy
        switch (this.settings.cacheStrategy) {
            case 'aggressive':
                return true;
            case 'conservative':
                return requestData.query && requestData.query.length > 20;
            case 'intelligent':
                return this.isResponseCacheWorthy(requestData, response);
            default:
                return true;
        }
    }

    /**
     * Intelligent cache worthiness assessment
     */
    isResponseCacheWorthy(requestData, response) {
        const query = requestData.query?.toLowerCase();
        
        // Cache educational and factual content
        if (query && (
            query.includes('what is') ||
            query.includes('how to') ||
            query.includes('explain') ||
            query.includes('definition')
        )) {
            return true;
        }
        
        // Cache technical documentation
        if (query && (
            query.includes('documentation') ||
            query.includes('api') ||
            query.includes('syntax')
        )) {
            return true;
        }
        
        // Don't cache time-sensitive or personal queries
        if (query && (
            query.includes('today') ||
            query.includes('now') ||
            query.includes('current') ||
            query.includes('my') ||
            query.includes('i am')
        )) {
            return false;
        }
        
        return true;
    }

    /**
     * Cache response with appropriate TTL
     */
    cacheResponse(cacheKey, response, requestData) {
        let ttl = 300; // 5 minutes default
        
        // Adjust TTL based on content type
        const query = requestData.query?.toLowerCase();
        if (query) {
            if (query.includes('definition') || query.includes('what is')) {
                ttl = 3600; // 1 hour for definitions
            } else if (query.includes('how to') || query.includes('tutorial')) {
                ttl = 1800; // 30 minutes for tutorials
            } else if (query.includes('news') || query.includes('current')) {
                ttl = 60; // 1 minute for current events
            }
        }
        
        this.responseCache.set(cacheKey, response, ttl);
    }

    /**
     * Update latency metrics
     */
    updateLatencyMetrics(latency) {
        const currentAvg = this.metrics.averageLatency;
        const totalRequests = this.metrics.totalRequests;
        
        this.metrics.averageLatency = ((currentAvg * (totalRequests - 1)) + latency) / totalRequests;
    }

    /**
     * Update model-specific performance metrics
     */
    updateModelPerformance(modelType, latency, success) {
        if (!this.metrics.modelPerformance.has(modelType)) {
            this.metrics.modelPerformance.set(modelType, {
                requests: 0,
                successfulRequests: 0,
                averageLatency: 0,
                totalLatency: 0
            });
        }
        
        const modelMetrics = this.metrics.modelPerformance.get(modelType);
        modelMetrics.requests++;
        modelMetrics.totalLatency += latency;
        modelMetrics.averageLatency = modelMetrics.totalLatency / modelMetrics.requests;
        
        if (success) {
            modelMetrics.successfulRequests++;
        }
    }

    /**
     * Analyze performance and emit insights
     */
    analyzePerformance() {
        const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
        
        console.log(`[Performance] Cache Hit Rate: ${cacheHitRate.toFixed(1)}%, Avg Latency: ${this.metrics.averageLatency.toFixed(0)}ms`);
        
        // Emit performance insights
        this.emit('performanceUpdate', {
            cacheHitRate,
            averageLatency: this.metrics.averageLatency,
            totalRequests: this.metrics.totalRequests,
            modelPerformance: Object.fromEntries(this.metrics.modelPerformance)
        });
        
        // Auto-optimize settings based on performance
        this.autoOptimizeSettings(cacheHitRate);
    }

    /**
     * Auto-optimize settings based on performance data
     */
    autoOptimizeSettings(cacheHitRate) {
        // Adjust cache strategy based on hit rate
        if (cacheHitRate < 20) {
            this.settings.cacheStrategy = 'aggressive';
            console.log('[Performance] Switched to aggressive caching due to low hit rate');
        } else if (cacheHitRate > 80) {
            this.settings.cacheStrategy = 'conservative';
            console.log('[Performance] Switched to conservative caching due to high hit rate');
        }
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
        
        return {
            ...this.metrics,
            cacheHitRate: cacheHitRate.toFixed(2) + '%',
            modelPerformance: Object.fromEntries(this.metrics.modelPerformance)
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.responseCache.flushAll();
        console.log('[Performance] Cache cleared');
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('[Performance] Settings updated:', newSettings);
    }
}

module.exports = PerformanceOptimizer;
