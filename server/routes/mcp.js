/**
 * Unified MCP (Model Context Protocol) API Routes
 *
 * Provides a single, efficient MCP system with:
 * 1. Intelligent query processing through specialized agents
 * 2. Automatic agent selection and task routing
 * 3. Multi-agent collaboration when needed
 * 4. Real-time performance monitoring
 * 5. Unified interface for all MCP functionality
 */

const express = require('express');
const router = express.Router();
const MCPOrchestrator = require('../services/mcpOrchestrator');
const AgenticMCPIntegration = require('../services/agenticMCPIntegration');

// Initialize Unified MCP System (singleton)
let mcpOrchestrator = null;
let agenticMCPIntegration = null;

function getMCPOrchestrator() {
    if (!mcpOrchestrator) {
        mcpOrchestrator = new MCPOrchestrator();
        console.log('[Unified MCP] MCP Orchestrator initialized');
    }
    return mcpOrchestrator;
}

function getAgenticMCPIntegration(serviceManager) {
    if (!agenticMCPIntegration && serviceManager) {
        agenticMCPIntegration = new AgenticMCPIntegration(serviceManager);
        console.log('[Unified MCP] Agentic MCP Integration initialized');
    }
    return agenticMCPIntegration;
}

/**
 * Analyze query complexity to determine which MCP system to use
 */
function analyzeQueryComplexity(query) {
    const complexityIndicators = [
        // Multi-step tasks
        /create.*and.*upload/i,
        /generate.*then.*analyze/i,
        /research.*and.*summarize/i,
        /compare.*and.*recommend/i,

        // Document processing
        /process.*document/i,
        /analyze.*file/i,
        /extract.*from.*document/i,

        // Multi-service tasks
        /search.*web.*and/i,
        /upload.*and.*process/i,
        /create.*report/i,
        /comprehensive.*analysis/i,

        // Workflow indicators
        /step.*by.*step/i,
        /workflow/i,
        /pipeline/i,
        /orchestrate/i
    ];

    // Check for complexity indicators
    const hasComplexityIndicators = complexityIndicators.some(pattern => pattern.test(query));

    // Check query length (longer queries tend to be more complex)
    const isLongQuery = query.length > 200;

    // Check for multiple questions or tasks
    const hasMultipleTasks = (query.match(/\?/g) || []).length > 1 ||
                            (query.match(/\band\b/gi) || []).length > 2;

    return hasComplexityIndicators || isLongQuery || hasMultipleTasks;
}

/**
 * POST /api/mcp/process
 * Unified endpoint for intelligent MCP processing
 * Automatically routes to the best agent system based on query complexity
 */
router.post('/process', async (req, res) => {
    try {
        const { query, context = {}, userId, sessionId, mode = 'auto' } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        console.log(`[Unified MCP] Processing query for user ${userId}: "${query.substring(0, 100)}..."`);

        // Enhance context with request metadata
        const enhancedContext = {
            ...context,
            userId: userId,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            requestId: require('uuid').v4(),
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            mode: mode
        };

        let result;

        // Intelligent routing: Use Agentic MCP for complex tasks, regular MCP for simple ones
        const isComplexQuery = analyzeQueryComplexity(query);

        if (mode === 'agentic' || (mode === 'auto' && isComplexQuery)) {
            // Use Agentic MCP for complex tasks
            console.log(`[Unified MCP] Using Agentic MCP for complex query`);
            const agenticMCP = getAgenticMCPIntegration(req.serviceManager);
            if (agenticMCP) {
                result = await agenticMCP.processAgenticTask(query, enhancedContext);
                result.processingMode = 'agentic';
            } else {
                // Fallback to regular MCP
                const orchestrator = getMCPOrchestrator();
                result = await orchestrator.processQuery(query, enhancedContext);
                result.processingMode = 'standard_fallback';
            }
        } else {
            // Use regular MCP for simpler tasks
            console.log(`[Unified MCP] Using standard MCP for query`);
            const orchestrator = getMCPOrchestrator();
            result = await orchestrator.processQuery(query, enhancedContext);
            result.processingMode = 'standard';
        }
        
        // Log successful processing
        if (result.success) {
            console.log(`[Unified MCP] Query processed successfully in ${result.processingTime || 'N/A'}ms using ${result.processingMode} mode`);
        }

        // Ensure result is properly formatted as string
        const responseText = typeof (result.result || result.response) === 'string'
            ? (result.result || result.response)
            : JSON.stringify(result.result || result.response || 'No response received');

        res.json({
            success: result.success,
            data: result.success ? {
                result: responseText,
                analysis: result.analysis,
                processingTime: result.processingTime,
                agentsUsed: result.agentsUsed,
                confidence: result.confidence,
                requestId: enhancedContext.requestId,
                processingMode: result.processingMode
            } : null,
            error: result.success ? null : result.error,
            fallbackSuggestion: result.fallbackSuggestion,
            metadata: {
                timestamp: enhancedContext.timestamp,
                mcpVersion: '3.0.0-unified',
                processingMode: result.processingMode,
                systemLoad: await getSystemLoad()
            }
        });

    } catch (error) {
        console.error('[MCP API] Error processing query:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during MCP processing',
            details: error.message
        });
    }
});

