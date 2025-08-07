// client/src/components/MindMap.js

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import './MindMap.css'; // Keep for styling the container and modal

// Unique ID for the mermaid container
const mermaidId = `mermaid-graph-${Math.random().toString(36).substring(2, 9)}`;

const MindMap = ({ mermaidData }) => {
    const [selectedNode, setSelectedNode] = useState(null);
    const [svgCode, setSvgCode] = useState('');
    const [error, setError] = useState('');

    // Debug logging
    console.log('🧠 MindMap component received mermaidData:', mermaidData);
    console.log('🧠 MindMap data type:', typeof mermaidData);
    console.log('🧠 MindMap data length:', mermaidData?.length);

    const handleNodeClick = useCallback((nodeId, nodeLabel, nodeContent) => {
        console.log(`🧠 Mind map node clicked: ${nodeId}`);

        // Extract meaningful content from the node
        let displayLabel = nodeLabel || nodeId;
        let displayContent = nodeContent || nodeLabel || "No additional details available.";

        // Clean up the display text
        displayLabel = displayLabel.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        displayContent = displayContent.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();

        // If content is the same as label, provide a more detailed explanation
        if (displayContent === displayLabel) {
            displayContent = `This section covers: ${displayLabel}. Click on related nodes to explore more details about this topic.`;
        }

        setSelectedNode({
            id: nodeId,
            label: displayLabel,
            content: displayContent
        });
    }, []);

    // Make the click handler available globally for Mermaid
    useEffect(() => {
        window.handleMermaidNodeClick = handleNodeClick;
        return () => {
            delete window.handleMermaidNodeClick;
        };
    }, [handleNodeClick]);

    const renderMermaid = useCallback(async () => {
        console.log('🧠 renderMermaid called with data:', mermaidData);
        setError('');

        if (mermaidData && mermaidData.trim()) {
            try {
                console.log('🧠 Attempting to render Mermaid with ID:', mermaidId);
                console.log('🧠 Mermaid data to render:', mermaidData);

                // The 'click' keyword in Mermaid allows calling a global function.
                const { svg } = await mermaid.render(mermaidId, mermaidData);
                console.log('🧠 Mermaid rendering successful, SVG length:', svg.length);
                setSvgCode(svg);
            } catch (e) {
                console.error("🧠 Error rendering Mermaid SVG:", e);
                console.error("🧠 Mermaid data that failed:", mermaidData);
                setError(`Error rendering mind map: ${e.message}`);
                setSvgCode(''); // Clear previous SVG on error
            }
        } else {
            console.warn('🧠 No mermaid data provided or data is empty');
            setError('No mind map data provided.');
        }
    }, [mermaidData]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose', // IMPORTANT: Needed to allow function calls from 'click' events
                mindmap: {
                    padding: 20,
                    useMaxWidth: true,
                    htmlLabels: true,
                },
                themeVariables: {
                    primaryColor: '#4f46e5',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#6366f1',
                    lineColor: '#8b5cf6',
                    secondaryColor: '#7c3aed',
                    tertiaryColor: '#a855f7',
                    background: '#1f2937',
                    mainBkg: '#374151',
                    secondBkg: '#4b5563',
                    tertiaryBkg: '#6b7280'
                },
                logLevel: 'error' // Reduce console noise
            });
            renderMermaid();
        }
    }, [renderMermaid]);

    if (error) {
        return (
            <div className="mindmap-error">
                <h3>🚫 Mind Map Error</h3>
                <p>{error}</p>
                <details>
                    <summary>Debug Info</summary>
                    <pre>{JSON.stringify({ mermaidData: mermaidData?.substring(0, 200) + '...' }, null, 2)}</pre>
                </details>
            </div>
        );
    }

    if (!svgCode) {
        return (
            <div className="mindmap-loading">
                <div>🧠 Generating Mind Map...</div>
                <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>
                    Processing: {mermaidData ? 'Rendering visualization...' : 'Waiting for data...'}
                </div>
            </div>
        );
    }

    return (
        <div className="mindmap-container">
            <div id={mermaidId} className="react-flow-mindmap" dangerouslySetInnerHTML={{ __html: svgCode }}></div>
            {selectedNode && (
                <div className="mindmap-modal" onClick={() => setSelectedNode(null)}>
                    <div className="mindmap-modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{selectedNode.label}</h2>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{selectedNode.content || "No additional details available."}</p>
                        <button onClick={() => setSelectedNode(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MindMap;