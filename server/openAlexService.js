// openAlexService.js
const axios = require('axios');

const OPENALEX_API_BASE_URL = 'https://api.openalex.org/works';
const YOUR_EMAIL = '522153@student.nitandhra.ac.in'; 

/**
 * Searches OpenAlex for academic works.
 * @param {string} query - The user's search query.
 * @param {object} options - Optional parameters (e.g., { limit: 10 }).
 * @returns {Promise<Array<object>>} A promise that resolves to an array of MCP-formatted paper objects.
 */

async function searchOpenAlex(query, options = {}) {
    const perPage = Math.min(options.perPage || 20, 200); // OpenAlex max per_page is 200
    const totalLimit = options.limit || 50;
    let allResults = [];
    let cursor = '*';

    try {
        while (allResults.length < totalLimit && cursor) {
            const searchParams = new URLSearchParams({
                search: query,
                mailto: YOUR_EMAIL,
                per_page: perPage,
                cursor
            });

            const requestUrl = `${OPENALEX_API_BASE_URL}?${searchParams.toString()}`;
            console.log(`Requesting OpenAlex: ${requestUrl}`);

            const response = await axios.get(requestUrl);
            const rawResults = response.data.results || [];
            const nextCursor = response.data.meta?.next_cursor;

            if (rawResults.length === 0) break;

            const transformed = rawResults.map(item => transformOpenAlexToMcp(item));
            allResults.push(...transformed);

            if (!nextCursor) break;

            cursor = nextCursor;

            // Don't exceed totalLimit
            if (allResults.length >= totalLimit) break;
        }

        return allResults.slice(0, totalLimit);

    } catch (error) {
        console.error('Error fetching data from OpenAlex:', error.message);
        if (error.response) {
            console.error('OpenAlex Error Data:', error.response.data);
            console.error('OpenAlex Error Status:', error.response.status);
        }
        return [];
    }
}


/**
 * Transforms a single OpenAlex work item into MCP format.
 * @param {object} openAlexItem - A raw work item from the OpenAlex API.
 * @returns {object} The paper formatted according to MCP.
 */
function transformOpenAlexToMcp(openAlexItem) {
    return {
        source: "OpenAlex",
        id_from_source: openAlexItem.id || null,
        type: openAlexItem.type || null,
        title: openAlexItem.display_name || null,
        authors: openAlexItem.authorships ? openAlexItem.authorships.map(auth => ({
            name: auth.author ? auth.author.display_name : null,
            affiliation: auth.institutions && auth.institutions.length > 0 ? auth.institutions[0].display_name : null,
            orcid: auth.author ? auth.author.orcid : null
        })) : [],
        publicationDate: openAlexItem.publication_date || null,
        publicationYear: openAlexItem.publication_year ? String(openAlexItem.publication_year) : null,
        abstract: reconstructAbstract(openAlexItem.abstract_inverted_index),
        url: openAlexItem.doi || (openAlexItem.primary_location ? openAlexItem.primary_location.landing_page_url : null),
        alternate_urls: openAlexItem.primary_location && openAlexItem.primary_location.pdf_url ?
            [{ type: "pdf", url: openAlexItem.primary_location.pdf_url }] : [],
        citations: openAlexItem.cited_by_count || 0,
        keywords: openAlexItem.keywords ? openAlexItem.keywords.map(kw => kw.display_name) : [],
        journal_conference_details: {
            name: openAlexItem.primary_location && openAlexItem.primary_location.source ? openAlexItem.primary_location?.source?.display_name : (openAlexItem.host_venue ? openAlexItem.host_venue.display_name : null),
            volume: openAlexItem.biblio ? openAlexItem.biblio?.volume : null,
            issue: openAlexItem.biblio ? openAlexItem.biblio?.issue : null,
            pages: openAlexItem.biblio && openAlexItem.biblio?.first_page && openAlexItem.biblio?.last_page ?
                `${openAlexItem.biblio.first_page}-${openAlexItem.biblio.last_page}` : null
        },
        language: openAlexItem.language || null,
        relevance_score_from_source: openAlexItem.relevance_score || null,
        retrieval_timestamp: new Date().toISOString()
    };
}

/**
 * Reconstructs an abstract from OpenAlex's inverted index format.
 * @param {object} invertedIndex - The inverted index object.
 * @returns {string} Reconstructed abstract text.
 */
function reconstructAbstract(invertedIndex) {
    if (!invertedIndex || typeof invertedIndex !== 'object' || Object.keys(invertedIndex).length === 0) {
        return '';
    }

    let abstractLength = 0;
    Object.values(invertedIndex).forEach(positions => {
        positions.forEach(pos => {
            if (pos + 1 > abstractLength) {
                abstractLength = pos + 1;
            }
        });
    });

    if (abstractLength === 0) return '';

    const abstractArray = new Array(abstractLength).fill('');
    for (const word in invertedIndex) {
        invertedIndex[word].forEach(pos => {
            abstractArray[pos] = word;
        });
    }

    return abstractArray.filter(word => word !== '').join(' ');
}

// Export the main function
module.exports = {
    searchOpenAlex
};
