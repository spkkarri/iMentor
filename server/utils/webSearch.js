// server/utils/webSearch.js
const axios = require('axios');

/**
 * Performs a web search using the DuckDuckGo API.
 * This is a more stable alternative to web scraping.
 * @param {string} query - The search query.
 * @returns {Promise<Array>} A promise that resolves to an array of search results.
 */
async function performDuckDuckGoSearch(query) {
    if (!query) {
        console.warn('[webSearch] Search query is empty.');
        return [];
    }

    const url = `https://api.duckduckgo.com/`;

    try {
        console.log(`[webSearch] Searching for: "${query}"`);
        const response = await axios.get(url, {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                skip_disambig: 1,
            },
            headers: {
                // DuckDuckGo API is public but a user agent can help avoid blocks
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const results = response.data.RelatedTopics.filter(topic => topic.Text && topic.FirstURL).map(topic => ({
            title: topic.Text,
            snippet: topic.Result, // The Result field often has a snippet-like summary
            url: topic.FirstURL,
        }));
        
        console.log(`[webSearch] Found ${results.length} results from DuckDuckGo API.`);
        return results;

    } catch (error) {
        console.error(`[webSearch] Error fetching results from DuckDuckGo API:`, error.message);
        // On error, return an empty array to prevent the entire process from failing.
        return [];
    }
}

module.exports = { performDuckDuckGoSearch };
