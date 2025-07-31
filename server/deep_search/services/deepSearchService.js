const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DuckDuckGoService = require('../../utils/duckduckgo');
const axios = require('axios');
const GeminiAI = require('../../services/geminiAI');
const EmbeddingService = require('./EmbeddingService');
const RerankerService = require('./RerankerService');

// Custom error classes
class SearchResultError extends Error {
    constructor(message, details) {
        super(message);
        this.name = 'SearchResultError';
        this.details = details || {};
    }
}

class GeminiQuotaError extends SearchResultError {
    constructor(quotaInfo) {
        super('Gemini API quota exceeded', { quotaInfo });
        this.name = 'GeminiQuotaError';
    }
}

class GeminiRateLimitError extends SearchResultError {
    constructor(retryAttempts) {
        super(`Gemini API rate limit hit after ${retryAttempts} attempts`, { retryAttempts });
        this.name = 'GeminiRateLimitError';
    }
}

class WebSearchError extends SearchResultError {
    constructor(message, details) {
        super(message, details);
        this.name = 'WebSearchError';
    }
}

class CacheError extends SearchResultError {
    constructor(message, details) {
        super(message, details);
        this.name = 'CacheError';
    }
}

class QueryOptimizationError extends SearchResultError {
    constructor(message, details) {
        super(message, details);
        this.name = 'QueryOptimizationError';
    }
}

// Constants
const SEARCH_RESULTS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'search-results');

// Ensure search results directory exists
try {
    fs.mkdirSync(SEARCH_RESULTS_DIR, { recursive: true });
} catch (error) {
    console.error('Error creating search results directory:', error);
}


/**
 * Service for managing deep search operations and caching results
 */

class DeepSearchService {
    constructor(userId, geminiAI, duckDuckGo, embeddingModel = null, rerankerModel = null) {
        if (!userId) throw new Error('userId is required');
        if (!geminiAI) throw new Error('geminiAI is required');
        if (!duckDuckGo) throw new Error('duckDuckGo is required');

        this.userId = userId;
        this.userDir = path.join(SEARCH_RESULTS_DIR, userId);
        this.geminiAI = geminiAI;
        this.duckDuckGo = duckDuckGo;

        // Initialize services with error handling
        try {
            this.embeddingService = new EmbeddingService(embeddingModel);
            this.rerankerService = new RerankerService(rerankerModel);
        } catch (error) {
            console.warn('⚠️ Failed to initialize embedding/reranker services:', error.message);
            this.embeddingService = null;
            this.rerankerService = null;
        }

        this.initializeUserDir();
        // Define progress steps dynamically for more transparency and granularity
        this.progressSteps = [
            'Checking cache...',
            'Checking API quota...',
            'Optimizing query...',
            'Performing web search...',
            'Chunking, embedding, and reranking results...',
            'Checking Gemini quota...',
            'Generating initial AI synthesis...',
            'Reasoning: chain-of-thought step 1...',
            'Reasoning: chain-of-thought step 2...',
            'Iterative refinement (reranking/validation)...',
            'Final answer assembly...',
            'Preparing final result...',
            'Caching result...'
        ];
        this.progress = {
            totalSteps: this.progressSteps.length,
            currentStep: 0,
            status: 'idle',
            details: []
        };
        this.progressInterval = null;
        this.isSearching = false; // Add flag to prevent multiple simultaneous searches
    }

