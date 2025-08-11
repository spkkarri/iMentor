/**
 * Multi-AI Service Manager
 * Manages multiple free AI services with automatic fallback
 */

const LocalAI = require('./localAI');
const HuggingFaceAI = require('./huggingFaceAI');
const TogetherAI = require('./togetherAI');
const CohereAI = require('./cohereAI');
const GroqAI = require('./groqAI');

class MultiAIService {
    constructor() {
        this.services = [];
        this.currentServiceIndex = 0;
        this.totalRequests = 0;
        this.dailyLimit = 50; // STRICT 50 REQUEST LIMIT
        this.initialize();
    }

    async initialize() {
        console.log('Initializing Multi-AI Service...');
        
        // Initialize all AI services (prioritize working APIs with keys)
        try {
            this.services = [
                { name: 'Groq', service: new GroqAI(), priority: 1 }, // Ultra-fast with API key
                { name: 'Cohere', service: new CohereAI(), priority: 2 }, // Good quality with API key
                { name: 'Together', service: new TogetherAI(), priority: 3 }, // Open source models with API key
                { name: 'HuggingFace', service: new HuggingFaceAI(), priority: 4 }, // Free tier with API key
                { name: 'LocalAI', service: new LocalAI(), priority: 5 } // Template-based fallback
            ];
            
            // Sort by priority (lower number = higher priority)
            this.services.sort((a, b) => a.priority - b.priority);
            
            console.log('Multi-AI Service initialized with services:');
            this.services.forEach((s, i) => {
                console.log(`   ${i + 1}. ${s.name} (Priority: ${s.priority})`);
            });
            
        } catch (error) {
            console.error('Failed to initialize Multi-AI Service:', error);
        }
    }

    getCurrentService() {
        return this.services[this.currentServiceIndex];
    }

    switchToNextService() {
        this.currentServiceIndex = (this.currentServiceIndex + 1) % this.services.length;
        const current = this.getCurrentService();
        console.log(`Switched to AI service: ${current.name}`);
        return current;
    }

    async generateText(prompt, maxTokens = 500) {
        // Check 50 request limit first
        if (this.totalRequests >= this.dailyLimit) {
            throw new Error(`🚫 Daily request limit exceeded (${this.totalRequests}/50). Please try again tomorrow or use offline search features.`);
        }

        let attempts = 0;
        const maxAttempts = this.services.length;
        let lastError = null;

        while (attempts < maxAttempts) {
            const current = this.getCurrentService();
            
            try {
                console.log(`Trying ${current.name} AI (attempt ${attempts + 1}/${maxAttempts})`);
                
                const result = await current.service.generateText(prompt, maxTokens);
                
                if (result && result.trim().length > 0) {
                    this.totalRequests++; // Track total requests across all services
                    console.log(`Success with ${current.name} AI (${this.totalRequests}/50 requests used)`);
                    return {
                        text: result,
                        service: current.name,
                        attempt: attempts + 1,
                        totalRequests: this.totalRequests
                    };
                }
                
                throw new Error('Empty response');
                
            } catch (error) {
                console.warn(`${current.name} AI failed: ${error.message}`);
                lastError = error;
                
                // Switch to next service
                this.switchToNextService();
                attempts++;
                
                // Small delay before trying next service
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // All services failed
        console.error('All AI services failed');
        throw new Error(`All AI services failed. Last error: ${lastError?.message}`);
    }

    async generateResponse(query, context = '') {
        const prompt = this.buildPrompt(query, context);
        
        try {
            const result = await this.generateText(prompt, 800);
            
            return {
                summary: result.text,
                aiGenerated: true,
                service: result.service,
                attempt: result.attempt,
                query: query,
                timestamp: new Date().toISOString(),
                metadata: {
                    searchType: 'multi_ai_response',
                    aiService: result.service,
                    fallbackLevel: result.attempt > 1 ? 'fallback' : 'primary'
                }
            };
            
        } catch (error) {
            console.error('Multi-AI generation failed:', error);
            throw error;
        }
    }

    buildPrompt(query, context = '') {
        let prompt = '';
        
        if (context) {
            prompt += `Context: ${context}\n\n`;
        }
        
        prompt += `Please provide a comprehensive and helpful response to the following question:\n\n`;
        prompt += `Question: ${query}\n\n`;
        prompt += `Response:`;
        
        return prompt;
    }

    getServicesStatus() {
        return this.services.map(s => ({
            name: s.name,
            priority: s.priority,
            status: s.service.getStatus ? s.service.getStatus() : { enabled: true },
            current: this.services[this.currentServiceIndex].name === s.name
        }));
    }

    resetAllServices() {
        console.log('Resetting all AI services...');
        
        this.services.forEach(s => {
            if (s.service.reset) {
                s.service.reset();
            }
        });
        
        this.currentServiceIndex = 0;
        console.log('All AI services reset');
    }

    async healthCheck() {
        console.log('Performing AI services health check...');
        
        const results = [];
        
        for (const s of this.services) {
            try {
                const testPrompt = 'Hello, please respond with "OK" if you are working.';
                const startTime = Date.now();
                
                const result = await s.service.generateText(testPrompt, 50);
                const responseTime = Date.now() - startTime;
                
                results.push({
                    name: s.name,
                    status: 'healthy',
                    responseTime: responseTime,
                    response: result?.substring(0, 50) || 'No response'
                });
                
                console.log(`${s.name}: Healthy (${responseTime}ms)`);
                
            } catch (error) {
                results.push({
                    name: s.name,
                    status: 'unhealthy',
                    error: error.message
                });
                
                console.log(`${s.name}: Unhealthy - ${error.message}`);
            }
        }
        
        const healthyCount = results.filter(r => r.status === 'healthy').length;
        
        console.log(`Health check complete: ${healthyCount}/${this.services.length} services healthy`);
        
        return {
            overall: healthyCount > 0 ? 'healthy' : 'unhealthy',
            healthyCount: healthyCount,
            totalServices: this.services.length,
            services: results
        };
    }
}

// Singleton instance
let multiAIInstance = null;

function getMultiAIService() {
    if (!multiAIInstance) {
        multiAIInstance = new MultiAIService();
    }
    return multiAIInstance;
}

module.exports = {
    MultiAIService,
    getMultiAIService
};
