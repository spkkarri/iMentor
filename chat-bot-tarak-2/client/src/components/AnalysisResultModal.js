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
        if (type === 'flashcards') {
            const flashcards = parseFlashcards(result);
            if (!flashcards.length) return <div>No flashcards found.</div>;
            return (
                <div className="flashcard-grid">
                    {flashcards.map((fc, i) => (
                        <FlipCard key={i} term={fc.term} definition={fc.definition} />
                    ))}
                </div>
            );
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

// FlipCard component for flashcards
const FlipCard = ({ term, definition }) => {
    const [flipped, setFlipped] = useState(false);
    return (
        <div
            className={`flipcard${flipped ? ' flipped' : ''}`}
            onMouseEnter={() => setFlipped(true)}
            onMouseLeave={() => setFlipped(false)}
        >
            <div className="flipcard-inner">
                <div className="flipcard-front">{term}</div>
                <div className="flipcard-back">{definition}</div>
            </div>
        </div>
    );
};

// Improved parser: handles multi-line definitions and flexible formatting
function parseFlashcards(text) {
    if (!text) return [];
    const lines = text.split(/\n+/).map(line => line.trim());
    const flashcards = [];
    let currentTerm = null;
    let currentDef = [];
    for (let line of lines) {
        if (/^Term:/i.test(line)) {
            if (currentTerm && currentDef.length) {
                flashcards.push({ term: currentTerm, definition: currentDef.join(' ').trim() });
            }
            const termMatch = line.match(/^Term:\s*(.*?)(?:\s*Definition:(.*))?$/i);
            currentTerm = termMatch ? termMatch[1].trim() : '';
            currentDef = [];
            if (termMatch && termMatch[2]) {
                currentDef.push(termMatch[2].trim());
            }
        } else if (/^Definition:/i.test(line)) {
            const defMatch = line.match(/^Definition:\s*(.*)$/i);
            if (defMatch) currentDef.push(defMatch[1].trim());
        } else if (currentDef) {
            // Continuation of definition
            currentDef.push(line);
        }
    }
    if (currentTerm && currentDef.length) {
        flashcards.push({ term: currentTerm, definition: currentDef.join(' ').trim() });
    }
    return flashcards.filter(fc => fc.term && fc.definition);
}

export default AnalysisResultModal;