    initializeUserDir() {
        try {
            fs.mkdirSync(this.userDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    startProgressTracking() {
        this.progress.status = 'running';
        this.progressInterval = setInterval(() => {
            this.updateProgress(this.progress.currentStep, this.progress.details[0]);
        }, 1000);
        
        // Add timeout to prevent infinite loops
        this.progressTimeout = setTimeout(() => {
            console.warn('Progress tracking timeout reached, stopping tracking');
            this.stopProgressTracking();
        }, 45000); // 45 second timeout (increased for embedding processing)
    }

    updateProgress(step, message) {
        this.progress.currentStep = step;
        this.progress.details = [message || this.progressSteps[step - 1] || ''];
        console.log(`Progress: ${step}/${this.progress.totalSteps} - ${this.progress.details[0]}`);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (this.progressTimeout) {
            clearTimeout(this.progressTimeout);
            this.progressTimeout = null;
        }
        this.progress.status = 'complete';
    }

    async optimizeQuery(query, history = []) {
        try {
            const optimized = query.toLowerCase()
                .replace(/\b(a|an|the|and|or|in|on|at|to|for|with|of|by|from)\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (history.length > 0) {
                const context = history.map(h => h.query).join(' ').toLowerCase();
                return `${optimized} ${context}`;
            }
            return optimized;
        } catch (error) {
            throw new QueryOptimizationError('Failed to optimize query', { original: query });
        }
    }

    scoreResults(results) {
        return results.map(result => {
            const score = this.calculateScore(result);
            return { ...result, score };
        });
    }

    calculateScore(result) {
        let score = 0;
        if (result.title) score += result.title.length * 0.2;
        if (result.snippet) score += result.snippet.length * 0.1;
        if (result.url) {
            const domain = result.url.split('/')[2];
            const domainScore = domain.includes('wikipedia') ? 10 :
                               domain.includes('google') ? 8 :
                               domain.includes('edu') ? 7 :
                               domain.includes('gov') ? 7 :
                               5;
            score += domainScore;
        }
        return score;
    }

    async checkGeminiQuota() {
        try {
            const response = await this.geminiAI.checkQuota();

            // Handle different response formats
            if (response.remaining !== undefined) {
                // Format 1: {remaining, limit, status}
                return {
                    hasRemaining: response.remaining > 0,
                    remaining: response.remaining,
                    limit: response.limit
                };
            } else if (response.used !== undefined) {
                // Format 2: QuotaManager format {used, remaining, limit, ...}
                return {
                    hasRemaining: response.remaining > 0,
                    remaining: response.remaining,
                    limit: response.limit
                };
            } else {
                // Unknown format, assume quota available for now
                console.warn('⚠️ Unknown quota response format, assuming quota available');
                return {
                    hasRemaining: true,
                    remaining: 100,
                    limit: 200,
                    assumedAvailable: true
                };
            }
        } catch (error) {
            console.warn('⚠️ Could not check Gemini quota, assuming quota available for web search:', error.message);
            // CHANGED: Assume quota is available instead of exceeded to allow web search
            return {
                hasRemaining: true,
                remaining: 50,
                limit: 200,
                checkFailed: true,
                assumedAvailable: true
            };
        }
    }

    async callGeminiWithRetry(query, context, maxAttempts = 3) {
        let attempts = 0;
        const baseDelay = 1000;
        while (attempts < maxAttempts) {
            try {
                const response = await this.geminiAI.generateText(query);
                return response;
            } catch (error) {
                attempts++;
                // Check if it's a quota error - don't retry these
                const errorMessage = error.message || '';
                console.log('🔍 Checking error message:', errorMessage);

                if (
                    errorMessage.includes('quota') ||
                    errorMessage.includes('429') ||
                    errorMessage.includes('Too Many Requests') ||
                    errorMessage.includes('exceeded your current quota') ||
                    errorMessage.includes('exceeded') ||
                    errorMessage.includes('billing') ||
                    errorMessage.includes('plan')
                ) {
                    console.warn('🚫 Gemini API quota exceeded, using intelligent fallback');
                    return this.getIntelligentFallback(query, context);
                }
                // Check for 503 Service Unavailable (model overloaded)
                if (
                    errorMessage.includes('503') ||
                    errorMessage.includes('Service Unavailable') ||
                    errorMessage.includes('model is overloaded') ||
                    errorMessage.includes('overloaded')
                ) {
                    if (attempts >= maxAttempts) {
                        console.warn('🚫 Gemini service overloaded, max retries reached, using intelligent fallback');
                        return this.getIntelligentFallback(query, context);
                    }
                    const delay = baseDelay * Math.pow(2, attempts - 1);
                    console.warn(`Gemini 503 error (model overloaded), retrying in ${delay}ms (attempt ${attempts} of ${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                if (error instanceof GeminiRateLimitError) {
                    const delay = baseDelay * Math.pow(2, attempts - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // If we've reached max attempts, use fallback instead of throwing
                if (attempts >= maxAttempts) {
                    console.warn(`⚠️ All ${maxAttempts} attempts failed, using intelligent fallback`);
                    return this.getIntelligentFallback(query, context);
                }

                // For other errors, wait and retry
                const delay = baseDelay * Math.pow(2, attempts - 1);
                console.warn(`Gemini error, retrying in ${delay}ms (attempt ${attempts} of ${maxAttempts}):`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.warn(`⚠️ All Gemini attempts failed, using intelligent fallback`);
        return this.getIntelligentFallback(query, context);
    }

    /**
     * Generate intelligent fallback response when Gemini is unavailable
     */
    getIntelligentFallback(query, context = '') {
        console.log('🤖 Generating intelligent fallback response...');

        // Simple query classification for fallback responses
        const lowerQuery = query.toLowerCase();

        // Greeting responses
        if (lowerQuery.match(/^(hi|hello|hey|greetings?)$/)) {
            return "Hello! I'm here to help you with any questions you have. While my AI service is temporarily unavailable, I can still assist you with basic information and guidance.";
        }

        // Math queries
        if (lowerQuery.includes('calculate') || lowerQuery.includes('math') || lowerQuery.match(/\d+\s*[\+\-\*\/]\s*\d+/)) {
            return "I'd be happy to help with mathematical calculations. While my advanced AI is temporarily unavailable, you can try using a calculator or math tools for precise calculations.";
        }

        // Programming queries
        if (lowerQuery.includes('code') || lowerQuery.includes('program') || lowerQuery.includes('function') || lowerQuery.includes('python') || lowerQuery.includes('javascript')) {
            return "I can help with programming questions! While my AI service is temporarily unavailable, I recommend checking official documentation, Stack Overflow, or programming tutorials for detailed coding assistance.";
        }

        // General information queries
        if (lowerQuery.includes('what is') || lowerQuery.includes('explain') || lowerQuery.includes('how does')) {
            return `I understand you're asking about "${query}". While my AI service is temporarily unavailable due to high demand, I recommend checking reliable sources like Wikipedia, educational websites, or official documentation for detailed information on this topic.`;
        }

        // Default fallback
        return `Thank you for your question about "${query}". My AI service is temporarily unavailable due to high demand, but I'm still here to help! You might want to try rephrasing your question or checking reliable online sources for information. Please try again in a few moments when the service becomes available.`;
    }

    async getCachedResult(query) {
        try {
            const cacheFile = path.join(this.userDir, `${crypto.createHash('md5').update(query).digest('hex')}.json`);
            
            // Check if file exists first
            try {
                await fsPromises.access(cacheFile);
            } catch (accessError) {
                // File doesn't exist, return null (this is normal)
                return null;
            }
            
            // File exists, try to read it
            const cached = JSON.parse(await fsPromises.readFile(cacheFile, 'utf-8'));
            const cacheAge = new Date() - new Date(cached.timestamp);
            
            // Validate cached result content
            if (cacheAge < 24 * 60 * 60 * 1000 && 
                cached.hasResults && 
                (cached.message && cached.message.trim()) || 
                (cached.metadata && cached.metadata.sources && cached.metadata.sources.length > 0)) {
                return cached;
            }
            
            return null; // Cache expired or invalid content
        } catch (error) {
            // Only throw for actual file reading errors, not missing files
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist, this is normal
            }
            console.warn(`Cache read warning for query "${query}":`, error.message);
            return null; // Return null instead of throwing for cache issues
        }
    }

    async cacheResult(query, result) {
        try {
            const cacheFile = path.join(this.userDir, `${crypto.createHash('md5').update(query).digest('hex')}.json`);
            await fsPromises.writeFile(cacheFile, JSON.stringify(result, null, 2));
        } catch (error) {
            throw new CacheError('Failed to cache result', { query, error });
        }
    }

    handleError(error, step) {
        try {
            console.error(`DeepSearchService error at step ${step}:`, error);

            if (error instanceof GeminiQuotaError) {
                console.log('🔄 Providing fallback response due to quota limit...');
                return this.generateQuotaFallbackResponse();
            } else if (error instanceof GeminiRateLimitError) {
                console.log('🔄 Providing fallback response due to rate limit...');
                return this.generateFallbackResponse('rate_limit');
            } else if (error instanceof WebSearchError) {
                console.log('🔄 Providing fallback response due to search error...');
                return this.generateFallbackResponse('search_error');
            } else {
                console.log('🔄 Providing general fallback response...');
                return this.generateFallbackResponse('general_error');
            }
        } catch (error) {
            console.error('Error handling error:', error);
            return { success: false, error: 'Internal server error', details: {} };
        }
    }

    /**
     * Use Multi-AI service for synthesis when Gemini quota exceeded
     */
    async useMultiAIForSynthesis(query, searchResults) {
        try {
            // Import Multi-AI service
            const { getMultiAIService } = require('../../services/multiAIService');
            const multiAI = getMultiAIService();

            // Build context from search results
            let context = '';
            if (searchResults && searchResults.length > 0) {
                context = 'Based on the following search results:\n\n';
                searchResults.slice(0, 5).forEach((result, index) => {
                    context += `${index + 1}. ${result.title}\n${result.snippet}\n\n`;
                });
            }

            // Generate response using Multi-AI
            const response = await multiAI.generateResponse(query, context);

            if (response && response.summary) {
                console.log(`✅ Multi-AI synthesis successful using ${response.service}`);

                return {
                    message: response.summary,
                    metadata: {
                        sources: searchResults ? searchResults.slice(0, 5).map(result => ({
                            title: result.title,
                            url: result.url,
                            snippet: result.snippet
                        })) : [],
                        searchType: 'multi_ai_synthesis',
                        aiService: response.service,
                        note: 'Generated using Multi-AI service due to Gemini quota limit'
                    }
                };
            }

            return null;
        } catch (error) {
            console.error('Multi-AI synthesis failed:', error);
            return null;
        }
    }

    /**
     * Generate a helpful fallback response when quota is exceeded
     */
    generateQuotaFallbackResponse() {
        const fallbackMessage = `# API Quota Exceeded

I apologize, but I've reached my daily API limit for AI-powered responses. However, I can still help you in other ways:

## Alternative Search Options

1. **Web Search Engines**
   - [Google Search](https://www.google.com)
   - [Bing Search](https://www.bing.com)
   - [DuckDuckGo](https://duckduckgo.com)

2. **Specialized Resources**
   - [Wikipedia](https://wikipedia.org) - For general knowledge
   - [Stack Overflow](https://stackoverflow.com) - For programming questions
   - [GitHub](https://github.com) - For code and projects
   - [arXiv](https://arxiv.org) - For academic papers

3. **Educational Platforms**
   - [Khan Academy](https://khanacademy.org)
   - [Coursera](https://coursera.org)
   - [edX](https://edx.org)

## What You Can Do

- **Try again tomorrow**: My quota resets daily
- **Use specific search terms**: More targeted queries often yield better results
- **Check multiple sources**: Cross-reference information from different websites
- **Ask more specific questions**: Break down complex topics into smaller parts

## Technical Details

- **Quota Type**: Daily API request limit
- **Reset Time**: Approximately 24 hours from first request
- **Service**: Deep Search with AI synthesis

Thank you for your understanding! 🙏`;

        return {
            success: true,
            summary: fallbackMessage,
            sources: [],
            aiGenerated: false,
            query: this.currentQuery || 'search query',
            timestamp: new Date().toISOString(),
            userId: this.userId,
            formattedSources: 'No sources available due to quota limit',
            fallback: true,
            quotaExceeded: true,
            metadata: {
                searchType: 'quota_exceeded_fallback',
                sources: [],
                resultsCount: 0,
                aiGenerated: false,
                query: this.currentQuery || 'search query',
                timestamp: new Date().toISOString(),
                quotaExceeded: true
            }
        };
    }

    /**
     * Generate fallback response for different error types
     */
    generateFallbackResponse(errorType = 'general_error') {
        const query = this.currentQuery || 'your question';
        let fallbackMessage = '';

        switch (errorType) {
            case 'rate_limit':
                fallbackMessage = `# Service Temporarily Unavailable

I apologize, but the AI service is currently experiencing high demand and is temporarily unavailable.

## Your Question
"${query}"

## What You Can Do Right Now

1. **Try Again in a Few Minutes** - The service should be available shortly
2. **Use Alternative Search** - Try [Google](https://google.com) or [DuckDuckGo](https://duckduckgo.com)
3. **Simplify Your Question** - Break complex queries into smaller parts

## Why This Happened
- High server load
- Temporary rate limiting
- Service maintenance

Please try your question again in a few moments! 🔄`;
                break;

            case 'search_error':
                fallbackMessage = `# Search Service Issue

I encountered an issue while searching for information about "${query}".

## Alternative Approaches

1. **Manual Search** - Try searching directly on:
   - [Google](https://google.com/search?q=${encodeURIComponent(query)})
   - [Wikipedia](https://wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)})
   - [DuckDuckGo](https://duckduckgo.com/?q=${encodeURIComponent(query)})

2. **Rephrase Your Question** - Try using different keywords
3. **Be More Specific** - Add more context to your query

## What I Can Still Help With
- General knowledge questions
- Basic calculations
- Simple explanations

Please try rephrasing your question or use the search links above! 🔍`;
                break;

            default:
                fallbackMessage = this.getIntelligentFallback(query);
                break;
        }

        return {
            success: true,
            summary: fallbackMessage,
            sources: [],
            aiGenerated: false,
            query: query,
            timestamp: new Date().toISOString(),
            userId: this.userId,
            formattedSources: 'No sources available due to service issue',
            fallback: true,
            errorType: errorType,
            metadata: {
                searchType: `${errorType}_fallback`,
                sources: [],
                resultsCount: 0,
                aiGenerated: false,
                query: query,
                timestamp: new Date().toISOString(),
                errorType: errorType
            }
        };
    }

    /**
     * Helper: Expand snippet for a result by fetching and summarizing page content if snippet is missing/weak
     */
    async expandSnippetIfNeeded(result, query) {
        if (result.snippet && result.snippet.length > 40) return result; // Already has a decent snippet
        let pageContent = '';
        try {
            // Try to fetch page content using DuckDuckGo (if supported)
            if (this.duckDuckGo.fetchPageContent) {
                pageContent = await this.duckDuckGo.fetchPageContent(result.url);
            }
        } catch (e) {
            // Ignore fetch errors
        }
        if (!pageContent || pageContent.length < 40) {
            // Fallback: Use Gemini to summarize the page (if allowed)
            try {
                const prompt = `Summarize the main points of the following web page for the query: "${query}"\n\n${pageContent || result.url}`;
                const summary = await this.callGeminiWithRetry(prompt, pageContent || result.url, 1);
                if (summary && summary.length > 40) {
                    return { ...result, snippet: summary };
                }
            } catch (e) {
                // Ignore Gemini errors
            }
        }
        // If still no snippet, return as is
        return result;
    }

    /**
     * Helper: Determine if all results are weak (missing/short snippets)
     */
    areAllResultsWeak(results) {
        if (!results || results.length === 0) return true;
        return results.every(r => !r.snippet || r.snippet.length < 40);
    }

    /**
     * Helper: Format sources as bullet points
     */
    formatSources(sources) {
        if (!sources || sources.length === 0) return 'No sources found.';
        return sources.map((s) => `- [${s.title || s.url}](${s.url})${s.snippet ? `: ${s.snippet}` : ''}`).join('\n');
    }

    /**
     * Main DeepSearch pipeline
     */
    async performSearch(query, history = []) {
        try {
            // Prevent multiple simultaneous searches
            if (this.isSearching) {
                console.warn('Search already in progress, returning early');
                return {
                    message: 'A search is already in progress. Please wait for it to complete.',
                    metadata: {
                        sources: [],
                        searchType: 'already_in_progress',
                        note: 'Search already in progress'
                    }
                };
            }
            
            this.isSearching = true;
            this.currentQuery = query; // Store for fallback responses

            console.log(`🔍 Starting deep search for: "${query}"`);
            this.startProgressTracking();

            // Step 1: Check cache
            this.updateProgress(1);
            const cachedResult = await this.getCachedResult(query);
            if (cachedResult) {
                console.log('📦 Returning cached result');
                this.stopProgressTracking();
                this.isSearching = false;
                return cachedResult;
            }

            // Step 1.5: Quick quota check to avoid unnecessary API calls
            this.updateProgress(2);
            try {
                const quotaCheck = await this.checkGeminiQuota();
                if (!quotaCheck.hasRemaining) {
                    console.warn('🤖 Gemini quota exceeded, trying Multi-AI for immediate response...');
                    try {
                        const multiAIResult = await this.useMultiAIForSynthesis(query, []);
                        if (multiAIResult) {
                            this.stopProgressTracking();
                            this.isSearching = false;
                            return multiAIResult;
                        }
                    } catch (multiAIError) {
                        console.warn('Multi-AI immediate response failed:', multiAIError.message);
                    }

                    console.warn('Providing basic fallback response');
                    this.stopProgressTracking();
                    this.isSearching = false;
                    return {
                        message: `I apologize, but I'm currently unable to provide a detailed response due to API quota limitations. Here's what I can tell you about "${query}":\n\nThis appears to be a topic that would benefit from current information, but I'm limited in my ability to search for the most up-to-date details right now. You might want to try searching directly on a search engine or check back later when the service is available.\n\nIf you have specific questions about this topic, feel free to ask and I'll do my best to help with what I know.`,
                        metadata: {
                            sources: [],
                            searchType: 'quota_exceeded_immediate',
                            note: 'API quota exceeded - providing immediate fallback'
                        }
                    };
                }
            } catch (quotaError) {
                console.warn('Could not check quota, proceeding with search:', quotaError.message);
            }

            // Step 2: Optimize query
            this.updateProgress(3);
            const optimizedQuery = await this.optimizeQuery(query, history);

            // Step 3: Perform web search
            this.updateProgress(4);
            let searchResults;
            try {
                searchResults = await this.duckDuckGo.performSearch(optimizedQuery, 'text');
                
                if (searchResults.error) {
                    throw new WebSearchError(searchResults.error, { query: optimizedQuery });
                }
                
                // Additional validation for search results
                if (!searchResults.results || !Array.isArray(searchResults.results)) {
                    throw new WebSearchError('Invalid search results format', { query: optimizedQuery });
                }
                
                // Log if fallback search was used
                if (searchResults.fallback) {
                    console.log('Using fallback search results');
                }
                
            } catch (searchError) {
                console.warn(`Web search failed for "${optimizedQuery}":`, searchError.message);
                
                // Check if it's a specific DuckDuckGo library error
                if (searchError.message && searchError.message.includes('Cannot read properties of null')) {
                    console.warn('DuckDuckGo library error detected, using fallback response');
                }
                
                // For library errors or timeouts, skip retries and go directly to fallback
                if (searchError.message && (
                    searchError.message.includes('Cannot read properties of null') ||
                    searchError.message.includes('Search timeout') ||
                    searchError.message.includes('Search library error')
                )) {
                    console.warn('Skipping retries due to library error, using fallback response');
                }
                
                // Generate fallback response using Gemini
                try {
                    console.log('Progress: 7/9 - Generating fallback response...');
                    const fallbackPrompt = `Generate a helpful response about "${query}".
                    This should be informative and relevant to the user's question.
                    Keep it concise but comprehensive. Do NOT include any "Limitations" section or discuss limitations of the information.`;
                    
                    const fallbackResponse = await this.callGeminiWithRetry(fallbackPrompt, '');
                    this.isSearching = false;
                    return {
                        message: fallbackResponse,
                        metadata: {
                            sources: [],
                            searchType: 'fallback',
                            note: 'Generated fallback response due to search limitations'
                        }
                    };
                } catch (error) {
                    console.error('Fallback response generation also failed:', error);
                    
                    // Check if it's a quota error - look for specific error patterns
                    const isQuotaError = error instanceof GeminiQuotaError || 
                        (error.message && (
                            error.message.includes('quota') ||
                            error.message.includes('429') ||
                            error.message.includes('Too Many Requests') ||
                            error.message.includes('exceeded')
                        ));
                    
                    if (isQuotaError) {
                        console.warn('Gemini API quota exceeded, providing quota fallback response');
                        this.stopProgressTracking();
                        this.isSearching = false;
                        return {
                            message: `I apologize, but I'm currently unable to provide a detailed response due to API quota limitations. Here's what I can tell you about "${query}":\n\nThis appears to be a topic that would benefit from current information, but I'm limited in my ability to search for the most up-to-date details right now. You might want to try searching directly on a search engine or check back later when the service is available.\n\nIf you have specific questions about this topic, feel free to ask and I'll do my best to help with what I know.`,
                            metadata: {
                                sources: [],
                                searchType: 'quota_exceeded_fallback',
                                note: 'API quota exceeded - providing basic response'
                            }
                        };
                    }
                    
                    // Generic fallback for other errors
                    this.stopProgressTracking();
                    this.isSearching = false;
                    return {
                        message: `I'm having trouble accessing external information right now. Here's a general response about "${query}":\n\nThis topic appears to be something that would benefit from current, up-to-date information. Unfortunately, I'm unable to search for the latest details at the moment. You might want to try a direct web search or check back later.\n\nIf you have specific questions, I'm happy to help with what I can!`,
                        metadata: {
                            sources: [],
                            searchType: 'error_fallback',
                            note: 'Multiple errors occurred - providing basic response'
                        }
                    };
                }
            }


            // Step 4: Chunk, embed, rerank, and expand snippets if needed
            this.updateProgress(5);
            let rawResults = searchResults.results || [];
            // Reasoning trace for transparency
            const reasoningTrace = [];
            reasoningTrace.push('Initial query: ' + query);
            reasoningTrace.push('Web search performed, number of results: ' + (rawResults ? rawResults.length : 0));
            // Expand snippets for each result (in parallel, but limit concurrency)
            const expandedResults = [];
            for (const result of rawResults) {
                expandedResults.push(await this.expandSnippetIfNeeded(result, query));
            }
            reasoningTrace.push('Expanded snippets for all results.');

            // Late-chunking: break each snippet into chunks
            console.log('📝 Processing text chunks...');
            let chunkedCandidates = [];
            for (const result of expandedResults) {
                const text = result.snippet || result.description || '';
                const chunks = this.embeddingService.chunkText(text);
                chunkedCandidates.push(...chunks.map(chunk => ({
                    ...result,
                    chunkText: chunk
                })));
            }
            console.log(`📝 Created ${chunkedCandidates.length} text chunks`);
            reasoningTrace.push('Chunked all snippets for embedding.');

            // Embed all chunks
            console.log('🧠 Generating embeddings...');
            const embeddedChunks = await this.embeddingService.embedChunks(chunkedCandidates.map(c => c.chunkText));
            console.log('✅ Embeddings generated');

            // Attach embeddings to candidates
            chunkedCandidates = chunkedCandidates.map((c, i) => ({ ...c, embedding: embeddedChunks[i].embedding }));

            // For now, use the first chunk as query embedding (stub)
            console.log('🔍 Processing query embedding...');
            const queryChunks = this.embeddingService.chunkText(query);
            const queryEmbeddings = await this.embeddingService.embedChunks([queryChunks[0]]);
            const queryEmbedding = queryEmbeddings[0].embedding;

            // Compute similarity and add as feature
            console.log('📊 Computing similarities...');
            chunkedCandidates = chunkedCandidates.map(c => ({
                ...c,
                similarity: EmbeddingService.cosineSimilarity(queryEmbedding, c.embedding)
            }));
            reasoningTrace.push('Computed similarity between query and all chunks.');

            // Rerank using reranker service
            console.log('🔄 Reranking results...');
            const reranked = await this.rerankerService.rerank(query, chunkedCandidates);
            reasoningTrace.push('Reranked all candidates.');

            // Take top 5 reranked results
            const topResults = reranked.slice(0, 5);
            console.log(`✅ Selected top ${topResults.length} results for synthesis`);
            reasoningTrace.push('Selected top 5 results for synthesis.');

            // Step 4.5: LLM fallback if all results are weak
            if (this.areAllResultsWeak(topResults)) {
                this.updateProgress(6, 'All search results are weak, using LLM fallback...');
                reasoningTrace.push('All top results are weak or missing snippets. Triggering LLM fallback.');
                const fallbackPrompt = `The web search did not return strong results for the query: "${query}". Please generate a helpful, well-structured answer using your own knowledge and reasoning. Do NOT include any "Limitations" section or discuss limitations of the information. Focus only on providing the requested information in a clear and helpful manner.`;
                const llmFallback = await this.callGeminiWithRetry(fallbackPrompt, '', 1);
                this.stopProgressTracking();
                return {
                    summary: llmFallback,
                    sources: topResults.map(r => ({ title: r.title, url: r.url, snippet: r.snippet || r.chunkText })),
                    aiGenerated: true,
                    rawResults: topResults,
                    query: query,
                    timestamp: new Date().toISOString(),
                    userId: this.userId,
                    note: 'LLM fallback used due to weak search results',
                    reasoning: reasoningTrace
                };
            }


            // Step 5: Check Gemini quota and use Multi-AI if exceeded
            this.updateProgress(6);
            const quotaCheck = await this.checkGeminiQuota();
            if (!quotaCheck.hasRemaining) {
                console.warn('🤖 Gemini quota exceeded, trying Multi-AI service...');
                try {
                    const multiAIResult = await this.useMultiAIForSynthesis(query, searchResults);
                    if (multiAIResult) {
                        this.stopProgressTracking();
                        this.isSearching = false;
                        return multiAIResult;
                    }
                } catch (multiAIError) {
                    console.warn('Multi-AI also failed, using fallback response:', multiAIError.message);
                }

                console.warn('All AI services failed, using fallback response');
                this.stopProgressTracking();
                this.isSearching = false;
                return this.generateQuotaFallbackResponse();
            }


            // Step 6: Generate AI synthesis
            this.updateProgress(7, 'Generating AI synthesis...');


            // Extract subtopics from top results titles (limit to 3 for brevity)
            const subtopics = topResults.slice(0, 3).map(r => r.title);

            let combinedReport = `Comprehensive report on "${query}":\n\n`;


            for (const subtopic of subtopics) {
                const sectionPrompt = `Write a detailed section for a report on the topic: "${subtopic}". Include explanations, examples, and relevant data. Make it informative and suitable for a professional report.`;
                const sectionResponse = await this.callGeminiWithRetry(sectionPrompt, '');
                combinedReport += `Section: ${subtopic}\n${sectionResponse}\n\n`;
            }

            // Step 7: Prepare final result
            this.updateProgress(12);
            const result = {
                summary: combinedReport,
                sources: topResults.map(r => ({ title: r.title, url: r.url })),
                aiGenerated: true,
                rawResults: topResults,
                query: query,
                timestamp: new Date().toISOString(),
                userId: this.userId,
                formattedSources: this.formatSources(topResults),
                reasoning: reasoningTrace,
                metadata: {
                    searchType: 'standard_deep_search',
                    sources: topResults.map(r => ({ title: r.title, url: r.url })),
                    resultsCount: topResults.length,
                    aiGenerated: true,
                    query: query,
                    timestamp: new Date().toISOString()
                }
            };

            // Step 8: Cache the result
            this.updateProgress(13);
            await this.cacheResult(query, result);

            this.stopProgressTracking();
            console.log(`✅ Deep search completed for: "${query}"`);
            return result;

        } catch (error) {
            this.stopProgressTracking();
            console.error(`❌ Deep search failed for "${query}":`, error);
            return this.handleError(error, 'performSearch');
        } finally {
            this.isSearching = false;
        }
    }

    // Add any additional methods you need here, following the same pattern
}

module.exports = DeepSearchService;
