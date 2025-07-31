/**
 * Multi-Model API Routes
 * Provides endpoints for interacting with the specialized LLM models
 */

const express = require('express');
const router = express.Router();
const serviceManager = require('../services/serviceManager');
const { auth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiting for multi-model endpoints
const multiModelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many multi-model requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(multiModelLimiter);

/**
 * GET /api/multi-model/status
 * Get the status of the multi-model service
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = await serviceManager.getServiceStatus();
    
    res.json({
      success: true,
      data: {
        enhancedSearchEnabled: status.enhancedSearchEnabled,
        multiModelService: status.multiModelService,
        activeServices: {
          standard: status.activeDeepSearchServices,
          enhanced: status.activeEnhancedServices
        },
        serviceHealth: {
          vectorStore: status.vectorStore,
          geminiAI: status.geminiAI,
          duckDuckGo: status.duckDuckGo
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting multi-model status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

/**
 * POST /api/multi-model/query
 * Process a query using the multi-model system
 */
router.post('/query', auth, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    const userId = req.user.id;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }
    
    if (query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Query is too long (max 1000 characters)'
      });
    }
    
    // Get the appropriate search service
    const searchService = serviceManager.getDeepSearchService(userId);
    
    // Process the query
    const result = await searchService.performSearch(query, options.history || []);
    
    res.json({
      success: true,
      data: {
        response: result.summary,
        sources: result.sources || [],
        metadata: result.metadata || {},
        timestamp: result.timestamp || new Date().toISOString(),
        query: query
      }
    });
    
  } catch (error) {
    console.error('Error processing multi-model query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query'
    });
  }
});

/**
 * POST /api/multi-model/classify
 * Classify a query to determine which subject it belongs to
 */
router.post('/classify', auth, async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.id;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }
    
    // Get the enhanced search service if available
    const searchService = serviceManager.getDeepSearchService(userId);
    
    if (searchService.classifyQuery) {
      const classification = searchService.classifyQuery(query);
      
      res.json({
        success: true,
        data: {
          subject: classification.subject,
          confidence: classification.confidence,
          scores: classification.scores,
          query: query
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          subject: 'general',
          confidence: 0.5,
          scores: {},
          query: query,
          note: 'Enhanced classification not available'
        }
      });
    }
    
  } catch (error) {
    console.error('Error classifying query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to classify query'
    });
  }
});

/**
 * GET /api/multi-model/subjects
 * Get available subjects for specialized models
 */
router.get('/subjects', auth, async (req, res) => {
  try {
    const subjects = [
      {
        id: 'mathematics',
        name: 'Mathematics',
        description: 'Arithmetic, algebra, geometry, calculus, statistics',
        keywords: ['math', 'calculate', 'equation', 'formula', 'solve']
      },
      {
        id: 'programming',
        name: 'Programming',
        description: 'Coding, algorithms, software development',
        keywords: ['code', 'programming', 'function', 'algorithm', 'debug']
      },
      {
        id: 'science',
        name: 'Science',
        description: 'Physics, chemistry, biology, scientific concepts',
        keywords: ['physics', 'chemistry', 'biology', 'experiment', 'theory']
      },
      {
        id: 'history',
        name: 'History',
        description: 'Historical events, dates, civilizations',
        keywords: ['history', 'historical', 'ancient', 'war', 'civilization']
      },
      {
        id: 'literature',
        name: 'Literature',
        description: 'Books, poetry, authors, literary analysis',
        keywords: ['literature', 'poetry', 'novel', 'author', 'character']
      }
    ];
    
    res.json({
      success: true,
      data: subjects
    });
    
  } catch (error) {
    console.error('Error getting subjects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subjects'
    });
  }
});

/**
 * POST /api/multi-model/test
 * Test the multi-model integration (development endpoint)
 */
router.post('/test', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const searchService = serviceManager.getDeepSearchService(userId);
    
    if (searchService.testMultiModelIntegration) {
      const testResults = await searchService.testMultiModelIntegration();
      
      res.json({
        success: true,
        data: {
          testResults,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Test functionality not available in standard search service'
      });
    }
    
  } catch (error) {
    console.error('Error running multi-model test:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run test'
    });
  }
});

/**
 * GET /api/multi-model/health
 * Health check endpoint for monitoring
 */
router.get('/health', async (req, res) => {
  try {
    const status = await serviceManager.getServiceStatus();
    
    const isHealthy = status.vectorStore && 
                     status.geminiAI && 
                     status.duckDuckGo;
    
    const healthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        core: {
          vectorStore: status.vectorStore,
          geminiAI: status.geminiAI,
          duckDuckGo: status.duckDuckGo
        },
        enhanced: {
          enabled: status.enhancedSearchEnabled,
          multiModel: status.multiModelService ? 'available' : 'unavailable'
        }
      },
      metrics: {
        activeStandardServices: status.activeDeepSearchServices,
        activeEnhancedServices: status.activeEnhancedServices
      }
    };
    
    res.status(isHealthy ? 200 : 503).json(healthStatus);
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

module.exports = router;
