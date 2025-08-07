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
  "intent": "information_seeking|current_events|how_to|comparison|definition|news|research",
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
            const analysis = JSON.parse(result);
            console.log('🎯 Query analysis:', analysis);
            return analysis;
        } catch (error) {
            console.warn('Query analysis failed, using fallback:', error.message);
            return this.createFallbackAnalysis(query);
        }
    }

    createFallbackAnalysis(query) {
        const words = query.toLowerCase().split(' ');
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
        
        // Search each query across multiple sources
        for (const query of analysis.searchQueries.slice(0, 3)) {
            searchPromises.push(this.searchDuckDuckGo(query));
            searchPromises.push(this.searchBing(query));
            
            // Add specialized searches based on intent
            if (analysis.intent === 'current_events' || analysis.intent === 'news') {
                searchPromises.push(this.searchNews(query));
            }
            if (analysis.intent === 'definition' || analysis.expectedSources.includes('wikipedia')) {
                searchPromises.push(this.searchWikipedia(query));
            }
        }

        console.log(`🔍 Performing ${searchPromises.length} parallel searches...`);
        
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

        const geminiPrompt = `You are Gemini AI providing a comprehensive, accurate response based on real-time web search results. Your response should be natural, informative, and directly helpful.

User Query: "${query}"
Search Intent: ${analysis.intent}
Query Complexity: ${analysis.complexity}${conversationContext}

Search Results:
${context}

Instructions:
1. Provide a direct, comprehensive answer that addresses the user's specific question
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
            throw new Error('Failed to generate comprehensive response');
        }
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
            const response = await this.generateGeminiStyleResponse(query, searchResults, analysis, conversationHistory);
            
            console.log(`✅ Gemini-style search completed with ${searchResults.length} results, confidence: ${response.metadata.confidence}`);
            return response;
            
        } catch (error) {
            console.error('Gemini-style search failed:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }
}

module.exports = GeminiStyleSearchEngine;
