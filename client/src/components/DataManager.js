import React, { useState, useEffect } from 'react';
import {
    getTrainingDataStats,
    uploadTrainingData,
    addTextTrainingData,
    generateSampleData
} from '../services/api';
import './DataManager.css';

const DataManager = ({ selectedSubject, onDataUpdate }) => {
    const [dataStats, setDataStats] = useState({});
    const [uploadMode, setUploadMode] = useState('file'); // 'file', 'text'
    const [textData, setTextData] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        fetchDataStats();
    }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchDataStats = async () => {
        try {
            const userId = localStorage.getItem('userId');
            const username = localStorage.getItem('username');

            console.log('DataManager: Checking authentication...');
            console.log('DataManager: userId from localStorage:', userId);
            console.log('DataManager: username from localStorage:', username);

            if (!userId) {
                console.warn('DataManager: No user ID found in localStorage - user may not be logged in');
                setDataStats({ train: 0, validation: 0, test: 0 });
                return;
            }

            console.log(`DataManager: Fetching data stats for subject: ${selectedSubject}`);
            const response = await getTrainingDataStats(selectedSubject);
            console.log('DataManager: Received data:', response.data);
            setDataStats(response.data.stats || {});
        } catch (error) {
            console.error('DataManager: Error fetching data stats:', error);

            // Check if it's an authentication error
            if (error.response && error.response.status === 401) {
                console.warn('DataManager: Authentication failed - user may need to log in');
            }

            // Set default stats on error
            setDataStats({ train: 0, validation: 0, test: 0 });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('subject', selectedSubject);

        try {
            console.log('DataManager: Uploading file...');
            const response = await uploadTrainingData(formData);

            if (response.data.success) {
                alert(`Successfully uploaded ${response.data.count} training examples!`);
                fetchDataStats();
                onDataUpdate && onDataUpdate();
            } else {
                alert(`Upload failed: ${response.data.error}`);
            }
        } catch (error) {
            alert(`Upload error: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleTextUpload = async () => {
        if (!textData.trim()) return;

        setIsUploading(true);
        try {
            console.log('DataManager: Sending text data...');
            const response = await addTextTrainingData(selectedSubject, textData);

            if (response.data.success) {
                alert(`Successfully processed ${response.data.count} training examples!`);
                setTextData('');
                fetchDataStats();
                onDataUpdate && onDataUpdate();
            } else {
                alert(`Processing failed: ${response.data.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };



    const generateSampleData = async () => {
        setIsUploading(true);
        try {
            console.log('DataManager: Generating sample data...');
            const response = await generateSampleData(selectedSubject, 100);

            if (response.data.success) {
                alert(`Generated ${response.data.count} sample training examples!`);
                fetchDataStats();
                onDataUpdate && onDataUpdate();
            } else {
                alert(`Generation failed: ${response.data.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="data-manager">
            <h3>📊 Training Data for {selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1)}</h3>

            {/* Data Statistics */}
            <div className="data-stats">
                <div className="stat-card">
                    <div className="stat-number">{dataStats.train || 0}</div>
                    <div className="stat-label">Training</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{dataStats.validation || 0}</div>
                    <div className="stat-label">Validation</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{dataStats.test || 0}</div>
                    <div className="stat-label">Test</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <button
                    onClick={generateSampleData}
                    disabled={isUploading}
                    className="generate-btn"
                >
                    🎲 Generate Sample Data
                </button>
                <button
                    onClick={fetchDataStats}
                    disabled={isUploading}
                    className="refresh-btn"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Upload Methods */}
            <div className="upload-methods">
                <div className="method-tabs">
                    <button
                        className={uploadMode === 'file' ? 'active' : ''}
                        onClick={() => setUploadMode('file')}
                    >
                        📁 File
                    </button>
                    <button
                        className={uploadMode === 'text' ? 'active' : ''}
                        onClick={() => setUploadMode('text')}
                    >
                        📝 Text
                    </button>
                </div>

                {/* File Upload */}
                {uploadMode === 'file' && (
                    <div className="upload-section">
                        <p>Upload JSONL file with training examples</p>
                        <input
                            type="file"
                            accept=".jsonl,.json,.txt"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        {isUploading && <span>Uploading...</span>}
                    </div>
                )}

                {/* Text Input */}
                {uploadMode === 'text' && (
                    <div className="upload-section">
                        <p>Paste JSONL training data (one JSON object per line)</p>
                        <textarea
                            value={textData}
                            onChange={(e) => setTextData(e.target.value)}
                            placeholder='{"input": "What is 2+2?", "target": "2+2 equals 4"}'
                            rows={6}
                            disabled={isUploading}
                        />
                        <button
                            onClick={handleTextUpload}
                            disabled={isUploading || !textData.trim()}
                            className="upload-btn"
                        >
                            {isUploading ? 'Processing...' : 'Add Data'}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DataManager;
