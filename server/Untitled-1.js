// arxivService.js
const axios = require('axios');
const xml2js = require('xml2js'); // For parsing XML

const ARXIV_API_BASE_URL = 'http://export.arxiv.org/api/query';

/**
 * Searches arXiv for academic preprints with pagination.
 * @param {string} query - The user's search query (e.g., "graphene" or "cat:cs.AI AND ti:transformer").
 * @param {object} options - Optional parameters (e.g., { totalLimit: 50, perPage: 10 }).
 *                           `totalLimit` is the desired total number of results.
 *                           `perPage` is how many results to fetch per API call (arXiv's 'max_results').
 * @returns {Promise<Array<object>>} A promise that resolves to an array of MCP-formatted paper objects.
 */
async function searchArxiv(query, options = {}) {
    const perPage = Math.min(options.perPage || 10, 100); // arXiv's max_results can be higher, but 100 is a safe bet. Check docs for absolute max.
    const totalLimit = options.totalLimit || 50;
    let allResults = [];
    let currentOffset = 0; // arXiv uses 'start' as a 0-indexed offset

    try {
        while (allResults.length < totalLimit) {
            const searchParams = new URLSearchParams({
                search_query: query, // arXiv uses field prefixes like all:, ti:, au:, cat:
                start: currentOffset,
                max_results: perPage
            });

            const requestUrl = `${ARXIV_API_BASE_URL}?${searchParams.toString()}`;
            console.log(`Requesting arXiv (Offset ${currentOffset}): ${requestUrl}`);

            const response = await axios.get(requestUrl);
            const xmlData = response.data;

            // Parse XML to JavaScript object
            // explicitArray: false tries to simplify output by not making single elements arrays
            // ignoreAttrs: false is important because some arXiv data (like URLs) is in attributes
            // tagNameProcessors: [xml2js.processors.stripPrefix] can simplify names like 'arxiv:comment' to 'comment'
            const parser = new xml2js.Parser({
                explicitArray: false,
                ignoreAttrs: false,
                tagNameProcessors: [xml2js.processors.stripPrefix] // Remove namespace prefixes
            });
            const parsedResult = await parser.parseStringPromise(xmlData);

            // Check if feed or entry exists
            if (!parsedResult.feed || !parsedResult.feed.entry) {
                console.log('No results or malformed feed from arXiv.');
                break; // No more results or error in feed structure
            }

            let entries = parsedResult.feed.entry;

            // If only one entry, xml2js with explicitArray:false might make it an object, not an array
            if (!Array.isArray(entries)) {
                entries = [entries];
            }
            
            if (entries.length === 0 || (entries.length === 1 && Object.keys(entries[0]).length === 0) ) {
                 // Handle case where entries might be an empty object if no actual entries found
                console.log('No actual entries found in this page from arXiv.');
                break;
            }


            const transformed = entries.map(item => transformArxivToMcp(item));
            allResults.push(...transformed);

            // Check if we've fetched enough or if there might be more pages
            // arXiv doesn't give a 'next_page' link, so we rely on results count
            if (allResults.length >= totalLimit || entries.length < perPage) {
                break;
            }

            currentOffset += entries.length; // Prepare for the next API call
        }

        return allResults.slice(0, totalLimit);

    } catch (error) {
        console.error('Error fetching or parsing data from arXiv:', error.message);
        if (error.response) {
            console.error('arXiv Error Status:', error.response.status);
            console.error('arXiv Error Data (first 500 chars):', String(error.response.data).substring(0,500));
        } else {
            console.error('arXiv Raw Error:', error);
        }
        return [];
    }
}

/**
 * Transforms a single arXiv entry item (parsed from XML) into MCP format.
 * @param {object} arxivItem - A parsed entry item from the arXiv API.
 * @returns {object} The paper formatted according to MCP.
 */
function transformArxivToMcp(arxivItem) {
    // Helper to get link by attribute (rel or title)
    const findLink = (linksInput, attributeKey, attributeValue) => {
        if (!linksInput) return null;
        // Ensure links is an array, even if there's only one link object from xml2js
        const links = Array.isArray(linksInput) ? linksInput : [linksInput];
        const found = links.find(link => link && link.$ && link.$[attributeKey] === attributeValue);
        return found ? found.$.href : null;
    };

    // Helper to process authors
    const getAuthors = (authorsInput) => {
        if (!authorsInput) return [];
        // Ensure authors is an array
        const authors = Array.isArray(authorsInput) ? authorsInput : [authorsInput];
        return authors.map(auth => ({
            name: auth.name || null,
            affiliation: auth.affiliation || null, // After stripPrefix, 'arxiv:affiliation' becomes 'affiliation'
            orcid: null // arXiv rarely provides ORCID
        }));
    };

    // Helper to process categories (keywords)
    const getCategories = (categoriesInput) => {
        if (!categoriesInput) return [];
        // Ensure categories is an array
        const categories = Array.isArray(categoriesInput) ? categoriesInput : [categoriesInput];
        return categories.map(cat => cat && cat.$ ? cat.$.term : null).filter(Boolean); // Get 'term' attribute
    };

    const publicationDate = arxivItem.published || null;
    const publicationYear = publicationDate ? new Date(publicationDate).getFullYear().toString() : null;
    
    // Process journal_ref if it exists
    let journalDetails = { name: null, volume: null, issue: null, pages: null };
    if (arxivItem.journal_ref) { // After stripPrefix, 'arxiv:journal_ref' becomes 'journal_ref'
        // Basic parsing: assume 'journal_ref' is just the name. More complex parsing needed for vol/issue/pages.
        journalDetails.name = typeof arxivItem.journal_ref === 'string' ? arxivItem.journal_ref : null;
    }


    return {
        source: "arXiv",
        id_from_source: arxivItem.id || null,
        type: "preprint",
        title: typeof arxivItem.title === 'string' ? arxivItem.title.replace(/\s+/g, ' ').trim() : null, // Clean up whitespace
        authors: getAuthors(arxivItem.author),
        publicationDate: publicationDate,
        publicationYear: publicationYear,
        abstract: typeof arxivItem.summary === 'string' ? arxivItem.summary.replace(/\s+/g, ' ').trim() : null, // Clean up whitespace
        url: findLink(arxivItem.link, 'rel', 'alternate') || arxivItem.id || null, // HTML page
        alternate_urls: findLink(arxivItem.link, 'title', 'pdf') ?
            [{ type: "pdf", url: findLink(arxivItem.link, 'title', 'pdf') }] : [],
        citations: 0, // arXiv API doesn't provide this
        keywords: getCategories(arxivItem.primary_category) // Use primary_category, or combine with 'category'
                   .concat(getCategories(arxivItem.category))
                   .filter((v, i, a) => a.indexOf(v) === i), // Deduplicate
        journal_conference_details: journalDetails,
        language: "en", // Default assumption for arXiv
        relevance_score_from_source: null, // Not provided by arXiv
        retrieval_timestamp: new Date().toISOString()
    };
}

// Export the main function
module.exports = {
    searchArxiv
};