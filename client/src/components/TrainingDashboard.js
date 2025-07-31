import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getTrainingModels,
    getTrainingStatus,
    getTrainingProgress,
    startTrainingAPI,
    stopTrainingAPI
} from '../services/api';
import DataManager from './DataManager';
import AdvancedTrainingConfig from './AdvancedTrainingConfig';
import DatabaseConfig from './DatabaseConfig';
import OllamaConfig from './OllamaConfig';
import './TrainingDashboard.css';

const TrainingDashboard = () => {
    const navigate = useNavigate();
    const [trainingStatus, setTrainingStatus] = useState('idle');
    const [selectedSubject, setSelectedSubject] = useState('mathematics');
    const [trainingConfig, setTrainingConfig] = useState({
        modelSize: '1B',
        epochs: 3,
        batchSize: 4,
        learningRate: 2e-4,
        useUnsloth: true,
        useLoRA: true,
        trainingMode: 'fine_tune',
        baseModel: null,
        checkpointId: null,
        resumeFromCheckpoint: false,
        transferFromSubject: null,
        retrainExisting: false
    });
    const [trainingLogs, setTrainingLogs] = useState([]);
    const [models, setModels] = useState([]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [advancedConfig, setAdvancedConfig] = useState({});
    const [trainingData, setTrainingData] = useState(null);
    const [showDatabaseConfig, setShowDatabaseConfig] = useState(false);
    const [databaseData, setDatabaseData] = useState(null);
    const [showOllamaConfig, setShowOllamaConfig] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState({ connected: false, baseUrl: '' });

    const subjects = [
        { id: 'mathematics', name: 'Mathematics', description: 'Arithmetic, algebra, geometry, calculus' },
        { id: 'programming', name: 'Programming', description: 'Coding, algorithms, software development' },
        { id: 'science', name: 'Science', description: 'Physics, chemistry, biology' },
        { id: 'history', name: 'History', description: 'Historical events, civilizations' },
        { id: 'literature', name: 'Literature', description: 'Books, poetry, literary analysis' }
    ];

    const modelSizes = ['1B', '3B', '7B'];

    // Check authentication on component mount
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');

        console.log('TrainingDashboard: Checking authentication...');
        console.log('TrainingDashboard: userId:', userId);
        console.log('TrainingDashboard: username:', storedUsername);

        if (userId && storedUsername) {
            setIsAuthenticated(true);
            setUsername(storedUsername);
            fetchModels();
            fetchTrainingStatus();
        } else {
            console.warn('TrainingDashboard: User not authenticated, redirecting to login');
            setIsAuthenticated(false);
            // Optionally redirect to login or show login prompt
            // navigate('/login');
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchModels();
            fetchTrainingStatus();
            checkOllamaStatus();
        }
    }, [isAuthenticated]);

    const checkOllamaStatus = async () => {
        try {
            const { getOllamaStatus } = await import('../services/api');
            const response = await getOllamaStatus();
            console.log('Ollama status response:', response.data);
            setOllamaStatus({
                connected: response.data.connected,
                baseUrl: response.data.baseUrl
            });

            if (response.data.connected) {
                addLog(`Ollama connected: ${response.data.baseUrl}`);
            }
        } catch (error) {
            console.log('Ollama status check failed:', error);
            setOllamaStatus({ connected: false, baseUrl: '' });
        }
    };

    const fetchModels = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.warn('No user ID found in localStorage');
                return;
            }

            console.log('TrainingDashboard: Fetching models...');
            const response = await getTrainingModels();
            setModels(response.data.models || []);
        } catch (error) {
            console.error('Error fetching models:', error);
            setModels([]);
        }
    };

    const fetchTrainingStatus = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.warn('No user ID found in localStorage');
                return;
            }

            console.log('TrainingDashboard: Fetching training status...');
            const response = await getTrainingStatus();
            setTrainingStatus(response.data.status || 'idle');
        } catch (error) {
            console.error('Error fetching training status:', error);
            setTrainingStatus('idle');
        }
    };

    const startTraining = async () => {
        try {
            setTrainingStatus('starting');
            const response = await startTrainingAPI({ subject: selectedSubject, config: trainingConfig });

            if (response.data.success) {
                setTrainingStatus('training');
                addLog(`Started training ${selectedSubject} model with ${trainingConfig.modelSize} parameters`);
                pollTrainingProgress();
            } else {
                setTrainingStatus('error');
                addLog(`Error starting training: ${response.data.error}`);
            }
        } catch (error) {
            setTrainingStatus('error');
            addLog(`Error: ${error.message}`);
            console.error('Training start error:', error);
        }
    };

    const stopTraining = async () => {
        try {
            const response = await stopTrainingAPI();
            if (response.data.success) {
                setTrainingStatus('stopped');
                addLog('Training stopped by user');
            }
        } catch (error) {
            addLog(`Error stopping training: ${error.message}`);
            console.error('Training stop error:', error);
        }
    };

    const pollTrainingProgress = () => {
        const interval = setInterval(async () => {
            try {
                // We might need to pass a training ID here, but for now we'll call it without parameters
                // This might need to be updated based on how the backend API works
                const response = await getTrainingProgress();
                const data = response.data;

                if (data.logs) {
                    data.logs.forEach(log => addLog(log));
                }

                if (data.status === 'completed' || data.status === 'error') {
                    setTrainingStatus(data.status);
                    clearInterval(interval);
                    fetchModels(); // Refresh models list
                }
            } catch (error) {
                console.error('Error polling progress:', error);
            }
        }, 2000);

        return interval;
    };

    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setTrainingLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    };

    const handleConfigChange = (key, value) => {
        setTrainingConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleDatabaseDataExtracted = (extractedData) => {
        setDatabaseData(extractedData);
        setTrainingData(extractedData.data);
        setShowDatabaseConfig(false);

        // Update training config with database info
        setTrainingConfig(prev => ({
            ...prev,
            dataSource: 'database',
            dataFormat: extractedData.format,
            dataValidation: extractedData.validation,
            dataConfig: extractedData.config
        }));

        addLog(`Database data extracted: ${extractedData.data.length} samples in ${extractedData.format} format`);
        if (extractedData.report) {
            addLog(`Data quality: ${extractedData.report.summary.successRate.toFixed(1)}% success rate`);
        }
    };

    const handleOllamaConfigurationChange = (config) => {
        setOllamaStatus(config);
        if (config.connected) {
            addLog(`Ollama configured successfully: ${config.baseUrl}`);
        }
        // Refresh status after configuration change
        setTimeout(checkOllamaStatus, 1000);
    };

    const downloadModel = async (modelId) => {
        try {
            const response = await fetch(`/api/training/download/${modelId}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `model_${modelId}.zip`;
            a.click();
        } catch (error) {
            addLog(`Error downloading model: ${error.message}`);
        }
    };

    // Show login prompt if not authenticated
    if (!isAuthenticated) {
        return (
            <div className="training-dashboard">
                <div className="dashboard-header">
                    <div className="header-nav">
                        <button
                            onClick={() => navigate('/chat')}
                            className="back-button"
                            title="Back to Chat"
                        >
                            ← Back to Chat
                        </button>
                    </div>
                    <h1>🧠 LLM Training Dashboard</h1>
                    <div className="auth-prompt">
                        <h2>Authentication Required</h2>
                        <p>Please log in to access the LLM Training Dashboard.</p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/chat')}
                        >
                            Go to Chat & Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="training-dashboard">
            <div className="dashboard-header">
                <div className="header-nav">
                    <button
                        onClick={() => navigate('/chat')}
                        className="back-button"
                        title="Back to Chat"
                    >
                        ← Back to Chat
                    </button>
                </div>
                <h1>🧠 LLM Training Dashboard</h1>
                <p>Welcome, {username}! Train specialized subject-specific language models</p>
            </div>

            <div className="dashboard-grid">
                {/* Data Management */}
                <DataManager
                    selectedSubject={selectedSubject}
                    onDataUpdate={fetchModels}
                />

                {/* Database Integration */}
                <div className="dashboard-section">
                    <div className="section-header">
                        <h3>🗄️ Database Integration</h3>
                        <button
                            className="config-btn"
                            onClick={() => setShowDatabaseConfig(!showDatabaseConfig)}
                        >
                            {showDatabaseConfig ? 'Hide' : 'Configure Database'}
                        </button>
                    </div>

                    {databaseData && (
                        <div className="database-summary">
                            <div className="summary-item">
                                <strong>Source:</strong> {databaseData.format} from database
                            </div>
                            <div className="summary-item">
                                <strong>Records:</strong> {databaseData.data.length}
                            </div>
                            <div className="summary-item">
                                <strong>Quality:</strong> {databaseData.report?.summary.successRate.toFixed(1)}% success rate
                            </div>
                            {databaseData.validation?.errors?.length > 0 && (
                                <div className="summary-item error">
                                    <strong>Issues:</strong> {databaseData.validation.errors.length} errors, {databaseData.validation.warnings.length} warnings
                                </div>
                            )}
                        </div>
                    )}

                    {showDatabaseConfig && (
                        <DatabaseConfig
                            onDataExtracted={handleDatabaseDataExtracted}
                            selectedSubject={selectedSubject}
                        />
                    )}
                </div>

                {/* Ollama Configuration */}
                <div className="dashboard-section">
                    <div className="section-header">
                        <h3>🦙 Ollama Configuration</h3>
                        <div className="header-actions">
                            <button
                                className="refresh-btn"
                                onClick={checkOllamaStatus}
                                title="Refresh Ollama Status"
                            >
                                🔄
                            </button>
                            <button
                                className="config-btn"
                                onClick={() => setShowOllamaConfig(!showOllamaConfig)}
                            >
                                {showOllamaConfig ? 'Hide' : 'Configure'}
                            </button>
                        </div>
                    </div>

                    {ollamaStatus.connected && (
                        <div className="database-summary">
                            <div className="summary-item">
                                <strong>Status:</strong> Connected
                            </div>
                            <div className="summary-item">
                                <strong>URL:</strong> {ollamaStatus.baseUrl}
                            </div>
                        </div>
                    )}

                    {!ollamaStatus.connected && (
                        <div className="database-summary">
                            <div className="summary-item error">
                                <strong>Status:</strong> Not connected - Configure Ollama to use local models
                            </div>
                        </div>
                    )}

                    {showOllamaConfig && (
                        <OllamaConfig
                            onConfigurationChange={handleOllamaConfigurationChange}
                        />
                    )}
                </div>

                {/* Training Section */}
                <div className="training-section">
                    {/* Training Configuration */}
                    <div className="config-panel">
                    <h2>Training Configuration</h2>
                    
                    <div className="form-group">
                        <label>Subject Domain</label>
                        <select 
                            value={selectedSubject} 
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            disabled={trainingStatus === 'training'}
                        >
                            {subjects.map(subject => (
                                <option key={subject.id} value={subject.id}>
                                    {subject.name} - {subject.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Model Size</label>
                        <select 
                            value={trainingConfig.modelSize} 
                            onChange={(e) => handleConfigChange('modelSize', e.target.value)}
                            disabled={trainingStatus === 'training'}
                        >
                            {modelSizes.map(size => (
                                <option key={size} value={size}>{size} Parameters</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Epochs</label>
                            <input 
                                type="number" 
                                value={trainingConfig.epochs}
                                onChange={(e) => handleConfigChange('epochs', parseInt(e.target.value))}
                                min="1" max="10"
                                disabled={trainingStatus === 'training'}
                            />
                        </div>
                        <div className="form-group">
                            <label>Batch Size</label>
                            <input 
                                type="number" 
                                value={trainingConfig.batchSize}
                                onChange={(e) => handleConfigChange('batchSize', parseInt(e.target.value))}
                                min="1" max="16"
                                disabled={trainingStatus === 'training'}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Learning Rate</label>
                        <input 
                            type="number" 
                            step="0.0001"
                            value={trainingConfig.learningRate}
                            onChange={(e) => handleConfigChange('learningRate', parseFloat(e.target.value))}
                            disabled={trainingStatus === 'training'}
                        />
                    </div>

                    <div className="checkbox-group">
                        <label>
                            <input 
                                type="checkbox" 
                                checked={trainingConfig.useUnsloth}
                                onChange={(e) => handleConfigChange('useUnsloth', e.target.checked)}
                                disabled={trainingStatus === 'training'}
                            />
                            Use Unsloth (Memory Efficient)
                        </label>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={trainingConfig.useLoRA}
                                onChange={(e) => handleConfigChange('useLoRA', e.target.checked)}
                                disabled={trainingStatus === 'training'}
                            />
                            Use LoRA (Low-Rank Adaptation)
                        </label>
                    </div>

                    {/* Advanced Training Configuration */}
                    <AdvancedTrainingConfig
                        subject={selectedSubject}
                        config={trainingConfig}
                        onConfigChange={setTrainingConfig}
                        availableSubjects={['mathematics', 'programming', 'science', 'history', 'literature']}
                    />

                    <div className="training-controls">
                        {trainingStatus === 'idle' || trainingStatus === 'completed' || trainingStatus === 'error' ? (
                            <button className="btn-primary" onClick={startTraining}>
                                🚀 Start Training
                            </button>
                        ) : (
                            <button className="btn-danger" onClick={stopTraining}>
                                ⏹️ Stop Training
                            </button>
                        )}
                    </div>
                </div>

                    {/* Training Status */}
                    <div className="status-panel">
                    <h2>Training Status</h2>
                    <div className={`status-indicator ${trainingStatus}`}>
                        <div className="status-icon">
                            {trainingStatus === 'idle' && '⏸️'}
                            {trainingStatus === 'starting' && '🔄'}
                            {trainingStatus === 'training' && '🔥'}
                            {trainingStatus === 'completed' && '✅'}
                            {trainingStatus === 'error' && '❌'}
                            {trainingStatus === 'stopped' && '⏹️'}
                        </div>
                        <div className="status-text">
                            {trainingStatus.charAt(0).toUpperCase() + trainingStatus.slice(1)}
                        </div>
                    </div>

                    <div className="training-logs">
                        <h3>Training Logs</h3>
                        <div className="logs-container">
                            {trainingLogs.map((log, index) => (
                                <div key={index} className="log-entry">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>

                {/* Trained Models */}
                <div className="models-panel">
                    <h2>Trained Models</h2>
                    <div className="models-list">
                        {models.length === 0 ? (
                            <p>No trained models yet. Start training to create your first model!</p>
                        ) : (
                            models.map(model => (
                                <div key={model.id} className="model-card">
                                    <div className="model-info">
                                        <h4>{model.subject} Model</h4>
                                        <p>Size: {model.size} | Accuracy: {model.accuracy}%</p>
                                        <p>Trained: {new Date(model.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="model-actions">
                                        <button 
                                            className="btn-secondary"
                                            onClick={() => downloadModel(model.id)}
                                        >
                                            📥 Download
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingDashboard;
