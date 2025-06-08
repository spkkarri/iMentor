// coreService.js
const axios = require('axios');

const CORE_API_BASE_URL = 'https://api.core.ac.uk/v3/search/works';
const YOUR_CORE_API_KEY = 'yRoTaHXFAbpCGzB7tSm34nOixgjuv5Q0'; // <<< IMPORTANT: Replace with your real CORE API key

/**
 * Searches CORE for academic works with pagination.
 * CORE API v3 uses 'limit' for page size and 'page' (1-indexed) for pagination.
 * @param {string} query - The user's search query.
 * @param {object} options - Optional parameters (e.g., { totalLimit: 50, perPage: 10 }).
 *                           `totalLimit` is the desired total number of results.
 *                           `perPage` is how many results to fetch per API call (CORE's 'limit').
 * @returns {Promise<Array<object>>} A promise that resolves to an array of MCP-formatted paper objects.
 */
async function searchCore(query, options = {}) {
    const perPage = Math.min(options.perPage || 20, 100); // CORE's max limit is often 100, check their docs
    const totalLimit = options.totalLimit || 50;         // Desired total number of results to aim for
    let allResults = [];
    let currentPage = 1; // CORE 'page' parameter is 1-indexed

    try {
        while (allResults.length < totalLimit) {
            const searchParams = new URLSearchParams({
                q: query,
                limit: perPage,
                page: currentPage,
            });

            const requestUrl = `${CORE_API_BASE_URL}?${searchParams.toString()}`;
            console.log(`Requesting CORE (Page ${currentPage}): ${requestUrl}`);

            const response = await axios.get(requestUrl, {
                headers: {
                    'apiKey':'yRoTaHXFAbpCGzB7tSm34nOixgjuv5Q0'// Confirm header name from CORE docs
                }
            });

            const rawResults = response.data.results || [];
            // CORE V3 also provides `totalHits` in response.data if you want to know the grand total available
            // const totalHits = response.data.totalHits;

            if (rawResults.length === 0) {
                // No more results from the API for this query
                break;
            }

            const transformed = rawResults.map(item => transformCoreToMcp(item));
            allResults.push(...transformed);

            // Check if we've fetched enough or if there might be more pages
            if (allResults.length >= totalLimit || rawResults.length < perPage) {
                // Either reached the desired totalLimit, or the last page had fewer results than perPage (meaning no more pages)
                break;
            }

            currentPage++; // Move to the next page for the next iteration
        }

        return allResults.slice(0, totalLimit); // Ensure we don't return more than totalLimit

    } catch (error) {
        console.error('Error fetching data from CORE:', error.message);
        if (error.response) {
            console.error('CORE Error Data:', error.response.data);
            console.error('CORE Error Status:', error.response.status);
            console.error('CORE Error Headers:', error.response.headers);
        }
        return []; // Return empty array on error
    }
}

/**
 * Transforms a single CORE work item into MCP format.
 * @param {object} coreItem - A raw work item from the CORE API.
 * @returns {object} The paper formatted according to MCP.
 */
function transformCoreToMcp(coreItem) {
    const getDoiUrl = (doi) => {
        if (!doi) return null;
        if (doi.startsWith('http')) return doi;
        return `https://doi.org/${doi}`;
    };

    const authors = coreItem.authors ? coreItem.authors.map(auth => ({
        name: auth.name || null,
        affiliation: null,
        orcid: null
    })) : [];

    let pdfUrl = coreItem.downloadUrl || null;
    if (!pdfUrl && coreItem.links) {
        const downloadLink = coreItem.links.find(link => link.type === 'download' && link.url);
        if (downloadLink) pdfUrl = downloadLink.url;
    }
    if (!pdfUrl && coreItem.sourceFulltextUrls && coreItem.sourceFulltextUrls.length > 0) {
        pdfUrl = coreItem.sourceFulltextUrls[0];
    }

    return {
        source: "CORE",
        id_from_source: coreItem.id ? String(coreItem.id) : null,
        type: coreItem.documentType || "unknown",
        title: coreItem.title || null,
        authors: authors,
        publicationDate: coreItem.publishedDate || null,
        publicationYear: coreItem.yearPublished ? String(coreItem.yearPublished) : null,
        abstract: coreItem.abstract || null,
        url: getDoiUrl(coreItem.doi) || pdfUrl || (coreItem.links?.find(l => l.type === 'display')?.url) || null,
        alternate_urls: pdfUrl ? [{ type: "pdf", url: pdfUrl }] : [],
        citations: coreItem.citationCount || 0,
        keywords: [],
        journal_conference_details: {
            name: coreItem.publisher ? coreItem.publisher.replace(/^'|'$/g, '') : null,
            volume: null,
            issue: null,
            pages: null
        },
        language: coreItem.language ? coreItem.language.code : null,
        relevance_score_from_source: null,
        retrieval_timestamp: new Date().toISOString()
    };
}

// Export the main function
module.exports = {
    searchCore
};