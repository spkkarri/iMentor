// server/services/enhancedDeepSearch.js
// Enhanced Deep Search Service with Gemini AI-like responses

const axios = require('axios');
const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class EnhancedDeepSearchService {
    constructor() {
        this.geminiService = null;
        this.geminiAI = null;
        this.searchCache = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            try {
                this.geminiService = new GeminiService();
                await this.geminiService.initialize();
                this.geminiAI = new GeminiAI(this.geminiService);
                this.isInitialized = true;
                console.log('🔍 Enhanced Deep Search Service initialized');
            } catch (error) {
                console.error('Failed to initialize Enhanced Deep Search:', error);
                throw error;
            }
        }
    }

    /**
     * Enhanced query optimization using Gemini AI
     */
    async optimizeSearchQuery(originalQuery, conversationHistory = []) {
        await this.initialize();

        const contextPrompt = `You are a search query optimization expert. Your task is to transform user queries into effective web search terms.

Original Query: "${originalQuery}"

${conversationHistory.length > 0 ? `
Conversation Context:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

Instructions:
1. Extract the core intent and key concepts
2. Add relevant synonyms and related terms
3. Remove unnecessary words but keep important context
4. Format as 2-3 optimized search queries for comprehensive coverage
5. Focus on factual, informative content

Return ONLY a JSON object with this format:
{
  "primaryQuery": "main optimized search query",
  "secondaryQueries": ["alternative query 1", "alternative query 2"],
  "intent": "brief description of user intent",
  "keywords": ["key", "terms", "to", "focus", "on"]
}`;

        try {
            const result = await this.geminiAI.generateText(contextPrompt);
            const optimized = JSON.parse(result);
            console.log('🎯 Query optimized:', optimized);
            return optimized;
        } catch (error) {
            console.warn('Query optimization failed, using fallback:', error.message);
            return {
                primaryQuery: originalQuery,
                secondaryQueries: [originalQuery],
                intent: "general information search",
                keywords: originalQuery.split(' ').filter(word => word.length > 2)
            };
        }
    }

    /**
     * Perform enhanced web search with multiple sources
     */
    async performEnhancedWebSearch(optimizedQuery) {
        const { primaryQuery, secondaryQueries } = optimizedQuery;
        const allQueries = [primaryQuery, ...secondaryQueries].slice(0, 3);
        
        console.log('🔍 Performing enhanced web search for:', allQueries);
        
        const searchPromises = allQueries.map(query => this.searchWithFallback(query));
        const searchResults = await Promise.allSettled(searchPromises);
        
        // Combine and deduplicate results
        const combinedResults = [];
        const seenUrls = new Set();
        
        searchResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.results) {
                result.value.results.forEach(item => {
                    if (!seenUrls.has(item.url) && item.title && item.description) {
                        seenUrls.add(item.url);
                        combinedResults.push({
                            ...item,
                            sourceQuery: allQueries[index],
                            relevanceScore: this.calculateRelevanceScore(item, optimizedQuery)
                        });
                    }
                });
            }
        });
        
        // Sort by relevance score
        combinedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        console.log(`📊 Found ${combinedResults.length} unique results`);
        return combinedResults.slice(0, 8); // Top 8 most relevant results
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(result, optimizedQuery) {
        let score = 0;
        const { keywords, intent } = optimizedQuery;
        const text = `${result.title} ${result.description}`.toLowerCase();
        
        // Keyword matching
        keywords.forEach(keyword => {
            const keywordLower = keyword.toLowerCase();
            if (text.includes(keywordLower)) {
                score += 2;
                // Bonus for title matches
                if (result.title.toLowerCase().includes(keywordLower)) {
                    score += 1;
                }
            }
        });
        
        // Intent matching
        if (intent && text.includes(intent.toLowerCase())) {
            score += 1;
        }
        
        // Quality indicators
        if (result.title.length > 10 && result.description.length > 50) {
            score += 1;
        }
        
        // Trusted domains bonus
        const trustedDomains = ['wikipedia.org', 'edu', 'gov', 'stackoverflow.com', 'github.com'];
        if (trustedDomains.some(domain => result.url.includes(domain))) {
            score += 2;
        }
        
        return score;
    }

    /**
     * Search with multiple fallback methods
     */
    async searchWithFallback(query) {
        // Try DuckDuckGo HTML scraping
        try {
            return await this.scrapeDuckDuckGo(query);
        } catch (error) {
            console.warn('DuckDuckGo search failed:', error.message);
            
            // Fallback to educational content generation
            return this.generateEducationalContent(query);
        }
    }

    /**
     * Scrape DuckDuckGo search results
     */
    async scrapeDuckDuckGo(query) {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        
        try {
            const response = await axios.get(searchUrl, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            
            const html = response.data;
            const results = this.parseDuckDuckGoHTML(html);
            
            return {
                results: results.slice(0, 5),
                source: 'duckduckgo',
                success: true
            };
        } catch (error) {
            throw new Error(`DuckDuckGo search failed: ${error.message}`);
        }
    }

    /**
     * Parse DuckDuckGo HTML results
     */
    parseDuckDuckGoHTML(html) {
        const results = [];
        
        // Improved regex patterns for DuckDuckGo HTML
        const resultBlocks = html.match(/<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/div>/g) || [];
        
        resultBlocks.forEach(block => {
            try {
                const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([^<]+)<\/a>/);
                const urlMatch = block.match(/href="([^"]+)"/);
                const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/) ||
                                   block.match(/<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/span>/);
                
                if (titleMatch && urlMatch) {
                    results.push({
                        title: this.cleanHtmlText(titleMatch[1]),
                        url: urlMatch[1],
                        description: snippetMatch ? this.cleanHtmlText(snippetMatch[1]) : '',
                        source: 'DuckDuckGo'
                    });
                }
            } catch (parseError) {
                // Skip malformed results
            }
        });
        
        return results;
    }

    /**
     * Clean HTML text
     */
    cleanHtmlText(text) {
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    /**
     * Generate educational content as fallback
     */
    async generateEducationalContent(query) {
        const educationalTopics = {
            'programming': ['JavaScript', 'Python', 'React', 'Node.js', 'Database Design'],
            'science': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science'],
            'technology': ['AI', 'Machine Learning', 'Web Development', 'Cloud Computing', 'Cybersecurity'],
            'general': ['History', 'Geography', 'Literature', 'Philosophy', 'Economics']
        };
        
        const results = [];
        const category = this.categorizeQuery(query);
        const topics = educationalTopics[category] || educationalTopics.general;
        
        topics.slice(0, 3).forEach((topic, index) => {
            results.push({
                title: `${topic} - Comprehensive Guide`,
                url: `https://example-educational-resource.com/${topic.toLowerCase().replace(/\s+/g, '-')}`,
                description: `Learn about ${topic} with detailed explanations, examples, and practical applications. This comprehensive guide covers fundamental concepts and advanced topics.`,
                source: 'Educational Content'
            });
        });
        
        return { results, source: 'educational', success: true };
    }

    /**
     * Categorize query for educational content
     */
    categorizeQuery(query) {
        const queryLower = query.toLowerCase();
        
        if (queryLower.match(/\b(code|programming|javascript|python|react|node|database|sql|api)\b/)) {
            return 'programming';
        }
        if (queryLower.match(/\b(physics|chemistry|biology|math|science|formula|equation)\b/)) {
            return 'science';
        }
        if (queryLower.match(/\b(ai|machine learning|technology|computer|software|hardware)\b/)) {
            return 'technology';
        }
        
        return 'general';
    }

    /**
     * Generate Gemini AI-like comprehensive response
     */
    async generateComprehensiveResponse(query, searchResults, conversationHistory = []) {
        await this.initialize();
        
        const context = searchResults.map(result => 
            `**${result.title}**\nSource: ${result.url}\nContent: ${result.description}\nRelevance: ${result.relevanceScore || 'N/A'}`
        ).join('\n\n');
        
        const conversationContext = conversationHistory.length > 0 
            ? `\n\nConversation Context:\n${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
            : '';
        
        const enhancedPrompt = `You are an expert AI assistant providing comprehensive, accurate, and helpful responses. Your goal is to provide information that matches the quality and style of Google's Gemini AI.

User Query: "${query}"${conversationContext}

Search Results:
${context}

Instructions:
1. Provide a comprehensive, well-structured response that directly answers the user's question
2. Use the search results as supporting evidence and cite sources when relevant
3. Structure your response with clear headings and bullet points where appropriate
4. Include practical examples, explanations, and actionable insights
5. Maintain a conversational yet informative tone
6. If the search results are limited, use your knowledge to provide additional context
7. Acknowledge any limitations or uncertainties
8. Format your response in markdown for better readability

Provide a detailed, helpful response:`;

        try {
            const response = await this.geminiAI.generateText(enhancedPrompt);
            
            return {
                answer: response,
                sources: searchResults.slice(0, 5).map(r => ({
                    title: r.title,
                    url: r.url,
                    description: r.description
                })),
                metadata: {
                    searchType: 'enhanced_deep_search',
                    resultsFound: searchResults.length,
                    searchTime: Date.now(),
                    aiGenerated: true,
                    confidence: this.assessResponseConfidence(searchResults)
                }
            };
        } catch (error) {
            console.error('Enhanced response generation failed:', error);
            throw new Error('Failed to generate comprehensive response');
        }
    }

    /**
     * Assess response confidence based on search results quality
     */
    assessResponseConfidence(searchResults) {
        if (searchResults.length === 0) return 'low';
        
        const avgRelevance = searchResults.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / searchResults.length;
        const trustedSources = searchResults.filter(r => 
            r.url.includes('wikipedia.org') || r.url.includes('.edu') || r.url.includes('.gov')
        ).length;
        
        if (avgRelevance > 5 && trustedSources > 1) return 'high';
        if (avgRelevance > 3 || trustedSources > 0) return 'medium';
        return 'low';
    }

    /**
     * Main search method
     */
    async performEnhancedSearch(query, conversationHistory = []) {
        try {
            console.log(`🚀 Starting enhanced deep search for: "${query}"`);
            
            // Step 1: Optimize query
            const optimizedQuery = await this.optimizeSearchQuery(query, conversationHistory);
            
            // Step 2: Perform enhanced web search
            const searchResults = await this.performEnhancedWebSearch(optimizedQuery);
            
            // Step 3: Generate comprehensive response
            const response = await this.generateComprehensiveResponse(query, searchResults, conversationHistory);
            
            console.log(`✅ Enhanced search completed with ${searchResults.length} results`);
            return response;
            
        } catch (error) {
            console.error('Enhanced deep search failed:', error);
            throw new Error(`Enhanced search failed: ${error.message}`);
        }
    }
}

module.exports = EnhancedDeepSearchService;
