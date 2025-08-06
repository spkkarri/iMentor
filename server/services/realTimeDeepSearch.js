const axios = require('axios');
const cheerio = require('cheerio');
const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class RealTimeDeepSearch {
    constructor() {
        this.searchEngines = [
            { name: 'DuckDuckGo', enabled: true },
            { name: 'Bing', enabled: true },
            { name: 'Google', enabled: false } // Disabled due to API restrictions
        ];
        this.maxResults = 8;
        this.timeout = 10000; // 10 seconds max per search
        this.geminiAI = null; // Will be initialized in performRealTimeSearch
    }

    /**
     * Initialize Gemini AI if not already done
     */
    async initializeGeminiAI() {
        if (!this.geminiAI) {
            try {
                const geminiService = new GeminiService();
                await geminiService.initialize();
                this.geminiAI = new GeminiAI(geminiService);
                console.log('🤖 GeminiAI initialized for real-time search');
            } catch (error) {
                console.warn('Failed to initialize GeminiAI:', error.message);
                this.geminiAI = null;
            }
        }
    }

    /**
     * Perform real-time deep search similar to ChatGPT/Gemini
     */
    async performRealTimeSearch(query, options = {}) {
        console.log(`🔍 Starting real-time deep search for: "${query}"`);
        const startTime = Date.now();

        try {
            // Initialize Gemini AI
            await this.initializeGeminiAI();
            // Step 1: Quick query enhancement (no complex optimization)
            const enhancedQuery = this.enhanceQuery(query);
            console.log(`📝 Enhanced query: "${enhancedQuery}"`);

            // Step 2: Parallel search across multiple engines
            const searchPromises = [];
            
            if (this.searchEngines.find(e => e.name === 'DuckDuckGo' && e.enabled)) {
                searchPromises.push(this.searchDuckDuckGo(enhancedQuery));
            }
            
            if (this.searchEngines.find(e => e.name === 'Bing' && e.enabled)) {
                searchPromises.push(this.searchBing(enhancedQuery));
            }

            // Execute searches in parallel with timeout
            const searchResults = await Promise.allSettled(
                searchPromises.map(promise => 
                    Promise.race([
                        promise,
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Search timeout')), this.timeout)
                        )
                    ])
                )
            );

            // Step 3: Aggregate and deduplicate results
            const allResults = [];
            searchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    allResults.push(...result.value);
                } else {
                    console.warn(`Search engine ${index} failed:`, result.reason?.message);
                }
            });

            // Remove duplicates based on URL
            const uniqueResults = this.deduplicateResults(allResults);
            const topResults = uniqueResults.slice(0, this.maxResults);

            console.log(`✅ Found ${topResults.length} unique results in ${Date.now() - startTime}ms`);

            // Step 4: Quick content extraction for top results
            const enrichedResults = await this.enrichResults(topResults);

            // Step 5: Generate response using AI
            const response = await this.generateResponse(query, enrichedResults);

            return {
                query: query,
                enhancedQuery: enhancedQuery,
                results: enrichedResults,
                response: response,
                searchTime: Date.now() - startTime,
                metadata: {
                    searchType: 'real_time_deep_search',
                    sources: enrichedResults.map(r => ({ title: r.title, url: r.url })),
                    resultsCount: enrichedResults.length,
                    searchEngines: this.searchEngines.filter(e => e.enabled).map(e => e.name),
                    enhanced: true,
                    realTime: true
                }
            };

        } catch (error) {
            console.error('Real-time deep search error:', error);
            return this.generateErrorResponse(query, error);
        }
    }

    /**
     * Quick query enhancement without over-optimization
     */
    enhanceQuery(query) {
        // Simple enhancements for better search results
        let enhanced = query.trim();
        
        // Add quotes for exact phrases if needed
        if (enhanced.includes(' ') && !enhanced.includes('"')) {
            // For multi-word queries, try both exact and loose matching
            return enhanced;
        }
        
        // Add current year for time-sensitive queries
        const timeKeywords = ['latest', 'recent', 'current', 'new', 'today', '2024', '2025'];
        if (timeKeywords.some(keyword => enhanced.toLowerCase().includes(keyword))) {
            enhanced += ' 2024 2025';
        }
        
        return enhanced;
    }

    /**
     * Search DuckDuckGo
     */
    async searchDuckDuckGo(query) {
        try {
            console.log('🦆 Searching DuckDuckGo...');
            
            // Use DuckDuckGo instant answer API
            const response = await axios.get('https://api.duckduckgo.com/', {
                params: {
                    q: query,
                    format: 'json',
                    no_html: '1',
                    skip_disambig: '1'
                },
                timeout: 5000
            });

            const results = [];
            
            // Add instant answer if available
            if (response.data.Abstract) {
                results.push({
                    title: response.data.Heading || 'DuckDuckGo Instant Answer',
                    snippet: response.data.Abstract,
                    url: response.data.AbstractURL || 'https://duckduckgo.com',
                    source: 'DuckDuckGo'
                });
            }

            // Add related topics
            if (response.data.RelatedTopics) {
                response.data.RelatedTopics.slice(0, 3).forEach(topic => {
                    if (topic.Text && topic.FirstURL) {
                        results.push({
                            title: topic.Text.split(' - ')[0] || 'Related Topic',
                            snippet: topic.Text,
                            url: topic.FirstURL,
                            source: 'DuckDuckGo'
                        });
                    }
                });
            }

            return results;
        } catch (error) {
            console.warn('DuckDuckGo search failed:', error.message);
            return [];
        }
    }

    /**
     * Search Bing (using web scraping)
     */
    async searchBing(query) {
        try {
            console.log('🔍 Searching Bing...');
            
            const response = await axios.get('https://www.bing.com/search', {
                params: { q: query },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 5000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.b_algo').each((i, element) => {
                if (i >= 5) return false; // Limit to 5 results
                
                const titleElement = $(element).find('h2 a');
                const snippetElement = $(element).find('.b_caption p');
                
                const title = titleElement.text().trim();
                const url = titleElement.attr('href');
                const snippet = snippetElement.text().trim();

                if (title && url && snippet) {
                    results.push({
                        title,
                        snippet,
                        url,
                        source: 'Bing'
                    });
                }
            });

            return results;
        } catch (error) {
            console.warn('Bing search failed:', error.message);
            return [];
        }
    }

    /**
     * Remove duplicate results based on URL similarity
     */
    deduplicateResults(results) {
        const seen = new Set();
        return results.filter(result => {
            const domain = this.extractDomain(result.url);
            const key = `${domain}-${result.title.toLowerCase().substring(0, 50)}`;
            
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    /**
     * Enrich results with additional content (quick extraction)
     */
    async enrichResults(results) {
        // For now, return results as-is for speed
        // In the future, we could add quick content extraction
        return results.map(result => ({
            ...result,
            relevanceScore: this.calculateRelevanceScore(result),
            timestamp: new Date().toISOString()
        }));
    }

    /**
     * Calculate simple relevance score
     */
    calculateRelevanceScore(result) {
        let score = 0.5; // Base score
        
        // Boost for longer, more detailed snippets
        if (result.snippet && result.snippet.length > 100) score += 0.2;
        
        // Boost for reputable domains
        const domain = this.extractDomain(result.url);
        const reputableDomains = ['wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com'];
        if (reputableDomains.some(d => domain.includes(d))) score += 0.3;
        
        return Math.min(score, 1.0);
    }

    /**
     * Generate AI response from search results using Gemini
     */
    async generateResponse(query, results) {
        if (results.length === 0) {
            return `I searched the web for "${query}" but couldn't find relevant results. Please try rephrasing your question or being more specific.`;
        }

        try {
            // Check if Gemini AI is available
            if (!this.geminiAI) {
                console.warn('GeminiAI not available, using fallback response formatting');
                return this.generateFallbackResponse(query, results);
            }

            // Create context from search results
            const context = results.map((r, i) =>
                `Source ${i + 1}: ${r.title}\n${r.snippet}\nURL: ${r.url}`
            ).join('\n\n');

            // Use Gemini to synthesize a comprehensive response
            const prompt = `Based on the following web search results for the query "${query}", provide a comprehensive, well-structured response.

SEARCH RESULTS:
${context}

Instructions:
- Synthesize the information from multiple sources into a coherent response
- Include specific facts and details from the sources
- Cite sources using [1], [2], etc. format
- Provide a balanced view if there are different perspectives
- Keep the response informative but concise
- End with a brief summary of key points

Query: ${query}`;

            const aiResponse = await this.geminiAI.generateText(prompt);

            // Add source list at the end
            const sourcesList = results.map((r, i) => `[${i + 1}] ${r.title} - ${r.url}`).join('\n');

            return `${aiResponse}\n\n**Sources:**\n${sourcesList}\n\n*Information current as of ${new Date().toLocaleDateString()}*`;

        } catch (error) {
            console.warn('AI synthesis failed, using fallback response:', error.message);
            return this.generateFallbackResponse(query, results);
        }
    }

    /**
     * Generate fallback response when AI is not available
     */
    generateFallbackResponse(query, results) {
        return `Based on my web search for "${query}", here's what I found:

${results.map((r, i) => `**${i + 1}. ${r.title}**
${r.snippet}
Source: ${r.url}
`).join('\n')}

This information is current as of ${new Date().toLocaleDateString()} and comes from ${results.length} web sources.`;
    }

    /**
     * Generate error response when search fails
     */
    generateErrorResponse(query, error) {
        return {
            query: query,
            response: `I encountered an issue while searching the web for "${query}". ${error.message}. Please try again or rephrase your question.`,
            results: [],
            metadata: {
                searchType: 'real_time_search_error',
                sources: [],
                error: error.message,
                fallback: true
            }
        };
    }
}

module.exports = RealTimeDeepSearch;
