// academicSearchService.js

const openAlexService = require('./openAlexService'); // Adjust path as needed
const coreService = require('./coreService');         // Adjust path as needed
const arxivService = require('./arxivService');       // Adjust path as needed

// Helper function to normalize titles for de-duplication
function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
}

async function searchAcademicSources(userQuery, options = {}) {
    console.log(`Orchestrator: Searching for "${userQuery}"`);

    const {
        sortBy = 'relevance', // 'relevance', 'year', 'citations'
        sortOrder = 'desc',   // 'asc', 'desc'
        limit = 10,           // Max results to return to LLM
        // You can pass through other options to individual services if needed
        // e.g., year_filter_start, year_filter_end, etc.
        openAlexOptions = {},
        coreOptions = {},
        arxivOptions = {}
    } = options;

    try {
        // 1. Call all services in parallel
        const [openAlexResults, coreResults, arxivResults] = await Promise.all([
            openAlexService.searchOpenAlex(userQuery, openAlexOptions).catch(err => {
                console.error("Error fetching from OpenAlex:", err.message);
                return []; // Return empty array on error to not break Promise.all
            }),
            coreService.searchCore(userQuery, coreOptions).catch(err => {
                console.error("Error fetching from CORE:", err.message);
                return [];
            }),
            arxivService.searchArxiv(userQuery, arxivOptions).catch(err => {
                console.error("Error fetching from arXiv:", err.message);
                return [];
            })
        ]);

        console.log(`Fetched ${openAlexResults.length} from OpenAlex, ${coreResults.length} from CORE, ${arxivResults.length} from arXiv.`);

        // 2. Collect all MCP-formatted results into a single array
        let allResults = [...openAlexResults, ...coreResults, ...arxivResults];
        console.log(`Total results before de-duplication: ${allResults.length}`);

        // 3. De-duplicate results
        const uniqueResults = [];
        const seenDois = new Set();
        const seenNormalizedTitles = new Set();

        for (const result of allResults) {
            const doi = result.url && result.url.startsWith('https://doi.org/') ? result.url : null;
            console.log(`Checking: "${result.title.substring(0,30)}...", DOI: ${doi}, Source: ${result.source}`); // LOG 1

            if (doi) {
                if (!seenDois.has(doi)) {
                    uniqueResults.push(result);
                    seenDois.add(doi);
                    console.log(`  ADDED by DOI: ${doi}`); // LOG 2
                } else {
                    console.log(`  DUPLICATE by DOI: ${doi} (Original title: "${result.title.substring(0,30)}...")`); // LOG 3
                }
            } else {
                const normalizedTitle = normalizeTitle(result.title);
                if (normalizedTitle && !seenNormalizedTitles.has(normalizedTitle)) {
                    uniqueResults.push(result);
                    seenNormalizedTitles.add(normalizedTitle);
                    console.log(`  ADDED by Title: "${normalizedTitle}"`);// LOG 4
                } else if (normalizedTitle) {
                    console.log(`  DUPLICATE by Title: "${normalizedTitle}" (Original title: "${result.title.substring(0,30)}...")`); // LOG 5
                } else {
                    console.log(`  SKIPPED (no DOI, no valid normalized title): "${result.title.substring(0,30)}..."`); // LOG 6
                }
            }
    }
        console.log(`Total results after de-duplication: ${uniqueResults.length}`);


        // 4. Sort the combined, de-duplicated results
        // Ensure publicationYear is a string for consistent comparison if some are numbers
        uniqueResults.forEach(item => {
            if (typeof item.publicationYear !== 'string') {
                item.publicationYear = String(item.publicationYear);
            }
            // Ensure citations is a number
            item.citations = Number(item.citations) || 0;
        });
        
        uniqueResults.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'year') {
                comparison = (b.publicationYear || '0').localeCompare(a.publicationYear || '0'); // Newer first
            } else if (sortBy === 'citations') {
                comparison = (b.citations || 0) - (a.citations || 0); // More citations first
            } else if (sortBy === 'relevance') {
                // Relevance is tricky as scores come from different sources and might not be comparable.
                // If your MCP items have `relevance_score_from_source`, you might try to use it.
                // For now, let's prioritize OpenAlex scores if available, then CORE, then arXiv (which usually doesn't have one).
                // This is a placeholder for more sophisticated relevance handling.
                // A simple fallback if no scores: sort by year.
                const scoreA = a.source === 'OpenAlex' && a.relevance_score_from_source ? a.relevance_score_from_source : (a.source === 'CORE' && a.relevance_score_from_source ? a.relevance_score_from_source * 0.8 : 0); // Example: Weighting scores
                const scoreB = b.source === 'OpenAlex' && b.relevance_score_from_source ? b.relevance_score_from_source : (b.source === 'CORE' && b.relevance_score_from_source ? b.relevance_score_from_source * 0.8 : 0);
                comparison = scoreB - scoreA;
                if (comparison === 0) { // Fallback to year if relevance is same or not present
                    comparison = (b.publicationYear || '0').localeCompare(a.publicationYear || '0');
                }
            }

            return sortOrder === 'asc' ? comparison * -1 : comparison;
        });
        console.log(`Sorted results. First item after sort:`, uniqueResults.length > 0 ? uniqueResults[0].title : 'N/A');

        // 5. Limit the number of results
        const limitedResults = uniqueResults.slice(0, limit);
        console.log(`Returning ${limitedResults.length} results to LLM.`);

        return limitedResults;

    } catch (error) {
        console.error("Error in academicSearchService:", error);
        return []; // Return empty array on major orchestrator failure
    }
}

module.exports = {
    searchAcademicSources
};


  

