import React, { useState, useEffect } from 'react';
import {
    getTrainingDataStats,
    uploadTrainingData,
    addTextTrainingData,
    generateSampleData
} from '../services/api';
import './DataManager.css';

const DataManager = ({ selectedSubject, onDataUpdate, customDomains = [], onAddCustomDomain }) => {
    const [dataStats, setDataStats] = useState({});
    const [uploadMode, setUploadMode] = useState('file'); // 'file', 'text', 'database'
    const [textData, setTextData] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [generatedSampleData, setGeneratedSampleData] = useState('');
    const [showCustomDomainInput, setShowCustomDomainInput] = useState(false);
    const [newCustomDomain, setNewCustomDomain] = useState('');
    const [supportedFormats, setSupportedFormats] = useState([]);
    const [selectedFormat, setSelectedFormat] = useState('jsonl');

    useEffect(() => {
        fetchDataStats();
        fetchSupportedFormats();
    }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchSupportedFormats = async () => {
        // Define supported file formats and their processing methods
        setSupportedFormats([
            {
                format: 'jsonl',
                name: 'JSONL',
                description: 'JSON Lines format (recommended)',
                extensions: ['.jsonl'],
                method: 'direct_parse'
            },
            {
                format: 'json',
                name: 'JSON',
                description: 'Standard JSON format',
                extensions: ['.json'],
                method: 'json_parse'
            },
            {
                format: 'txt',
                name: 'Plain Text',
                description: 'Plain text files',
                extensions: ['.txt'],
                method: 'text_extraction'
            },
            {
                format: 'csv',
                name: 'CSV',
                description: 'Comma-separated values',
                extensions: ['.csv'],
                method: 'csv_parse'
            },
            {
                format: 'pdf',
                name: 'PDF',
                description: 'PDF documents',
                extensions: ['.pdf'],
                method: 'pdf_extraction'
            },
            {
                format: 'docx',
                name: 'Word Document',
                description: 'Microsoft Word documents',
                extensions: ['.docx', '.doc'],
                method: 'docx_extraction'
            },
            {
                format: 'md',
                name: 'Markdown',
                description: 'Markdown files',
                extensions: ['.md', '.markdown'],
                method: 'markdown_parse'
            }
        ]);
    };

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
            const response = await getTrainingDataStats();
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
            const response = await addTextTrainingData({ subject: selectedSubject, textData });

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



    const handleGenerateSampleData = async () => {
        setIsUploading(true);
        try {
            console.log('DataManager: Generating sample data...');
            const response = await generateSampleData(selectedSubject, 100);

            if (response.data.success) {
                // Set the generated data in the text area for user to see and edit
                const sampleData = response.data.samples || [];
                const formattedData = sampleData.map(sample =>
                    JSON.stringify(sample)
                ).join('\n');

                setGeneratedSampleData(formattedData);
                setTextData(formattedData);
                setUploadMode('text'); // Switch to text mode to show generated data

                alert(`Generated ${response.data.count} sample training examples! Review and edit them in the Text tab.`);
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

    const handleAddCustomDomain = () => {
        if (newCustomDomain.trim() && !customDomains.includes(newCustomDomain.trim())) {
            onAddCustomDomain && onAddCustomDomain(newCustomDomain.trim());
            setNewCustomDomain('');
            setShowCustomDomainInput(false);
        }
    };

    return (
        <div className="data-manager">
            <div className="data-manager-header">
                <h3>📊 Training Data for {selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1)}</h3>

                {/* Custom Domain Management */}
                <div className="domain-management">
                    <div className="current-domains">
                        <span className="domain-label">Available Domains:</span>
                        <div className="domain-tags">
                            {['mathematics', 'programming', 'science', 'history', 'literature', ...customDomains].map(domain => (
                                <span key={domain} className={`domain-tag ${domain === selectedSubject ? 'active' : ''}`}>
                                    {domain}
                                </span>
                            ))}
                        </div>
                    </div>

                    {!showCustomDomainInput ? (
                        <button
                            className="add-domain-btn"
                            onClick={() => setShowCustomDomainInput(true)}
                        >
                            + Add Custom Domain
                        </button>
                    ) : (
                        <div className="custom-domain-input">
                            <input
                                type="text"
                                value={newCustomDomain}
                                onChange={(e) => setNewCustomDomain(e.target.value)}
                                placeholder="Enter custom domain name..."
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomDomain()}
                            />
                            <button onClick={handleAddCustomDomain}>Add</button>
                            <button onClick={() => setShowCustomDomainInput(false)}>Cancel</button>
                        </div>
                    )}
                </div>
            </div>

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

            {/* Supported File Formats Info */}
            <div className="supported-formats">
                <h4>📁 Supported File Formats & Processing Methods</h4>
                <div className="format-grid">
                    {supportedFormats.map(format => (
                        <div key={format.format} className="format-item">
                            <div className="format-header">
                                <span className="format-name">{format.name}</span>
                                <span className="format-extensions">{format.extensions.join(', ')}</span>
                            </div>
                            <div className="format-method">
                                <strong>Processing:</strong> {format.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                            <div className="format-description">{format.description}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <button
                    onClick={handleGenerateSampleData}
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
                        <div className="text-input-header">
                            <p>Training Data Text Editor</p>
                            <div className="text-controls">
                                <select
                                    value={selectedFormat}
                                    onChange={(e) => setSelectedFormat(e.target.value)}
                                    className="format-selector"
                                >
                                    <option value="jsonl">JSONL Format</option>
                                    <option value="json">JSON Format</option>
                                    <option value="txt">Plain Text</option>
                                </select>
                                <button
                                    onClick={() => setTextData('')}
                                    className="clear-btn"
                                    disabled={isUploading}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="text-editor-container">
                            <textarea
                                value={textData}
                                onChange={(e) => setTextData(e.target.value)}
                                placeholder={selectedFormat === 'jsonl' ?
                                    '{"input": "What is 2+2?", "target": "2+2 equals 4"}\n{"input": "Define AI", "target": "Artificial Intelligence is..."}' :
                                    selectedFormat === 'json' ?
                                    '[\n  {"input": "What is 2+2?", "target": "2+2 equals 4"},\n  {"input": "Define AI", "target": "Artificial Intelligence is..."}\n]' :
                                    'Enter your training text here...'
                                }
                                rows={12}
                                disabled={isUploading}
                                className="training-text-editor"
                                spellCheck={false}
                            />
                            <div className="text-stats">
                                <span>Characters: {textData.length}</span>
                                <span>Lines: {textData.split('\n').length}</span>
                                <span>Estimated Examples: {selectedFormat === 'jsonl' ? textData.split('\n').filter(line => line.trim()).length : 'N/A'}</span>
                            </div>
                        </div>

                        <div className="text-actions">
                            <button
                                onClick={handleTextUpload}
                                disabled={isUploading || !textData.trim()}
                                className="upload-btn primary"
                            >
                                {isUploading ? 'Processing...' : 'Add Training Data'}
                            </button>
                            <button
                                onClick={() => {
                                    const formatted = textData.split('\n').map(line => {
                                        try {
                                            return JSON.stringify(JSON.parse(line), null, 2);
                                        } catch {
                                            return line;
                                        }
                                    }).join('\n');
                                    setTextData(formatted);
                                }}
                                disabled={isUploading || !textData.trim()}
                                className="format-btn"
                            >
                                Format JSON
                            </button>
                            <button
                                onClick={() => {
                                    const lines = textData.split('\n').filter(line => line.trim());
                                    const validated = lines.filter(line => {
                                        try {
                                            JSON.parse(line);
                                            return true;
                                        } catch {
                                            return false;
                                        }
                                    });
                                    alert(`Valid JSON lines: ${validated.length}/${lines.length}`);
                                }}
                                disabled={isUploading || !textData.trim()}
                                className="validate-btn"
                            >
                                Validate Data
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DataManager;
