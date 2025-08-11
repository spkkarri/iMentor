/**
 * Enhanced Deep Search Service with Multi-Model Integration
 * Extends the existing deep search functionality with specialized model routing
 */

// Ensure environment variables are loaded
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const DeepSearchService = require('../deep_search/services/deepSearchService');
const MultiModelService = require('./multiModelService');
const OfflineDeepSearchService = require('./offlineDeepSearchService');
const { getMultiAIService } = require('./multiAIService');

class EnhancedDeepSearchService extends DeepSearchService {
    constructor(userId, geminiAI, duckDuckGo, embeddingModel = null, rerankerModel = null) {
        super(userId, geminiAI, duckDuckGo, embeddingModel, rerankerModel);
        
        // Initialize multi-model service
        this.multiModelService = new MultiModelService();
        this.multiModelInitialized = false;

        // Initialize offline deep search as ultimate fallback
        this.offlineDeepSearch = new OfflineDeepSearchService(userId);

        // Initialize multi-AI service for AI-powered responses
        this.multiAI = getMultiAIService();
        
        // Subject classification keywords for routing
        this.subjectKeywords = {
            mathematics: ['math', 'calculate', 'equation', 'formula', 'solve', 'algebra', 'geometry', 'calculus', 'statistics', 'probability'],
            programming: ['code', 'programming', 'function', 'algorithm', 'python', 'javascript', 'debug', 'syntax', 'api', 'database'],
            science: ['physics', 'chemistry', 'biology', 'experiment', 'hypothesis', 'theory', 'molecule', 'atom', 'cell', 'energy', 'photosynthesis', 'science', 'scientific'],
            history: ['history', 'historical', 'ancient', 'medieval', 'war', 'civilization', 'empire', 'revolution', 'century'],
            literature: ['literature', 'poetry', 'novel', 'author', 'character', 'plot', 'theme', 'metaphor', 'symbolism', 'shakespeare', 'wrote', 'book', 'poem']
        };
        
        // Initialize multi-model service asynchronously
        this.initializeMultiModel();
        
        console.log('Enhanced Deep Search Service initialized');
    }

    /**
     * Initialize the multi-model service
     */
    async initializeMultiModel() {
        try {
            this.multiModelInitialized = await this.multiModelService.initialize();
            if (this.multiModelInitialized) {
                console.log('Multi-model service integrated with deep search');
            } else {
                console.log('Multi-model service not available, using standard deep search');
            }
        } catch (error) {
            console.error('Failed to initialize multi-model service:', error);
            this.multiModelInitialized = false;
        }
    }

    /**
     * Classify query to determine if it should use specialized models
     */
    classifyQuery(query) {
        const queryLower = query.toLowerCase();
        const scores = {};

        // Calculate keyword scores for each subject
        for (const [subject, keywords] of Object.entries(this.subjectKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                if (queryLower.includes(keyword)) {
                    score += 1;
                }
            }
            scores[subject] = score;
        }

        // Add pattern matching scores
        const patternScores = this.checkPatterns(query);
        for (const [subject, patternScore] of Object.entries(patternScores)) {
            scores[subject] = (scores[subject] || 0) + patternScore;
        }

        // Find the subject with the highest score
        const maxScore = Math.max(...Object.values(scores));
        const bestSubject = Object.keys(scores).find(subject => scores[subject] === maxScore);

        // Require at least 1 point for classification
        if (maxScore > 0) {
            return {
                subject: bestSubject,
                confidence: Math.min(maxScore / 3, 1), // Normalize confidence
                scores
            };
        }

        return {
            subject: 'general',
            confidence: 0,
            scores
        };
    }

