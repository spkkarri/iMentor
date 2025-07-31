import React, { useState, useEffect } from 'react';
import { getOllamaStatus, configureOllama } from '../services/api';
import './OllamaConfig.css';

const OllamaConfig = ({ onConfigurationChange }) => {
    const [config, setConfig] = useState({
        host: 'localhost',
        port: '11434',
        protocol: 'http'
    });
    const [status, setStatus] = useState({
        connected: false,
        checking: false,
        baseUrl: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        checkCurrentStatus();
    }, []);

    const checkCurrentStatus = async () => {
        try {
            setStatus(prev => ({ ...prev, checking: true }));
            const response = await getOllamaStatus();
            setStatus({
                connected: response.data.connected,
                checking: false,
                baseUrl: response.data.baseUrl
            });
            
            if (response.data.baseUrl) {
                parseUrlToConfig(response.data.baseUrl);
            }
        } catch (error) {
            setStatus({
                connected: false,
                checking: false,
                baseUrl: ''
            });
        }
    };

    const parseUrlToConfig = (url) => {
        try {
            const urlObj = new URL(url);
            setConfig({
                protocol: urlObj.protocol.replace(':', ''),
                host: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')
            });
        } catch (error) {
            console.error('Error parsing URL:', error);
        }
    };

    const buildUrl = () => {
        return `${config.protocol}://${config.host}:${config.port}`;
    };

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
        setError('');
        setSuccess('');
    };

    const testConnection = async () => {
        try {
            setStatus(prev => ({ ...prev, checking: true }));
            setError('');
            setSuccess('');

            const baseUrl = buildUrl();
            const response = await configureOllama(baseUrl);

            if (response.data.success) {
                setStatus({
                    connected: true,
                    checking: false,
                    baseUrl: baseUrl
                });
                setSuccess('Successfully connected to Ollama!');
                onConfigurationChange && onConfigurationChange({
                    connected: true,
                    baseUrl: baseUrl
                });
            } else {
                setStatus(prev => ({ ...prev, checking: false }));
                setError(response.data.error || 'Connection failed');
            }
        } catch (error) {
            setStatus(prev => ({ ...prev, checking: false }));
            setError(error.response?.data?.error || 'Connection test failed');
        }
    };

    const getCommonPorts = () => [
        { port: '11434', label: '11434 (Default)' },
        { port: '11435', label: '11435 (Alternative)' },
        { port: '8080', label: '8080 (Development)' },
        { port: '3000', label: '3000 (Custom)' },
        { port: '8000', label: '8000 (Custom)' }
    ];

    const getStatusColor = () => {
        if (status.checking) return '#ffc107';
        return status.connected ? '#28a745' : '#dc3545';
    };

    const getStatusText = () => {
        if (status.checking) return 'Checking...';
        return status.connected ? 'Connected' : 'Disconnected';
    };

    return (
        <div className="ollama-config">
            <div className="config-header">
                <h3>🦙 Ollama Configuration</h3>
                <div className="status-badge" style={{ backgroundColor: getStatusColor() }}>
                    {getStatusText()}
                </div>
            </div>

            <div className="current-status">
                <div className="status-info">
                    <strong>Current URL:</strong> {status.baseUrl || 'Not configured'}
                </div>
                {status.connected && (
                    <div className="status-info success">
                        ✅ Ollama is running and accessible
                    </div>
                )}
                {!status.connected && !status.checking && (
                    <div className="status-info error">
                        ❌ Cannot connect to Ollama service
                    </div>
                )}
            </div>

            <div className="config-form">
                <h4>Connection Settings</h4>
                
                <div className="form-row">
                    <div className="form-group">
                        <label>Protocol:</label>
                        <select
                            value={config.protocol}
                            onChange={(e) => handleConfigChange('protocol', e.target.value)}
                        >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Host:</label>
                        <input
                            type="text"
                            value={config.host}
                            onChange={(e) => handleConfigChange('host', e.target.value)}
                            placeholder="localhost"
                        />
                    </div>

                    <div className="form-group">
                        <label>Port:</label>
                        <select
                            value={config.port}
                            onChange={(e) => handleConfigChange('port', e.target.value)}
                        >
                            {getCommonPorts().map(({ port, label }) => (
                                <option key={port} value={port}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="url-preview">
                    <strong>URL Preview:</strong> <code>{buildUrl()}</code>
                </div>

                <div className="config-actions">
                    <button
                        className="test-btn"
                        onClick={testConnection}
                        disabled={status.checking}
                    >
                        {status.checking ? 'Testing...' : 'Test Connection'}
                    </button>
                    
                    <button
                        className="refresh-btn"
                        onClick={checkCurrentStatus}
                        disabled={status.checking}
                    >
                        🔄 Refresh Status
                    </button>
                </div>

                {error && (
                    <div className="message error">
                        ⚠️ {error}
                    </div>
                )}

                {success && (
                    <div className="message success">
                        ✅ {success}
                    </div>
                )}
            </div>

            <div className="config-help">
                <h4>Configuration Help</h4>
                <div className="help-section">
                    <h5>🚀 Starting Ollama with Custom Port:</h5>
                    <div className="code-block">
                        <strong>Windows (PowerShell):</strong>
                        <code>
                            $env:OLLAMA_HOST = "0.0.0.0:{config.port}"<br/>
                            ollama serve
                        </code>
                    </div>
                    <div className="code-block">
                        <strong>macOS/Linux:</strong>
                        <code>
                            export OLLAMA_HOST=0.0.0.0:{config.port}<br/>
                            ollama serve
                        </code>
                    </div>
                </div>

                <div className="help-section">
                    <h5>🔧 Common Issues:</h5>
                    <ul>
                        <li><strong>Connection Refused:</strong> Make sure Ollama is running</li>
                        <li><strong>Port in Use:</strong> Try a different port (11435, 8080, etc.)</li>
                        <li><strong>Firewall:</strong> Ensure the port is not blocked</li>
                        <li><strong>Host Access:</strong> Use 0.0.0.0 to allow external connections</li>
                    </ul>
                </div>

                <div className="help-section">
                    <h5>📋 Quick Setup Commands:</h5>
                    <div className="quick-commands">
                        <button 
                            className="command-btn"
                            onClick={() => navigator.clipboard.writeText(`export OLLAMA_HOST=0.0.0.0:${config.port} && ollama serve`)}
                        >
                            📋 Copy Linux/Mac Command
                        </button>
                        <button 
                            className="command-btn"
                            onClick={() => navigator.clipboard.writeText(`$env:OLLAMA_HOST = "0.0.0.0:${config.port}"; ollama serve`)}
                        >
                            📋 Copy Windows Command
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OllamaConfig;
