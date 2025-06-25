const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const DuckDuckGoService = require('../../utils/duckduckgo');
const axios = require('axios');
const GeminiAI = require('../../services/geminiAI');

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
    constructor(userId, geminiAI, duckDuckGo) {
        if (!userId) throw new Error('userId is required');
        if (!geminiAI) throw new Error('geminiAI is required');
        if (!duckDuckGo) throw new Error('duckDuckGo is required');
        this.userId = userId;
        this.userDir = path.join(SEARCH_RESULTS_DIR, userId);
        this.geminiAI = geminiAI;
        this.duckDuckGo = duckDuckGo;
        this.initializeUserDir();
        this.progress = {
            totalSteps: 9,
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
        }, 15000); // 15 second timeout (reduced from 30)
    }

    updateProgress(step, message) {
        this.progress.currentStep = step;
        this.progress.details = [message];
        console.log(`Progress: ${step}/${this.progress.totalSteps} - ${message}`);
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
            return {
                hasRemaining: response.remaining > 0,
                remaining: response.remaining,
                limit: response.limit
            };
        } catch (error) {
            throw new GeminiQuotaError('Failed to check Gemini quota');
        }
    }

    async callGeminiWithRetry(query, context, maxAttempts = 1) {
        let attempts = 0;
        const baseDelay = 1000;
        while (attempts < maxAttempts) {
            try {
                const response = await this.geminiAI.generateText(query);
                return response;
            } catch (error) {
                attempts++;
                
                // Check if it's a quota error - don't retry these
                if (error.message && error.message.includes('quota') || 
                    error.message && error.message.includes('429') ||
                    error.message && error.message.includes('Too Many Requests')) {
                    console.warn('Gemini API quota exceeded, not retrying');
                    throw new GeminiQuotaError('API quota exceeded');
                }
                
                if (error instanceof GeminiRateLimitError) {
                    const delay = baseDelay * Math.pow(2, attempts - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        throw new GeminiRateLimitError(`Failed after ${maxAttempts} attempts`);
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
            const errorResponse = {
                error: error.message,
                step,
                timestamp: new Date().toISOString()
            };
            if (error instanceof GeminiQuotaError) {
                return { success: false, error: 'Gemini API quota exceeded', details: error.quotaInfo };
            } else if (error instanceof GeminiRateLimitError) {
                return { success: false, error: 'Gemini API rate limit exceeded', details: { retryAttempts: error.retryAttempts } };
            } else if (error instanceof WebSearchError) {
                return { success: false, error: 'Web search failed', details: error.details };
            } else {
                return { success: false, error: 'Search failed', details: error.details || {} };
            }
        } catch (error) {
            console.error('Error handling error:', error);
            return { success: false, error: 'Internal server error', details: {} };
        }
    }

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
            
            console.log(`🔍 Starting deep search for: "${query}"`);
            this.startProgressTracking();

            // Step 1: Check cache
            this.updateProgress(1, 'Checking cache...');
            const cachedResult = await this.getCachedResult(query);
            if (cachedResult) {
                console.log('📦 Returning cached result');
                this.stopProgressTracking();
                this.isSearching = false;
                return cachedResult;
            }

            // Step 1.5: Quick quota check to avoid unnecessary API calls
            this.updateProgress(2, 'Checking API quota...');
            try {
                const quotaCheck = await this.checkGeminiQuota();
                if (!quotaCheck.hasRemaining) {
                    console.warn('Gemini API quota exceeded, providing immediate fallback');
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
            this.updateProgress(3, 'Optimizing query...');
            const optimizedQuery = await this.optimizeQuery(query, history);

            // Step 3: Perform web search
            this.updateProgress(4, 'Performing web search...');
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
                    Keep it concise but comprehensive.`;
                    
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

            // Step 4: Score and rank results
            this.updateProgress(5, 'Scoring results...');
            const scoredResults = this.scoreResults(searchResults.results || []);
            const topResults = scoredResults.slice(0, 5); // Get top 5 results

            // Step 5: Check Gemini quota
            this.updateProgress(6, 'Checking Gemini quota...');
            const quotaCheck = await this.checkGeminiQuota();
            if (!quotaCheck.hasRemaining) {
                throw new GeminiQuotaError(quotaCheck.quotaInfo);
            }

            // Step 6: Generate AI synthesis
            this.updateProgress(7, 'Generating AI synthesis...');
            const context = topResults.map(result => 
                `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description || result.snippet || ''}`
            ).join('\n\n');

            const synthesisPrompt = `Based on the following search results, provide a comprehensive and accurate answer to the query: "${query}"

Search Results:
${context}

Please provide a well-structured response that:
1. Directly answers the query
2. Cites relevant sources when possible
3. Acknowledges any limitations or uncertainties
4. Is informative and helpful`;

            const aiResponse = await this.callGeminiWithRetry(synthesisPrompt, context);

            // Step 7: Prepare final result
            this.updateProgress(8, 'Preparing final result...');
            const result = {
                summary: aiResponse,
                sources: topResults.map(r => ({ title: r.title, url: r.url })),
                aiGenerated: true,
                rawResults: topResults,
                query: query,
                timestamp: new Date().toISOString(),
                userId: this.userId
            };

            // Step 8: Cache the result
            this.updateProgress(9, 'Caching result...');
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
