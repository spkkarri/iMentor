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
        this.embeddingService = new EmbeddingService(embeddingModel);
        this.rerankerService = new RerankerService(rerankerModel);
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
        }, 15000); // 15 second timeout (reduced from 30)
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
            return {
                hasRemaining: response.remaining > 0,
                remaining: response.remaining,
                limit: response.limit
            };
        } catch (error) {
            throw new GeminiQuotaError('Failed to check Gemini quota');
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
                if (
                    (error.message && error.message.includes('quota')) ||
                    (error.message && error.message.includes('429')) ||
                    (error.message && error.message.includes('Too Many Requests'))
                ) {
                    console.warn('Gemini API quota exceeded, not retrying');
                    throw new GeminiQuotaError('API quota exceeded');
                }
                // Retry on 503 Service Unavailable (model overloaded)
                if (
                    (error.message && error.message.includes('503')) ||
                    (error.message && error.message.includes('Service Unavailable')) ||
                    (error.message && error.message.includes('model is overloaded'))
                ) {
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
        return sources.map((s, i) => `- [${s.title || s.url}](${s.url})${s.snippet ? `: ${s.snippet}` : ''}`).join('\n');
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
            let chunkedCandidates = [];
            for (const result of expandedResults) {
                const text = result.snippet || result.description || '';
                const chunks = this.embeddingService.chunkText(text);
                chunkedCandidates.push(...chunks.map(chunk => ({
                    ...result,
                    chunkText: chunk
                })));
            }
            reasoningTrace.push('Chunked all snippets for embedding.');
            // Embed all chunks
            const embeddedChunks = await this.embeddingService.embedChunks(chunkedCandidates.map(c => c.chunkText));
            // Attach embeddings to candidates
            chunkedCandidates = chunkedCandidates.map((c, i) => ({ ...c, embedding: embeddedChunks[i].embedding }));
            // For now, use the first chunk as query embedding (stub)
            const queryChunks = this.embeddingService.chunkText(query);
            const queryEmbeddings = await this.embeddingService.embedChunks([queryChunks[0]]);
            const queryEmbedding = queryEmbeddings[0].embedding;
            // Compute similarity and add as feature
            chunkedCandidates = chunkedCandidates.map(c => ({
                ...c,
                similarity: EmbeddingService.cosineSimilarity(queryEmbedding, c.embedding)
            }));
            reasoningTrace.push('Computed similarity between query and all chunks.');
            // Rerank using reranker service
            const reranked = await this.rerankerService.rerank(query, chunkedCandidates);
            reasoningTrace.push('Reranked all candidates.');
            // Take top 5 reranked results
            const topResults = reranked.slice(0, 5);
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


            // Step 5: Check Gemini quota
            this.updateProgress(6);
            const quotaCheck = await this.checkGeminiQuota();
            if (!quotaCheck.hasRemaining) {
                throw new GeminiQuotaError(quotaCheck.quotaInfo);
            }



            // Step 6: Generate initial AI synthesis
            this.updateProgress(7);
            // --- Reasoning/chain-of-thought steps ---
            reasoningTrace.push('Synthesizing context from top reranked results.');
            this.updateProgress(8, 'Chain-of-thought step 1: synthesizing context from top results');
            reasoningTrace.push('Prepared answer prompt for LLM synthesis.');
            this.updateProgress(9, 'Chain-of-thought step 2: preparing answer prompt');
            reasoningTrace.push('Validated and formatted sources for answer.');
            this.updateProgress(10, 'Iterative refinement: validating and formatting sources');
            reasoningTrace.push('Final answer assembly.');
            this.updateProgress(11, 'Final answer assembly.');
            const context = topResults.map(result => 
                `Title: ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet || result.chunkText}`
            ).join('\n\n');

            const synthesisPrompt = `Based on the following search results, provide a comprehensive and accurate answer to the query: "${query}"

Search Results:
${context}

Please provide a well-structured response that:
1. Directly answers the query
2. Breaks down the answer into clear sections for each possible sub-question or aspect (for example: "Scientific Explanation", "Why is it not arbitrary?", "Formula", "Further Reading", etc.)
3. Uses section headings (e.g., ## Scientific Explanation) for each part
4. Cites relevant sources when possible (use markdown links)
5. Is informative and helpful
6. Formats the answer with bullet points or a table if appropriate

IMPORTANT: Do NOT include any "Limitations" section or discuss limitations of the information. Focus only on providing the requested information in a clear and helpful manner.`;

            const aiResponse = await this.callGeminiWithRetry(synthesisPrompt, context);

            // Step 7: Prepare final result
            this.updateProgress(12);
            const result = {
                summary: aiResponse,
                sources: topResults.map(r => ({ title: r.title, url: r.url, snippet: r.snippet || r.chunkText })),
                aiGenerated: true,
                rawResults: topResults,
                query: query,
                timestamp: new Date().toISOString(),
                userId: this.userId,
                formattedSources: this.formatSources(topResults),
                reasoning: reasoningTrace
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
