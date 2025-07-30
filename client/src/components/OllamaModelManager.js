import React, { useState, useEffect } from 'react';
import { 
    getOllamaStatus, 
    getOllamaModels, 
    getPopularOllamaModels, 
    pullOllamaModel, 
    deleteOllamaModel,
    loadOllamaModel,
    unloadOllamaModel,
    getRunningOllamaModels
} from '../services/api';
import './OllamaModelManager.css';

const OllamaModelManager = ({ onModelSelect, selectedModel }) => {
    const [ollamaStatus, setOllamaStatus] = useState({ connected: false, checking: true });
    const [installedModels, setInstalledModels] = useState([]);
    const [popularModels, setPopularModels] = useState([]);
    const [runningModels, setRunningModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('installed');
    const [pullingModels, setPullingModels] = useState(new Set());
    const [pullProgress, setPullProgress] = useState({});

    useEffect(() => {
        checkOllamaStatus();
        loadPopularModels();
    }, []);

    useEffect(() => {
        if (ollamaStatus.connected) {
            loadInstalledModels();
            loadRunningModels();
        }
    }, [ollamaStatus.connected]);

    const checkOllamaStatus = async () => {
        try {
            const response = await getOllamaStatus();
            setOllamaStatus({
                connected: response.data.connected,
                checking: false,
                baseUrl: response.data.baseUrl
            });
        } catch (error) {
            setOllamaStatus({ connected: false, checking: false });
            setError('Failed to connect to Ollama service');
        }
    };

    const loadInstalledModels = async () => {
        try {
            setLoading(true);
            const response = await getOllamaModels();
            setInstalledModels(response.data.models || []);
        } catch (error) {
            setError('Failed to load installed models');
        } finally {
            setLoading(false);
        }
    };

    const loadPopularModels = async () => {
        try {
            const response = await getPopularOllamaModels();
            setPopularModels(response.data.models || []);
        } catch (error) {
            console.error('Failed to load popular models:', error);
        }
    };

    const loadRunningModels = async () => {
        try {
            const response = await getRunningOllamaModels();
            setRunningModels(response.data.models || []);
        } catch (error) {
            console.error('Failed to load running models:', error);
        }
    };

    const handlePullModel = async (modelName) => {
        try {
            setPullingModels(prev => new Set([...prev, modelName]));
            setPullProgress(prev => ({ ...prev, [modelName]: 0 }));

            // Use fetch with streaming for real-time progress
            const response = await fetch('/api/training/ollama/pull', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': localStorage.getItem('userId') || '6889c5f51666097a9ee3c518'
                },
                body: JSON.stringify({ modelName })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // For now, simulate progress since streaming is complex
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 95) {
                    progress = 95;
                }
                setPullProgress(prev => ({ ...prev, [modelName]: progress }));
            }, 500);

            // Wait for the actual response
            const result = await response.json();

            clearInterval(progressInterval);
            setPullProgress(prev => ({ ...prev, [modelName]: 100 }));

            if (result.success) {
                setTimeout(() => {
                    setPullingModels(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(modelName);
                        return newSet;
                    });
                    setPullProgress(prev => {
                        const newProgress = { ...prev };
                        delete newProgress[modelName];
                        return newProgress;
                    });
                    loadInstalledModels(); // Refresh installed models
                }, 1000);
            } else {
                setError(`Failed to pull ${modelName}: ${result.error}`);
                setPullingModels(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(modelName);
                    return newSet;
                });
            }

        } catch (error) {
            setError(`Failed to pull ${modelName}: ${error.message}`);
            setPullingModels(prev => {
                const newSet = new Set(prev);
                newSet.delete(modelName);
                return newSet;
            });
        }
    };

    const handleDeleteModel = async (modelName) => {
        if (!window.confirm(`Are you sure you want to delete ${modelName}? This will remove the model from your system.`)) {
            return;
        }

        try {
            await deleteOllamaModel(modelName);
            loadInstalledModels();
            
            // If deleted model was selected, clear selection
            if (selectedModel?.name === modelName) {
                onModelSelect(null);
            }
        } catch (error) {
            setError(`Failed to delete ${modelName}: ${error.message}`);
        }
    };

    const handleLoadModel = async (modelName) => {
        try {
            await loadOllamaModel(modelName);
            loadRunningModels();
        } catch (error) {
            setError(`Failed to load ${modelName}: ${error.message}`);
        }
    };

    const handleUnloadModel = async (modelName) => {
        try {
            await unloadOllamaModel(modelName);
            loadRunningModels();
        } catch (error) {
            setError(`Failed to unload ${modelName}: ${error.message}`);
        }
    };

    const formatSize = (size) => {
        if (typeof size === 'string') return size;
        if (!size) return 'Unknown';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let sizeValue = size;
        
        while (sizeValue >= 1024 && unitIndex < units.length - 1) {
            sizeValue /= 1024;
            unitIndex++;
        }
        
        return `${sizeValue.toFixed(1)} ${units[unitIndex]}`;
    };

    const isModelRunning = (modelName) => {
        return runningModels.some(model => model.name === modelName);
    };

    const isModelInstalled = (modelName) => {
        return installedModels.some(model => model.name === modelName);
    };

    if (ollamaStatus.checking) {
        return (
            <div className="ollama-manager">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <div>Checking Ollama connection...</div>
                </div>
            </div>
        );
    }

    if (!ollamaStatus.connected) {
        return (
            <div className="ollama-manager">
                <div className="connection-error">
                    <div className="error-icon">🔌</div>
                    <div className="error-title">Ollama Not Connected</div>
                    <div className="error-description">
                        Ollama service is not running or not accessible at {ollamaStatus.baseUrl || 'localhost:11434'}
                    </div>
                    <div className="error-instructions">
                        <p>To use Ollama models:</p>
                        <ol>
                            <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">ollama.ai</a></li>
                            <li>Start Ollama service</li>
                            <li>Refresh this page</li>
                        </ol>
                    </div>
                    <button className="retry-btn" onClick={checkOllamaStatus}>
                        🔄 Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ollama-manager">
            <div className="manager-header">
                <h3>🦙 Ollama Models</h3>
                <div className="status-indicator connected">
                    ✅ Connected to Ollama
                </div>
            </div>

            {error && (
                <div className="error-message">
                    ⚠️ {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            <div className="tab-navigation">
                <button 
                    className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('installed')}
                >
                    📦 Installed ({installedModels.length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'popular' ? 'active' : ''}`}
                    onClick={() => setActiveTab('popular')}
                >
                    ⭐ Popular Models
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'installed' ? (
                    <div className="installed-models">
                        {loading ? (
                            <div className="loading-state">
                                <div className="loading-spinner"></div>
                                <div>Loading installed models...</div>
                            </div>
                        ) : installedModels.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📦</div>
                                <div className="empty-title">No Models Installed</div>
                                <div className="empty-description">
                                    Install models from the Popular Models tab to get started.
                                </div>
                            </div>
                        ) : (
                            <div className="models-grid">
                                {installedModels.map(model => (
                                    <div 
                                        key={model.id}
                                        className={`model-card ${selectedModel?.id === model.id ? 'selected' : ''}`}
                                        onClick={() => onModelSelect(model)}
                                    >
                                        <div className="model-header">
                                            <div className="model-info">
                                                <div className="model-name">{model.name}</div>
                                                <div className="model-meta">
                                                    <span className="model-size">{model.size}</span>
                                                    {isModelRunning(model.name) && (
                                                        <span className="running-badge">🟢 Running</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="model-actions">
                                                {isModelRunning(model.name) ? (
                                                    <button
                                                        className="action-btn unload"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnloadModel(model.name);
                                                        }}
                                                        title="Unload model"
                                                    >
                                                        ⏹️
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="action-btn load"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLoadModel(model.name);
                                                        }}
                                                        title="Load model"
                                                    >
                                                        ▶️
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn delete"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteModel(model.name);
                                                    }}
                                                    title="Delete model"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        <div className="model-description">
                                            {model.description}
                                        </div>

                                        <div className="model-subjects">
                                            {model.compatible_subjects?.map(subject => (
                                                <span key={subject} className="subject-tag">
                                                    {subject}
                                                </span>
                                            ))}
                                        </div>

                                        {selectedModel?.id === model.id && (
                                            <div className="selected-indicator">
                                                ✅ Selected for training
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="popular-models">
                        <div className="models-grid">
                            {popularModels.map(model => (
                                <div key={model.name} className="model-card popular">
                                    <div className="model-header">
                                        <div className="model-info">
                                            <div className="model-name">{model.name}</div>
                                            <div className="model-size">{model.size}</div>
                                        </div>
                                        <div className="model-actions">
                                            {isModelInstalled(model.name) ? (
                                                <span className="installed-badge">✅ Installed</span>
                                            ) : pullingModels.has(model.name) ? (
                                                <div className="pull-progress">
                                                    <div className="progress-bar">
                                                        <div 
                                                            className="progress-fill"
                                                            style={{ width: `${pullProgress[model.name] || 0}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="progress-text">Pulling...</span>
                                                </div>
                                            ) : (
                                                <button
                                                    className="pull-btn"
                                                    onClick={() => handlePullModel(model.name)}
                                                >
                                                    📥 Pull
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="model-description">
                                        {model.description}
                                    </div>

                                    <div className="model-subjects">
                                        {model.subjects?.map(subject => (
                                            <span key={subject} className="subject-tag">
                                                {subject}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OllamaModelManager;
