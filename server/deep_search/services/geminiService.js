// Google Gemini AI service for advanced deep search
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Search types
const SEARCH_TYPES = {
    WEB: 'web_search',
    ACADEMIC: 'academic',
    TECHNICAL: 'technical',
    NEWS: 'news',
    CODE: 'code_search'
};

// Search priorities
const SEARCH_PRIORITIES = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

// Search domains
const SEARCH_DOMAINS = {
    GENERAL: 'general',
    TECHNICAL: 'technical',
    MEDICAL: 'medical',
    LEGAL: 'legal',
    BUSINESS: 'business'
};

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.enabled = false;
        this.genAI = null;
        this.model = null;
        this.logger = {
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        };

        try {
            this.initialize();
        } catch (error) {
            this.logger.error('Failed to initialize GeminiService:', error);
            this.enabled = false;
        }
    }

    initialize() {
        if (!this.apiKey) {
            this.logger.warn('⚠️ GEMINI_API_KEY not found. AI features will be disabled.');
            return false;
        }
        
        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
            this.enabled = true;
            this.logger.info('🤖 Gemini AI service initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize Gemini AI:', error);
            this.enabled = false;
            return false;
        }
    }

    /**
     * Check if the service is available
     * @returns {boolean} Whether the service is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Generate a structured error response
     * @param {Error} error - The error object
     * @param {Object} context - Context information
     * @returns {Object} Error response
     */
    generateErrorResponse(error, context = {}) {
        return {
            error: {
                message: error.message || 'An error occurred',
                type: error.name || 'UnknownError',
                stack: error.stack,
                context
            },
            metadata: {
                timestamp: new Date().toISOString(),
                service: 'GeminiService',
                method: context.method,
                status: 'error'
            }
        };
    }

    /**
     * Generate a structured success response
     * @param {any} data - The response data
     * @param {Object} context - Context information
     * @returns {Object} Success response
     */
    generateSuccessResponse(data, context = {}) {
        return {
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                service: 'GeminiService',
                method: context.method,
                status: 'success'
            }
        };
    }

    /**
     * Extract JSON from Gemini response
     * @param {string} responseText - The response text
     * @param {Object} context - Context information
     * @returns {Promise<any>} Parsed JSON
     */
    async extractJSONFromResponse(responseText, context) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                const error = new Error('Invalid JSON response from Gemini');
                this.logger.error(`Failed to parse Gemini response for ${context.method}:`, error);
                throw error;
            }
            
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                const error = new Error('Failed to parse JSON string');
                error.originalError = parseError;
                this.logger.error(`Failed to parse JSON string for ${context.method}:`, error);
                throw error;
            }
        } catch (error) {
            this.logger.error(`Failed to extract JSON from response for ${context.method}:`, error);
            throw error;
        }
    }

    /**
     * Decompose a complex query into searchable components
     * @param {string} query - The search query
     * @param {Object} options - Search options
     * @param {string} options.type - Search type (web, academic, technical, etc.)
     * @param {string} options.priority - Search priority (high, medium, low)
     * @param {string} options.domain - Search domain (general, technical, etc.)
     * @returns {Promise<Object>} Query decomposition
     */
    async decomposeQuery(query, options = {}) {
        if (!this.enabled) {
            return this.getFallbackDecomposition(query, options);
        }

        try {
            const {
                type = SEARCH_TYPES.WEB,
                priority = SEARCH_PRIORITIES.MEDIUM,
                domain = SEARCH_DOMAINS.GENERAL
            } = options;

            const prompt = `
You are an expert search decomposer. Analyze this query and break it down into components for effective ${type} searching.

Query: "${query}"
Search Type: ${type}
Priority: ${priority}
Domain: ${domain}

Respond with ONLY a valid JSON object in this format:
{
    "coreQuestion": "The main question being asked",
    "searchQueries": ["search term 1", "search term 2", "search term 3"],
    "context": "Important context or background",
    "searchType": "${type}",
    "priority": "${priority}",
    "timeRange": {
        "start": "YYYY-MM-DD",
        "end": "YYYY-MM-DD"
    },
    "confidence": 0-100,
    "metadata": {
        "language": "en",
        "domain": "${domain}",
        "expectedResults": number,
        "searchDepth": "shallow" | "medium" | "deep"
    }
}
`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim();

            const parsed = await this.extractJSONFromResponse(text, { method: 'decomposeQuery' });
            return {
                coreQuestion: parsed.coreQuestion || query,
                searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.slice(0, 3) : [query],
                context: parsed.context || '',
                expectedResultTypes: Array.isArray(parsed.expectedResultTypes) ? parsed.expectedResultTypes : ['articles'],
                aiGenerated: true
            };
        } catch (error) {
            this.logger.error('Gemini query decomposition error:', error);
            return this.getFallbackDecomposition(query, options);
        }
    }

    /**
     * Get fallback decomposition if AI is disabled or fails
     */
    getFallbackDecomposition(query, options = {}) {
        return {
            coreQuestion: query,
            searchQueries: [query],
            context: '',
            expectedResultTypes: ['articles'],
            aiGenerated: false
        };
    }

    /**
     * Synthesize search results into a cohesive response
     * @param {Array} results - Search results
     * @param {string} query - Original query
     * @param {Object} context - Search context
     * @param {Object} options - Synthesis options
     * @param {string} options.style - Response style (formal, casual, technical)
     * @param {string} options.length - Response length (short, medium, long)
     * @returns {Promise<Object>} Synthesized response
     */
    async synthesizeResults(results, query, context, options = {}) {
        if (!this.enabled) {
            return this.getFallbackSynthesis(results, query, context, options);
        }

        try {
            const { style = 'formal', length = 'medium' } = options;

            // Ensure results is an array
            const resultsArray = Array.isArray(results) ? results : [];

            const prompt = `
You are a master synthesizer. Analyze these search results and create a ${style} ${length}-length response.

Query: "${query}"
Context: ${JSON.stringify(context)}

Results:
${resultsArray.map(result => `- ${result.title || result.snippet || 'Unknown'}: ${result.snippet || result.content || 'No content'}`).join('\n')}

Synthesize this information into a response that:
1. Answers the core question
2. Provides relevant context
3. Includes key evidence from sources
4. Maintains factual accuracy
5. Is well-structured and ${style}

Respond with ONLY a valid JSON object in this format:
{
    "summary": "Main synthesized response",
    "keyPoints": ["point 1", "point 2", "point 3"],
    "sources": [
        { "title": "Source Title", "url": "source_url", "relevance": 0-100 }
    ],
    "confidence": 0-100,
    "metadata": {
        "language": "en",
        "domain": "${context.metadata?.domain || 'general'}",
        "readingTime": number,
        "sourcesUsed": number,
        "style": "${style}",
        "length": "${length}"
    }
}
`;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim();

            const jsonMatch = /\{[\s\S]*\}/.exec(text);
            if (!jsonMatch) {
                console.warn('Invalid JSON response from Gemini');
                return this.getFallbackSynthesis(results, query, context, options);
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                summary: parsed.summary || 'No summary available',
                keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
                sources: Array.isArray(parsed.sources) ? parsed.sources : [],
                confidence: parsed.confidence || 75,
                metadata: parsed.metadata || {},
                aiGenerated: true,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Gemini synthesis error:', error);
            return this.getFallbackSynthesis(results, query, context, options);
        }
    }

    /**
     * Get fallback synthesis if AI is disabled or fails
     */
    getFallbackSynthesis(results, query, context, options = {}) {
        const resultsArray = Array.isArray(results) ? results : [];
        const summary = resultsArray.length > 0 
            ? `Based on the search results for "${query}", I found ${resultsArray.length} relevant sources. ${resultsArray[0].snippet || resultsArray[0].content || 'Please try a more specific search query.'}`
            : `I couldn't find sufficient search results for "${query}". This might be due to the query being too specific or no relevant information being available. Please try rephrasing your question or try again later.`;

        return {
            summary: summary,
            keyPoints: [],
            sources: resultsArray.map(result => ({
                title: result.title || 'Unknown Source',
                url: result.url || '#',
                relevance: 50
            })),
            confidence: resultsArray.length > 0 ? 50 : 0,
            metadata: {
                language: 'en',
                domain: context.metadata?.domain || 'general',
                readingTime: 1,
                sourcesUsed: resultsArray.length,
                style: options.style || 'formal',
                length: options.length || 'medium'
            },
            aiGenerated: false,
            timestamp: new Date().toISOString()
        };
    }

    getFallbackCognitiveBias() {
        return { bias: 'none', explanation: 'No significant cognitive bias detected.' };
    }
}

module.exports = GeminiService;
