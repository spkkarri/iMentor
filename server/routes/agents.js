// server/routes/agents.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * MCP (Model Context Protocol) Agent Routes
 * Handles communication with Python-based AI agents
 */

// Agent status tracking
let agentStatus = {
    available: false,
    lastCheck: null,
    error: null,
    agents: []
};

/**
 * Check if MCP system is available
 */
async function checkMCPAvailability() {
    try {
        const mcpControllerPath = path.join(__dirname, '..', 'mcp_system', 'mcp_controller.py');
        await fs.access(mcpControllerPath);
        
        agentStatus.available = true;
        agentStatus.lastCheck = new Date();
        agentStatus.error = null;
        agentStatus.agents = [
            { id: 'research', name: 'Research Assistant', status: 'active' },
            { id: 'coding', name: 'Coding Assistant', status: 'active' },
            { id: 'analysis', name: 'Analysis Assistant', status: 'active' },
            { id: 'creative', name: 'Creative Assistant', status: 'active' }
        ];
        
        return true;
    } catch (error) {
        agentStatus.available = false;
        agentStatus.error = error.message;
        agentStatus.lastCheck = new Date();
        return false;
    }
}

/**
 * Execute MCP Python controller
 */
async function executeMCPController(inputData) {
    return new Promise((resolve, reject) => {
        const mcpControllerPath = path.join(__dirname, '..', 'mcp_system', 'mcp_controller.py');
        const inputJson = JSON.stringify(inputData);
        
        // Spawn Python process
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
        
        // Set timeout for long-running processes
        setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('MCP process timeout'));
        }, 30000); // 30 second timeout
    });
}

/**
 * POST /api/agents/search
 * Main MCP agent search endpoint
 */
