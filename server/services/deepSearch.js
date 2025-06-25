// server/services/deepSearch.js
const { performDuckDuckGoSearch } = require('../utils/webSearch');

class DeepSearchService {
    constructor(userId) {
        if (!userId) {
            console.warn("[DeepSearchService] Instantiated without a userId.");
        }
        this.userId = userId;
    }

    /**
     * Performs a web search for a given query.
     * @param {string} query - The search query.
     * @returns {Promise<Array>} A promise that resolves to an array of search results.
     */
    async performWebSearch(query) {
        try {
            console.log(`[DeepSearchService] Performing web search for: "${query}"`);
            const searchResults = await performDuckDuckGoSearch(query);
            console.log(`[DeepSearchService] Found ${searchResults.length} results for "${query}".`);
            return searchResults;
  } catch (error) {
            console.error(`[DeepSearchService] Error during web search for "${query}":`, error);
            return [];
        }
    }

    /**
     * The main method to perform a deep search.
     * @param {string} query - The user's original query.
     * @returns {Promise<Object>} A promise that resolves to the synthesized result.
     */
    async performSearch(query) {
        throw new Error("[DeepSearchService] This service is deprecated. Use the new deep search in server/deep_search/services/deepSearchService.js");
    }
}

module.exports = DeepSearchService;