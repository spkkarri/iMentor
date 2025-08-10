// server/services/geminiStyleSearch.js
// Gemini AI-style real-time web search with highly relevant responses

const axios = require('axios');
const cheerio = require('cheerio');
const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class GeminiStyleSearchEngine {
    constructor() {
        this.geminiService = null;
        this.geminiAI = null;
        this.isInitialized = false;
        this.searchCache = new Map();
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async initialize() {
        if (!this.isInitialized) {
            try {
                this.geminiService = new GeminiService();
                await this.geminiService.initialize();
                this.geminiAI = new GeminiAI(this.geminiService);
                this.isInitialized = true;
                console.log('🔍 Gemini-Style Search Engine initialized');
            } catch (error) {
                console.error('Failed to initialize Gemini-Style Search:', error);
                throw error;
            }
        }
    }

    /**
     * Analyze query like Gemini AI does - understand intent, extract entities, determine search strategy
     */
    async analyzeQuery(query, conversationHistory = []) {
        await this.initialize();

        const analysisPrompt = `You are a search query analyzer for a real-time web search system. Analyze the following query and provide a structured analysis.

Query: "${query}"

${conversationHistory.length > 0 ? `
Recent conversation context:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

Provide analysis in this exact JSON format:
{
  "intent": "information_seeking|current_events|how_to|comparison|definition|news|research|transportation|schedule_inquiry",
  "entities": ["key", "entities", "or", "topics"],
  "searchQueries": ["primary optimized query", "secondary query", "tertiary query"],
  "expectedSources": ["wikipedia", "news", "academic", "official", "tutorial"],
  "timeRelevance": "current|recent|historical|timeless",
  "complexity": "simple|moderate|complex",
  "keywords": ["most", "important", "keywords"],
  "searchStrategy": "broad|focused|multi_angle|comparative"
}

Focus on creating search queries that will find the most relevant, up-to-date information.`;

        try {
            const result = await this.geminiAI.generateText(analysisPrompt);

            // Extract JSON from markdown if needed
            let jsonText = result.trim();
            if (jsonText.includes('```json')) {
                const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
                if (match) {
                    jsonText = match[1].trim();
                }
            } else if (jsonText.includes('```')) {
                const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
                if (match) {
                    jsonText = match[1].trim();
                }
            }

            const analysis = JSON.parse(jsonText);
            console.log('🎯 Query analysis:', analysis);
            return analysis;
        } catch (error) {
            console.warn('Query analysis failed, using fallback:', error.message);
            return this.createFallbackAnalysis(query);
        }
    }

    createFallbackAnalysis(query) {
        const words = query.toLowerCase().split(' ');
        const queryLower = query.toLowerCase();

        // Detect transportation queries even with typos
        const isTransportation = /\b(trains?|tarins?|bus|buses|flight|flights?|schedule|timetable|timing)\b/.test(queryLower) ||
                                /\b(vizag|visakhapatnam|vozag|vskp|hyderabad|mumbai|delhi|chennai|bangalore)\b/.test(queryLower) ||
                                /\b(from|to|between)\b.*\b(daily|weekly)\b/.test(queryLower);

        if (isTransportation) {
            // Enhanced search queries for Indian train searches
            const searchQueries = [
                query,
                `${query} IRCTC train schedule`,
                `${query} Indian Railways`,
                query.replace(/tarins?/g, 'trains').replace(/vozag/g, 'vizag visakhapatnam'),
                `train schedule ${query.replace(/which|go|daily|from|to/g, '').trim()}`
            ].filter(q => q.trim().length > 0);

            return {
                intent: "transportation",
                entities: words.filter(w => w.length > 3),
                searchQueries: searchQueries.slice(0, 3),
                expectedSources: ["official", "irctc", "railway"],
                timeRelevance: "current",
                complexity: "moderate",
                keywords: words.filter(w => w.length > 2),
                searchStrategy: "focused"
            };
        }

        return {
            intent: "information_seeking",
            entities: words.filter(w => w.length > 3),
            searchQueries: [query, `${query} 2024`, `what is ${query}`],
            expectedSources: ["wikipedia", "official"],
            timeRelevance: "current",
            complexity: "moderate",
            keywords: words.filter(w => w.length > 2),
            searchStrategy: "broad"
        };
    }

    /**
     * Multi-source search like Gemini AI - searches multiple engines simultaneously
     */
    async performMultiSourceSearch(analysis) {
        const searchPromises = [];

        // Enhanced search strategy for maximum user satisfaction
        console.log(`🔍 Starting comprehensive multi-source search for maximum relevance...`);

        // Search each query across multiple sources with enhanced coverage
        for (const query of analysis.searchQueries.slice(0, 4)) { // Increased from 3 to 4 queries
            // Core search engines
            searchPromises.push(this.searchDuckDuckGo(query));
            searchPromises.push(this.searchBing(query));

            // Add specialized searches based on intent for better coverage
            if (analysis.intent === 'current_events' || analysis.intent === 'news' || query.includes('2024') || query.includes('latest')) {
                searchPromises.push(this.searchNews(query));
                searchPromises.push(this.searchDuckDuckGo(query + ' news recent'));
            }

            if (analysis.intent === 'definition' || analysis.intent === 'information_seeking' || analysis.expectedSources?.includes('wikipedia')) {
                searchPromises.push(this.searchWikipedia(query));
            }

            // Add technical/academic searches for complex topics
            if (analysis.complexity === 'moderate' || analysis.complexity === 'complex') {
                searchPromises.push(this.searchDuckDuckGo(query + ' comprehensive guide'));
                searchPromises.push(this.searchBing(query + ' detailed explanation'));
            }

            // Add practical application searches
            if (analysis.intent === 'how_to' || analysis.intent === 'learning') {
                searchPromises.push(this.searchDuckDuckGo(query + ' examples applications'));
                searchPromises.push(this.searchBing(query + ' practical use cases'));
            }

            // Add transportation and schedule searches
            if (query.toLowerCase().includes('train') || query.toLowerCase().includes('bus') ||
                query.toLowerCase().includes('flight') || query.toLowerCase().includes('schedule') ||
                query.toLowerCase().includes('timetable') || query.toLowerCase().includes('timing')) {
                searchPromises.push(this.searchDuckDuckGo(query + ' schedule timetable'));
                searchPromises.push(this.searchBing(query + ' official railway website'));
                searchPromises.push(this.searchDuckDuckGo(query + ' IRCTC booking'));
                // Add video search for transportation topics
                searchPromises.push(this.searchYouTube(query + ' train schedule guide'));
            }

            // Add video search for how-to and educational content
            if (analysis.intent === 'how_to' || analysis.intent === 'learning' ||
                query.toLowerCase().includes('how to') || query.toLowerCase().includes('tutorial')) {
                searchPromises.push(this.searchYouTube(query + ' tutorial'));
                searchPromises.push(this.searchYouTube(query + ' guide'));
            }
        }

        console.log(`🔍 Performing ${searchPromises.length} parallel searches for comprehensive coverage...`);

        const results = await Promise.allSettled(searchPromises);
        const allResults = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.results) {
                result.value.results.forEach(item => {
                    if (item.title && item.url && item.description) {
                        allResults.push({
                            ...item,
                            source: result.value.source || 'web',
                            searchQuery: analysis.searchQueries[Math.floor(index / 2)] || analysis.searchQueries[0],
                            relevanceScore: this.calculateAdvancedRelevance(item, analysis)
                        });
                    }
                });
            }
        });

        // Remove duplicates and sort by relevance
        const uniqueResults = this.deduplicateResults(allResults);
        const sortedResults = uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`📊 Found ${sortedResults.length} unique results`);
        return sortedResults.slice(0, 10); // Top 10 most relevant
    }

    /**
     * Advanced relevance scoring like Gemini AI
     */
    calculateAdvancedRelevance(result, analysis) {
        let score = 0;
        const text = `${result.title} ${result.description}`.toLowerCase();
        
        // Keyword matching with weights
        analysis.keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            if (text.includes(keywordLower)) {
                score += 3;
                // Title matches are more important
                if (result.title.toLowerCase().includes(keywordLower)) {
                    score += 2;
                }
            }
        });

        // Entity matching
        analysis.entities.forEach(entity => {
            if (text.includes(entity.toLowerCase())) {
                score += 4;
            }
        });

        // Source quality scoring
        const url = result.url.toLowerCase();
        if (url.includes('wikipedia.org')) score += 5;
        if (url.includes('.edu')) score += 4;
        if (url.includes('.gov')) score += 4;
        if (url.includes('.org')) score += 2;
        if (url.includes('stackoverflow.com')) score += 3;
        if (url.includes('github.com')) score += 2;

        // Content quality indicators
        if (result.description.length > 100) score += 1;
        if (result.title.length > 10 && result.title.length < 100) score += 1;

        // Time relevance
        if (analysis.timeRelevance === 'current') {
            if (text.includes('2024') || text.includes('2023')) score += 2;
        }

        // Intent-specific scoring
        if (analysis.intent === 'how_to' && text.includes('how to')) score += 3;
        if (analysis.intent === 'definition' && (text.includes('definition') || text.includes('meaning'))) score += 3;
        if (analysis.intent === 'comparison' && text.includes('vs')) score += 2;

        return score;
    }

    /**
     * Search DuckDuckGo with improved parsing
     */
    async searchDuckDuckGo(query) {
        try {
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: { 'User-Agent': this.userAgent }
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, element) => {
                const $element = $(element);
                const title = $element.find('.result__title a').text().trim();
                const url = $element.find('.result__title a').attr('href');
                const description = $element.find('.result__snippet').text().trim();

                if (title && url && description) {
                    results.push({
                        title: this.cleanText(title),
                        url: url.startsWith('http') ? url : `https://${url}`,
                        description: this.cleanText(description)
                    });
                }
            });

            return { results: results.slice(0, 5), source: 'duckduckgo' };
        } catch (error) {
            console.warn('DuckDuckGo search failed:', error.message);
            return { results: [], source: 'duckduckgo' };
        }
    }

    /**
     * Search Bing for additional results
     */
    async searchBing(query) {
        try {
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: { 'User-Agent': this.userAgent }
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.b_algo').each((i, element) => {
                const $element = $(element);
                const title = $element.find('h2 a').text().trim();
                const url = $element.find('h2 a').attr('href');
                const description = $element.find('.b_caption p').text().trim();

                if (title && url && description) {
                    results.push({
                        title: this.cleanText(title),
                        url: url,
                        description: this.cleanText(description)
                    });
                }
            });

            return { results: results.slice(0, 5), source: 'bing' };
        } catch (error) {
            console.warn('Bing search failed:', error.message);
            return { results: [], source: 'bing' };
        }
    }

    /**
     * Search Wikipedia for authoritative information
     */
    async searchWikipedia(query) {
        try {
            const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                timeout: 5000,
                headers: { 'User-Agent': this.userAgent }
            });

            const data = response.data;
            if (data.extract) {
                return {
                    results: [{
                        title: data.title,
                        url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
                        description: data.extract
                    }],
                    source: 'wikipedia'
                };
            }
        } catch (error) {
            console.warn('Wikipedia search failed:', error.message);
        }
        return { results: [], source: 'wikipedia' };
    }

    /**
     * Search for news if query is time-sensitive
     */
    async searchNews(query) {
        try {
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query + ' news 2024')}&iar=news`;
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: { 'User-Agent': this.userAgent }
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, element) => {
                const $element = $(element);
                const title = $element.find('.result__title a').text().trim();
                const url = $element.find('.result__title a').attr('href');
                const description = $element.find('.result__snippet').text().trim();

                if (title && url && description && title.length > 10) {
                    results.push({
                        title: this.cleanText(title),
                        url: url.startsWith('http') ? url : `https://${url}`,
                        description: this.cleanText(description)
                    });
                }
            });

            return { results: results.slice(0, 3), source: 'news' };
        } catch (error) {
            console.warn('News search failed:', error.message);
            return { results: [], source: 'news' };
        }
    }

    /**
     * Remove duplicate results
     */
    deduplicateResults(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.url.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Clean and normalize text
     */
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-.,!?()]/g, '')
            .trim()
            .substring(0, 300);
    }

    /**
     * Generate Gemini AI-style comprehensive response
     */
    async generateGeminiStyleResponse(query, searchResults, analysis, conversationHistory = []) {
        await this.initialize();

        const topResults = searchResults.slice(0, 6);
        const context = topResults.map(result => 
            `**${result.title}**\nSource: ${result.url}\nContent: ${result.description}\nRelevance: ${result.relevanceScore}\nSearch Query: ${result.searchQuery}`
        ).join('\n\n');

        const conversationContext = conversationHistory.length > 0 
            ? `\n\nConversation Context:\n${conversationHistory.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
            : '';

        const geminiPrompt = `You are Gemini AI providing a comprehensive, highly satisfying response based on real-time web search results. Your goal is to exceed user expectations by providing maximum value and comprehensive coverage.

User Query: "${query}"
Search Intent: ${analysis.intent}
Query Complexity: ${analysis.complexity}
Expected Information Types: ${analysis.expectedSources?.join(', ') || 'comprehensive information'}${conversationContext}

Search Results (${topResults.length} sources):
${context}

Instructions for Maximum User Satisfaction:
1. Provide a direct, comprehensive answer that fully addresses the user's question
2. Start with a clear, concise summary, then expand with detailed information
3. Include specific data, statistics, and concrete examples from the search results
4. Cover multiple aspects and perspectives of the topic
5. Highlight recent developments and current trends when relevant
6. Provide practical applications and real-world relevance
7. Address common questions or misconceptions about the topic
8. Use clear structure with headings and bullet points for readability
2. Use information from the search results as supporting evidence
3. Structure your response clearly with appropriate formatting
4. Include relevant details, examples, and context
5. Cite sources naturally within your response when referencing specific information
6. If the query asks for current information, emphasize the most recent findings
7. Be conversational yet authoritative, like Gemini AI
8. Use markdown formatting for better readability
9. If search results are limited, acknowledge this and provide what information is available
10. End with a brief summary or key takeaway if the response is long

Provide a helpful, accurate response:`;

        try {
            const response = await this.geminiAI.generateText(geminiPrompt);
            
            return {
                answer: response,
                sources: topResults.map(r => ({
                    title: r.title,
                    url: r.url,
                    description: r.description.substring(0, 150) + '...',
                    relevanceScore: r.relevanceScore,
                    source: r.source
                })),
                metadata: {
                    searchType: 'gemini_style_search',
                    intent: analysis.intent,
                    resultsFound: searchResults.length,
                    searchQueries: analysis.searchQueries,
                    confidence: this.assessConfidence(topResults, analysis),
                    searchTime: Date.now()
                }
            };
        } catch (error) {
            console.error('Gemini-style response generation failed:', error);
            console.log('🔄 Creating fallback response from search results...');

            // Create a fallback response directly from search results
            return this.createFallbackResponse(topResults, analysis, query);
        }
    }

    /**
     * Create fallback response when AI generation fails
     */
    createFallbackResponse(searchResults, analysis, query) {
        console.log('📝 Generating fallback response from search results...');

        if (!searchResults || searchResults.length === 0) {
            return {
                answer: `I searched for "${query}" but couldn't find specific results. Please try rephrasing your query or check official websites directly.`,
                sources: [],
                metadata: {
                    searchType: 'fallback_no_results',
                    confidence: 'low',
                    resultsFound: 0
                }
            };
        }

        // Separate videos and regular results
        const videos = searchResults.filter(r => r.type === 'video');
        const regularResults = searchResults.filter(r => r.type !== 'video');

        // Create a structured response from search results
        let response = '';

        if (analysis.intent === 'transportation' || query.toLowerCase().includes('train')) {
            response = `🚂 **Train Information for "${query}"**\n\n`;
            response += `Based on my search, here's what I found:\n\n`;

            regularResults.slice(0, 5).forEach((result, index) => {
                response += `**${index + 1}. ${result.title}**\n`;
                response += `${result.description}\n`;
                response += `🔗 [View Details](${result.url})\n\n`;
            });

            // Add videos if found
            if (videos.length > 0) {
                response += `🎥 **Related Videos:**\n\n`;
                videos.slice(0, 2).forEach((video, index) => {
                    response += `**${video.title}**\n`;
                    response += `${video.description}\n`;
                    if (video.videoId) {
                        response += `<iframe width="560" height="315" src="https://www.youtube.com/embed/${video.videoId}" frameborder="0" allowfullscreen></iframe>\n\n`;
                    } else {
                        response += `🔗 [Watch Video](${video.url})\n\n`;
                    }
                });
            }

            response += `💡 **Recommendations:**\n`;
            response += `• Check IRCTC official website for live schedules\n`;
            response += `• Verify train timings before travel\n`;
            response += `• Book tickets in advance for better availability\n\n`;

        } else {
            response = `Here's what I found for "${query}":\n\n`;

            regularResults.slice(0, 3).forEach((result, index) => {
                response += `**${index + 1}. ${result.title}**\n`;
                response += `${result.description}\n`;
                response += `🔗 [Source](${result.url})\n\n`;
            });

            // Add videos if found
            if (videos.length > 0) {
                response += `🎥 **Related Videos:**\n\n`;
                videos.slice(0, 2).forEach((video, index) => {
                    response += `**${video.title}**\n`;
                    if (video.videoId) {
                        response += `<iframe width="560" height="315" src="https://www.youtube.com/embed/${video.videoId}" frameborder="0" allowfullscreen></iframe>\n\n`;
                    } else {
                        response += `🔗 [Watch Video](${video.url})\n\n`;
                    }
                });
            }
        }

        response += `*Search performed across multiple sources including official websites and reliable databases.*`;

        return {
            answer: response,
            sources: searchResults.slice(0, 5).map(r => ({
                title: r.title,
                url: r.url,
                description: r.description.substring(0, 150) + '...',
                relevanceScore: r.relevanceScore,
                source: r.source
            })),
            metadata: {
                searchType: 'fallback_response',
                intent: analysis.intent,
                resultsFound: searchResults.length,
                searchQueries: analysis.searchQueries,
                confidence: 'medium',
                searchTime: Date.now()
            }
        };
    }

    /**
     * Assess response confidence based on result quality and relevance
     */
    assessConfidence(results, analysis) {
        if (results.length === 0) return 'low';
        
        const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
        const hasHighQualitySources = results.some(r => 
            r.url.includes('wikipedia.org') || r.url.includes('.edu') || r.url.includes('.gov')
        );
        const matchesIntent = results.some(r => 
            r.description.toLowerCase().includes(analysis.intent.replace('_', ' '))
        );

        if (avgRelevance > 8 && hasHighQualitySources && matchesIntent) return 'high';
        if (avgRelevance > 5 && (hasHighQualitySources || matchesIntent)) return 'medium';
        return 'low';
    }

    /**
     * Main search method - orchestrates the entire Gemini-style search process
     */
    async performGeminiStyleSearch(query, conversationHistory = []) {
        try {
            console.log(`🚀 Starting Gemini-style search for: "${query}"`);
            
            // Step 1: Analyze query like Gemini AI
            const analysis = await this.analyzeQuery(query, conversationHistory);
            
            // Step 2: Perform multi-source search
            const searchResults = await this.performMultiSourceSearch(analysis);
            
            // Step 3: Generate comprehensive response
            try {
                const response = await this.generateGeminiStyleResponse(query, searchResults, analysis, conversationHistory);
                console.log(`✅ Gemini-style search completed with ${searchResults.length} results, confidence: ${response.metadata.confidence}`);
                return response;
            } catch (responseError) {
                console.error('Response generation failed, using fallback:', responseError.message);
                console.log('🔄 Creating fallback response from search results...');

                // Use fallback response when AI generation fails
                const fallbackResponse = this.createFallbackResponse(searchResults, analysis, query);
                console.log(`✅ Fallback response created with ${searchResults.length} results`);
                return fallbackResponse;
            }
            
        } catch (error) {
            console.error('Gemini-style search failed:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * Search YouTube for videos
     */
    async searchYouTube(query) {
        try {
            console.log(`🎥 Searching YouTube for: "${query}"`);

            // Use DuckDuckGo to search YouTube (since we don't have YouTube API)
            const searchUrl = `https://duckduckgo.com/html/?q=site:youtube.com ${encodeURIComponent(query)}`;

            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 8000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, element) => {
                if (i >= 3) return false; // Limit to 3 video results

                const $element = $(element);
                const title = $element.find('.result__title a').text().trim();
                const url = $element.find('.result__title a').attr('href');
                const description = $element.find('.result__snippet').text().trim();

                if (title && url && url.includes('youtube.com/watch')) {
                    // Extract video ID for embedding
                    const videoIdMatch = url.match(/[?&]v=([^&]+)/);
                    const videoId = videoIdMatch ? videoIdMatch[1] : null;

                    results.push({
                        title: title,
                        url: url,
                        description: description,
                        type: 'video',
                        videoId: videoId,
                        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
                        embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null
                    });
                }
            });

            console.log(`🎥 Found ${results.length} YouTube videos`);
            return { results, source: 'youtube' };

        } catch (error) {
            console.warn('YouTube search failed:', error.message);
            return { results: [], source: 'youtube' };
        }
    }
}

module.exports = GeminiStyleSearchEngine;
