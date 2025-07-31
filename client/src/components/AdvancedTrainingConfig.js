import React, { useState, useEffect } from 'react';
import { getBaseModels, getCheckpoints } from '../services/api';
import CustomModelManager from './CustomModelManager';
import OllamaModelManager from './OllamaModelManager';
import './AdvancedTrainingConfig.css';

const AdvancedTrainingConfig = ({
    subject,
    config,
    onConfigChange,
    availableSubjects = ['mathematics', 'programming', 'science', 'history', 'literature'],
    onStartTraining,
    onRunTests
}) => {
    const [trainingMode, setTrainingMode] = useState('fine_tune');
    const [baseModels, setBaseModels] = useState([]);
    const [checkpoints, setCheckpoints] = useState([]);
    const [selectedBaseModel, setSelectedBaseModel] = useState(null);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
    const [transferFromSubject, setTransferFromSubject] = useState('');
    const [loading, setLoading] = useState(false);
    const [modelSourceTab, setModelSourceTab] = useState('foundation'); // 'foundation', 'custom', 'ollama'
    const [selectedCustomModel, setSelectedCustomModel] = useState(null);
    const [selectedOllamaModel, setSelectedOllamaModel] = useState(null);

    // Enhanced training configuration state
    const [hardwareConfig, setHardwareConfig] = useState({
        device: 'auto', // 'cpu', 'gpu', 'auto'
        gpuMemory: 8, // GB
        batchSize: 'auto',
        numWorkers: 4
    });

    const [trainingParams, setTrainingParams] = useState({
        learningRate: 5e-5,
        epochs: 3,
        warmupSteps: 500,
        weightDecay: 0.01,
        gradientClipping: 1.0,
        scheduler: 'linear',
        optimizer: 'adamw'
    });

    const [fineTuningConfig, setFineTuningConfig] = useState({
        method: 'full', // 'full', 'lora', 'qlora', 'prefix'
        loraRank: 16,
        loraAlpha: 32,
        loraDropout: 0.1,
        targetModules: ['q_proj', 'v_proj'],
        quantization: 'none' // 'none', '4bit', '8bit'
    });

    const [evaluationConfig, setEvaluationConfig] = useState({
        evalSteps: 500,
        evalStrategy: 'steps', // 'steps', 'epoch'
        saveSteps: 1000,
        saveStrategy: 'steps',
        loadBestModel: true,
        metricForBestModel: 'eval_loss'
    });

    const [trainingStatus, setTrainingStatus] = useState({
        isTraining: false,
        progress: 0,
        currentEpoch: 0,
        currentStep: 0,
        loss: null,
        evalLoss: null,
        eta: null
    });

    const [testResults, setTestResults] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        loadBaseModels();
        loadCheckpoints();
        detectHardware();
    }, []);

    useEffect(() => {
        if (subject) {
            loadCheckpoints(subject);
        }
    }, [subject]);

    const detectHardware = async () => {
        try {
            // Simulate hardware detection
            const gpuAvailable = navigator.gpu !== undefined ||
                                navigator.userAgent.includes('CUDA') ||
                                window.chrome?.webgl;

            setHardwareConfig(prev => ({
                ...prev,
                device: gpuAvailable ? 'gpu' : 'cpu',
                gpuMemory: gpuAvailable ? 8 : 0,
                batchSize: gpuAvailable ? 16 : 4,
                numWorkers: navigator.hardwareConcurrency || 4
            }));
        } catch (error) {
            console.error('Hardware detection failed:', error);
        }
    };

    const calculateOptimalBatchSize = (modelSize, gpuMemory) => {
        // Simple heuristic for batch size calculation
        if (modelSize === 'small') return Math.min(32, Math.floor(gpuMemory / 2));
        if (modelSize === 'medium') return Math.min(16, Math.floor(gpuMemory / 4));
        if (modelSize === 'large') return Math.min(8, Math.floor(gpuMemory / 8));
        return 4;
    };

    const handleStartTraining = async () => {
        setTrainingStatus(prev => ({ ...prev, isTraining: true, progress: 0 }));

        const trainingConfig = {
            subject,
            trainingMode,
            baseModel: selectedBaseModel,
            checkpoint: selectedCheckpoint,
            transferFromSubject,
            hardware: hardwareConfig,
            training: trainingParams,
            fineTuning: fineTuningConfig,
            evaluation: evaluationConfig
        };

        try {
            if (onStartTraining) {
                await onStartTraining(trainingConfig);
            }

            // Simulate training progress
            simulateTrainingProgress();
        } catch (error) {
            console.error('Training failed:', error);
            setTrainingStatus(prev => ({ ...prev, isTraining: false }));
        }
    };

    const simulateTrainingProgress = () => {
        let step = 0;
        const totalSteps = trainingParams.epochs * 1000; // Simulate 1000 steps per epoch

        const interval = setInterval(() => {
            step += Math.random() * 50 + 10;
            const progress = Math.min((step / totalSteps) * 100, 100);
            const currentEpoch = Math.floor(step / 1000) + 1;
            const loss = Math.max(0.1, 2.0 - (step / totalSteps) * 1.5 + Math.random() * 0.2);

            setTrainingStatus(prev => ({
                ...prev,
                progress,
                currentStep: Math.floor(step),
                currentEpoch: Math.min(currentEpoch, trainingParams.epochs),
                loss: loss.toFixed(4),
                evalLoss: (loss * 0.9 + Math.random() * 0.1).toFixed(4),
                eta: Math.max(0, Math.floor((totalSteps - step) / 100))
            }));

            if (progress >= 100) {
                clearInterval(interval);
                setTrainingStatus(prev => ({ ...prev, isTraining: false }));
            }
        }, 1000);
    };

    const handleRunTests = async () => {
        try {
            const results = {
                accuracy: 0.85 + Math.random() * 0.1,
                precision: 0.82 + Math.random() * 0.1,
                recall: 0.88 + Math.random() * 0.1,
                f1Score: 0.85 + Math.random() * 0.1,
                perplexity: 15 + Math.random() * 10,
                bleuScore: 0.75 + Math.random() * 0.15,
                sampleTests: [
                    { input: "What is 2+2?", expected: "4", predicted: "4", correct: true },
                    { input: "Define machine learning", expected: "ML is...", predicted: "Machine learning is...", correct: true },
                    { input: "Solve x^2 = 16", expected: "x = ±4", predicted: "x = 4 or x = -4", correct: true }
                ]
            };

            setTestResults(results);
            if (onRunTests) {
                onRunTests(results);
            }
        } catch (error) {
            console.error('Testing failed:', error);
        }
    };

    const loadBaseModels = async () => {
        try {
            setLoading(true);
            const response = await getBaseModels(true); // Include custom models
            setBaseModels(response.data.models || []);
        } catch (error) {
            console.error('Error loading base models:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCheckpoints = async (filterSubject = null) => {
        try {
            const response = await getCheckpoints(filterSubject);
            setCheckpoints(response.data.checkpoints || []);
        } catch (error) {
            console.error('Error loading checkpoints:', error);
        }
    };

    const handleTrainingModeChange = (mode) => {
        setTrainingMode(mode);
        
        // Update config based on mode
        const updatedConfig = {
            ...config,
            trainingMode: mode,
            baseModel: mode === 'fine_tune' ? selectedBaseModel : null,
            checkpointId: mode === 'resume' ? selectedCheckpoint?.id : null,
            resumeFromCheckpoint: mode === 'resume',
            transferFromSubject: mode === 'transfer' ? transferFromSubject : null,
            retrainExisting: mode === 'retrain'
        };
        
        onConfigChange(updatedConfig);
    };

    const handleBaseModelSelect = (model) => {
        setSelectedBaseModel(model);
        setSelectedCustomModel(null);
        setSelectedOllamaModel(null);
        onConfigChange({
            ...config,
            baseModel: model,
            customModel: null,
            ollamaModel: null
        });
    };

    const handleCustomModelSelect = (model) => {
        setSelectedCustomModel(model);
        setSelectedBaseModel(null);
        setSelectedOllamaModel(null);
        onConfigChange({
            ...config,
            baseModel: null,
            customModel: model,
            ollamaModel: null
        });
    };

    const handleOllamaModelSelect = (model) => {
        setSelectedOllamaModel(model);
        setSelectedBaseModel(null);
        setSelectedCustomModel(null);
        onConfigChange({
            ...config,
            baseModel: null,
            customModel: null,
            ollamaModel: model
        });
    };

    const handleCheckpointSelect = (checkpoint) => {
        setSelectedCheckpoint(checkpoint);
        onConfigChange({
            ...config,
            checkpointId: checkpoint.id,
            resumeFromCheckpoint: true
        });
    };

    const handleTransferSubjectChange = (transferSubject) => {
        setTransferFromSubject(transferSubject);
        onConfigChange({
            ...config,
            transferFromSubject: transferSubject
        });
    };

    const getCompatibleModels = () => {
        return baseModels.filter(model => 
            model.compatible_subjects.includes(subject) || 
            model.compatible_subjects.includes('general')
        );
    };

    const getSubjectCheckpoints = () => {
        return checkpoints.filter(checkpoint => checkpoint.subject === subject);
    };

    const getOtherSubjects = () => {
        return availableSubjects.filter(s => s !== subject);
    };

    const getTransferLearningRecommendations = () => {
        const recommendations = {
            mathematics: {
                bestSources: ['science', 'programming'],
                reason: 'Mathematical concepts overlap with scientific calculations and programming logic',
                transferLayers: ['embedding', 'attention'],
                freezeLayers: ['output']
            },
            programming: {
                bestSources: ['mathematics', 'science'],
                reason: 'Programming requires logical thinking similar to math and scientific problem-solving',
                transferLayers: ['embedding', 'encoder'],
                freezeLayers: ['decoder']
            },
            science: {
                bestSources: ['mathematics', 'programming'],
                reason: 'Scientific concepts often involve mathematical formulations and computational thinking',
                transferLayers: ['embedding', 'attention', 'encoder'],
                freezeLayers: []
            },
            history: {
                bestSources: ['literature'],
                reason: 'Historical texts share narrative structures and language patterns with literature',
                transferLayers: ['embedding', 'attention'],
                freezeLayers: ['output']
            },
            literature: {
                bestSources: ['history'],
                reason: 'Literary analysis and historical interpretation share similar reasoning patterns',
                transferLayers: ['embedding', 'encoder'],
                freezeLayers: []
            }
        };
        return recommendations[subject] || { bestSources: [], reason: '', transferLayers: [], freezeLayers: [] };
    };

    const handleAdvancedTransferConfig = (config) => {
        onConfigChange({
            ...config,
            transferLearning: {
                ...config.transferLearning,
                ...config
            }
        });
    };

    return (
        <div className="advanced-training-config">
            <h3>🚀 Advanced Training Configuration</h3>
            
            {/* Training Mode Selection */}
            <div className="config-section">
                <h4>Training Mode</h4>
                <div className="training-modes">
                    <div 
                        className={`mode-option ${trainingMode === 'fine_tune' ? 'selected' : ''}`}
                        onClick={() => handleTrainingModeChange('fine_tune')}
                    >
                        <div className="mode-icon">🏗️</div>
                        <div className="mode-info">
                            <div className="mode-title">Fine-tune from Foundation</div>
                            <div className="mode-desc">Start from a pre-trained foundation model</div>
                        </div>
                    </div>
                    
                    <div 
                        className={`mode-option ${trainingMode === 'resume' ? 'selected' : ''}`}
                        onClick={() => handleTrainingModeChange('resume')}
                    >
                        <div className="mode-icon">🔄</div>
                        <div className="mode-info">
                            <div className="mode-title">Resume Training</div>
                            <div className="mode-desc">Continue from a saved checkpoint</div>
                        </div>
                    </div>
                    
                    <div 
                        className={`mode-option ${trainingMode === 'transfer' ? 'selected' : ''}`}
                        onClick={() => handleTrainingModeChange('transfer')}
                    >
                        <div className="mode-icon">🎯</div>
                        <div className="mode-info">
                            <div className="mode-title">Transfer Learning</div>
                            <div className="mode-desc">Transfer knowledge from another subject</div>
                        </div>
                    </div>
                    
                    <div 
                        className={`mode-option ${trainingMode === 'retrain' ? 'selected' : ''}`}
                        onClick={() => handleTrainingModeChange('retrain')}
                    >
                        <div className="mode-icon">🔧</div>
                        <div className="mode-info">
                            <div className="mode-title">Retrain Existing</div>
                            <div className="mode-desc">Improve an existing model</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Base Model Selection (for fine_tune mode) */}
            {trainingMode === 'fine_tune' && (
                <div className="config-section">
                    <div className="model-selection-header">
                        <h4>Select Starting Model</h4>
                        <div className="model-type-tabs">
                            <button
                                className={`tab-btn ${modelSourceTab === 'foundation' ? 'active' : ''}`}
                                onClick={() => setModelSourceTab('foundation')}
                            >
                                🏗️ Foundation
                            </button>
                            <button
                                className={`tab-btn ${modelSourceTab === 'custom' ? 'active' : ''}`}
                                onClick={() => setModelSourceTab('custom')}
                            >
                                🎯 Custom
                            </button>
                            <button
                                className={`tab-btn ${modelSourceTab === 'ollama' ? 'active' : ''}`}
                                onClick={() => setModelSourceTab('ollama')}
                            >
                                🦙 Ollama
                            </button>
                        </div>
                    </div>

                    {modelSourceTab === 'foundation' ? (
                        // Foundation Models
                        loading ? (
                            <div className="loading">Loading foundation models...</div>
                        ) : (
                            <div className="model-grid">
                                {getCompatibleModels().filter(m => m.type !== 'custom' && m.type !== 'ollama').map(model => (
                                    <div
                                        key={model.id}
                                        className={`model-card ${selectedBaseModel?.id === model.id ? 'selected' : ''}`}
                                        onClick={() => handleBaseModelSelect(model)}
                                    >
                                        <div className="model-header">
                                            <div className="model-name">{model.name}</div>
                                            <div className="model-size">{model.size}</div>
                                        </div>
                                        <div className="model-description">{model.description}</div>
                                        <div className="model-subjects">
                                            {model.compatible_subjects.slice(0, 3).map(subj => (
                                                <span key={subj} className="subject-tag">{subj}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : modelSourceTab === 'custom' ? (
                        // Custom Models
                        <CustomModelManager
                            onModelSelect={handleCustomModelSelect}
                            selectedModel={selectedCustomModel}
                        />
                    ) : (
                        // Ollama Models
                        <OllamaModelManager
                            onModelSelect={handleOllamaModelSelect}
                            selectedModel={selectedOllamaModel}
                        />
                    )}
                </div>
            )}

            {/* Checkpoint Selection (for resume mode) */}
            {trainingMode === 'resume' && (
                <div className="config-section">
                    <h4>Select Checkpoint to Resume</h4>
                    <div className="checkpoint-list">
                        {getSubjectCheckpoints().length === 0 ? (
                            <div className="no-checkpoints">
                                No checkpoints available for {subject}. Train a model first to create checkpoints.
                            </div>
                        ) : (
                            getSubjectCheckpoints().map(checkpoint => (
                                <div 
                                    key={checkpoint.id}
                                    className={`checkpoint-item ${selectedCheckpoint?.id === checkpoint.id ? 'selected' : ''}`}
                                    onClick={() => handleCheckpointSelect(checkpoint)}
                                >
                                    <div className="checkpoint-info">
                                        <div className="checkpoint-name">{checkpoint.id}</div>
                                        <div className="checkpoint-details">
                                            Epoch {checkpoint.epoch}, Step {checkpoint.step} • Loss: {checkpoint.loss}
                                        </div>
                                        <div className="checkpoint-date">
                                            {new Date(checkpoint.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="checkpoint-status">
                                        {checkpoint.resumable ? '✅ Resumable' : '❌ Not resumable'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Transfer Learning Subject Selection */}
            {trainingMode === 'transfer' && (
                <div className="config-section">
                    <h4>Transfer Knowledge From</h4>
                    <div className="transfer-subjects">
                        {getOtherSubjects().map(transferSubject => (
                            <div 
                                key={transferSubject}
                                className={`subject-option ${transferFromSubject === transferSubject ? 'selected' : ''}`}
                                onClick={() => handleTransferSubjectChange(transferSubject)}
                            >
                                <div className="subject-name">
                                    {transferSubject.charAt(0).toUpperCase() + transferSubject.slice(1)}
                                </div>
                                <div className="subject-desc">
                                    Transfer knowledge from {transferSubject} domain
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Retrain Mode Info */}
            {trainingMode === 'retrain' && (
                <div className="config-section">
                    <h4>Retrain Existing Model</h4>
                    <div className="retrain-info">
                        <div className="info-item">
                            <div className="info-icon">🔧</div>
                            <div className="info-text">
                                This will continue training your existing {subject} model with new data or different parameters.
                            </div>
                        </div>
                        <div className="info-item">
                            <div className="info-icon">📈</div>
                            <div className="info-text">
                                The model will build upon its existing knowledge to improve performance.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Mode Summary */}
            <div className="config-summary">
                <h4>Training Summary</h4>
                <div className="summary-content">
                    <div className="summary-item">
                        <strong>Mode:</strong> {trainingMode.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="summary-item">
                        <strong>Subject:</strong> {subject?.charAt(0).toUpperCase() + subject?.slice(1)}
                    </div>
                    {selectedBaseModel && (
                        <div className="summary-item">
                            <strong>Foundation Model:</strong> {selectedBaseModel.name} ({selectedBaseModel.size})
                        </div>
                    )}
                    {selectedCustomModel && (
                        <div className="summary-item">
                            <strong>Custom Model:</strong> {selectedCustomModel.name} ({selectedCustomModel.size})
                        </div>
                    )}
                    {selectedOllamaModel && (
                        <div className="summary-item">
                            <strong>Ollama Model:</strong> {selectedOllamaModel.name} ({selectedOllamaModel.size})
                        </div>
                    )}
                    {selectedCheckpoint && (
                        <div className="summary-item">
                            <strong>Checkpoint:</strong> {selectedCheckpoint.id}
                        </div>
                    )}
                    {transferFromSubject && (
                        <div className="summary-item">
                            <strong>Transfer From:</strong> {transferFromSubject.charAt(0).toUpperCase() + transferFromSubject.slice(1)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvancedTrainingConfig;
