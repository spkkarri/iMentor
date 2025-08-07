// server/services/intelligentPromptAnalyzer.js
// Intelligent prompt analyzer to automatically determine when web search is needed

const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class IntelligentPromptAnalyzer {
    constructor() {
        this.geminiService = null;
        this.geminiAI = null;
        this.isInitialized = false;
        this.analysisCache = new Map();
    }

    async initialize() {
        if (!this.isInitialized) {
            try {
                this.geminiService = new GeminiService();
                await this.geminiService.initialize();
                this.geminiAI = new GeminiAI(this.geminiService);
                this.isInitialized = true;
                console.log('🧠 Intelligent Prompt Analyzer initialized');
            } catch (error) {
                console.error('Failed to initialize Intelligent Prompt Analyzer:', error);
                throw error;
            }
        }
    }

    /**
     * Analyze prompt to determine if web search is needed (like ChatGPT does)
     */
    async analyzePrompt(prompt, conversationHistory = []) {
        await this.initialize();

        // Check cache first
        const cacheKey = this.generateCacheKey(prompt, conversationHistory);
        if (this.analysisCache.has(cacheKey)) {
            console.log('📋 Using cached prompt analysis');
            return this.analysisCache.get(cacheKey);
        }

        const analysisPrompt = `You are an intelligent prompt analyzer that determines whether a user query requires real-time web search or can be answered with general AI knowledge, similar to how ChatGPT automatically decides when to search the web.

User Query: "${prompt}"

${conversationHistory.length > 0 ? `
Recent Conversation Context:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

Analyze this query and determine if it needs web search based on these criteria:

**REQUIRES WEB SEARCH if query involves:**
- Current events, news, or recent developments
- Real-time information (stock prices, weather, sports scores)
- Recent data, statistics, or trends
- Specific current facts that change over time
- Information about recent products, releases, or updates
- Current status of companies, people, or organizations
- Recent research findings or studies
- Time-sensitive information (today, this week, this month, 2024, etc.)
- Specific current prices, availability, or market data
- Recent technological developments or updates

**DOES NOT REQUIRE WEB SEARCH if query involves:**
- General knowledge or concepts
- Historical facts or established information
- Theoretical explanations or how-to guides
- Mathematical calculations or logic problems
- Creative writing or brainstorming
- Code examples or programming concepts
- General advice or recommendations
- Explanations of established concepts
- Personal opinions or subjective topics
- Hypothetical scenarios or thought experiments

Return ONLY a JSON object with this exact format:
{
  "needsWebSearch": true/false,
  "confidence": "high/medium/low",
  "reasoning": "Brief explanation of why web search is/isn't needed",
  "queryType": "current_events/real_time_data/general_knowledge/how_to/creative/technical",
  "timeRelevance": "current/recent/historical/timeless",
  "searchKeywords": ["key", "terms", "for", "search"] or null
}

Be conservative - only suggest web search when the query clearly needs current/real-time information.`;

        try {
            const result = await this.geminiAI.generateText(analysisPrompt);
            const analysis = JSON.parse(result);
            
            // Validate the analysis
            if (typeof analysis.needsWebSearch !== 'boolean') {
                throw new Error('Invalid analysis format');
            }

            // Cache the result
            this.analysisCache.set(cacheKey, analysis);
            
            console.log('🧠 Prompt analysis:', {
                needsWebSearch: analysis.needsWebSearch,
                confidence: analysis.confidence,
                queryType: analysis.queryType,
                reasoning: analysis.reasoning.substring(0, 100) + '...'
            });

            return analysis;

        } catch (error) {
            console.warn('Prompt analysis failed, using fallback:', error.message);
            return this.createFallbackAnalysis(prompt);
        }
    }

    /**
     * Generate cache key for analysis results
     */
    generateCacheKey(prompt, conversationHistory) {
        const contextHash = conversationHistory.slice(-2).map(msg => msg.content).join('|');
        return `${prompt.toLowerCase().trim()}_${contextHash}`.substring(0, 100);
    }

    /**
     * Create fallback analysis using simple heuristics
     */
    createFallbackAnalysis(prompt) {
        const promptLower = prompt.toLowerCase();
        
        // Keywords that strongly suggest web search is needed
        const webSearchKeywords = [
            'today', 'yesterday', 'this week', 'this month', 'this year', '2024', '2023',
            'current', 'latest', 'recent', 'now', 'currently', 'breaking',
            'news', 'update', 'price', 'stock', 'weather', 'score',
            'released', 'announced', 'launched', 'trending', 'happening',
            'status', 'available', 'when did', 'when will', 'how much does',
            'what happened', 'what is happening', 'live', 'real-time'
        ];

        // Keywords that suggest general knowledge is sufficient
        const generalKnowledgeKeywords = [
            'how to', 'what is', 'explain', 'define', 'meaning', 'concept',
            'theory', 'principle', 'example', 'tutorial', 'guide',
            'difference between', 'compare', 'pros and cons', 'advantages',
            'history of', 'background', 'overview', 'summary',
            'write', 'create', 'generate', 'help me', 'suggest'
        ];

        const hasWebSearchKeywords = webSearchKeywords.some(keyword => 
            promptLower.includes(keyword)
        );

        const hasGeneralKeywords = generalKnowledgeKeywords.some(keyword => 
            promptLower.includes(keyword)
        );

        let needsWebSearch = false;
        let confidence = 'medium';
        let reasoning = 'Fallback analysis based on keyword detection';
        let queryType = 'general_knowledge';
        let timeRelevance = 'timeless';

        if (hasWebSearchKeywords && !hasGeneralKeywords) {
            needsWebSearch = true;
            confidence = 'high';
            reasoning = 'Query contains time-sensitive or current information keywords';
            queryType = 'current_events';
            timeRelevance = 'current';
        } else if (hasWebSearchKeywords && hasGeneralKeywords) {
            needsWebSearch = true;
            confidence = 'medium';
            reasoning = 'Query has mixed indicators but leans toward current information';
            queryType = 'real_time_data';
            timeRelevance = 'recent';
        } else if (hasGeneralKeywords) {
            needsWebSearch = false;
            confidence = 'high';
            reasoning = 'Query appears to be asking for general knowledge or explanations';
            queryType = 'general_knowledge';
            timeRelevance = 'timeless';
        }

        // Extract potential search keywords
        const searchKeywords = needsWebSearch ? 
            prompt.split(' ').filter(word => 
                word.length > 3 && 
                !['what', 'when', 'where', 'how', 'why', 'the', 'and', 'or', 'but'].includes(word.toLowerCase())
            ).slice(0, 5) : null;

        return {
            needsWebSearch,
            confidence,
            reasoning,
            queryType,
            timeRelevance,
            searchKeywords
        };
    }

    /**
     * Quick analysis for simple cases (used for performance)
     */
    quickAnalysis(prompt) {
        const promptLower = prompt.toLowerCase().trim();
        
        // Very obvious cases that need web search
        const obviousWebSearchPatterns = [
            /\b(today|yesterday|this week|this month|2024|2023)\b/,
            /\b(current|latest|recent|breaking|live)\b/,
            /\b(news|price|stock|weather|score)\b/,
            /\b(what happened|what's happening|trending)\b/,
            /\b(when did|when will|how much does)\b/
        ];

        // Very obvious cases that don't need web search
        const obviousGeneralPatterns = [
            /^(how to|what is|explain|define|meaning of)\b/,
            /\b(theory|principle|concept|tutorial|guide)\b/,
            /\b(write|create|generate|help me|suggest)\b/,
            /\b(difference between|compare|pros and cons)\b/
        ];

        for (const pattern of obviousWebSearchPatterns) {
            if (pattern.test(promptLower)) {
                return {
                    needsWebSearch: true,
                    confidence: 'high',
                    reasoning: 'Quick analysis: Query clearly needs current information',
                    queryType: 'current_events',
                    timeRelevance: 'current',
                    searchKeywords: promptLower.split(' ').filter(w => w.length > 3).slice(0, 5)
                };
            }
        }

        for (const pattern of obviousGeneralPatterns) {
            if (pattern.test(promptLower)) {
                return {
                    needsWebSearch: false,
                    confidence: 'high',
                    reasoning: 'Quick analysis: Query is asking for general knowledge',
                    queryType: 'general_knowledge',
                    timeRelevance: 'timeless',
                    searchKeywords: null
                };
            }
        }

        return null; // Needs full analysis
    }

    /**
     * Main analysis method with performance optimization
     */
    async shouldUseWebSearch(prompt, conversationHistory = []) {
        try {
            console.log(`🔍 Analyzing prompt for web search need: "${prompt.substring(0, 50)}..."`);
            
            // Try quick analysis first
            const quickResult = this.quickAnalysis(prompt);
            if (quickResult) {
                console.log(`⚡ Quick analysis result: ${quickResult.needsWebSearch ? 'WEB SEARCH' : 'GENERAL'} (${quickResult.confidence})`);
                return quickResult;
            }

            // Fall back to full AI analysis
            const fullResult = await this.analyzePrompt(prompt, conversationHistory);
            console.log(`🧠 Full analysis result: ${fullResult.needsWebSearch ? 'WEB SEARCH' : 'GENERAL'} (${fullResult.confidence})`);
            return fullResult;

        } catch (error) {
            console.error('Prompt analysis error:', error);
            // Conservative fallback - don't use web search if analysis fails
            return {
                needsWebSearch: false,
                confidence: 'low',
                reasoning: 'Analysis failed, defaulting to general knowledge',
                queryType: 'general_knowledge',
                timeRelevance: 'timeless',
                searchKeywords: null
            };
        }
    }

    /**
     * Clear analysis cache (useful for testing)
     */
    clearCache() {
        this.analysisCache.clear();
        console.log('🗑️ Prompt analysis cache cleared');
    }
}

module.exports = IntelligentPromptAnalyzer;
