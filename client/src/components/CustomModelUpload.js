import React, { useState, useRef } from 'react';
import { uploadCustomModel } from '../services/api';
import './CustomModelUpload.css';

const CustomModelUpload = ({ onUploadSuccess, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        modelSize: '',
        compatibleSubjects: [],
        modelFormat: 'huggingface'
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const availableSubjects = ['mathematics', 'programming', 'science', 'history', 'literature', 'general'];
    const modelFormats = [
        { value: 'huggingface', label: 'Hugging Face Transformers' },
        { value: 'pytorch', label: 'PyTorch (.pt/.pth)' },
        { value: 'safetensors', label: 'SafeTensors' },
        { value: 'onnx', label: 'ONNX' }
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleSubjectToggle = (subject) => {
        setFormData(prev => ({
            ...prev,
            compatibleSubjects: prev.compatibleSubjects.includes(subject)
                ? prev.compatibleSubjects.filter(s => s !== subject)
                : [...prev.compatibleSubjects, subject]
        }));
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (max 2GB)
            if (file.size > 2 * 1024 * 1024 * 1024) {
                setError('File size must be less than 2GB');
                return;
            }

            // Validate file type based on format
            const validExtensions = {
                huggingface: ['.bin', '.safetensors', '.json'],
                pytorch: ['.pt', '.pth'],
                safetensors: ['.safetensors'],
                onnx: ['.onnx']
            };

            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            const allowedExtensions = validExtensions[formData.modelFormat] || [];
            
            if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
                setError(`Invalid file type for ${formData.modelFormat}. Expected: ${allowedExtensions.join(', ')}`);
                return;
            }

            setSelectedFile(file);
            setError('');

            // Auto-fill model name if empty
            if (!formData.name) {
                const fileName = file.name.replace(/\.[^/.]+$/, "");
                setFormData(prev => ({
                    ...prev,
                    name: fileName
                }));
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // Simulate file input change
            const event = { target: { files: [file] } };
            handleFileSelect(event);
        }
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            setError('Model name is required');
            return false;
        }
        if (!formData.description.trim()) {
            setError('Model description is required');
            return false;
        }
        if (formData.compatibleSubjects.length === 0) {
            setError('Please select at least one compatible subject');
            return false;
        }
        if (!selectedFile) {
            setError('Please select a model file to upload');
            return false;
        }
        return true;
    };

    const handleUpload = async () => {
        if (!validateForm()) return;

        setUploading(true);
        setUploadProgress(0);
        setError('');

        try {
            const uploadData = new FormData();
            uploadData.append('modelFile', selectedFile);
            uploadData.append('name', formData.name);
            uploadData.append('description', formData.description);
            uploadData.append('modelSize', formData.modelSize);
            uploadData.append('compatibleSubjects', formData.compatibleSubjects.join(','));
            uploadData.append('modelFormat', formData.modelFormat);

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + Math.random() * 10;
                });
            }, 200);

            const response = await uploadCustomModel(uploadData);

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (response.data.success) {
                setTimeout(() => {
                    onUploadSuccess && onUploadSuccess(response.data.model);
                    onClose && onClose();
                }, 1000);
            } else {
                setError(response.data.error || 'Upload failed');
            }

        } catch (error) {
            setError(error.response?.data?.error || 'Upload failed. Please try again.');
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="custom-model-upload">
            <div className="upload-header">
                <h3>🚀 Upload Custom Model</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="upload-form">
                {/* Model Information */}
                <div className="form-section">
                    <h4>Model Information</h4>
                    
                    <div className="form-group">
                        <label>Model Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., My Custom GPT Model"
                            disabled={uploading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Description *</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Describe your model, its training data, and intended use cases..."
                            rows={3}
                            disabled={uploading}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Model Size</label>
                            <input
                                type="text"
                                name="modelSize"
                                value={formData.modelSize}
                                onChange={handleInputChange}
                                placeholder="e.g., 1B, 7B, 13B"
                                disabled={uploading}
                            />
                        </div>

                        <div className="form-group">
                            <label>Model Format</label>
                            <select
                                name="modelFormat"
                                value={formData.modelFormat}
                                onChange={handleInputChange}
                                disabled={uploading}
                            >
                                {modelFormats.map(format => (
                                    <option key={format.value} value={format.value}>
                                        {format.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Compatible Subjects */}
                <div className="form-section">
                    <h4>Compatible Subjects *</h4>
                    <div className="subjects-grid">
                        {availableSubjects.map(subject => (
                            <div
                                key={subject}
                                className={`subject-chip ${formData.compatibleSubjects.includes(subject) ? 'selected' : ''}`}
                                onClick={() => !uploading && handleSubjectToggle(subject)}
                            >
                                {subject.charAt(0).toUpperCase() + subject.slice(1)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* File Upload */}
                <div className="form-section">
                    <h4>Model File *</h4>
                    <div
                        className={`file-upload-area ${selectedFile ? 'has-file' : ''}`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            disabled={uploading}
                            accept=".bin,.safetensors,.json,.pt,.pth,.onnx"
                        />
                        
                        {selectedFile ? (
                            <div className="file-info">
                                <div className="file-icon">📁</div>
                                <div className="file-details">
                                    <div className="file-name">{selectedFile.name}</div>
                                    <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                                </div>
                                {!uploading && (
                                    <button
                                        className="remove-file"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedFile(null);
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="upload-prompt">
                                <div className="upload-icon">📤</div>
                                <div className="upload-text">
                                    <div>Click to select or drag & drop your model file</div>
                                    <div className="upload-hint">
                                        Supported formats: .bin, .safetensors, .pt, .pth, .onnx (max 2GB)
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                    <div className="upload-progress">
                        <div className="progress-bar">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        <div className="progress-text">
                            Uploading... {Math.round(uploadProgress)}%
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="error-message">
                        ⚠️ {error}
                    </div>
                )}

                {/* Upload Button */}
                <div className="upload-actions">
                    <button
                        className="cancel-btn"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        className="upload-btn"
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                    >
                        {uploading ? 'Uploading...' : 'Upload Model'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomModelUpload;
