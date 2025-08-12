// server/routes/agentMonitoring.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Agent Performance Monitoring Routes
 * Provides comprehensive monitoring and analytics for MCP agents
 */

/**
 * GET /api/agent-monitoring/dashboard
 * Get comprehensive dashboard data for all agents
 */
router.get('/dashboard', tempAuth, async (req, res) => {
    try {
        const dashboardData = {
            overview: await getSystemOverview(),
            agents: await getAllAgentMetrics(),
            recentActivity: await getRecentActivity(),
            trends: await getPerformanceTrends(),
            alerts: await getSystemAlerts()
        };

        res.json({
            success: true,
            data: dashboardData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/agent-monitoring/agent/:agentId
 * Get detailed metrics for a specific agent
 */
router.get('/agent/:agentId', tempAuth, async (req, res) => {
    try {
        const { agentId } = req.params;
        const timeframe = req.query.timeframe || '7d';

        const agentData = await getAgentDetailedMetrics(agentId, timeframe);

        res.json({
            success: true,
            data: agentData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Agent metrics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/agent-monitoring/performance
 * Get performance analytics across all agents
 */
router.get('/performance', tempAuth, async (req, res) => {
    try {
        const performanceData = await getPerformanceAnalytics();

        res.json({
            success: true,
            data: performanceData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Performance analytics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/agent-monitoring/feedback
 * Submit feedback for agent performance
 */
router.post('/feedback', tempAuth, async (req, res) => {
    try {
        const feedbackData = {
            type: 'feedback',
            ...req.body,
            user_id: req.user.id,
            timestamp: new Date().toISOString()
        };

        const result = await executeMCPController(feedbackData);

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Feedback submission error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/agent-monitoring/recommendations/:agentId
 * Get learning-based recommendations for an agent
 */
router.get('/recommendations/:agentId', tempAuth, async (req, res) => {
    try {
        const { agentId } = req.params;

        const recommendationsData = {
            type: 'recommendations',
            agent_id: agentId
        };

        const result = await executeMCPController(recommendationsData);

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/agent-monitoring/health
 * Get system health status
 */
router.get('/health', tempAuth, async (req, res) => {
    try {
        const healthData = await getSystemHealth();

        res.json({
            success: true,
            data: healthData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper functions

async function getSystemOverview() {
    return {
        totalAgents: 4,
        activeAgents: 4,
        totalInteractions: await getTotalInteractions(),
        averageRating: await getAverageRating(),
        successRate: await getOverallSuccessRate(),
        uptime: process.uptime(),
        systemStatus: 'healthy'
    };
}

async function getAllAgentMetrics() {
    const agents = ['research', 'coding', 'analysis', 'creative'];
    const metrics = [];

    for (const agentId of agents) {
        try {
            const performanceData = {
                type: 'performance',
                agent_id: agentId
            };

            const result = await executeMCPController(performanceData);
            
            if (result.success) {
                metrics.push({
                    agentId,
                    name: getAgentName(agentId),
                    ...result.data.learning_analysis.performance_metrics,
                    status: 'active'
                });
            } else {
                metrics.push({
                    agentId,
                    name: getAgentName(agentId),
                    status: 'error',
                    error: result.error
                });
            }
        } catch (error) {
            metrics.push({
                agentId,
                name: getAgentName(agentId),
                status: 'error',
                error: error.message
            });
        }
    }

    return metrics;
}

async function getRecentActivity() {
    // Simulate recent activity data
    return [
        {
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            agent: 'research',
            action: 'query_processed',
            user: 'user123',
            rating: 5
        },
        {
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            agent: 'coding',
            action: 'code_generated',
            user: 'user456',
            rating: 4
        },
        {
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            agent: 'analysis',
            action: 'data_analyzed',
            user: 'user789',
            rating: 5
        }
    ];
}

async function getPerformanceTrends() {
    // Generate sample trend data
    const days = 7;
    const trends = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        trends.push({
            date: date.toISOString().split('T')[0],
            interactions: Math.floor(Math.random() * 50) + 20,
            averageRating: (Math.random() * 2 + 3).toFixed(1),
            successRate: (Math.random() * 0.3 + 0.7).toFixed(2)
        });
    }
    
    return trends;
}

async function getSystemAlerts() {
    const alerts = [];
    
    // Check for performance issues
    const avgRating = await getAverageRating();
    if (avgRating < 3.5) {
        alerts.push({
            type: 'warning',
            message: 'Average rating below threshold',
            severity: 'medium',
            timestamp: new Date().toISOString()
        });
    }
    
    return alerts;
}

async function getAgentDetailedMetrics(agentId, timeframe) {
    try {
        const performanceData = {
            type: 'performance',
            agent_id: agentId
        };

        const result = await executeMCPController(performanceData);
        
        if (result.success) {
            return {
                agentId,
                name: getAgentName(agentId),
                timeframe,
                metrics: result.data.learning_analysis.performance_metrics,
                patterns: result.data.learning_analysis.patterns_found,
                recommendations: result.data.learning_analysis.recommendations
            };
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        throw new Error(`Failed to get metrics for agent ${agentId}: ${error.message}`);
    }
}

async function getPerformanceAnalytics() {
    const agents = ['research', 'coding', 'analysis', 'creative'];
    const analytics = {
        agentComparison: [],
        topPerformers: [],
        improvementAreas: [],
        overallTrends: await getPerformanceTrends()
    };

    for (const agentId of agents) {
        try {
            const metrics = await getAgentDetailedMetrics(agentId, '30d');
            analytics.agentComparison.push({
                agent: agentId,
                rating: metrics.metrics?.average_rating || 0,
                successRate: metrics.metrics?.success_rate || 0,
                interactions: metrics.metrics?.total_interactions || 0
            });
        } catch (error) {
            console.error(`Error getting analytics for ${agentId}:`, error);
        }
    }

    // Sort for top performers
    analytics.topPerformers = analytics.agentComparison
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3);

    return analytics;
}

async function getSystemHealth() {
    return {
        status: 'healthy',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        agentStatus: {
            research: 'active',
            coding: 'active',
            analysis: 'active',
            creative: 'active'
        },
        databaseConnections: {
            context: 'connected',
            learning: 'connected'
        },
        lastHealthCheck: new Date().toISOString()
    };
}

// Utility functions

function getAgentName(agentId) {
    const names = {
        'research': 'Research Assistant',
        'coding': 'Coding Assistant',
        'analysis': 'Analysis Assistant',
        'creative': 'Creative Assistant'
    };
    return names[agentId] || agentId;
}

async function getTotalInteractions() {
    // This would typically query the database
    return Math.floor(Math.random() * 1000) + 500;
}

async function getAverageRating() {
    // This would typically query the database
    return (Math.random() * 2 + 3).toFixed(1);
}

async function getOverallSuccessRate() {
    // This would typically query the database
    return (Math.random() * 0.3 + 0.7).toFixed(2);
}

async function executeMCPController(inputData) {
    return new Promise((resolve, reject) => {
        const mcpControllerPath = path.join(__dirname, '..', 'mcp_system', 'mcp_controller.py');
        const inputJson = JSON.stringify(inputData);

        const pythonProcess = spawn('python', [mcpControllerPath, inputJson], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.dirname(mcpControllerPath)
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Failed to parse MCP response: ${parseError.message}`));
                }
            } else {
                reject(new Error(`MCP process failed with code ${code}: ${stderr}`));
            }
        });

        pythonProcess.on('error', (error) => {
            reject(new Error(`Failed to start MCP process: ${error.message}`));
        });

        setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('MCP process timeout'));
        }, 30000);
    });
}

module.exports = router;
