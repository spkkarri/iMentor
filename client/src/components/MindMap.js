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

    const handleNodeClick = useCallback((nodeId, nodeLabel, nodeContent) => {
        console.log(`Node clicked: ${nodeId}, Label: ${nodeLabel}`);
        // The content might be the same as the label if not explicitly different
        const content = nodeContent && nodeContent !== 'undefined' ? nodeContent : nodeLabel;
        setSelectedNode({ id: nodeId, label: nodeLabel, content: content });
    }, []);

    // Make the click handler available globally for Mermaid
    useEffect(() => {
        window.handleMermaidNodeClick = handleNodeClick;
        return () => {
            delete window.handleMermaidNodeClick;
        };
    }, [handleNodeClick]);

    const renderMermaid = useCallback(async () => {
        setError('');
        if (mermaidData) {
            try {
                // The 'click' keyword in Mermaid allows calling a global function.
                // We don't need to manually replace anything if the server-side prompt is correct.
                const { svg } = await mermaid.render(mermaidId, mermaidData);
                setSvgCode(svg);
            } catch (e) {
                console.error("[MindMap] Error rendering Mermaid SVG:", e);
                setError(`Error rendering mind map. The generated data might be invalid. Details: ${e.message}`);
                setSvgCode(''); // Clear previous SVG on error
            }
        } else {
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
                },
            });
            renderMermaid();
        }
    }, [renderMermaid]);

    if (error) {
        return <div className="mindmap-error">{error}</div>;
    }

    if (!svgCode) {
        return <div className="mindmap-loading">Generating Mind Map...</div>;
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