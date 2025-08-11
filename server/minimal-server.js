#!/usr/bin/env node
/**
 * Minimal Server for Testing Multi-Model LLM System
 * Starts a basic server with multi-model functionality
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('Starting Minimal Multi-Model Server...');

const app = express();
const PORT = process.env.PORT || 5007;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Multi-Model LLM Server is running!',
        timestamp: new Date().toISOString(),
        features: {
            multiModel: true,
            classification: true,
            monitoring: true
        }
    });
});

// Test multi-model classification
app.post('/api/multi-model/classify', (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Use the enhanced classification service
        const EnhancedDeepSearchService = require('./services/enhancedDeepSearchService');
        const service = new EnhancedDeepSearchService('test-user', {}, {});
        const result = service.classifyQuery(query);

        res.json({
            success: true,
            data: {
                query,
                subject: result.subject,
                confidence: result.confidence,
                scores: result.scores,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({
            success: false,
            error: 'Classification failed',
            details: error.message
        });
    }
});

// Test multi-model query processing
app.post('/api/multi-model/query', (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        // Classify the query first
        const EnhancedDeepSearchService = require('./services/enhancedDeepSearchService');
        const service = new EnhancedDeepSearchService('test-user', {}, {});
        const classification = service.classifyQuery(query);

        // Generate a response based on classification
        let response;
        switch (classification.subject) {
            case 'mathematics':
                response = `I understand this is a mathematics question: "${query}". This would be processed by our specialized mathematics model for accurate calculations and explanations.`;
                break;
            case 'programming':
                response = `I see this is a programming question: "${query}". This would be handled by our specialized programming model for code examples and technical explanations.`;
                break;
            case 'science':
                response = `This appears to be a science question: "${query}". Our specialized science model would provide detailed scientific explanations and concepts.`;
                break;
            case 'history':
                response = `I recognize this as a history question: "${query}". Our history model would provide accurate historical information and context.`;
                break;
            case 'literature':
                response = `This looks like a literature question: "${query}". Our literature model would analyze themes, authors, and literary devices.`;
                break;
            default:
                response = `I understand your question: "${query}". This would be processed by our general model for comprehensive assistance.`;
        }

        res.json({
            success: true,
            data: {
                query,
                response,
                classification: {
                    subject: classification.subject,
                    confidence: classification.confidence
                },
                metadata: {
                    model_used: classification.subject,
                    processing_time: Math.random() * 100 + 50, // Simulated
                    timestamp: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('Query processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Query processing failed',
            details: error.message
        });
    }
});

// Get available subjects
app.get('/api/multi-model/subjects', (req, res) => {
    const subjects = [
        {
            id: 'mathematics',
            name: 'Mathematics',
            description: 'Arithmetic, algebra, geometry, calculus, statistics',
            keywords: ['math', 'calculate', 'equation', 'solve']
        },
        {
            id: 'programming',
            name: 'Programming',
            description: 'Coding, algorithms, software development',
            keywords: ['code', 'function', 'program', 'python']
        },
        {
            id: 'science',
            name: 'Science',
            description: 'Physics, chemistry, biology, scientific concepts',
            keywords: ['science', 'experiment', 'theory', 'photosynthesis']
        },
        {
            id: 'history',
            name: 'History',
            description: 'Historical events, dates, civilizations',
            keywords: ['history', 'war', 'ancient', 'civilization']
        },
        {
            id: 'literature',
            name: 'Literature',
            description: 'Books, poetry, authors, literary analysis',
            keywords: ['literature', 'book', 'author', 'poem']
        }
    ];

    res.json({
        success: true,
        data: subjects
    });
});

// Basic monitoring endpoint
app.get('/api/monitoring/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString(),
            features: {
                classification: true,
                multiModel: true,
                monitoring: true
            }
        }
    });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\nMulti-Model LLM Server Started Successfully!');
    console.log('==========================================');
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Classification: POST http://localhost:${PORT}/api/multi-model/classify`);
    console.log(`Query processing: POST http://localhost:${PORT}/api/multi-model/query`);
    console.log(`Monitoring: http://localhost:${PORT}/api/monitoring/health`);
    console.log('==========================================\n');

    console.log('Features Available:');
    console.log('  - Multi-Model Query Classification');
    console.log('  - Subject-Specific Processing');
    console.log('  - Pattern Recognition (Math expressions, Code syntax)');
    console.log('  - Performance Monitoring');
    console.log('  - RESTful API Endpoints');
    console.log('\nReady to handle intelligent queries!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Starting graceful shutdown...');
    server.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Starting graceful shutdown...');
    server.close(() => {
        console.log('Server closed successfully');
        process.exit(0);
    });
});

module.exports = app;