/**
 * GET /api/mcp/status
 * Get current MCP system status and performance metrics
 */
router.get('/status', async (req, res) => {
    try {
        const orchestrator = getMCPOrchestrator();
        
        const status = {
            systemStatus: 'operational',
            agents: await getAgentStatus(orchestrator),
            performance: orchestrator.performanceMetrics,
            systemInfo: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform
            },
            capabilities: await getSystemCapabilities(orchestrator),
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('[MCP API] Error getting status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve MCP system status'
        });
    }
});

/**
 * GET /api/mcp/agents
 * Get detailed information about all available agents
 */
router.get('/agents', async (req, res) => {
    try {
        const orchestrator = getMCPOrchestrator();
        
        const agentDetails = [];
        for (const [agentId, agent] of orchestrator.agents) {
            agentDetails.push({
                id: agent.id,
                name: agent.name,
                specialization: agent.specialization,
                capabilities: agent.capabilities,
                performance: agent.performance,
                status: agent.isActive ? 'active' : 'inactive',
                lastUsed: new Date(agent.lastUsed).toISOString(),
                memorySize: agent.memory.size,
                description: getAgentDescription(agent)
            });
        }

        res.json({
            success: true,
            data: {
                totalAgents: agentDetails.length,
                activeAgents: agentDetails.filter(a => a.status === 'active').length,
                agents: agentDetails
            }
        });

    } catch (error) {
        console.error('[MCP API] Error getting agents:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve agent information'
        });
    }
});

/**
 * POST /api/mcp/analyze
 * Analyze a query without processing it (for debugging/testing)
 */
router.post('/analyze', async (req, res) => {
    try {
        const { query, context = {} } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required for analysis'
            });
        }

        const orchestrator = getMCPOrchestrator();
        const analysis = await orchestrator.analyzeQuery(query, context);

        res.json({
            success: true,
            data: {
                query: query,
                analysis: analysis,
                recommendations: {
                    primaryAgent: analysis.recommendedAgents[0]?.agent || 'No specific agent recommended',
                    estimatedComplexity: analysis.complexity,
                    estimatedTime: `${analysis.estimatedTime}ms`,
                    collaborationNeeded: analysis.needsCollaboration,
                    suggestedApproach: getSuggestedApproach(analysis)
                }
            }
        });

    } catch (error) {
        console.error('[MCP API] Error analyzing query:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze query'
        });
    }
});

/**
 * GET /api/mcp/performance
 * Get detailed performance analytics
 */
router.get('/performance', async (req, res) => {
    try {
        const orchestrator = getMCPOrchestrator();
        const { timeframe = '24h' } = req.query;
        
        const performanceData = {
            overview: orchestrator.performanceMetrics,
            agentPerformance: getAgentPerformanceDetails(orchestrator),
            trends: await getPerformanceTrends(orchestrator, timeframe),
            recommendations: generatePerformanceRecommendations(orchestrator),
            systemHealth: await assessSystemHealth(orchestrator)
        };

        res.json({
            success: true,
            data: performanceData
        });

    } catch (error) {
        console.error('[MCP API] Error getting performance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance data'
        });
    }
});

/**
 * POST /api/mcp/feedback
 * Submit feedback for MCP system learning
 */
router.post('/feedback', async (req, res) => {
    try {
        const { requestId, rating, feedback, userId } = req.body;
        
        if (!requestId || !rating) {
            return res.status(400).json({
                success: false,
                error: 'Request ID and rating are required'
            });
        }

        const orchestrator = getMCPOrchestrator();
        
        // Store feedback for learning
        const feedbackData = {
            requestId: requestId,
            rating: rating,
            feedback: feedback,
            userId: userId,
            timestamp: new Date().toISOString()
        };

        // Emit feedback event for learning system
        orchestrator.emit('userFeedback', feedbackData);

        console.log(`[MCP API] Feedback received for request ${requestId}: ${rating}/5`);

        res.json({
            success: true,
            message: 'Feedback received and will be used to improve the system',
            data: {
                requestId: requestId,
                acknowledged: true
            }
        });

    } catch (error) {
        console.error('[MCP API] Error processing feedback:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process feedback'
        });
    }
});

