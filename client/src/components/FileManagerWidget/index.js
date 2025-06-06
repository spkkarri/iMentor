// client/src/components/FileManagerWidget.js

import React, { useState, useEffect } from 'react';
import { getUserFiles, deleteUserFile } from '../../services/api';
import './index.css'; // We'll create this CSS file next

const FileManagerWidget = ({ refreshTrigger, onGeneratePodcast, onFilesChange }) => {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            setError('');
            try {
                const response = await getUserFiles();
                setFiles(response.data || []);
                onFilesChange(response.data.length > 0); // Notify parent if files exist
            } catch (err) {
                console.error("Failed to fetch files:", err);
                setError('Could not load files.');
                setFiles([]);
                onFilesChange(false); // Notify parent that no files exist
            } finally {
                setIsLoading(false);
            }
        };

        fetchFiles();
    }, [refreshTrigger, onFilesChange]); // Re-fetch when refreshTrigger changes

    const handleDelete = async (fileId, fileName) => {
        // Optional: Ask for confirmation
        if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
            return;
        }

        try {
            await deleteUserFile(fileId);
            // Remove the file from the local state for an immediate UI update
            setFiles(prevFiles => prevFiles.filter(file => file._id !== fileId));
        } catch (err) {
            console.error("Failed to delete file:", err);
            setError(`Could not delete ${fileName}.`);
        }
    };

    return (
        <div className="file-manager-widget">
            <h4>My Files</h4>
            {isLoading && <p className="loading-text">Loading files...</p>}
            {error && <p className="error-text">{error}</p>}
            
            {!isLoading && !error && (
                <ul className="file-list">
                    {files.length > 0 ? (
                        files.map(file => (
                            <li key={file._id} className="file-item">
                                <span className="file-name" title={file.originalname}>
                                    {file.originalname}
                                </span>
                                <div className="file-actions">
                                    <button
                                        onClick={() => onGeneratePodcast(file._id, file.originalname)}
                                        className="action-button podcast-button"
                                        title="Generate Podcast"
                                    >
                                        🎙️
                                    </button>
                                    <button
                                        onClick={() => handleDelete(file._id, file.originalname)}
                                        className="action-button delete-button"
                                        title="Delete File"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </li>
                        ))
                    ) : (
                        <p className="no-files-text">No files uploaded.</p>
                    )}
                </ul>
            )}
        </div>
    );
};

export default FileManagerWidget;