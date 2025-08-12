// server/mcp_system/websocket_handler.js
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * WebSocket handler for real-time MCP agent communication
 * Provides streaming responses and real-time agent interactions
 */
class MCPWebSocketHandler extends EventEmitter {
    constructor(server) {
        super();
        this.server = server;
        this.wss = null;
        this.activeConnections = new Map();
        this.activeProcesses = new Map();
        this.initialize();
    }

    initialize() {
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/api/agents/ws'
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        console.log('🔌 MCP WebSocket server initialized on /api/agents/ws');
    }

    handleConnection(ws, req) {
        const connectionId = this.generateConnectionId();
        const clientIP = req.socket.remoteAddress;
        
        console.log(`🔌 New MCP WebSocket connection: ${connectionId} from ${clientIP}`);

        // Store connection
        this.activeConnections.set(connectionId, {
            ws,
            clientIP,
            connectedAt: new Date(),
            lastActivity: new Date(),
            userId: null,
            sessionId: null
        });

        // Set up connection handlers
        ws.on('message', (message) => {
            this.handleMessage(connectionId, message);
        });

        ws.on('close', () => {
            this.handleDisconnection(connectionId);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for ${connectionId}:`, error);
            this.handleDisconnection(connectionId);
        });

        // Send welcome message
        this.sendMessage(connectionId, {
            type: 'connection_established',
            connectionId,
            timestamp: new Date().toISOString(),
            message: 'Connected to MCP Agent WebSocket'
        });
    }

    async handleMessage(connectionId, message) {
        try {
            const connection = this.activeConnections.get(connectionId);
            if (!connection) return;

            connection.lastActivity = new Date();

            const data = JSON.parse(message.toString());
            const { type, payload } = data;

            console.log(`📨 WebSocket message from ${connectionId}: ${type}`);

            switch (type) {
                case 'authenticate':
                    await this.handleAuthentication(connectionId, payload);
                    break;
                
                case 'agent_query':
                    await this.handleAgentQuery(connectionId, payload);
                    break;
                
                case 'stream_query':
                    await this.handleStreamQuery(connectionId, payload);
                    break;
                
                case 'cancel_query':
                    await this.handleCancelQuery(connectionId, payload);
                    break;
                
                case 'ping':
                    this.sendMessage(connectionId, { type: 'pong', timestamp: new Date().toISOString() });
                    break;
                
                default:
                    this.sendError(connectionId, `Unknown message type: ${type}`);
            }

        } catch (error) {
            console.error(`Error handling WebSocket message from ${connectionId}:`, error);
            this.sendError(connectionId, 'Invalid message format');
        }
    }

    async handleAuthentication(connectionId, payload) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection) return;

        const { userId, sessionId, token } = payload;

        // Simple authentication (enhance with proper token validation)
        if (userId && sessionId) {
            connection.userId = userId;
            connection.sessionId = sessionId;

            this.sendMessage(connectionId, {
                type: 'authentication_success',
                userId,
                sessionId,
                timestamp: new Date().toISOString()
            });

            console.log(`✅ WebSocket authenticated: ${connectionId} for user ${userId}`);
        } else {
            this.sendError(connectionId, 'Authentication failed: missing credentials');
        }
    }

    async handleAgentQuery(connectionId, payload) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection || !connection.userId) {
            this.sendError(connectionId, 'Not authenticated');
            return;
        }

        const { input, history = [], systemPrompt, useOrchestration = true } = payload;

        if (!input) {
            this.sendError(connectionId, 'Input query is required');
            return;
        }

        try {
            // Send processing started message
            this.sendMessage(connectionId, {
                type: 'query_started',
                timestamp: new Date().toISOString(),
                query: input
            });

            // Prepare MCP input
            const mcpInput = {
                input: input.trim(),
                sessionId: connection.sessionId,
                userId: connection.userId,
                history,
                systemPrompt,
                use_orchestration: useOrchestration,
                timestamp: new Date().toISOString()
            };

            // Execute MCP controller
            const result = await this.executeMCPController(mcpInput);

            // Send result
            this.sendMessage(connectionId, {
                type: 'query_result',
                timestamp: new Date().toISOString(),
                result
            });

        } catch (error) {
            console.error(`Error processing agent query for ${connectionId}:`, error);
            this.sendError(connectionId, `Query processing failed: ${error.message}`);
        }
    }

    async handleStreamQuery(connectionId, payload) {
        const connection = this.activeConnections.get(connectionId);
        if (!connection || !connection.userId) {
            this.sendError(connectionId, 'Not authenticated');
            return;
        }

        const { input, history = [], systemPrompt } = payload;

        if (!input) {
            this.sendError(connectionId, 'Input query is required');
            return;
        }

        try {
            const processId = this.generateProcessId();
            
            // Send streaming started message
            this.sendMessage(connectionId, {
                type: 'stream_started',
                processId,
                timestamp: new Date().toISOString(),
                query: input
            });

            // Start streaming MCP process
            await this.startStreamingMCPProcess(connectionId, processId, {
                input: input.trim(),
                sessionId: connection.sessionId,
                userId: connection.userId,
                history,
                systemPrompt,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error(`Error starting stream query for ${connectionId}:`, error);
            this.sendError(connectionId, `Stream processing failed: ${error.message}`);
        }
    }

    async startStreamingMCPProcess(connectionId, processId, mcpInput) {
        const mcpControllerPath = path.join(__dirname, 'mcp_controller.py');
        const inputJson = JSON.stringify(mcpInput);

        // Spawn Python process for streaming
        const pythonProcess = spawn('python', [mcpControllerPath, inputJson], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.dirname(mcpControllerPath)
        });

        // Store process reference
        this.activeProcesses.set(processId, {
            process: pythonProcess,
            connectionId,
            startTime: new Date()
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;

            // Send streaming chunk
            this.sendMessage(connectionId, {
                type: 'stream_chunk',
                processId,
                chunk: chunk,
                timestamp: new Date().toISOString()
            });
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            this.activeProcesses.delete(processId);

            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    this.sendMessage(connectionId, {
                        type: 'stream_complete',
                        processId,
                        result,
                        timestamp: new Date().toISOString()
                    });
                } catch (parseError) {
                    this.sendError(connectionId, `Failed to parse streaming result: ${parseError.message}`);
                }
            } else {
                this.sendError(connectionId, `Streaming process failed with code ${code}: ${stderr}`);
            }
        });

        pythonProcess.on('error', (error) => {
            this.activeProcesses.delete(processId);
            this.sendError(connectionId, `Failed to start streaming process: ${error.message}`);
        });

        // Set timeout
        setTimeout(() => {
            if (this.activeProcesses.has(processId)) {
                pythonProcess.kill();
                this.activeProcesses.delete(processId);
                this.sendError(connectionId, 'Streaming process timeout');
            }
        }, 60000); // 60 second timeout
    }

    async handleCancelQuery(connectionId, payload) {
        const { processId } = payload;
        
        if (this.activeProcesses.has(processId)) {
            const processInfo = this.activeProcesses.get(processId);
            processInfo.process.kill();
            this.activeProcesses.delete(processId);

            this.sendMessage(connectionId, {
                type: 'query_cancelled',
                processId,
                timestamp: new Date().toISOString()
            });
        }
    }

    async executeMCPController(inputData) {
        return new Promise((resolve, reject) => {
            const mcpControllerPath = path.join(__dirname, 'mcp_controller.py');
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

    handleDisconnection(connectionId) {
        console.log(`🔌 WebSocket disconnected: ${connectionId}`);
        
        // Clean up active processes for this connection
        for (const [processId, processInfo] of this.activeProcesses.entries()) {
            if (processInfo.connectionId === connectionId) {
                processInfo.process.kill();
                this.activeProcesses.delete(processId);
            }
        }

        // Remove connection
        this.activeConnections.delete(connectionId);
    }

    sendMessage(connectionId, message) {
        const connection = this.activeConnections.get(connectionId);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify(message));
        }
    }

    sendError(connectionId, error) {
        this.sendMessage(connectionId, {
            type: 'error',
            error,
            timestamp: new Date().toISOString()
        });
    }

    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateProcessId() {
        return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getStats() {
        return {
            activeConnections: this.activeConnections.size,
            activeProcesses: this.activeProcesses.size,
            connections: Array.from(this.activeConnections.entries()).map(([id, conn]) => ({
                id,
                userId: conn.userId,
                sessionId: conn.sessionId,
                connectedAt: conn.connectedAt,
                lastActivity: conn.lastActivity
            }))
        };
    }
}

module.exports = MCPWebSocketHandler;
