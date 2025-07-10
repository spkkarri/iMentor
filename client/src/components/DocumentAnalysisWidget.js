// client/src/components/DocumentAnalysisWidget.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen } from '@fortawesome/free-solid-svg-icons'; // Or your chosen icon

const DocumentAnalysisWidget = ({
    isExpanded,
    availableDocs,
    selectedDoc,
    onSelectedDocChange,
    isProcessing,
    userId, 
    onAnalyze,
    isAnalyzing,
    currentAnalysisType,
    analysisErrorText,
    analysisResultText
}) => {

    return (
        <div 
            className={`document-analysis-widget mt-4 p-3 border rounded widget-container ${!isExpanded ? 'widget-collapsed-inline' : ''}`}
            data-tooltip={!isExpanded ? "Document Analysis" : null}
        >
            <div className="widget-header">
                <FontAwesomeIcon icon={faBookOpen} className="widget-icon" />
                {isExpanded && <h5 className="widget-title" >Document Analysis</h5>}
            </div>
            
            {isExpanded && (
                <div className="widget-content"> {/* Wrap main content */}
                    <div className="mb-3">
                        <label htmlFor="docAnalysisSelectWidget" className="form-label">Select Document:</label>
                        <select
                            id="docAnalysisSelectWidget" // Use a unique ID if ChatPage still has one
                            className="form-select form-select-sm"
                            value={selectedDoc}
                            onChange={(e) => onSelectedDocChange(e.target.value)}
                            disabled={availableDocs.length === 0 || isProcessing}
                        >
                            <option value="">-- Select a document --</option>
                            {availableDocs.map((doc) => (
                                <option key={doc.id} value={doc.valueToSend}>
                                    {doc.displayName}
                                </option>
                            ))}
                        </select> 
                        {userId && availableDocs.length === 0 && <small className="text-muted d-block mt-1">No files found. Upload to analyze.</small>}
                        {!userId && <small className="text-muted d-block mt-1">Login to view/analyze files.</small>}
                    </div>
                    <div className="d-flex flex-column gap-2">
                        <button className="btn btn-info btn-sm" type="button" onClick={() => onAnalyze('faq')} disabled={!selectedDoc || isProcessing}>
                            {isAnalyzing && currentAnalysisType === 'faq' ? <><span className="spinner-border spinner-border-sm me-1"></span>Generating FAQ...</> : "Generate FAQ"}
                        </button>
                        <button className="btn btn-info btn-sm" type="button" onClick={() => onAnalyze('topics')} disabled={!selectedDoc || isProcessing}>
                            {isAnalyzing && currentAnalysisType === 'topics' ? <><span className="spinner-border spinner-border-sm me-1"></span>Extracting Topics...</> : "Extract Topics"}
                        </button>
                        <button className="btn btn-info btn-sm" type="button" onClick={() => onAnalyze('mindmap')} disabled={!selectedDoc || isProcessing}>
                            {isAnalyzing && currentAnalysisType === 'mindmap' ? <><span className="spinner-border spinner-border-sm me-1"></span>Generating Mind Map...</> : "Generate Mind Map"}
                        </button>
                    </div>
                    {analysisErrorText && <div className="alert alert-danger mt-3 p-2" style={{fontSize: '0.85rem'}}><strong>Analysis Error:</strong> {analysisErrorText}</div>}
                    {analysisResultText && !isAnalyzing && currentAnalysisType && ( 
                        <div className="mt-3 p-2 border rounded bg-light" style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '0.85rem' }}>
                            <h6>{currentAnalysisType.charAt(0).toUpperCase() + currentAnalysisType.slice(1)} for: {selectedDoc}</h6>
                            {currentAnalysisType === 'mindmap' ? (
                                <div><p className="text-muted small">Mindmap data (e.g., Mermaid syntax):</p><pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{analysisResultText}</pre></div>
                            ) : (<pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{analysisResultText}</pre>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DocumentAnalysisWidget;  