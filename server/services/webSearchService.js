// server/services/webSearchService.js
const axios = require('axios');

// Environment variables should be loaded by your main server entry point (e.g., server.js or app.js)
// using require('dotenv').config();
// So, we can directly access them via process.env
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX_ID = process.env.GOOGLE_SEARCH_CX_ID;

/**
 * Performs a web search using Google Custom Search API targeting pre-configured sites.
 * @param {string} query - The user's search query (potentially refined).
 * @param {number} numResultsToRequest - Number of search results to request from the API.
 * @param {number} numResultsToProcess - Number of results to actually process and return snippets for.
 * @returns {Promise<string|null>} - A promise that resolves to a string of concatenated context, or null if no results/error.
 */
async function searchSpecificWebsites(query, numResultsToRequest = 5, numResultsToProcess = 3) {
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX_ID) {
        console.error("[WebSearchService] Google Search API Key or CX ID is not configured in .env. Web search will be skipped.");
        return null;
    }

    const finalQuery = query; // The query should already be refined if necessary before calling this function

    // Construct the search URL for Google Custom Search API
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX_ID}&q=${encodeURIComponent(finalQuery)}&num=${numResultsToRequest}`;

    console.log(`[WebSearchService] Searching Google Custom Search: "${finalQuery}", requesting ${numResultsToRequest} results.`);

    try {
        const response = await axios.get(searchUrl);
        const items = response.data.items;

        if (!items || items.length === 0) {
            console.log("[WebSearchService] No results found from Google Custom Search.");
            return null;
        }

        let combinedContext = "";
        const resultsToUse = Math.min(items.length, numResultsToProcess);

        console.log(`[WebSearchService] Received ${items.length} results. Processing top ${resultsToUse}.`);

        for (let i = 0; i < resultsToUse; i++) {
            const item = items[i];
            // Ensure snippet exists and is not empty, and link exists
            if (item.snippet && item.snippet.trim() !== "" && item.link && item.title) {
                // Replace newlines in snippet with spaces to keep context more compact for LLM
                const cleanSnippet = item.snippet.replace(/\n/g, ' ').trim();
                combinedContext += `Source: ${item.link}\nTitle: ${item.title}\nSnippet: ${cleanSnippet}\n---\n`;
            } else {
                console.log(`[WebSearchService] Skipping result (title: "${item.title || 'N/A'}") due to missing link, title, or empty snippet.`);
            }
        }
        
        if (combinedContext.trim() === "") {
            console.log("[WebSearchService] All processed snippets were empty or results lacked necessary fields. Returning null.");
            return null;
        }

        console.log(`[WebSearchService] Compiled web context (length: ${combinedContext.trim().length}).`);
        return combinedContext.trim();

    } catch (error) {
        console.error("[WebSearchService] Error during Google Custom Search API call:");
        if (error.response) {
            // Google API often returns errors in error.response.data
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
            if (error.response.data && error.response.data.error && error.response.data.error.message) {
                console.error("Google API Error Message:", error.response.data.error.message);
            }
        } else {
            // Network error or other issue
            console.error("Error message:", error.message);
        }
        return null; // Indicate failure
    }
}

module.exports = { searchSpecificWebsites };