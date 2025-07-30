import React, { useState, useEffect } from 'react';
import { getCustomModels, deleteCustomModel } from '../services/api';
import CustomModelUpload from './CustomModelUpload';
import './CustomModelManager.css';

const CustomModelManager = ({ onModelSelect, selectedModel }) => {
    const [customModels, setCustomModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadCustomModels();
    }, []);

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