// Helper functions

async function getSystemLoad() {
    return {
        cpu: process.cpuUsage(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };
}

async function getAgentStatus(orchestrator) {
    const agentStatus = {};
    
    for (const [agentId, agent] of orchestrator.agents) {
        agentStatus[agentId] = {
            name: agent.name,
            active: agent.isActive,
            performance: agent.performance,
            utilization: orchestrator.performanceMetrics.agentUtilization[agentId] || 0
        };
    }
    
    return agentStatus;
}

async function getSystemCapabilities(orchestrator) {
    const allCapabilities = new Set();
    
    for (const [agentId, agent] of orchestrator.agents) {
        agent.capabilities.forEach(cap => allCapabilities.add(cap));
    }
    
    return {
        totalCapabilities: allCapabilities.size,
        capabilities: Array.from(allCapabilities),
        specializations: Array.from(orchestrator.agents.values()).map(a => a.specialization)
    };
}

function getAgentDescription(agent) {
    const descriptions = {
        'research_agent': 'Specialized in research, fact-checking, and information synthesis',
        'coding_agent': 'Expert in code generation, debugging, and software development',
        'academic_agent': 'Focused on education, concept explanation, and learning assistance',
        'creative_agent': 'Specialized in content creation, design thinking, and creative solutions'
    };
    
    return descriptions[agent.id] || 'General-purpose AI agent';
}

function getSuggestedApproach(analysis) {
    if (analysis.needsCollaboration) {
        return 'Multi-agent collaboration recommended for optimal results';
    } else if (analysis.complexity > 0.7) {
        return 'Complex query - may require specialized agent with extended processing time';
    } else {
        return 'Standard single-agent processing should be sufficient';
    }
}

function getAgentPerformanceDetails(orchestrator) {
    const details = {};
    
    for (const [agentId, agent] of orchestrator.agents) {
        details[agentId] = {
            ...agent.performance,
            utilizationRate: orchestrator.performanceMetrics.agentUtilization[agentId] || 0,
            efficiency: calculateAgentEfficiency(agent),
            reliability: calculateAgentReliability(agent)
        };
    }
    
    return details;
}

function calculateAgentEfficiency(agent) {
    // Efficiency based on response time and success rate
    const timeScore = Math.max(0, 1 - (agent.performance.avgResponseTime / 5000)); // 5s baseline
    const successScore = agent.performance.successRate;
    return (timeScore + successScore) / 2;
}

function calculateAgentReliability(agent) {
    // Reliability based on consistency and error rate
    const errorRate = 1 - agent.performance.successRate;
    return Math.max(0, 1 - errorRate);
}

async function getPerformanceTrends(orchestrator, timeframe) {
    // Simplified trend analysis - in production, this would use historical data
    return {
        timeframe: timeframe,
        trend: 'stable',
        improvement: '+5% over last period',
        note: 'Performance trends would be calculated from historical data in production'
    };
}

function generatePerformanceRecommendations(orchestrator) {
    const recommendations = [];
    
    // Analyze agent utilization
    const utilization = orchestrator.performanceMetrics.agentUtilization;
    const avgUtilization = Object.values(utilization).reduce((a, b) => a + b, 0) / Object.keys(utilization).length;
    
    if (avgUtilization > 80) {
        recommendations.push('Consider adding more agent instances to handle high load');
    } else if (avgUtilization < 20) {
        recommendations.push('System is underutilized - consider optimizing resource allocation');
    }
    
    // Analyze response times
    if (orchestrator.performanceMetrics.averageResponseTime > 3000) {
        recommendations.push('Response times are high - consider performance optimization');
    }
    
    return recommendations;
}

async function assessSystemHealth(orchestrator) {
    const health = {
        overall: 'healthy',
        agents: 'operational',
        performance: 'good',
        memory: 'normal'
    };
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
        health.memory = 'high';
        health.overall = 'warning';
    }
    
    // Check agent performance
    const avgSuccessRate = Object.values(orchestrator.performanceMetrics.agentUtilization)
        .reduce((a, b) => a + b, 0) / Object.keys(orchestrator.performanceMetrics.agentUtilization).length;
    
    if (avgSuccessRate < 0.8) {
        health.agents = 'degraded';
        health.overall = 'warning';
    }
    
    return health;
}

module.exports = router;