    /**
     * Check for pattern matches in the query
     */
    checkPatterns(query) {
        const scores = {};

        // Mathematics patterns
        const mathPatterns = [
            /\b\d+\s*[+\-*/]\s*\d+\b/,           // Basic arithmetic: 15 + 27
            /\b\d+\s*=\s*\?/,                     // Equations: 15 + 27 = ?
            /\bx\s*[+\-*/=]\s*\d+\b/,             // Algebra: x + 5
            /\b\d+\s*%\b/,                        // Percentages: 25%
            /\b\d+\.\d+\b/,                       // Decimals: 3.14
            /\b\d+\/\d+\b/,                       // Fractions: 1/2
            /\b\d+\^\d+\b/,                       // Exponents: 2^3
            /\bsqrt\(/,                           // Square root
            /\bsin\(|cos\(|tan\(/                 // Trigonometry
        ];

        // Programming patterns
        const programmingPatterns = [
            /\bdef\s+\w+\s*\(/,                   // Python function definition
            /\bclass\s+\w+\s*:/,                  // Python class definition
            /\bfunction\s+\w+\s*\(/,              // JavaScript function
            /\bimport\s+\w+/,                     // Import statements
            /\bprint\s*\(/,                       // Print statements
            /\bif\s+.*:/,                         // Conditional statements
            /\bfor\s+\w+\s+in\s+/,                // For loops
            /\b\w+\s*=\s*\[.*\]/,                 // Array/list assignment
            /\b\w+\.\w+\(/,                       // Method calls
            /\b(int|str|float|bool)\s*\(/         // Type casting
        ];

        // Science patterns
        const sciencePatterns = [
            /\b\d+\s*°[CF]\b/,                    // Temperature: 25°C
            /\b\d+\s*(kg|g|mg)\b/,                // Mass units
            /\b\d+\s*(m|cm|mm)\/s\b/,             // Velocity units
            /\bH2O\b/,                            // Water formula
            /\bCO2\b/,                            // Carbon dioxide
            /\bNaCl\b/,                           // Salt formula
            /\bDNA\b|\bRNA\b/,                    // Genetic material
            /\bpH\s*\d+/                          // pH values
        ];

        // Check mathematics patterns
        let mathScore = 0;
        for (const pattern of mathPatterns) {
            if (pattern.test(query)) {
                mathScore += 2; // Higher weight for patterns
            }
        }
        if (mathScore > 0) scores.mathematics = mathScore;

        // Check programming patterns
        let progScore = 0;
        for (const pattern of programmingPatterns) {
            if (pattern.test(query)) {
                progScore += 2;
            }
        }
        if (progScore > 0) scores.programming = progScore;

        // Check science patterns
        let scienceScore = 0;
        for (const pattern of sciencePatterns) {
            if (pattern.test(query)) {
                scienceScore += 2;
            }
        }
        if (scienceScore > 0) scores.science = scienceScore;

        return scores;
    }

    /**
     * Enhanced search that integrates multi-model responses
     */
    async performSearch(query, history = []) {
        try {
            console.log(`Enhanced deep search for: "${query}"`);

            // Classify the query
            const classification = this.classifyQuery(query);
            console.log(`Query classified as: ${classification.subject} (confidence: ${classification.confidence.toFixed(2)})`);
            
            // Decide whether to use multi-model or standard approach
            const useMultiModel = this.shouldUseMultiModel(classification, query);
            
            if (useMultiModel) {
                return await this.performMultiModelSearch(query, history, classification);
            } else {
                return await this.performStandardSearch(query, history);
            }
            
        } catch (error) {
            console.error('Enhanced deep search error:', error);
            // Fallback to standard search
            return await this.performStandardSearch(query, history);
        }
    }

    /**
     * Determine if multi-model approach should be used
     */
    shouldUseMultiModel(classification, query) {
        // Use multi-model if:
        // 1. Multi-model service is available
        // 2. Query is classified with reasonable confidence
        // 3. Query is not too complex for specialized models
        
        if (!this.multiModelInitialized || !this.multiModelService.isAvailable()) {
            return false;
        }
        
        if (classification.subject === 'general' || classification.confidence < 0.3) {
            return false;
        }
        
        // Check if query is suitable for specialized models
        const queryLength = query.split(' ').length;
        if (queryLength > 50) { // Very long queries might be better for general search
            return false;
        }
        
        return true;
    }

    /**
     * Perform search using multi-model approach
     */
    async performMultiModelSearch(query, history, classification) {
        console.log(`Using multi-model approach for ${classification.subject}`);
        
        try {
            // First, try to get a direct response from the specialized model
            const multiModelResult = await this.multiModelService.processQuery(query, {
                subject: classification.subject,
                confidence: classification.confidence,
                history: history.slice(-3) // Last 3 messages for context
            });
            
            // If the specialized model provides a good response, use it
            if (multiModelResult && multiModelResult.metadata.confidence > 0.7) {
                console.log(`High-confidence response from ${multiModelResult.metadata.model_used}`);
                
                return {
                    summary: multiModelResult.message,
                    sources: [],
                    aiGenerated: true,
                    query: query,
                    timestamp: new Date().toISOString(),
                    userId: this.userId,
                    metadata: {
                        ...multiModelResult.metadata,
                        searchType: 'multi_model_direct',
                        classification: classification
                    }
                };
            }
            
            // If confidence is low, enhance with web search
            console.log(`Enhancing with web search due to low confidence`);
            return await this.performHybridSearch(query, history, classification, multiModelResult);
            
        } catch (error) {
            console.error('Multi-model search error:', error);
            // Enhanced fallback chain: Multi-AI → Standard → Offline
            console.log('Trying Multi-AI service first...');
            try {
                return await this.performMultiAISearch(query, history);
            } catch (multiAIError) {
                console.error('Multi-AI search failed, trying standard search:', multiAIError);
                try {
                    return await this.performStandardSearch(query, history);
                } catch (standardError) {
                    console.error('Standard search also failed, using offline deep search:', standardError);
                    return await this.performOfflineDeepSearch(query, history);
                }
            }
        }
    }

    /**
     * Perform hybrid search combining web search with specialized models
     */
    async performHybridSearch(query, history, classification, initialResult) {
        console.log('Performing hybrid search (web + specialized model)');
        
        // Perform standard web search first
        const webSearchResult = await super.performSearch(query, history);
        
        // If we have good web search results, enhance the synthesis with specialized model
        if (webSearchResult.sources && webSearchResult.sources.length > 0) {
            try {
                // Create enhanced context for specialized model
                const webContext = webSearchResult.sources
                    .map(source => `${source.title}: ${source.snippet}`)
                    .join('\n\n');
                
                const enhancedQuery = `Based on the following web search results, provide a comprehensive answer to: "${query}"\n\nWeb Search Results:\n${webContext}`;
                
                const enhancedResult = await this.multiModelService.processQuery(enhancedQuery, {
                    subject: classification.subject,
                    context_type: 'web_enhanced',
                    original_query: query
                });
                
                if (enhancedResult && enhancedResult.message) {
                    return {
                        ...webSearchResult,
                        summary: enhancedResult.message,
                        metadata: {
                            ...webSearchResult.metadata,
                            searchType: 'hybrid_enhanced',
                            model_used: enhancedResult.metadata.model_used,
                            classification: classification,
                            enhancement_applied: true
                        }
                    };
                }
                
            } catch (error) {
                console.error('Hybrid enhancement error:', error);
            }
        }
        
        // Return web search result if enhancement fails
        return {
            ...webSearchResult,
            metadata: {
                ...webSearchResult.metadata,
                searchType: 'hybrid_fallback',
                classification: classification
            }
        };
    }

    /**
     * Perform multi-AI search (primary fallback)
     */
    async performMultiAISearch(query, history) {
        console.log('Using multi-AI search');
        try {
            // Build context from history
            const context = this.buildContextFromHistory(history);

            // Use multi-AI service to generate response
            const result = await this.multiAI.generateResponse(query, context);

            return {
                ...result,
                sources: [
                    {
                        title: `AI Response via ${result.service}`,
                        url: 'internal://multi-ai-service',
                        snippet: `Generated using ${result.service} AI service`
                    }
                ],
                metadata: {
                    ...result.metadata,
                    searchType: 'multi_ai_search',
                    multi_model_available: this.multiModelInitialized,
                    ai_service: result.service,
                    fallback_attempt: result.attempt
                }
            };
        } catch (error) {
            console.error('Multi-AI search failed:', error);
            throw error;
        }
    }

    buildContextFromHistory(history) {
        if (!history || history.length === 0) return '';

        const recentMessages = history.slice(-3);
        return recentMessages
            .map(msg => `${msg.role}: ${msg.parts?.[0]?.text || msg.content || ''}`)
            .join('\n');
    }

    /**
     * Perform standard search (fallback)
     */
    async performStandardSearch(query, history) {
        console.log('Using standard deep search');
        try {
            const result = await super.performSearch(query, history);

            // Ensure metadata exists and is properly structured
            const metadata = result.metadata || {
                searchType: 'standard_deep_search',
                sources: result.sources || [],
                resultsCount: result.sources ? result.sources.length : 0,
                aiGenerated: result.aiGenerated || true,
                query: result.query,
                timestamp: result.timestamp || new Date().toISOString()
            };

            return {
                ...result,
                metadata: {
                    ...metadata,
                    searchType: 'standard_deep_search',
                    multi_model_available: this.multiModelInitialized
                }
            };
        } catch (error) {
            console.error('Standard deep search failed, using offline deep search:', error);
            return await this.performOfflineDeepSearch(query, history);
        }
    }

    /**
     * Perform offline deep search (ultimate fallback)
     */
    async performOfflineDeepSearch(query, history) {
        console.log('Using offline deep search (ultimate fallback)');
        try {
            const result = await this.offlineDeepSearch.performSearch(query, history);

            return {
                ...result,
                metadata: {
                    ...result.metadata,
                    searchType: 'offline_deep_search',
                    fallback_level: 'ultimate',
                    reliable: true,
                    always_available: true
                }
            };
        } catch (error) {
            console.error('Even offline deep search failed:', error);

            // Check if it's a quota limit error
            if (error.message.includes('Daily request limit exceeded')) {
                return this.generateQuotaExceededResponse(query);
            }

            // This should never happen, but just in case
            return {
                summary: `# Your Question: "${query}"

I apologize, but I'm experiencing technical difficulties. Here are some reliable resources you can use:

## 🌐 Direct Search Options
- **Google**: [google.com/search?q=${encodeURIComponent(query)}](https://google.com/search?q=${encodeURIComponent(query)})
- **DuckDuckGo**: [duckduckgo.com/?q=${encodeURIComponent(query)}](https://duckduckgo.com/?q=${encodeURIComponent(query)})
- **Wikipedia**: [wikipedia.org](https://wikipedia.org)

## 📚 Educational Resources
- **Khan Academy**: [khanacademy.org](https://khanacademy.org)
- **MIT OpenCourseWare**: [ocw.mit.edu](https://ocw.mit.edu)
- **Stack Overflow**: [stackoverflow.com](https://stackoverflow.com) (for programming)

Please try these resources for reliable information on your topic.`,
                sources: [],
                aiGenerated: false,
                query: query,
                timestamp: new Date().toISOString(),
                userId: this.userId,
                metadata: {
                    searchType: 'emergency_fallback',
                    fallback_level: 'emergency',
                    error: error.message
                }
            };
        }
    }

    /**
     * Generate quota exceeded response
     */
    generateQuotaExceededResponse(query) {
        const resetTime = new Date();
        resetTime.setUTCDate(resetTime.getUTCDate() + 1);
        resetTime.setUTCHours(0, 0, 0, 0);

        const hoursUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / (1000 * 60 * 60));

        return {
            summary: `# 🚫 Daily Request Limit Exceeded

## Request Limit Reached
You have reached the **50 request daily limit** for AI-powered search features.

### 📊 Quota Information
- **Daily Limit**: 50 requests
- **Current Usage**: 50/50 (100%)
- **Reset Time**: ${resetTime.toISOString().split('T')[0]} at midnight UTC
- **Hours Until Reset**: ${hoursUntilReset} hours

## 🔄 What You Can Do

### 1. **Wait for Reset**
Your quota will automatically reset at **midnight UTC** (${hoursUntilReset} hours from now).

### 2. **Use Alternative Search Methods**
While waiting, you can use these excellent resources:

#### 🌐 **Web Search Engines**
- **Google**: [google.com/search?q=${encodeURIComponent(query)}](https://google.com/search?q=${encodeURIComponent(query)})
- **Bing**: [bing.com/search?q=${encodeURIComponent(query)}](https://bing.com/search?q=${encodeURIComponent(query)})
- **DuckDuckGo**: [duckduckgo.com/?q=${encodeURIComponent(query)}](https://duckduckgo.com/?q=${encodeURIComponent(query)})

#### 📚 **Educational Resources**
- **Wikipedia**: [wikipedia.org](https://wikipedia.org) - Comprehensive encyclopedia
- **Khan Academy**: [khanacademy.org](https://khanacademy.org) - Free educational content
- **MIT OpenCourseWare**: [ocw.mit.edu](https://ocw.mit.edu) - Free university courses

#### 💻 **For Programming Questions**
- **Stack Overflow**: [stackoverflow.com](https://stackoverflow.com) - Programming Q&A
- **GitHub**: [github.com](https://github.com) - Code repositories and examples
- **MDN Web Docs**: [developer.mozilla.org](https://developer.mozilla.org) - Web development

#### 🔬 **For Science & Math**
- **Wolfram Alpha**: [wolframalpha.com](https://wolframalpha.com) - Computational knowledge
- **NASA**: [nasa.gov](https://nasa.gov) - Space and earth sciences
- **Khan Academy Math**: [khanacademy.org/math](https://khanacademy.org/math) - Mathematics

### 3. **Optimize Your Usage**
To make the most of your daily quota:
- **Combine related questions** into single searches
- **Use specific keywords** for more targeted results
- **Save important responses** for future reference

## 📈 Tomorrow's Fresh Start
Your quota will reset to **50 new requests** at midnight UTC. Come back then for AI-powered search assistance!

Thank you for understanding! 🙏`,
            sources: [
                {
                    title: 'Quota Management System',
                    url: 'internal://quota-manager',
                    snippet: 'Daily request limit: 50 requests per day, resets at midnight UTC'
                }
            ],
            aiGenerated: false,
            query: query,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            metadata: {
                searchType: 'quota_exceeded',
                fallback_level: 'quota_limit',
                quotaExceeded: true,
                resetTime: resetTime.toISOString(),
                hoursUntilReset: hoursUntilReset
            }
        };
    }

    /**
     * Get enhanced service status
     */
    async getServiceStatus() {
        const baseStatus = {
            userId: this.userId,
            isSearching: this.isSearching,
            currentQuery: this.currentQuery
        };
        
        if (this.multiModelInitialized) {
            try {
                const multiModelStatus = await this.multiModelService.getStatus();
                return {
                    ...baseStatus,
                    multiModel: multiModelStatus,
                    enhancedFeaturesAvailable: true
                };
            } catch (error) {
                return {
                    ...baseStatus,
                    multiModel: { error: error.message },
                    enhancedFeaturesAvailable: false
                };
            }
        }
        
        return {
            ...baseStatus,
            enhancedFeaturesAvailable: false
        };
    }

    /**
     * Shutdown the enhanced service
     */
    async shutdown() {
        console.log('Shutting down Enhanced Deep Search Service');
        
        if (this.multiModelService) {
            await this.multiModelService.shutdown();
        }
        
        // Call parent shutdown if it exists
        if (super.shutdown) {
            await super.shutdown();
        }
    }

    /**
     * Test the multi-model integration
     */
    async testMultiModelIntegration() {
        const testQueries = [
            { query: "What is 2 + 2?", expectedSubject: "mathematics" },
            { query: "How do you create a function in Python?", expectedSubject: "programming" },
            { query: "What is photosynthesis?", expectedSubject: "science" },
            { query: "When did World War II end?", expectedSubject: "history" },
            { query: "Who wrote Romeo and Juliet?", expectedSubject: "literature" }
        ];
        
        const results = [];
        
        for (const test of testQueries) {
            try {
                const classification = this.classifyQuery(test.query);
                const isCorrect = classification.subject === test.expectedSubject;
                
                results.push({
                    query: test.query,
                    expected: test.expectedSubject,
                    classified: classification.subject,
                    confidence: classification.confidence,
                    correct: isCorrect
                });
                
                console.log(`Test: "${test.query}" -> ${classification.subject} (${isCorrect ? 'PASS' : 'FAIL'})`);
                
            } catch (error) {
                results.push({
                    query: test.query,
                    error: error.message
                });
            }
        }
        
        const accuracy = results.filter(r => r.correct).length / results.length;
        console.log(`Classification accuracy: ${(accuracy * 100).toFixed(1)}%`);
        
        return results;
    }

    /**
     * Generate offline fallback when all services fail
     */
    generateOfflineFallback(query, classification) {
        console.log('Generating offline fallback response...');

        const subject = classification.subject;
        let response = '';

        switch (subject) {
            case 'mathematics':
                response = `# Mathematics Query: "${query}"

I understand you're asking about a mathematical topic. While my AI services are temporarily unavailable, here are some helpful resources:

## Recommended Math Resources
- **Wolfram Alpha**: [wolframalpha.com](https://wolframalpha.com) - Excellent for calculations and equations
- **Khan Academy**: [khanacademy.org/math](https://khanacademy.org/math) - Step-by-step math tutorials
- **Desmos Calculator**: [desmos.com/calculator](https://desmos.com/calculator) - Graphing calculator

## What You Can Do
1. Try the calculation on Wolfram Alpha
2. Search for tutorials on Khan Academy
3. Use online math calculators
4. Ask again when the service is restored

The AI service should be available again shortly! 🧮`;
                break;

            case 'programming':
                response = `# Programming Query: "${query}"

I see you're asking about programming! While my AI services are temporarily unavailable, here are excellent resources:

## Programming Resources
- **Stack Overflow**: [stackoverflow.com](https://stackoverflow.com) - Community Q&A
- **MDN Web Docs**: [developer.mozilla.org](https://developer.mozilla.org) - Web development
- **GitHub**: [github.com](https://github.com) - Code examples and projects

## What You Can Do
1. Search Stack Overflow for similar questions
2. Check official documentation
3. Look for code examples on GitHub
4. Try online coding platforms

The AI service should be available again shortly! 💻`;
                break;

            default:
                response = `# Your Question: "${query}"

Thank you for your question! While my AI services are temporarily unavailable, I'm still here to help guide you to the right resources.

## General Resources
- **Google Search**: [google.com](https://google.com) - Comprehensive web search
- **Wikipedia**: [wikipedia.org](https://wikipedia.org) - General knowledge
- **DuckDuckGo**: [duckduckgo.com](https://duckduckgo.com) - Privacy-focused search

## What You Can Do
1. Try a web search with specific keywords
2. Check Wikipedia for background information
3. Look for official websites related to your topic
4. Ask again when the service is restored

The AI service should be available again shortly! 🔍`;
                break;
        }

        return {
            summary: response,
            sources: [],
            aiGenerated: false,
            query: query,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            metadata: {
                searchType: 'offline_fallback',
                classification: classification,
                fallback: true
            }
        };
    }
}

module.exports = EnhancedDeepSearchService;
