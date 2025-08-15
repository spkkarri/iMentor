/**
 * Unified MCP Toggle Component
 * 
 * Single, intelligent MCP system that automatically selects the best processing mode:
 * - Standard MCP for simple queries
 * - Agentic MCP for complex, multi-step tasks
 * - Automatic routing based on query complexity
 */

import React, { useState, useEffect } from 'react';
import { FaRobot, FaNetworkWired, FaCog, FaInfoCircle, FaBrain, FaLightbulb } from 'react-icons/fa';

const UnifiedMCPToggle = ({ mcpEnabled, onToggle, className = '' }) => {
    const [mcpStatus, setMcpStatus] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processingMode, setProcessingMode] = useState('auto');

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

    const getModeIcon = () => {
        switch (processingMode) {
            case 'standard': return <FaRobot />;
            case 'agentic': return <FaNetworkWired />;
            default: return <FaBrain />;
        }
    };

    const getModeDescription = () => {
        switch (processingMode) {
            case 'standard': return 'Standard MCP - Fast processing for simple queries';
            case 'agentic': return 'Agentic MCP - Advanced multi-agent processing';
            default: return 'Auto Mode - Intelligent routing based on query complexity';
        }
    };

    return (
        <div className={`unified-mcp-toggle-container ${className}`}>
            <div className="unified-mcp-toggle-main">
                <div className="unified-mcp-toggle-switch">
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
                
                <div className="unified-mcp-info">
                    <div className="unified-mcp-title">
                        {getModeIcon()}
                        <span>MCP Agents</span>
                        <button
                            className="info-button"
                            onClick={() => setShowDetails(!showDetails)}
                            title="Show MCP Details"
                        >
                            <FaInfoCircle />
                        </button>
                    </div>
                    
                    <div className="unified-mcp-status">
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

            {showDetails && mcpEnabled && (
                <div className="unified-mcp-details">
                    <div className="unified-mcp-details-header">
                        <h4>🤖 Unified MCP System</h4>
                        <button 
                            className="refresh-button"
                            onClick={fetchMCPStatus}
                            disabled={loading}
                        >
                            <FaCog className={loading ? 'spinning' : ''} />
                        </button>
                    </div>

                    {/* Processing Mode Selector */}
                    <div className="processing-mode-selector">
                        <h5>🎯 Processing Mode:</h5>
                        <div className="mode-buttons">
                            <button
                                className={`mode-btn ${processingMode === 'auto' ? 'active' : ''}`}
                                onClick={() => setProcessingMode('auto')}
                            >
                                <FaBrain /> Auto
                            </button>
                            <button
                                className={`mode-btn ${processingMode === 'standard' ? 'active' : ''}`}
                                onClick={() => setProcessingMode('standard')}
                            >
                                <FaRobot /> Standard
                            </button>
                            <button
                                className={`mode-btn ${processingMode === 'agentic' ? 'active' : ''}`}
                                onClick={() => setProcessingMode('agentic')}
                            >
                                <FaNetworkWired /> Agentic
                            </button>
                        </div>
                        <p className="mode-description">{getModeDescription()}</p>
                    </div>

                    {mcpStatus && (
                        <>
                            <div className="unified-mcp-metrics">
                                <div className="metric">
                                    <span className="metric-label">Active Agents:</span>
                                    <span className="metric-value">{mcpStatus.agents?.activeAgents || 0}</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Avg Response:</span>
                                    <span className="metric-value">{mcpStatus.performance?.averageResponseTime || 'N/A'}ms</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Success Rate:</span>
                                    <span className="metric-value">{mcpStatus.performance?.successRate || 'N/A'}%</span>
                                </div>
                            </div>

                            <div className="unified-mcp-capabilities">
                                <h5>⚡ Capabilities:</h5>
                                <div className="capabilities-grid">
                                    <div className="capability-item">
                                        <FaLightbulb /> Intelligent Routing
                                    </div>
                                    <div className="capability-item">
                                        <FaRobot /> Multi-Agent Collaboration
                                    </div>
                                    <div className="capability-item">
                                        <FaNetworkWired /> Complex Task Processing
                                    </div>
                                    <div className="capability-item">
                                        <FaBrain /> Adaptive Learning
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="unified-mcp-description">
                        <p>
                            <strong>Unified MCP System</strong> intelligently processes your queries using 
                            the most appropriate AI agents. It automatically selects between fast standard 
                            processing and advanced multi-agent workflows based on your query complexity.
                        </p>
                    </div>
                </div>
            )}

            <style jsx>{`
                .unified-mcp-toggle-container {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 16px;
                    margin: 8px 0;
                    color: white;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    transition: all 0.3s ease;
                }

                .unified-mcp-toggle-container:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }

                .unified-mcp-toggle-main {
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
                    background-color: rgba(40, 167, 69, 0.8);
                }

                .toggle-input:checked + .toggle-slider:before {
                    transform: translateX(26px);
                }

                .unified-mcp-info {
                    flex: 1;
                }

                .unified-mcp-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .info-button {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.7);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                }

                .info-button:hover {
                    color: white;
                    background: rgba(255, 255, 255, 0.1);
                }

                .unified-mcp-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9em;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }

                .agent-count {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 0.85em;
                }

                .unified-mcp-details {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.2);
                }

                .unified-mcp-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .unified-mcp-details-header h4 {
                    margin: 0;
                    font-size: 1.1em;
                }

                .refresh-button {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: white;
                    padding: 6px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .refresh-button:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .processing-mode-selector {
                    margin-bottom: 16px;
                }

                .processing-mode-selector h5 {
                    margin: 0 0 8px 0;
                    font-size: 0.95em;
                }

                .mode-buttons {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .mode-btn {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85em;
                }

                .mode-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .mode-btn.active {
                    background: rgba(40, 167, 69, 0.3);
                    border-color: rgba(40, 167, 69, 0.5);
                }

                .mode-description {
                    font-size: 0.8em;
                    color: rgba(255, 255, 255, 0.8);
                    margin: 0;
                }

                .unified-mcp-metrics {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .metric {
                    text-align: center;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                }

                .metric-label {
                    display: block;
                    font-size: 0.75em;
                    color: rgba(255, 255, 255, 0.8);
                    margin-bottom: 2px;
                }

                .metric-value {
                    display: block;
                    font-weight: 600;
                    font-size: 0.9em;
                }

                .unified-mcp-capabilities {
                    margin-bottom: 16px;
                }

                .unified-mcp-capabilities h5 {
                    margin: 0 0 8px 0;
                    font-size: 0.95em;
                }

                .capabilities-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }

                .capability-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.85em;
                    color: rgba(255, 255, 255, 0.9);
                }

                .unified-mcp-description {
                    font-size: 0.85em;
                    color: rgba(255, 255, 255, 0.9);
                    line-height: 1.4;
                }

                .unified-mcp-description p {
                    margin: 0;
                }
            `}</style>
        </div>
    );
};

export default UnifiedMCPToggle;
