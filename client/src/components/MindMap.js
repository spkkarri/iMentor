// client/src/components/MindMap.js

import React, { useEffect, useState, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    MarkerType,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import './MindMap.css';

import CustomInputNode from './CustomNodes/CustomInputNode';
import CustomDefaultNode from './CustomNodes/CustomDefaultNode';
import CustomOutputNode from './CustomNodes/CustomOutputNode';

const getLayoutedElements = (nodes, edges) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 200;
    const nodeHeight = 50; // This is an estimate; CSS will determine the real height
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top';
        node.sourcePosition = 'bottom';
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
    });

    return { nodes, edges };
};

// Define node types and edge options at the very top to guarantee stable reference
const nodeTypes = {
    customInput: CustomInputNode,
    customDefault: CustomDefaultNode,
    customOutput: CustomOutputNode,
};

const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#90caf9' },
    style: { stroke: '#90caf9', strokeWidth: 2 },
};

const transformBackendData = (backendData) => {
    if (!backendData || !backendData.nodes || !backendData.edges) {
        return null;
    }

    // Transform nodes to match frontend expectations
    const transformedNodes = backendData.nodes.map((node, index) => {
        // Decode label if present
        let rawLabel = node.data?.label || node.label || 'Node';
        let decodedLabel;
        try {
            decodedLabel = decodeURIComponent(rawLabel);
        } catch (e) {
            decodedLabel = rawLabel;
        }
        return {
            id: node.id,
            type: index === 0 ? 'customInput' : 'customDefault',
            data: {
                label: decodedLabel,
                content: node.data?.content || node.content || ''
            },
            position: node.position || { x: index * 200, y: 100 }
        };
    });

    // Transform edges to match frontend expectations
    const transformedEdges = backendData.edges.map((edge, index) => ({
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        data: {
            label: edge.data?.label || edge.label || ''
        }
    }));

    return {
        nodes: transformedNodes,
        edges: transformedEdges
    };
};

const MindMapContent = ({ mindMapData }) => {
    const [layoutedElements, setLayoutedElements] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    // Handler for node click
    const handleNodeClick = (nodeId, nodeData) => {
        setSelectedNode({ id: nodeId, ...nodeData });
    };

    useEffect(() => {
        if (mindMapData) {
            // Transform backend data to frontend format
            const transformedData = transformBackendData(mindMapData);
            
            if (transformedData && transformedData.nodes && transformedData.edges) {
                // Pass click handler to each node's data
                const nodesWithClick = transformedData.nodes.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        onClick: handleNodeClick,
                    },
                }));
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    nodesWithClick,
                    transformedData.edges
                );
                setLayoutedElements({ nodes: layoutedNodes, edges: layoutedEdges });
            }
        }
    }, [mindMapData]);

    if (!layoutedElements) {
        return <div className="mindmap-loading">Generating layout...</div>;
    }

    return (
        <div className="mindmap-container">
            <ReactFlow
                nodes={layoutedElements.nodes}
                edges={layoutedElements.edges}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                className="react-flow-mindmap"
            >
                <Background gap={20} color="#444" />
                <Controls />
                <MiniMap nodeColor={(n) => {
                    if (n.type === 'customInput') return '#81c784';
                    if (n.type === 'customOutput') return '#e57373';
                    return '#64b5f6';
                }} nodeStrokeWidth={3} pannable />
            </ReactFlow>
            {selectedNode && (
                <div className="mindmap-modal" onClick={() => setSelectedNode(null)}>
                    <div className="mindmap-modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{selectedNode.label}</h2>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{selectedNode.content}</pre>
                        <button onClick={() => setSelectedNode(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// The main component is now much simpler
const MindMap = ({ mindMapData }) => {
    if (!mindMapData) {
        return <div className="mindmap-error">No mind map data provided.</div>;
    }

    return (
        <ReactFlowProvider>
            <MindMapContent mindMapData={mindMapData} />
        </ReactFlowProvider>
    );
};

export default MindMap;