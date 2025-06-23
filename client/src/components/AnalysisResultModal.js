// client/src/components/AnalysisResultModal.js
import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiX, FiCopy } from 'react-icons/fi';
import { jsPDF } from 'jspdf';

import './AnalysisResultModal.css';
import MermaidDiagram from './MermaidDiagram';

const AnalysisResultModal = ({ isOpen, onClose, analysisData }) => {
    // ... (no changes to the top part of the file)
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setIsCopied(false);
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleCopy = useCallback(() => {
        const textToCopy = analysisData?.result || '';
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text.');
        });
    }, [analysisData?.result]);

    // New handler for downloading mindmap image
    const handleDownloadImage = useCallback(() => {
        if (!analysisData || analysisData.type !== 'mindmap') return;
        const container = document.querySelector('.mermaid-diagram-container');
        if (!container) {
            alert('Mindmap not found for download.');
            return;
        }
        const svg = container.querySelector('svg');
        if (!svg) {
            alert('Mindmap SVG not found.');
            return;
        }
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'mindmap.png';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
            });
        };
        image.onerror = () => {
            alert('Failed to load SVG image for download.');
            URL.revokeObjectURL(url);
        };
        image.src = url;
    }, [analysisData]);

    // New handler for downloading FAQ or Identify Topics as PDF
    const handleDownloadPdf = useCallback(() => {
        if (!analysisData || (analysisData.type !== 'faq' && analysisData.type !== 'topics')) return;
        const doc = new jsPDF();
        doc.setFontSize(12);
        const text = analysisData.result || '';
        const lines = doc.splitTextToSize(text, 180);
        let y = 10;
        lines.forEach(line => {
            if (y > 280) {
                doc.addPage();
                y = 10;
            }
            doc.text(line, 10, y);
            y += 10;
        });
        const filename = analysisData.type === 'faq' ? 'faq.pdf' : 'identify_topics.pdf';
        doc.save(filename);
    }, [analysisData]);

    if (!isOpen || !analysisData) return null;

    const { type, result, thinking, documentName } = analysisData;

    const renderResult = () => {
        if (type === 'mindmap') {
            return <MermaidDiagram chart={result} />;
        }
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{result || "No result."}</ReactMarkdown>;
    };

    const isCopyDisabled = isCopied || !result;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">{type ? `${type.charAt(0).toUpperCase() + type.slice(1)}` : 'Analysis'} Results</h3>
                    <button onClick={onClose} className="modal-close-button" title="Close"><FiX size={24} /></button>
                </div>
                <div className="modal-body">
                    <p className="modal-document-name">File: {documentName || 'Document'}</p>
                    {thinking && (
                        <details className="modal-thinking-details">
                            <summary>View Thinking Process</summary>
                            <pre>{thinking}</pre>
                        </details>
                    )}
                    <div className="modal-result-container">{renderResult()}</div>
                </div>
                <div className="modal-footer">
                    <button onClick={handleCopy} className="modal-secondary-button" disabled={isCopyDisabled}>
                        <FiCopy size={16} style={{ marginRight: '8px' }} />
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    {type === 'mindmap' && (
                        <button onClick={handleDownloadImage} className="modal-secondary-button" style={{ marginLeft: '8px' }}>
                            Download Image
                        </button>
                    )}
                    {(type === 'faq' || type === 'topics') && (
                        <button onClick={handleDownloadPdf} className="modal-secondary-button" style={{ marginLeft: '8px' }}>
                            Download PDF
                        </button>
                    )}
                    <button onClick={onClose} className="modal-action-button">Close</button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisResultModal;
