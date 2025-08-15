/**
 * Enhanced Prompt System for Optimized Performance and Accuracy
 * Provides intelligent prompt optimization, caching, and performance monitoring
 */

class EnhancedPromptSystem {
    constructor() {
        this.promptCache = new Map();
        this.performanceMetrics = new Map();
        this.optimizedPrompts = new Map();
        this.contextualPrompts = new Map();
        
        // Initialize optimized prompts for different scenarios
        this.initializeOptimizedPrompts();
    }

    /**
     * Initialize pre-optimized prompts for common scenarios
     */
    initializeOptimizedPrompts() {
        // Conversational prompts (optimized for Llama 3.2)
        this.optimizedPrompts.set('conversational', {
            system: `You are a helpful, friendly, and engaging AI assistant. Respond naturally and conversationally while being informative and accurate. Keep responses concise but comprehensive. Use a warm, approachable tone.`,
            temperature: 0.7,
            maxTokens: 2048,
            model: 'llama3.2'
        });

        // Reasoning prompts (optimized for DeepSeek)
        this.optimizedPrompts.set('reasoning', {
            system: `You are an expert reasoning AI. Break down complex problems step-by-step. Use logical thinking, provide clear explanations for each step, and arrive at well-reasoned conclusions. Be precise and analytical.`,
            temperature: 0.3,
            maxTokens: 4096,
            model: 'deepseek'
        });

        // Technical prompts (optimized for Qwen)
        this.optimizedPrompts.set('technical', {
            system: `You are a technical expert AI. Provide accurate, detailed technical information. Include code examples, best practices, and implementation details when relevant. Be precise and comprehensive in technical explanations.`,
            temperature: 0.2,
            maxTokens: 6144,
            model: 'qwen'
        });

        // Educational prompts (optimized for Gemini)
        this.optimizedPrompts.set('educational', {
            system: `You are an expert educator and tutor. Explain concepts clearly, use examples and analogies, break down complex topics into digestible parts. Adapt your teaching style to the user's level of understanding.`,
            temperature: 0.4,
            maxTokens: 3072,
            model: 'gemini-flash'
        });

        // Creative prompts
        this.optimizedPrompts.set('creative', {
            system: `You are a creative AI assistant. Generate original, imaginative content while maintaining quality and relevance. Be innovative and engaging in your responses.`,
            temperature: 0.8,
            maxTokens: 4096,
            model: 'llama3.2'
        });

        // Research prompts (for deep search)
        this.optimizedPrompts.set('research', {
            system: `You are a research expert AI. Provide comprehensive, well-researched information with multiple perspectives. Cite sources when possible and present balanced, factual content.`,
            temperature: 0.3,
            maxTokens: 8192,
            model: 'gemini-pro'
        });
    }

    /**
     * Get optimized prompt configuration based on query type and context
     */
    async getOptimizedPrompt(queryType, userContext = {}, conversationHistory = []) {
        const startTime = Date.now();
        
        try {
            // Determine query type if not provided
            if (!queryType) {
                queryType = await this.classifyQuery(userContext.query || '', conversationHistory);
            }

            // Get base optimized prompt
            let promptConfig = this.optimizedPrompts.get(queryType) || this.optimizedPrompts.get('conversational');
            
            // Enhance with user context
            promptConfig = await this.enhanceWithUserContext(promptConfig, userContext, conversationHistory);
            
            // Add performance optimizations
            promptConfig = this.addPerformanceOptimizations(promptConfig, queryType);
            
            // Record performance metrics
            const processingTime = Date.now() - startTime;
            this.recordPromptMetrics(queryType, processingTime, true);
            
            return promptConfig;
            
        } catch (error) {
            console.error('[EnhancedPromptSystem] Error getting optimized prompt:', error);
            const processingTime = Date.now() - startTime;
            this.recordPromptMetrics(queryType || 'unknown', processingTime, false);
            
            // Return fallback prompt
            return this.optimizedPrompts.get('conversational');
        }
    }

    /**
     * Classify query type for optimal prompt selection
     */
    async classifyQuery(query, conversationHistory = []) {
        const queryLower = query.toLowerCase();
        
        // Technical keywords
        if (this.containsKeywords(queryLower, [
            'code', 'programming', 'function', 'algorithm', 'api', 'database',
            'javascript', 'python', 'react', 'node', 'sql', 'html', 'css',
            'debug', 'error', 'implementation', 'architecture', 'framework'
        ])) {
            return 'technical';
        }
        
        // Reasoning keywords
        if (this.containsKeywords(queryLower, [
            'analyze', 'compare', 'evaluate', 'solve', 'calculate', 'prove',
            'logic', 'reasoning', 'problem', 'strategy', 'decision', 'optimize',
            'why', 'how', 'explain the relationship', 'cause and effect'
        ])) {
            return 'reasoning';
        }
        
        // Educational keywords
        if (this.containsKeywords(queryLower, [
            'learn', 'teach', 'explain', 'understand', 'concept', 'definition',
            'example', 'tutorial', 'guide', 'lesson', 'study', 'practice'
        ])) {
            return 'educational';
        }
        
        // Creative keywords
        if (this.containsKeywords(queryLower, [
            'create', 'generate', 'write', 'story', 'poem', 'creative',
            'imagine', 'brainstorm', 'design', 'invent', 'artistic'
        ])) {
            return 'creative';
        }
        
        // Research keywords
        if (this.containsKeywords(queryLower, [
            'research', 'investigate', 'comprehensive', 'detailed analysis',
            'sources', 'evidence', 'studies', 'data', 'statistics', 'report'
        ])) {
            return 'research';
        }
        
        // Default to conversational
        return 'conversational';
    }

