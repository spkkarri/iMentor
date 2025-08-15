/**
 * Agentic MCP Toggle Component
 * 
 * Provides a toggle switch to enable/disable Agentic MCP (Model Context Protocol) processing
 * Shows agentic system status, agent information, and workflow capabilities
 */

import React, { useState, useEffect } from 'react';
import { FaRobot, FaNetworkWired, FaCog, FaInfoCircle, FaUsers, FaTools } from 'react-icons/fa';

const AgenticMCPToggle = ({ agenticMCPEnabled, onToggle, className = '' }) => {
    const [systemStatus, setSystemStatus] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (agenticMCPEnabled) {
            fetchSystemStatus();
        }
    }, [agenticMCPEnabled]);

    const fetchSystemStatus = async () => {
        try {
            setLoading(true);
            // Note: This would connect to the agentic MCP status endpoint when available
            // For now, we'll simulate the status
            const mockStatus = {
                orchestrator: {
                    agents: 5,
                    activeWorkflows: 0,
                    performance: {
                        totalTasks: 0,
                        successfulTasks: 0,
                        averageResponseTime: 0
                    }
                },
                services: {
                    available: 15,
                    serviceManager: true,
                    integration: 'active'
                },
                capabilities: {
                    agents: [
                        { name: 'Research Analyst', specialization: 'research_and_analysis' },
                        { name: 'Content Creator', specialization: 'content_generation' },
                        { name: 'Document Processor', specialization: 'document_management' },
                        { name: 'Learning Assistant', specialization: 'educational_support' },
                        { name: 'Workflow Coordinator', specialization: 'task_orchestration' }
                    ],
                    workflows: ['single_agent', 'multi_agent_workflow']
                }
            };
            setSystemStatus(mockStatus);
        } catch (error) {
            console.error('Failed to fetch Agentic MCP status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        onToggle(!agenticMCPEnabled);
        if (!agenticMCPEnabled) {
            fetchSystemStatus();
        }
    };

    const getStatusColor = () => {
        if (!agenticMCPEnabled) return '#6c757d';
        if (loading) return '#ffc107';
        if (systemStatus?.services?.integration === 'active') return '#28a745';
        return '#dc3545';
    };

    const getStatusText = () => {
        if (!agenticMCPEnabled) return 'Disabled';
        if (loading) return 'Loading...';
        if (systemStatus?.services?.integration === 'active') return 'Active';
        return 'Error';
    };

    return (
        <div className={`agentic-mcp-toggle-container ${className}`}>
            <div className="agentic-mcp-toggle-main">
                <div className="agentic-mcp-toggle-switch">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={agenticMCPEnabled}
                            onChange={handleToggle}
                            className="toggle-input"
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
                
                <div className="agentic-mcp-info">
                    <div className="agentic-mcp-title">
                        <FaNetworkWired className="agentic-mcp-icon" />
                        <span>Agentic MCP</span>
                        <button
                            className="info-button"
                            onClick={() => setShowDetails(!showDetails)}
                            title="Show Agentic MCP Details"
                        >
                            <FaInfoCircle />
                        </button>
                    </div>
                    
                    <div className="agentic-mcp-status">
                        <span 
                            className="status-indicator"
                            style={{ backgroundColor: getStatusColor() }}
                        ></span>
                        <span className="status-text">{getStatusText()}</span>
                        {systemStatus && (
                            <span className="agent-count">
                                {systemStatus.orchestrator?.agents || 0} agents • {systemStatus.services?.available || 0} services
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {showDetails && agenticMCPEnabled && systemStatus && (
                <div className="agentic-mcp-details">
                    <div className="agentic-mcp-details-header">
                        <h4>🤖 Agentic MCP System Status</h4>
                        <button 
                            className="refresh-button"
                            onClick={fetchSystemStatus}
                            disabled={loading}
                        >
                            <FaCog className={loading ? 'spinning' : ''} />
                        </button>
                    </div>
                    
                    <div className="agentic-mcp-metrics">
                        <div className="metric">
                            <span className="metric-label">Active Agents:</span>
                            <span className="metric-value">
                                {systemStatus.orchestrator?.agents || 0}
                            </span>
                        </div>
                        
                        <div className="metric">
                            <span className="metric-label">Services:</span>
                            <span className="metric-value">
                                {systemStatus.services?.available || 0}
                            </span>
                        </div>
                        
                        <div className="metric">
                            <span className="metric-label">Workflows:</span>
                            <span className="metric-value">
                                {systemStatus.orchestrator?.activeWorkflows || 0} active
                            </span>
                        </div>
                    </div>

                    <div className="agentic-agents">
                        <h5><FaUsers className="section-icon" /> Available Agents:</h5>
                        <div className="agents-list">
                            {systemStatus.capabilities?.agents?.map((agent, index) => (
                                <div key={index} className="agent-item">
                                    <span className="agent-name">{agent.name}</span>
                                    <span className="agent-spec">{agent.specialization.replace(/_/g, ' ')}</span>
                                </div>
                            )) || []}
                        </div>
                    </div>

                    <div className="agentic-capabilities">
                        <h5><FaTools className="section-icon" /> Integrated Services:</h5>
                        <div className="capabilities-grid">
                            <span className="capability-tag">RAG Service</span>
                            <span className="capability-tag">Deep Search</span>
                            <span className="capability-tag">Document Generation</span>
                            <span className="capability-tag">File Processing</span>
                            <span className="capability-tag">Content Creation</span>
                            <span className="capability-tag">Personalization</span>
                            <span className="capability-tag">Performance Optimization</span>
                            <span className="capability-tag">Analytics</span>
                        </div>
                    </div>

                    <div className="agentic-description">
                        <p>
                            <strong>Agentic MCP</strong> provides intelligent agents that can autonomously 
                            access and coordinate ALL application features. Agents work together to complete 
                            complex tasks using research, document generation, analysis, and more.
                        </p>
                        <div className="workflow-types">
                            <span className="workflow-badge">🤖 Single Agent Tasks</span>
                            <span className="workflow-badge">🔄 Multi-Agent Workflows</span>
                            <span className="workflow-badge">⚙️ Autonomous Coordination</span>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .agentic-mcp-toggle-container {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 16px;
                    margin: 8px 0;
                    color: white;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                    border: 2px solid rgba(255, 255, 255, 0.1);
                }

                .agentic-mcp-toggle-container:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .agentic-mcp-toggle-main {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toggle-label {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 24px;
                    cursor: pointer;
                }

                .toggle-input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(255, 255, 255, 0.3);
                    border-radius: 24px;
                    transition: 0.3s;
                    cursor: pointer;
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    border-radius: 50%;
                    transition: 0.3s;
                }

                .toggle-input:checked + .toggle-slider {
                    background-color: #4CAF50;
                }

                .toggle-input:checked + .toggle-slider:before {
                    transform: translateX(26px);
                }

                .agentic-mcp-info {
                    flex: 1;
                }

                .agentic-mcp-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                }

                .agentic-mcp-icon {
                    font-size: 16px;
                    color: #ffd700;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                .info-button {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.7);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                    transition: color 0.2s;
                }

                .info-button:hover {
                    color: white;
                }

                .agentic-mcp-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    opacity: 0.9;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }

                .status-text {
                    font-weight: 500;
                }

                .agent-count {
                    color: rgba(255, 255, 255, 0.8);
                }

                .agentic-mcp-details {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                    animation: slideDown 0.3s ease;
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .agentic-mcp-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .agentic-mcp-details-header h4 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                }

                .refresh-button {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .refresh-button:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .agentic-mcp-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .metric {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 12px;
                }

                .metric-label {
                    display: block;
                    opacity: 0.8;
                    margin-bottom: 2px;
                }

                .metric-value {
                    font-weight: 600;
                    font-size: 14px;
                }

                .agentic-agents h5,
                .agentic-capabilities h5 {
                    margin: 12px 0 8px 0;
                    font-size: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .section-icon {
                    font-size: 12px;
                }

                .agents-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 12px;
                }

                .agent-item {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 6px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                }

                .agent-name {
                    font-weight: 600;
                    display: block;
                }

                .agent-spec {
                    opacity: 0.8;
                    text-transform: capitalize;
                }

                .capabilities-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 4px;
                    margin-bottom: 12px;
                }

                .capability-tag {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 3px 6px;
                    border-radius: 8px;
                    font-size: 10px;
                    text-align: center;
                }

                .agentic-description {
                    font-size: 11px;
                    line-height: 1.4;
                    opacity: 0.9;
                }

                .agentic-description p {
                    margin: 0 0 8px 0;
                }

                .workflow-types {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }

                .workflow-badge {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 9px;
                    font-weight: 500;
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .agentic-mcp-metrics {
                        grid-template-columns: 1fr 1fr;
                    }

                    .capabilities-grid {
                        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                    }

                    .workflow-types {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default AgenticMCPToggle;
