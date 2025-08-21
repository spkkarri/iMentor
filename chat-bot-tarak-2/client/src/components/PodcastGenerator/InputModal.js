// client/src/components/PodcastGenerator/InputModal.js
import React, { useState, useRef } from 'react';
import './InputModal.css';
// --- MODIFICATION: YouTube icon removed ---
import { UploadFile, Link, Title, Close, TextFields } from '@mui/icons-material'; // Replaced Link with TextFields for clarity

const InputModal = ({ isOpen, onClose, onGenerate }) => {
    const [activeTab, setActiveTab] = useState('upload');
    const [rawText, setRawText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [podcastTitle, setPodcastTitle] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            if (!podcastTitle) {
                setPodcastTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const handleGenerateClick = () => {
        let inputData;
        let inputType;

        switch(activeTab) {
            case 'upload':
                if (!selectedFile) return;
                inputData = selectedFile;
                inputType = 'file';
                break;
            // --- MODIFICATION: 'youtube' case removed ---
            case 'text':
                if (!rawText) return;
                inputData = rawText;
                inputType = 'raw_text';
                break;
            default:
                return;
        }
        onGenerate({ inputType, inputData, title: podcastTitle || 'AI Podcast' });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'upload':
                return (
                    <div className="tab-content upload-tab" onClick={() => fileInputRef.current.click()}>
                        <UploadFile className="tab-icon" />
                        <p>{selectedFile ? selectedFile.name : 'Click or Drag and Drop to Upload'}</p>
                        <span className="file-types">Supported: .pdf, .txt</span>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.txt" />
                    </div>
                );
            // --- MODIFICATION: 'youtube' case removed ---
            case 'text':
                return (
                    <div className="tab-content text-tab">
                        <textarea
                            className="text-input-area"
                            placeholder="Paste your text here..."
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-container">
                <button className="modal-close-btn" onClick={onClose}><Close /></button>
                <h2>Add Source</h2>
                <p className="modal-subtitle">Generate a podcast from your own content.</p>
                
                <div className="modal-body">
                    {renderContent()}
                </div>

                <div className="modal-footer">
                    <div className="title-input-wrapper">
                        <Title className="title-icon"/>
                        <input 
                            type="text" 
                            placeholder="Enter podcast title..." 
                            className="title-input"
                            value={podcastTitle}
                            onChange={(e) => setPodcastTitle(e.target.value)}
                        />
                    </div>
                    <button className="generate-btn" onClick={handleGenerateClick} disabled={(!selectedFile && !rawText) || !podcastTitle}>
                        Generate Podcast
                    </button>
                </div>

                <div className="modal-tabs">
                    <button className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
                        <UploadFile /> Upload File
                    </button>
                    {/* --- MODIFICATION: YouTube button removed --- */}
                    <button className={`tab-button ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>
                        <TextFields /> Paste Text
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InputModal;