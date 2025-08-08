// server/routes/testResearch.js
// Test endpoint for Advanced Deep Research functionality

const express = require('express');
const router = express.Router();
const AdvancedDeepResearch = require('../services/advancedDeepResearch');

// Test endpoint for advanced deep research
router.post('/test-research', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Query is required',
                example: 'POST /api/test-research with body: { "query": "What is artificial intelligence?" }'
            });
        }

        console.log(`🧪 Testing Advanced Deep Research for: "${query}"`);
        
        const researchEngine = new AdvancedDeepResearch();
        const result = await researchEngine.conductDeepResearch(query, []);
        
        res.json({
            success: true,
            query: query,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('🚫 Test research failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get research system status
router.get('/research-status', async (req, res) => {
    try {
        const researchEngine = new AdvancedDeepResearch();
        await researchEngine.initialize();
        
        res.json({
            status: 'operational',
            initialized: researchEngine.isInitialized,
            features: {
                queryAnalysis: true,
                researchPlanning: true,
                informationRetrieval: true,
                crossVerification: true,
                answerSynthesis: true,
                outputFormatting: true
            },
            stages: [
                'Understand & Break Down',
                'Plan the Research', 
                'Retrieve Information',
                'Cross-Verify',
                'Synthesize Answer',
                'Format Output'
            ],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
