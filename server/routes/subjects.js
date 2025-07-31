/**
 * Custom Subjects API Routes
 * Manage custom subjects and model recommendations
 */

const express = require('express');
const router = express.Router();
const CustomSubjectService = require('../services/customSubjectService');

// Initialize service
const subjectService = new CustomSubjectService();

/**
 * GET /api/subjects
 * Get all available subjects
 */
router.get('/', (req, res) => {
    try {
        const subjects = subjectService.getAllSubjects();
        const stats = subjectService.getSubjectStats();
        
        res.json({
            success: true,
            data: {
                subjects: subjects,
                stats: stats
            }
        });
    } catch (error) {
        console.error('Error getting subjects:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve subjects'
        });
    }
});

/**
 * GET /api/subjects/:id
 * Get specific subject details
 */
router.get('/:id', (req, res) => {
    try {
        const subject = subjectService.getSubject(req.params.id);
        
        if (!subject) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }
        
        res.json({
            success: true,
            data: subject
        });
    } catch (error) {
        console.error('Error getting subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve subject'
        });
    }
});

/**
 * POST /api/subjects
 * Create a new custom subject
 */
router.post('/', (req, res) => {
    try {
        const {
            name,
            description,
            keywords,
            modelSize,
            specialization,
            knowledgeBase
        } = req.body;

        if (!name || !description) {
            return res.status(400).json({
                success: false,
                error: 'Name and description are required'
            });
        }

        const userId = req.headers['x-user-id'] || 'anonymous';
        
        const subject = subjectService.createCustomSubject({
            name,
            description,
            keywords: keywords || [],
            modelSize: modelSize || 'medium',
            specialization: specialization || 'general',
            knowledgeBase: knowledgeBase || {},
            userId
        });

        res.status(201).json({
            success: true,
            data: subject,
            message: 'Custom subject created successfully'
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create subject'
        });
    }
});

/**
 * POST /api/subjects/find-best
 * Find the best subject for a query
 */
router.post('/find-best', (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const result = subjectService.findBestSubject(query);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error finding best subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find best subject'
        });
    }
});

/**
 * POST /api/subjects/:id/model-recommendation
 * Get model size recommendation for a subject
 */
router.post('/:id/model-recommendation', (req, res) => {
    try {
        const subjectId = req.params.id;
        const constraints = req.body; // { maxMemory, maxResponseTime, budget }
        
        const recommendation = subjectService.getModelRecommendation(subjectId, constraints);
        
        if (recommendation.error) {
            return res.status(404).json({
                success: false,
                error: recommendation.error
            });
        }
        
        res.json({
            success: true,
            data: recommendation
        });
    } catch (error) {
        console.error('Error getting model recommendation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model recommendation'
        });
    }
});

/**
 * GET /api/subjects/specialization/:type
 * Get subjects by specialization
 */
router.get('/specialization/:type', (req, res) => {
    try {
        const subjects = subjectService.getSubjectsBySpecialization(req.params.type);
        
        res.json({
            success: true,
            data: subjects
        });
    } catch (error) {
        console.error('Error getting subjects by specialization:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve subjects'
        });
    }
});

/**
 * GET /api/subjects/:id/export
 * Export subject configuration
 */
router.get('/:id/export', (req, res) => {
    try {
        const config = subjectService.exportSubjectConfig(req.params.id);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error exporting subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export subject'
        });
    }
});

/**
 * POST /api/subjects/import
 * Import subject configuration
 */
router.post('/import', (req, res) => {
    try {
        const result = subjectService.importSubjectConfig(req.body);
        
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            data: result.subject,
            message: 'Subject imported successfully'
        });
    } catch (error) {
        console.error('Error importing subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import subject'
        });
    }
});

/**
 * GET /api/subjects/model-configs/all
 * Get all model configuration options
 */
router.get('/model-configs/all', (req, res) => {
    try {
        const configs = Array.from(subjectService.modelConfigs.entries()).map(([size, config]) => ({
            size,
            ...config
        }));
        
        res.json({
            success: true,
            data: configs
        });
    } catch (error) {
        console.error('Error getting model configs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve model configurations'
        });
    }
});

module.exports = router;
