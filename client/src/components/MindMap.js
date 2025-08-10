import React, { useEffect, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import './MindMap.css';

const mermaidId = "mermaid-graph-" + Math.random().toString(36).substring(2, 9);

const MindMap = ({ mermaidData, fileContent }) => {
    const [selectedNode, setSelectedNode] = useState(null);
    const [svgCode, setSvgCode] = useState('');
    const [error, setError] = useState('');
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);

    console.log('MindMap component received mermaidData:', mermaidData);
    console.log('MindMap component received fileContent length:', fileContent ? fileContent.length : 0);
    console.log('MindMap component received fileContent preview:', fileContent ? fileContent.substring(0, 100) + '...' : 'No content');

    // Extract relevant content from file based on node
    const getNodeContent = useCallback((nodeLabel) => {
        if (!fileContent || !nodeLabel) return "No content available.";

        const searchTerms = nodeLabel.toLowerCase().split(/[\s_-]+/);
        const lines = fileContent.split('\n');
        const relevantLines = [];

        // Find lines containing the search terms
        lines.forEach((line, index) => {
            const lowerLine = line.toLowerCase();
            if (searchTerms.some(term => lowerLine.includes(term))) {
                // Add context lines (previous and next)
                const start = Math.max(0, index - 2);
                const end = Math.min(lines.length, index + 3);
                for (let i = start; i < end; i++) {
                    if (!relevantLines.includes(lines[i]) && lines[i].trim()) {
                        relevantLines.push(lines[i].trim());
                    }
                }
            }
        });

        return relevantLines.length > 0
            ? relevantLines.slice(0, 10).join('\n')
            : `Content related to "${nodeLabel}" - explore this concept in the uploaded file.`;
    }, [fileContent]);

    const handleNodeClick = useCallback((nodeId, event) => {
        console.log('Mind map node clicked:', nodeId);

        // Extract text content from the clicked node
        const nodeElement = event?.target?.closest('g') || document.getElementById(nodeId);
        const textElement = nodeElement?.querySelector('text');
        const nodeLabel = textElement?.textContent || nodeId;

        let displayLabel = nodeLabel.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        let displayContent = getNodeContent(displayLabel) || "No additional details available.";

        setSelectedNode({
            id: nodeId,
            label: displayLabel,
            content: displayContent
        });
    }, [getNodeContent]);

    const handleNodeHover = useCallback((nodeId, event) => {
        // Extract text content from the hovered node
        const nodeElement = event?.target?.closest('g') || document.getElementById(nodeId);
        const textElement = nodeElement?.querySelector('text');
        const nodeLabel = textElement?.textContent || nodeId;

        const rect = nodeElement?.getBoundingClientRect() || event?.target?.getBoundingClientRect();
        if (rect) {
            setHoverPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
            });
        }

        let displayLabel = nodeLabel.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();

        setHoveredNode({
            id: nodeId,
            label: displayLabel,
            content: getNodeContent(displayLabel)
        });
    }, [getNodeContent]);

    const handleNodeLeave = useCallback(() => {
        setHoveredNode(null);
    }, []);

    useEffect(() => {
        window.handleMermaidNodeClick = handleNodeClick;
        window.handleMermaidNodeHover = handleNodeHover;
        window.handleMermaidNodeLeave = handleNodeLeave;
        return () => {
            delete window.handleMermaidNodeClick;
            delete window.handleMermaidNodeHover;
            delete window.handleMermaidNodeLeave;
        };
    }, [handleNodeClick, handleNodeHover, handleNodeLeave]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    const renderMermaid = useCallback(async () => {
        console.log('renderMermaid called with data:', mermaidData);
        setError('');

        if (mermaidData && mermaidData.trim()) {
            try {
                console.log('Attempting to render Mermaid with ID:', mermaidId);

                let cleanedData = mermaidData
                    .split('\n')
                    .filter(line => !line.trim().startsWith('click '))
                    .join('\n')
                    .trim();

                console.log('Cleaned Mermaid data:', cleanedData);

                const { svg } = await mermaid.render(mermaidId, cleanedData);
                console.log('Mermaid rendering successful, SVG length:', svg.length);
                
                // Add colorful gradients to the SVG
                // Add colorful gradients and interactive events to the SVG
                let enhancedSvg = svg.replace(
                    '<svg',
                    '<svg><defs>' +
                    '<linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">' +
                    '<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />' +
                    '<stop offset="25%" style="stop-color:#764ba2;stop-opacity:1" />' +
                    '<stop offset="50%" style="stop-color:#f093fb;stop-opacity:1" />' +
                    '<stop offset="75%" style="stop-color:#f5576c;stop-opacity:1" />' +
                    '<stop offset="100%" style="stop-color:#4facfe;stop-opacity:1" />' +
                    '</linearGradient>' +
                    '<linearGradient id="node-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">' +
                    '<stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />' +
                    '<stop offset="100%" style="stop-color:#ff8e8e;stop-opacity:1" />' +
                    '</linearGradient>' +
                    '<linearGradient id="node-gradient-2" x1="0%" y1="0%" x2="100%" y2="100%">' +
                    '<stop offset="0%" style="stop-color:#4ecdc4;stop-opacity:1" />' +
                    '<stop offset="100%" style="stop-color:#6ee5dd;stop-opacity:1" />' +
                    '</linearGradient>' +
                    '<linearGradient id="node-gradient-3" x1="0%" y1="0%" x2="100%" y2="100%">' +
                    '<stop offset="0%" style="stop-color:#45b7d1;stop-opacity:1" />' +
                    '<stop offset="100%" style="stop-color:#67c5e0;stop-opacity:1" />' +
                    '</linearGradient>' +
                    '<linearGradient id="node-gradient-default" x1="0%" y1="0%" x2="100%" y2="100%">' +
                    '<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />' +
                    '<stop offset="100%" style="stop-color:#8a9bff;stop-opacity:1" />' +
                    '</linearGradient>' +
                    '</defs><svg'
                );

                // Add hover and click events to nodes
                enhancedSvg = enhancedSvg.replace(
                    /<g[^>]*class="[^"]*node[^"]*"[^>]*>/g,
                    (match) => {
                        // Extract node ID from the match
                        const idMatch = match.match(/id="([^"]+)"/);
                        const nodeId = idMatch ? idMatch[1] : 'unknown';
                        return match.replace('>', ` onmouseenter="window.handleMermaidNodeHover('${nodeId}', event)" onmouseleave="window.handleMermaidNodeLeave()" onclick="window.handleMermaidNodeClick('${nodeId}', event)">`)
                    }
                );

                // Also add events to text elements within nodes
                enhancedSvg = enhancedSvg.replace(
                    /<text[^>]*>/g,
                    (match) => {
                        return match.replace('>', ' style="pointer-events: none;">')
                    }
                );

                setSvgCode(enhancedSvg);
            } catch (e) {
                console.error("Error rendering Mermaid SVG:", e);
                setError("Error rendering mind map: " + e.message);
                setSvgCode('');
            }
        } else {
            console.warn('No mermaid data provided or data is empty');
            setError('No mind map data provided.');
        }
    }, [mermaidData]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                mindmap: {
                    padding: 40,
                    useMaxWidth: true,
                    htmlLabels: false,
                },
                themeVariables: {
                    primaryColor: '#ff6b6b',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#ff6b6b',
                    lineColor: '#667eea',
                    secondaryColor: '#4ecdc4',
                    tertiaryColor: '#45b7d1',
                    background: 'transparent',
                    mainBkg: '#ff6b6b',
                    secondBkg: '#4ecdc4',
                    tertiaryBkg: '#45b7d1',
                    cScale0: '#ff6b6b',
                    cScale1: '#4ecdc4',
                    cScale2: '#45b7d1',
                    cScale3: '#667eea',
                    cScale4: '#f093fb',
                    cScale5: '#f5576c',
                    cScale6: '#4facfe',
                    cScale7: '#764ba2'
                },
                logLevel: 'error'
            });
            renderMermaid();
        }
    }, [renderMermaid]);

    if (error) {
        return (
            <div className="mindmap-container">
                <div className="mindmap-error">
                    {error}
                </div>
            </div>
        );
    }

    if (!svgCode) {
        return (
            <div className="mindmap-container">
                <div className="mindmap-loading">
                    Loading mind map...
                </div>
            </div>
        );
    }

    return (
        <div className={`mindmap-container ${isFullscreen ? 'fullscreen' : ''}`}>
            {/* Fullscreen Toggle Button */}
            <button
                className="fullscreen-toggle"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
                {isFullscreen ? '⛶' : '⛶'}
            </button>

            <div id={mermaidId} className="react-flow-mindmap" dangerouslySetInnerHTML={{ __html: svgCode }}></div>

            {/* Hover Tooltip */}
            {hoveredNode && (
                <div
                    className="mindmap-hover-tooltip"
                    style={{
                        left: hoverPosition.x,
                        top: hoverPosition.y,
                        transform: 'translateX(-50%) translateY(-100%)'
                    }}
                >
                    <h4>{hoveredNode.label}</h4>
                    <p>{hoveredNode.content.substring(0, 200)}...</p>
                </div>
            )}

            {/* Click Modal */}
            {selectedNode && (
                <div className="mindmap-modal" onClick={() => setSelectedNode(null)}>
                    <div className="mindmap-modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{selectedNode.label}</h2>
                        <div className="modal-content-section">
                            <h3>Related File Content:</h3>
                            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                                {selectedNode.content || "No additional details available."}
                            </pre>
                        </div>
                        <button onClick={() => setSelectedNode(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MindMap;
