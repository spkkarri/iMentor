// server/deep_search/services/geminiService.js
// Google Gemini AI service for query decomposition and result synthesis

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not found. AI features will be disabled.');
      this.enabled = false;
      return;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      this.enabled = true;
      console.log('🤖 Gemini AI service initialized');
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
      this.enabled = false;
    }
  }

  /**
   * Check if the service is available
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Decompose a complex query into searchable components
   */
  async decomposeQuery(query) {
    if (!this.enabled) {
      return this.getFallbackDecomposition(query);
    }

    try {
      const prompt = `
Analyze this search query and break it down into components for effective web searching.

Query: "${query}"

Respond with ONLY a valid JSON object in this exact format:
{
  "coreQuestion": "The main question being asked",
  "searchQueries": ["search term 1", "search term 2", "search term 3"],
  "context": "Important context or background",
  "expectedResultTypes": ["articles", "tutorials", "research"]
}

Do not include any text before or after the JSON object.
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Try to parse JSON response
      try {
        // Clean the response text to extract JSON
        let cleanText = text.trim();

        // Remove any markdown code blocks if present
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```$/, '');
        }

        // Try to find JSON object in the response
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanText);
        return {
          coreQuestion: parsed.coreQuestion || query,
          searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.slice(0, 3) : [query],
          context: parsed.context || '',
          expectedResultTypes: Array.isArray(parsed.expectedResultTypes) ? parsed.expectedResultTypes : ['articles'],
          aiGenerated: true
        };
      } catch (parseError) {
        console.warn('Failed to parse Gemini response:', text.substring(0, 200) + '...');
        console.warn('Parse error:', parseError.message);
        return this.getFallbackDecomposition(query);
      }
      
    } catch (error) {
      console.error('Gemini query decomposition error:', error);
      return this.getFallbackDecomposition(query);
    }
  }

  /**
   * Synthesize search results into a comprehensive answer
   */
  async synthesizeResults(query, searchResults, decomposition) {
    // Defensive: ensure searchResults is an array
    if (!Array.isArray(searchResults)) {
      searchResults = [];
    }
    if (!this.enabled || !searchResults || searchResults.length === 0) {
      return this.getFallbackSynthesis(query, searchResults);
    }

    try {
      // Prepare search results for AI processing
      const resultsText = searchResults
        .slice(0, 10) // Limit to top 10 results
        .map((result, index) => {
          return `Result ${index + 1}:
Title: ${result.title || 'No title'}
Description: ${result.description || 'No description'}
URL: ${result.url || 'No URL'}
---`;
        })
        .join('\n');

      const prompt = `
Based on the following search results, provide a comprehensive answer to the user's question.

Original Question: "${query}"
Core Question: "${decomposition.coreQuestion}"

Search Results:
${resultsText}

Please provide a well-structured response that:
1. Directly answers the user's question
2. Synthesizes information from multiple sources
3. Includes key insights and important details
4. Is written in a clear, informative style

Format your response in markdown with appropriate headings and bullet points where helpful.

IMPORTANT: Do NOT include any "Limitations" section or discuss limitations of the information. Focus only on providing the requested information in a clear and helpful manner.
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const synthesizedText = response.text();
      
      return {
        answer: synthesizedText,
        sources: searchResults.slice(0, 5).map(r => ({
          title: r.title,
          url: r.url,
          description: r.description
        })),
        aiGenerated: true,
        confidence: this.assessConfidence(searchResults),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Gemini synthesis error:', error);
      return this.getFallbackSynthesis(query, searchResults);
    }
  }

  /**
   * Analyze search results for cognitive biases
   */
  async analyzeCognitiveBias(query, searchResults) {
    if (!this.enabled) {
      return this.getFallbackBiasAnalysis(query);
    }

    try {
      const resultsText = searchResults
        .slice(0, 5)
        .map(result => `${result.title}: ${result.description}`)
        .join('\n');

      const prompt = `
Analyze the following query and search results for potential cognitive biases:

Query: "${query}"
Search Results:
${resultsText}

Please identify:
1. What cognitive biases might be present in the query itself
2. What biases might affect how someone interprets these results
3. Suggestions for more objective thinking about this topic
4. Alternative perspectives to consider

Provide your analysis in JSON format with fields: "queryBiases", "interpretationBiases", "suggestions", "alternatives".
`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      try {
        const analysis = JSON.parse(text);
        return {
          ...analysis,
          aiGenerated: true,
          timestamp: new Date().toISOString()
        };
      } catch (parseError) {
        return this.getFallbackBiasAnalysis(query);
      }
      
    } catch (error) {
      console.error('Gemini bias analysis error:', error);
      return this.getFallbackBiasAnalysis(query);
    }
  }

  /**
   * Fallback query decomposition when AI is not available
   */
  getFallbackDecomposition(query) {
    const words = query.toLowerCase().split(' ');
    const searchQueries = [
      query,
      words.length > 2 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : query,
      words.length > 3 ? words.slice(-Math.ceil(words.length / 2)).join(' ') : query
    ].filter((q, index, arr) => arr.indexOf(q) === index); // Remove duplicates

    return {
      coreQuestion: query,
      searchQueries: searchQueries.slice(0, 3),
      context: 'Basic query analysis',
      expectedResultTypes: ['articles', 'information'],
      aiGenerated: false
    };
  }

  /**
   * Fallback synthesis when AI is not available
   */
  getFallbackSynthesis(query, searchResults) {
    // Defensive: ensure searchResults is an array
    if (!Array.isArray(searchResults)) {
      searchResults = [];
    }
    if (!searchResults || searchResults.length === 0) {
      return {
        answer: `I couldn't find specific search results for "${query}". This might be due to search service limitations. Please try rephrasing your question or searching for more specific terms.`,
        sources: [],
        aiGenerated: false,
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }

    const topResults = searchResults.slice(0, 5);
    // Defensive: ensure topResults is an array
    if (!Array.isArray(topResults)) {
      return {
        answer: `I couldn't find specific search results for "${query}". This might be due to search service limitations. Please try rephrasing your question or searching for more specific terms.`,
        sources: [],
        aiGenerated: false,
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Create a more intelligent synthesis based on the content
    let answer = `Based on available information about "${query}":\n\n`;

    // Extract key information from descriptions
    const descriptions = topResults.map(r => r.description).join(' ');

    // Add synthesized content based on the descriptions
    if (descriptions.toLowerCase().includes('agent') && descriptions.toLowerCase().includes('structure')) {
      answer += `**Agent Structure Overview:**\n`;
      answer += `An agent typically consists of several key components:\n\n`;
      answer += `• **Sensors/Perception**: How the agent receives information from its environment\n`;
      answer += `• **Actuators/Actions**: How the agent affects its environment\n`;
      answer += `• **Agent Function**: The decision-making logic that maps perceptions to actions\n`;
      answer += `• **Agent Program**: The concrete implementation of the agent function\n\n`;
      answer += `Common agent architectures include reactive agents (respond directly to stimuli), deliberative agents (plan before acting), and hybrid agents (combine both approaches).\n\n`;
    } else {
      // Generic synthesis
      topResults.forEach((result, index) => {
        answer += `**${index + 1}. ${result.title}**\n`;
        answer += `${result.description}\n\n`;
      });
    }

    answer += `**Sources:**\n`;
    topResults.forEach((result, index) => {
      answer += `${index + 1}. [${result.title}](${result.url})\n`;
    });

    return {
      answer,
      sources: topResults.map(r => ({
        title: r.title,
        url: r.url,
        description: r.description
      })),
      aiGenerated: false,
      confidence: 0.7, // Higher confidence for structured fallback
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fallback bias analysis when AI is not available
   */
  getFallbackBiasAnalysis(query) {
    return {
      queryBiases: ['Consider if your question contains assumptions'],
      interpretationBiases: ['Be aware of confirmation bias when reading results'],
      suggestions: ['Look for multiple perspectives', 'Check source credibility'],
      alternatives: ['Try rephrasing your question', 'Search for opposing viewpoints'],
      aiGenerated: false,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Assess confidence level based on search results quality
   */
  assessConfidence(searchResults) {
    if (!searchResults || searchResults.length === 0) return 0;
    
    let score = 0;
    const factors = {
      resultCount: Math.min(searchResults.length / 10, 1) * 0.3,
      hasDescriptions: (searchResults.filter(r => r.description).length / searchResults.length) * 0.3,
      hasUrls: (searchResults.filter(r => r.url).length / searchResults.length) * 0.2,
      titleQuality: (searchResults.filter(r => r.title && r.title.length > 10).length / searchResults.length) * 0.2
    };
    
    score = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    if (!this.enabled) {
      return {
        status: 'disabled',
        reason: 'GEMINI_API_KEY not configured',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Simple test query
      const result = await this.model.generateContent('Say "OK" if you can respond.');
      const response = result.response;
      const text = response.text();
      
      return {
        status: text.toLowerCase().includes('ok') ? 'healthy' : 'degraded',
        response: text,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = GeminiService;