router.post('/search', tempAuth, async (req, res) => {
    try {
        const { input, history = [], sessionId, systemPrompt } = req.body;
        const userId = req.user.id;
        
        console.log(`🤖 MCP Agent search request from user ${userId}: "${input}"`);
        
        if (!input || input.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Input query is required'
            });
        }
        
        // Check MCP availability
        const isAvailable = await checkMCPAvailability();
        if (!isAvailable) {
            return res.status(503).json({
                success: false,
                error: 'MCP system is not available',
                fallback: true,
                data: {
                    response: "🤖 **MCP Agents Unavailable**\n\nThe AI agent system is currently unavailable. Please try using the standard chat or deep search features.",
                    agent_used: "fallback",
                    metadata: {
                        agent_type: "fallback",
                        error: agentStatus.error
                    }
                }
            });
        }
        
        // Prepare input for MCP controller
        const mcpInput = {
            input: input.trim(),
            sessionId: sessionId || 'default',
            userId: userId,
            history: history.map(msg => ({
                role: msg.role || 'user',
                content: msg.parts?.[0]?.text || msg.content || msg.message || '',
                timestamp: msg.timestamp || new Date().toISOString()
            })),
            systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
            timestamp: new Date().toISOString()
        };
        
        // Execute MCP controller
        const mcpResult = await executeMCPController(mcpInput);
        
        if (mcpResult.success) {
            console.log(`✅ MCP Agent response generated by ${mcpResult.data.agent_used}`);
            
            res.json({
                success: true,
                data: {
                    response: mcpResult.data.response,
                    agent_used: mcpResult.data.agent_used,
                    agent_id: mcpResult.data.agent_id,
                    metadata: {
                        ...mcpResult.data.metadata,
                        searchType: 'mcp_agent',
                        enhanced: true,
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } else {
            console.error('MCP Agent error:', mcpResult.error);
            
            res.status(500).json({
                success: false,
                error: mcpResult.error,
                data: {
                    response: "🤖 **MCP Agent Error**\n\nI encountered an issue processing your request. Please try again or use the standard chat features.",
                    agent_used: "error_handler",
                    metadata: {
                        agent_type: "error",
                        error: mcpResult.error
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('MCP route error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            data: {
                response: "🤖 **MCP System Error**\n\nThe agent system encountered an unexpected error. Please try again later.",
                agent_used: "error_handler",
                metadata: {
                    agent_type: "error",
                    error: error.message
                }
            }
        });
    }
});

/**
 * GET /api/agents/status
 * Get MCP system status and available agents
 */
router.get('/status', tempAuth, async (req, res) => {
    try {
        await checkMCPAvailability();
        
        res.json({
            success: true,
            data: {
                available: agentStatus.available,
                lastCheck: agentStatus.lastCheck,
                error: agentStatus.error,
                agents: agentStatus.agents,
                system: {
                    python_available: true, // We assume Python is available
                    controller_path: path.join(__dirname, '..', 'mcp_system', 'mcp_controller.py')
                }
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/agents/test
 * Test MCP system functionality
 */
router.post('/test', tempAuth, async (req, res) => {
    try {
        const testInput = {
            input: "Hello, this is a test query for the MCP system.",
            sessionId: "test_session",
            userId: req.user.id,
            history: [],
            systemPrompt: "You are a test assistant."
        };
        
        const result = await executeMCPController(testInput);
        
        res.json({
            success: true,
            data: {
                test_result: result,
                system_status: agentStatus,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            system_status: agentStatus
        });
    }
});

/**
 * GET /api/agents/list
 * Get list of available agents and their capabilities
 */
router.get('/list', tempAuth, async (req, res) => {
    try {
        const agents = [
            {
                id: 'research',
                name: 'Research Assistant',
                description: 'Specialized in research, fact-checking, and information synthesis',
                capabilities: ['web_search', 'fact_checking', 'source_analysis', 'synthesis'],
                status: agentStatus.available ? 'active' : 'inactive'
            },
            {
                id: 'coding',
                name: 'Coding Assistant',
                description: 'Specialized in programming, code analysis, and technical problem solving',
                capabilities: ['code_generation', 'code_review', 'debugging', 'architecture'],
                status: agentStatus.available ? 'active' : 'inactive'
            },
            {
                id: 'analysis',
                name: 'Analysis Assistant',
                description: 'Specialized in data analysis, pattern recognition, and insights generation',
                capabilities: ['data_analysis', 'pattern_recognition', 'statistical_analysis', 'visualization'],
                status: agentStatus.available ? 'active' : 'inactive'
            },
            {
                id: 'creative',
                name: 'Creative Assistant',
                description: 'Specialized in creative writing, content generation, and storytelling',
                capabilities: ['creative_writing', 'storytelling', 'content_generation', 'brainstorming'],
                status: agentStatus.available ? 'active' : 'inactive'
            }
        ];
        
        res.json({
            success: true,
            data: {
                agents: agents,
                total_agents: agents.length,
                system_available: agentStatus.available,
                last_check: agentStatus.lastCheck
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/agents/select
 * Manually select a specific agent for a query
 */
router.post('/select', tempAuth, async (req, res) => {
    try {
        const { agent_id, input, history = [], sessionId } = req.body;
        const userId = req.user.id;
        
        if (!agent_id || !input) {
            return res.status(400).json({
                success: false,
                error: 'Agent ID and input are required'
            });
        }
        
        // Prepare input with agent selection
        const mcpInput = {
            input: input.trim(),
            sessionId: sessionId || 'default',
            userId: userId,
            history: history,
            preferred_agent: agent_id,
            timestamp: new Date().toISOString()
        };
        
        const result = await executeMCPController(mcpInput);
        
        res.json({
            success: true,
            data: {
                ...result.data,
                requested_agent: agent_id,
                metadata: {
                    ...result.data.metadata,
                    manually_selected: true,
                    requested_agent: agent_id
                }
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Initialize MCP system on module load
 */
(async () => {
    try {
        await checkMCPAvailability();
        console.log(`🤖 MCP System initialized - Available: ${agentStatus.available}`);
    } catch (error) {
        console.error('Failed to initialize MCP system:', error);
    }
})();

module.exports = router;
