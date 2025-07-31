import React, { useState, useEffect } from 'react';
import { getCustomModels, deleteCustomModel } from '../services/api';
import CustomModelUpload from './CustomModelUpload';
import './CustomModelManager.css';

const CustomModelManager = ({ onModelSelect, selectedModel }) => {
    const [customModels, setCustomModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [error, setError] = useState('');
    const [downloadProgress, setDownloadProgress] = useState({});
    const [availableModels, setAvailableModels] = useState([]);
    const [showModelHub, setShowModelHub] = useState(false);

    useEffect(() => {
        loadCustomModels();
        loadAvailableModels();
    }, []);

    const loadAvailableModels = () => {
        // Popular pre-trained models available for download
        setAvailableModels([
            {
                id: 'gpt2-small',
                name: 'GPT-2 Small',
                description: 'Small GPT-2 model (124M parameters)',
                size: '500MB',
                format: 'pytorch',
                downloadUrl: 'https://huggingface.co/gpt2/resolve/main/pytorch_model.bin',
                configUrl: 'https://huggingface.co/gpt2/resolve/main/config.json',
                tokenizerUrl: 'https://huggingface.co/gpt2/resolve/main/tokenizer.json',
                type: 'foundation',
                architecture: 'transformer',
                useCase: 'text-generation'
            },
            {
                id: 'distilbert-base',
                name: 'DistilBERT Base',
                description: 'Distilled BERT model (66M parameters)',
                size: '250MB',
                format: 'pytorch',
                downloadUrl: 'https://huggingface.co/distilbert-base-uncased/resolve/main/pytorch_model.bin',
                configUrl: 'https://huggingface.co/distilbert-base-uncased/resolve/main/config.json',
                tokenizerUrl: 'https://huggingface.co/distilbert-base-uncased/resolve/main/tokenizer.json',
                type: 'foundation',
                architecture: 'bert',
                useCase: 'classification'
            },
            {
                id: 't5-small',
                name: 'T5 Small',
                description: 'Small T5 model (60M parameters)',
                size: '240MB',
                format: 'pytorch',
                downloadUrl: 'https://huggingface.co/t5-small/resolve/main/pytorch_model.bin',
                configUrl: 'https://huggingface.co/t5-small/resolve/main/config.json',
                tokenizerUrl: 'https://huggingface.co/t5-small/resolve/main/tokenizer.json',
                type: 'foundation',
                architecture: 't5',
                useCase: 'text-to-text'
            },
            {
                id: 'bert-base-uncased',
                name: 'BERT Base Uncased',
                description: 'Base BERT model (110M parameters)',
                size: '440MB',
                format: 'pytorch',
                downloadUrl: 'https://huggingface.co/bert-base-uncased/resolve/main/pytorch_model.bin',
                configUrl: 'https://huggingface.co/bert-base-uncased/resolve/main/config.json',
                tokenizerUrl: 'https://huggingface.co/bert-base-uncased/resolve/main/tokenizer.json',
                type: 'foundation',
                architecture: 'bert',
                useCase: 'classification'
            },
            {
                id: 'roberta-base',
                name: 'RoBERTa Base',
                description: 'Base RoBERTa model (125M parameters)',
                size: '500MB',
                format: 'pytorch',
                downloadUrl: 'https://huggingface.co/roberta-base/resolve/main/pytorch_model.bin',
                configUrl: 'https://huggingface.co/roberta-base/resolve/main/config.json',
                tokenizerUrl: 'https://huggingface.co/roberta-base/resolve/main/tokenizer.json',
                type: 'foundation',
                architecture: 'roberta',
                useCase: 'classification'
            }
        ]);
    };

    const loadCustomModels = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await getCustomModels();
            setCustomModels(response.data.models || []);
        } catch (error) {
            console.error('Error loading custom models:', error);
            setError('Failed to load custom models');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = (newModel) => {
        setCustomModels(prev => [newModel, ...prev]);
        setShowUpload(false);
    };

    const handleDeleteModel = async (modelId) => {
        if (!window.confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteCustomModel(modelId);
            setCustomModels(prev => prev.filter(model => model.id !== modelId));

            // If the deleted model was selected, clear selection
            if (selectedModel?.id === modelId) {
                onModelSelect(null);
            }
        } catch (error) {
            console.error('Error deleting model:', error);
            setError('Failed to delete model');
        }
    };

    const handleDownloadModel = async (model) => {
        try {
            setDownloadProgress(prev => ({ ...prev, [model.id]: { progress: 0, status: 'downloading' } }));

            // Simulate download progress
            const downloadFiles = [
                { name: 'model', url: model.downloadUrl, size: parseInt(model.size) },
                { name: 'config', url: model.configUrl, size: 10 },
                { name: 'tokenizer', url: model.tokenizerUrl, size: 5 }
            ];

            let totalProgress = 0;
            const totalFiles = downloadFiles.length;

            for (let i = 0; i < downloadFiles.length; i++) {
                const file = downloadFiles[i];

                // Simulate file download with progress
                for (let progress = 0; progress <= 100; progress += 10) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    const overallProgress = ((i * 100 + progress) / totalFiles);
                    setDownloadProgress(prev => ({
                        ...prev,
                        [model.id]: {
                            progress: overallProgress,
                            status: 'downloading',
                            currentFile: file.name
                        }
                    }));
                }
            }

            // Create downloaded model entry
            const downloadedModel = {
                id: `downloaded-${model.id}`,
                name: model.name,
                description: model.description,
                size: model.size,
                format: model.format,
                type: 'downloaded',
                architecture: model.architecture,
                useCase: model.useCase,
                downloadedAt: new Date().toISOString(),
                files: {
                    model: `models/${model.id}/pytorch_model.bin`,
                    config: `models/${model.id}/config.json`,
                    tokenizer: `models/${model.id}/tokenizer.json`
                }
            };

            setCustomModels(prev => [downloadedModel, ...prev]);
            setDownloadProgress(prev => ({
                ...prev,
                [model.id]: { progress: 100, status: 'completed' }
            }));

            // Clear progress after 3 seconds
            setTimeout(() => {
                setDownloadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[model.id];
                    return newProgress;
                });
            }, 3000);

        } catch (error) {
            console.error('Download failed:', error);
            setDownloadProgress(prev => ({
                ...prev,
                [model.id]: { progress: 0, status: 'failed', error: error.message }
            }));
        }
    };

    const handleExportModel = async (model) => {
        try {
            // Create a downloadable model package
            const modelPackage = {
                metadata: {
                    name: model.name,
                    description: model.description,
                    architecture: model.architecture,
                    format: model.format,
                    exportedAt: new Date().toISOString(),
                    version: '1.0.0'
                },
                files: model.files || {},
                config: model.config || {}
            };

            const blob = new Blob([JSON.stringify(modelPackage, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${model.name.replace(/\s+/g, '_').toLowerCase()}_model_package.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export failed:', error);
            setError('Failed to export model');
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'Unknown';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="custom-model-manager">
            <div className="manager-header">
                <h3>🎯 Custom Models</h3>
                <button 
                    className="upload-btn"
                    onClick={() => setShowUpload(true)}
                >
                    📤 Upload Model
                </button>
            </div>

            {error && (
                <div className="error-message">
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <div>Loading custom models...</div>
                </div>
            ) : customModels.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <div className="empty-title">No Custom Models</div>
                    <div className="empty-description">
                        Upload your own pre-trained models to use as starting points for training.
                    </div>
                    <button 
                        className="upload-btn primary"
                        onClick={() => setShowUpload(true)}
                    >
                        📤 Upload Your First Model
                    </button>
                </div>
            ) : (
                <div className="models-grid">
                    {customModels.map(model => (
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
                                        <span className="model-format">{model.model_format}</span>
                                        {model.verified && (
                                            <span className="verified-badge">✅ Verified</span>
                                        )}
                                    </div>
                                </div>
                                <div className="model-actions">
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteModel(model.id);
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

                            <div className="model-details">
                                <div className="detail-item">
                                    <span className="detail-label">Size:</span>
                                    <span className="detail-value">{formatFileSize(model.file_size)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">Uploaded:</span>
                                    <span className="detail-value">{formatDate(model.created_at)}</span>
                                </div>
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

            {/* Upload Modal */}
            {showUpload && (
                <div className="modal-overlay">
                    <CustomModelUpload
                        onUploadSuccess={handleUploadSuccess}
                        onClose={() => setShowUpload(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default CustomModelManager;
