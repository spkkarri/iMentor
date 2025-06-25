// server/deep_search/routes/aiSearch.js
// AI-powered search routes with query decomposition and result synthesis

const express = require('express');
const router = express.Router();
const DuckDuckGoService = require('../utils/duckduckgo');
const geminiService = require('./geminiServiceDS');

// Initialize services
const duckDuckGoService = new DuckDuckGoService();

/**
 * AI Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const geminiHealth = await geminiService.healthCheck();
    
    res.json({
      status: geminiHealth.status === 'healthy' ? 'OK' : 'DEGRADED',
      ai: geminiHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Main AI search endpoint
 */
router.post('/', async (req, res) => {
  try {
    const { query: userQuery, options = {} } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    const trimmedQuery = userQuery.trim();
    console.log(`🤖 AI Search request: "${trimmedQuery}"`);

    // Step 1: Decompose the query
    console.log('🔄 Step 1: Decomposing query...');
    const step1Start = Date.now();
    const decomposition = await geminiService.decomposeQuery(trimmedQuery);
    const step1Time = Date.now() - step1Start;
    console.log('✅ Query decomposed:', decomposition.coreQuestion);

    // Step 2: Execute searches based on decomposition
    console.log('🔄 Step 2: Executing searches...');
    const step2Start = Date.now();
    const searchResults = [];

    // Limit to maximum 2 searches to avoid rate limiting
    const limitedQueries = decomposition.searchQueries.slice(0, 2);

    for (let i = 0; i < limitedQueries.length; i++) {
      const searchQuery = limitedQueries[i];
      console.log(`  🔍 Search ${i + 1}: "${searchQuery}"`);

      try {
        // Add delay between searches to avoid rate limiting
        if (i > 0) {
          console.log(`⏳ Waiting 3 seconds before next search...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const results = await duckDuckGoService.performSearch(searchQuery, 'text', options);
        searchResults.push({
          query: searchQuery,
          results: results.results || [],
          success: !results.error && !results.rateLimited,
          error: results.error || null,
          rateLimited: results.rateLimited || false
        });

        // If we got good results, we can stop to avoid rate limiting
        if (results.results && results.results.length > 3) {
          console.log(`✅ Got sufficient results (${results.results.length}), stopping to avoid rate limiting`);
          break;
        }

      } catch (error) {
        console.error(`❌ Search failed for "${searchQuery}":`, error.message);
        searchResults.push({
          query: searchQuery,
          results: [],
          success: false,
          error: error.message,
          rateLimited: false
        });
      }
    }

    const step2Time = Date.now() - step2Start;
    console.log(`✅ Searches completed in ${step2Time}ms`);

    // Combine all search results
    const allResults = searchResults.flatMap(sr => sr.results);
    console.log(`📊 Total results collected: ${allResults.length}`);

    // Step 3: Synthesize results with AI
    console.log('🔄 Step 3: Synthesizing results...');
    const step3Start = Date.now();
    
    let synthesis;
    if (allResults.length > 0) {
      synthesis = await geminiService.synthesizeResults(trimmedQuery, allResults, decomposition);
    } else {
      synthesis = {
        answer: `I couldn't find sufficient search results for "${trimmedQuery}". This might be due to rate limiting or the query being too specific. Please try rephrasing your question or try again later.`,
        sources: [],
        aiGenerated: false,
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }
    
    const step3Time = Date.now() - step3Start;
    console.log(`✅ Synthesis completed in ${step3Time}ms`);

    // Prepare response
    const response = {
      query: trimmedQuery,
      decomposition,
      searchResults: searchResults.map(sr => ({
        query: sr.query,
        resultCount: sr.results.length,
        success: sr.success,
        ...(sr.error && { error: sr.error }),
        ...(sr.rateLimited && { rateLimited: true })
      })),
      synthesis,
      metadata: {
        totalResults: allResults.length,
        processingTime: {
          decomposition: step1Time,
          search: step2Time,
          synthesis: step3Time,
          total: Date.now() - step1Start
        },
        aiEnabled: geminiService.isEnabled(),
        timestamp: new Date().toISOString()
      }
    };

    console.log(`🎉 AI Search completed in ${response.metadata.processingTime.total}ms`);
    res.json(response);

  } catch (error) {
    console.error('AI Search error:', error);
    res.status(500).json({
      error: 'AI search failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Simple search endpoint (fallback without AI)
 */
router.get('/simple', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter "q" is required'
      });
    }

    console.log(`🔍 Simple AI search request: "${query}"`);

    // Perform basic search
    const results = await duckDuckGoService.performSearch(query, 'text', {});
    
    // Basic synthesis without heavy AI processing
    const synthesis = await geminiService.synthesizeResults(query, results.results || [], {
      coreQuestion: query,
      searchQueries: [query],
      context: '',
      expectedResultTypes: ['information']
    });

    const response = {
      query: query,
      results: results.results || [],
      total: results.total || 0,
      synthesis,
      searchEngine: 'DuckDuckGo',
      aiEnabled: geminiService.isEnabled(),
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('Simple AI search error:', error);
    res.status(500).json({
      error: 'Simple AI search failed',
      message: error.message
    });
  }
});

/**
 * Query decomposition endpoint (for testing)
 */
router.post('/decompose', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const decomposition = await geminiService.decomposeQuery(query);
    
    res.json({
      originalQuery: query,
      decomposition,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Query decomposition error:', error);
    res.status(500).json({
      error: 'Query decomposition failed',
      message: error.message
    });
  }
});

/**
 * Result synthesis endpoint (for testing)
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { query, results, decomposition } = req.body;

    if (!query || !results) {
      return res.status(400).json({
        error: 'Query and results are required'
      });
    }

    const synthesis = await geminiService.synthesizeResults(
      query, 
      results, 
      decomposition || { coreQuestion: query }
    );
    
    res.json({
      query,
      synthesis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Result synthesis error:', error);
    res.status(500).json({
      error: 'Result synthesis failed',
      message: error.message
    });
  }
});

module.exports = router;