    /**
     * Check if query contains specific keywords
     */
    containsKeywords(query, keywords) {
        return keywords.some(keyword => query.includes(keyword));
    }

    /**
     * Enhance prompt with user context and personalization
     */
    async enhanceWithUserContext(promptConfig, userContext, conversationHistory) {
        const enhanced = { ...promptConfig };
        
        // Add user personalization if available
        if (userContext.personalizationProfile) {
            enhanced.system += `\n\nUser Context: ${userContext.personalizationProfile}`;
        }
        
        // Add conversation context for continuity
        if (conversationHistory.length > 0) {
            const recentContext = conversationHistory.slice(-3)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            enhanced.conversationContext = recentContext;
        }
        
        // Add subject-specific enhancements
        if (userContext.subject) {
            enhanced.system += `\n\nFocus Area: Provide responses specifically tailored for ${userContext.subject} expertise.`;
        }
        
        return enhanced;
    }

    /**
     * Add performance optimizations based on query type
     */
    addPerformanceOptimizations(promptConfig, queryType) {
        const optimized = { ...promptConfig };
        
        // Adjust parameters for performance
        switch (queryType) {
            case 'technical':
                optimized.temperature = 0.1; // More deterministic for code
                optimized.topP = 0.9;
                break;
            case 'reasoning':
                optimized.temperature = 0.2; // Logical consistency
                optimized.topP = 0.95;
                break;
            case 'conversational':
                optimized.temperature = 0.7; // Natural variation
                optimized.topP = 0.9;
                break;
            case 'creative':
                optimized.temperature = 0.8; // More creative freedom
                optimized.topP = 0.95;
                break;
        }
        
        // Add streaming for better perceived performance
        optimized.stream = true;
        
        // Add caching hints
        optimized.cacheable = ['technical', 'educational', 'research'].includes(queryType);
        
        return optimized;
    }

    /**
     * Record performance metrics for continuous optimization
     */
    recordPromptMetrics(queryType, processingTime, success) {
        if (!this.performanceMetrics.has(queryType)) {
            this.performanceMetrics.set(queryType, {
                totalRequests: 0,
                successfulRequests: 0,
                averageProcessingTime: 0,
                totalProcessingTime: 0
            });
        }
        
        const metrics = this.performanceMetrics.get(queryType);
        metrics.totalRequests++;
        metrics.totalProcessingTime += processingTime;
        metrics.averageProcessingTime = metrics.totalProcessingTime / metrics.totalRequests;
        
        if (success) {
            metrics.successfulRequests++;
        }
        
        // Log performance insights
        if (metrics.totalRequests % 10 === 0) {
            console.log(`[PromptSystem] ${queryType} - Avg: ${metrics.averageProcessingTime.toFixed(2)}ms, Success: ${(metrics.successfulRequests/metrics.totalRequests*100).toFixed(1)}%`);
        }
    }

    /**
     * Get performance analytics
     */
    getPerformanceAnalytics() {
        const analytics = {};
        
        for (const [queryType, metrics] of this.performanceMetrics) {
            analytics[queryType] = {
                ...metrics,
                successRate: (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2) + '%'
            };
        }
        
        return analytics;
    }

    /**
     * Optimize prompt based on feedback and performance data
     */
    async optimizePrompt(queryType, feedback, performanceData) {
        // This would implement ML-based prompt optimization
        // For now, we'll do rule-based optimization
        
        const currentPrompt = this.optimizedPrompts.get(queryType);
        if (!currentPrompt) return;
        
        // Adjust based on performance feedback
        if (performanceData.averageResponseTime > 5000) {
            // Reduce max tokens for faster responses
            currentPrompt.maxTokens = Math.max(1024, currentPrompt.maxTokens * 0.8);
        }
        
        if (feedback && feedback.accuracy < 0.8) {
            // Make prompts more specific for better accuracy
            currentPrompt.system += "\n\nEnsure accuracy and provide specific, factual information.";
        }
        
        console.log(`[PromptSystem] Optimized prompt for ${queryType}`);
    }
}

module.exports = EnhancedPromptSystem;
