// client/src/components/MindMap.js

import React, { useMemo, useEffect, useState } from 'react';
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

const MindMapContent = ({ mindMapData }) => {
    const [layoutedElements, setLayoutedElements] = useState(null);

    const nodeTypes = useMemo(() => ({
        customInput: CustomInputNode,
        customDefault: CustomDefaultNode,
        customOutput: CustomOutputNode,
    }), []);
    
    const defaultEdgeOptions = {
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#90caf9' },
        style: { stroke: '#90caf9', strokeWidth: 2 },
    };

    useEffect(() => {
        if (mindMapData.nodes && mindMapData.edges) {
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                mindMapData.nodes,
                mindMapData.edges
            );
            setLayoutedElements({ nodes: layoutedNodes, edges: layoutedEdges });
        }
    }, [mindMapData]);

    if (!layoutedElements) {
        return <div className="mindmap-loading">Generating layout...</div>;
    }

    return (
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
    );
};

// The main component is now much simpler
const MindMap = ({ mindMapData }) => {
    if (!mindMapData || !mindMapData.nodes || !mindMapData.edges) {
        return <div className="mindmap-error">Invalid mind map data provided.</div>;
    }

    return (
        <ReactFlowProvider>
            <MindMapContent mindMapData={mindMapData} />
        </ReactFlowProvider>
    );
};

export default MindMap;