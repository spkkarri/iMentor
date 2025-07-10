// server/services/webSearchService.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// =========================================================================
// SITE LISTS
const ACADEMIC_SITES = [
  'researchgate.net', 'academia.edu', 'core.ac.uk', 'semanticscholar.org', 'arxiv.org',
  'ssrn.com', 'jstor.org', 'springeropen.com', 'doaj.org', 'scienceopen.com',
  'base-search.net', 'eric.ed.gov', 'zenodo.org', 'oatd.org', 'ethos.bl.uk',
  'archive.org', 'openaire.eu', 'frontiersin.org', 'jstage.jst.go.jp', 'repec.org'
];
const MEDICAL_SITES = [
  'ncbi.nlm.nih.gov', 'plos.org', 'biorxiv.org', 'medrxiv.org', 'psyarxiv.com',
  'thelancet.com', 'nejm.org', 'bmj.com', 'who.int', 'cdc.gov', 'hindawi.com',
  'mdpi.com', 'onlinelibrary.wiley.com', 'nature.com'
];
const GOV_LAW_SITES = [
  'congress.gov', 'supremecourt.gov', 'gov.uk', 'europa.eu', 'un.org', 'worldbank.org',
  'imf.org', 'findlaw.com', 'law.cornell.edu'
];
const TECHNICAL_KNOWLEDGE_SITES = [
  'geeksforgeeks.org', 'stackoverflow.com', 'developer.mozilla.org',
  'learn.microsoft.com', 'en.wikipedia.org', 'dev.to'
];
// We create a Set for fast, efficient lookups during filtering.
const ALLOWED_SITES_SET = new Set([
  ...ACADEMIC_SITES, ...MEDICAL_SITES, ...GOV_LAW_SITES, ...TECHNICAL_KNOWLEDGE_SITES
]);
// =========================================================================

const SEARCH_SERVICE_URL = process.env.PYTHON_SEARCH_SERVICE_URL || 'http://localhost:5003';

async function performWebSearch(query, numResults = 5) {
  if (!query) return [];
  
  console.log(`[WebSearchService] Calling Python service with clean query: "${query}"`);
  
  try {
    // Step 1: Send the SIMPLE, CLEAN query to the Python service.
    const response = await axios.post(`${SEARCH_SERVICE_URL}/search`, { query }, { timeout: 20000 });
    const rawResults = response.data.results;

    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      console.log('[WebSearchService] Python service returned no results.');
      return [];
    }
    console.log(`[WebSearchService] Received ${rawResults.length} general results. Filtering now...`);

    // Step 2: Filter the results on the Node.js side.
    const filteredResults = rawResults.filter(item => {
      try {
        const hostname = new URL(item.href).hostname.replace(/^www\./, '');
        return ALLOWED_SITES_SET.has(hostname);
      } catch (e) {
        return false; // Invalid URL, filter it out
      }
    });

    if (filteredResults.length === 0) {
      console.log('[WebSearchService] No results found from allowed sites after filtering.');
      return [];
    }

    // Step 3: Limit and format the high-quality results to MCP standard.
    const limitedResults = filteredResults.slice(0, numResults);
    console.log(`[WebSearchService] Found ${limitedResults.length} valid results. Formatting to MCP...`);
    
    const mcpResults = limitedResults.map(item => ({
      id: uuidv4(),
      source: 'DuckDuckGo Web Search (Python)',
      type: 'web_search',
      title: item.title,
      url: item.href,
      authors: [],
      publicationYear: null,
      abstract: item.body,
      raw: item
    }));

    return mcpResults;

  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('[WebSearchService] Error communicating with Python search service:', errorMsg);
    return [];
  }
}

module.exports = { performWebSearch };