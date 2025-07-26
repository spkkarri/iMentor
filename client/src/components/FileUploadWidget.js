// FileUploadWidget.js
import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';
import { FaTimesCircle } from 'react-icons/fa';
import './FileUploadWidget.css'; // Link to the external CSS file

const FileUploadWidget = ({ onUploadSuccess }) => {
    // ... (All JS logic remains exactly the same)
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const allowedFileTypesString = ".pdf,.txt,.docx,.doc,.pptx,.ppt,.py,.js,.bmp,.png,.jpg,.jpeg";

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        const newFiles = [];
        const newProgress = {};
        files.forEach(file => {
            const fileExt = "." + file.name.split('.').pop().toLowerCase();
            const MAX_SIZE_MB = 20;
            const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
            if (!allowedFileTypesString.includes(fileExt)) {
                newProgress[file.name] = { status: 'error', message: 'Invalid type' };
            } else if (file.size > MAX_SIZE_BYTES) {
                newProgress[file.name] = { status: 'error', message: `> ${MAX_SIZE_MB}MB` };
            } else {
                newFiles.push(file);
            }
        });
        setSelectedFiles(prev => [...prev, ...newFiles]);
        setUploadProgress(prev => ({ ...prev, ...newProgress }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    const removeFile = (fileName) => {
        setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
        });
    };
    const handleUploadAll = async () => {
        if (selectedFiles.length === 0) return;
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) {
            setUploadProgress({ 'system-error': { status: 'error', message: 'Not logged in.' } });
            return;
        }
        setIsUploading(true);
        const initialProgress = {};
        selectedFiles.forEach(file => {
            initialProgress[file.name] = { status: 'pending', message: 'Waiting...' };
        });
        setUploadProgress(initialProgress);
        for (const file of selectedFiles) {
            setUploadProgress(prev => ({ ...prev, [file.name]: { status: 'uploading', message: 'Uploading...' } }));
            const formData = new FormData();
            formData.append('file', file);
            try {
                await uploadFile(formData);
                setUploadProgress(prev => ({ ...prev, [file.name]: { status: 'success', message: 'Success!' } }));
                if (onUploadSuccess) onUploadSuccess();
            } catch (err) {
                setUploadProgress(prev => ({ ...prev, [file.name]: { status: 'error', message: err.response?.data?.message || 'Failed' } }));
            }
        }
        setIsUploading(false);
        setTimeout(() => {
            setSelectedFiles([]);
            setUploadProgress({});
        }, 4000);
    };
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="file-upload-widget">
            <h4>Upload Files</h4>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={allowedFileTypesString}
                style={{ display: 'none' }}
                aria-hidden="true"
                multiple
            />
            <button
                type="button"
                className="select-file-btn"
                onClick={triggerFileInput}
                disabled={isUploading}
            >
                Choose Files
            </button>

            <div className="selected-files-list">
                {selectedFiles.length === 0 && !isUploading && (
                    <div className="status-message">No files selected.</div>
                )}
                {selectedFiles.map(file => (
                    <div key={file.name} className={`file-preview-item ${uploadProgress[file.name]?.status || ''}`}>
                        <span className="file-preview-name" title={file.name}>{file.name}</span>
                        <div className="file-preview-status">
                            {uploadProgress[file.name]?.message}
                        </div>
                        {!isUploading && (
                            <button onClick={() => removeFile(file.name)} className="remove-file-btn">
                                <FaTimesCircle />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {selectedFiles.length > 0 && (
                <button
                    type="button"
                    className="upload-btn"
                    onClick={handleUploadAll}
                    disabled={selectedFiles.length === 0 || isUploading}
                >
                    {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
                </button>
            )}
        </div>
    );
};

export default FileUploadWidget;