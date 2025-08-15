/**
 * MCP Toggle Component
 * 
 * Provides a toggle switch to enable/disable MCP (Model Context Protocol) processing
 * Shows MCP status, agent information, and performance metrics
 */

import React, { useState, useEffect } from 'react';
import { FaRobot, FaChartLine, FaCog, FaInfoCircle } from 'react-icons/fa';

const MCPToggle = ({ mcpEnabled, onToggle, className = '' }) => {
    const [mcpStatus, setMcpStatus] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (mcpEnabled) {
            fetchMCPStatus();
        }
    }, [mcpEnabled]);

    const fetchMCPStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/mcp/status');
            if (response.ok) {
                const data = await response.json();
                setMcpStatus(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch MCP status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        onToggle(!mcpEnabled);
        if (!mcpEnabled) {
            fetchMCPStatus();
        }
    };

    const getStatusColor = () => {
        if (!mcpEnabled) return '#6c757d';
        if (loading) return '#ffc107';
        if (mcpStatus?.systemStatus === 'operational') return '#28a745';
        return '#dc3545';
    };

    const getStatusText = () => {
        if (!mcpEnabled) return 'Disabled';
        if (loading) return 'Loading...';
        if (mcpStatus?.systemStatus === 'operational') return 'Operational';
        return 'Error';
    };

    return (
        <div className={`mcp-toggle-container ${className}`}>
            <div className="mcp-toggle-main">
                <div className="mcp-toggle-switch">
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={mcpEnabled}
                            onChange={handleToggle}
                            className="toggle-input"
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
                
                <div className="mcp-info">
                    <div className="mcp-title">
                        <FaRobot className="mcp-icon" />
                        <span>MCP Agents</span>
                        <button
                            className="info-button"
                            onClick={() => setShowDetails(!showDetails)}
                            title="Show MCP Details"
                        >
                            <FaInfoCircle />
                        </button>
                    </div>
                    
                    <div className="mcp-status">
                        <span 
                            className="status-indicator"
                            style={{ backgroundColor: getStatusColor() }}
                        ></span>
                        <span className="status-text">{getStatusText()}</span>
                        {mcpStatus && (
                            <span className="agent-count">
                                {mcpStatus.agents?.totalAgents || 0} agents
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {showDetails && mcpEnabled && mcpStatus && (
                <div className="mcp-details">
                    <div className="mcp-details-header">
                        <h4>🤖 MCP System Status</h4>
                        <button 
                            className="refresh-button"
                            onClick={fetchMCPStatus}
                            disabled={loading}
                        >
                            <FaCog className={loading ? 'spinning' : ''} />
                        </button>
                    </div>
                    
                    <div className="mcp-metrics">
                        <div className="metric">
                            <span className="metric-label">Active Agents:</span>
                            <span className="metric-value">
                                {mcpStatus.agents?.activeAgents || 0}/{mcpStatus.agents?.totalAgents || 0}
                            </span>
                        </div>
                        
                        <div className="metric">
                            <span className="metric-label">Success Rate:</span>
                            <span className="metric-value">
                                {((mcpStatus.performance?.successfulTasks / mcpStatus.performance?.totalTasks) * 100 || 0).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div className="metric">
                            <span className="metric-label">Avg Response:</span>
                            <span className="metric-value">
                                {mcpStatus.performance?.averageResponseTime?.toFixed(0) || 0}ms
                            </span>
                        </div>
                    </div>

                    <div className="mcp-capabilities">
                        <h5>🎯 Available Capabilities:</h5>
                        <div className="capabilities-list">
                            {mcpStatus.capabilities?.capabilities?.slice(0, 6).map((capability, index) => (
                                <span key={index} className="capability-tag">
                                    {capability.replace(/_/g, ' ')}
                                </span>
                            )) || []}
                        </div>
                    </div>

                    <div className="mcp-description">
                        <p>
                            <strong>MCP (Model Context Protocol)</strong> intelligently routes your queries 
                            to specialized AI agents for optimal accuracy and relevance. Each agent is 
                            trained for specific tasks like research, coding, education, and creative work.
                        </p>
                    </div>
                </div>
            )}

            <style jsx>{`
                .mcp-toggle-container {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 16px;
                    margin: 8px 0;
                    color: white;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                }

                .mcp-toggle-container:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }

                .mcp-toggle-main {
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

                .mcp-info {
                    flex: 1;
                }

                .mcp-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                }

                .mcp-icon {
                    font-size: 16px;
                    color: #ffd700;
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

                .mcp-status {
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

                .mcp-details {
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

                .mcp-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .mcp-details-header h4 {
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

                .mcp-metrics {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

                .mcp-capabilities h5 {
                    margin: 0 0 8px 0;
                    font-size: 12px;
                    font-weight: 600;
                }

                .capabilities-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-bottom: 12px;
                }

                .capability-tag {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 10px;
                    text-transform: capitalize;
                }

                .mcp-description {
                    font-size: 11px;
                    line-height: 1.4;
                    opacity: 0.9;
                }

                .mcp-description p {
                    margin: 0;
                }
            `}</style>
        </div>
    );
};

export default MCPToggle;
