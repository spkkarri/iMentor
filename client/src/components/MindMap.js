// client/src/components/MindMap.js

import React, { useMemo, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './MindMap.css';

import CustomInputNode from './CustomNodes/CustomInputNode';
import CustomDefaultNode from './CustomNodes/CustomDefaultNode';
import CustomOutputNode from './CustomNodes/CustomOutputNode';

// This is the inner component that has access to the React Flow instance
const MindMapContent = forwardRef(({ mindMapData }, ref) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(mindMapData.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(mindMapData.edges || []);
    
    // Get the functions we need from the useReactFlow hook
    const { getNodes, getEdges } = useReactFlow();

    const nodeTypes = useMemo(() => ({
        customInput: CustomInputNode,
        customDefault: CustomDefaultNode,
        customOutput: CustomOutputNode,
    }), []);

    // This function will be exposed to the parent component (ChatPage)
    useImperativeHandle(ref, () => ({
        getSvgData: () => {
            // CRITICAL: Get the current, rendered nodes and edges
            const nodesToExport = getNodes();
            const edgesToExport = getEdges();

            if (nodesToExport.length === 0) {
                return null;
            }

            // This is a robust SVG generator that now uses the correct node dimensions
            const padding = 40;
            const xCoords = nodesToExport.map((node) => node.position.x);
            const yCoords = nodesToExport.map((node) => node.position.y);
            const widths = nodesToExport.map((node) => node.width || 0);
            const heights = nodesToExport.map((node) => node.height || 0);

            const minX = Math.min(...xCoords);
            const minY = Math.min(...yCoords);
            const maxX = Math.max(...xCoords.map((x, i) => x + widths[i]));
            const maxY = Math.max(...yCoords.map((y, i) => y + heights[i]));

            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;

            let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX - padding} ${minY - padding} ${width} ${height}">
                <style>
                    .edge-path { stroke: #90caf9; stroke-width: 2; fill: none; }
                    .node-label { font-family: Arial, sans-serif; font-size: 14px; fill: #ffffff; dominant-baseline: middle; text-anchor: middle; }
                    .node-rect { fill: #2d2d2d; stroke-width: 2; rx: 5; }
                    .node-rect-custominput { stroke: #4caf50; }
                    .node-rect-customdefault { stroke: #90caf9; }
                    .node-rect-customoutput { stroke: #f44336; }
                </style>
                <g>`;

            edgesToExport.forEach(edge => {
                const sourceNode = nodesToExport.find(n => n.id === edge.source);
                const targetNode = nodesToExport.find(n => n.id === edge.target);
                if (sourceNode && targetNode) {
                    const sourceX = sourceNode.position.x + (sourceNode.width / 2);
                    const sourceY = sourceNode.position.y + (sourceNode.height);
                    const targetX = targetNode.position.x + (targetNode.width / 2);
                    const targetY = targetNode.position.y;
                    svg += `<path d="M ${sourceX},${sourceY} C ${sourceX},${sourceY + 60} ${targetX},${targetY - 60} ${targetX},${targetY}" class="edge-path" />`;
                }
            });

            nodesToExport.forEach(node => {
                const nodeClass = `node-rect-${node.type}`;
                svg += `<g transform="translate(${node.position.x}, ${node.position.y})">
                    <rect width="${node.width}" height="${node.height}" class="node-rect ${nodeClass}" />
                    <text x="${node.width / 2}" y="${node.height / 2}" class="node-label">${node.data.label}</text>
                </g>`;
            });

            svg += `</g></svg>`;
            return svg;
        }
    }));

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="react-flow-mindmap"
        >
            <Background />
            <Controls />
            <MiniMap />
        </ReactFlow>
    );
});

// The main component wraps the content in a ReactFlowProvider
const MindMap = forwardRef(({ mindMapData }, ref) => {
    if (!mindMapData || !mindMapData.nodes || !mindMapData.edges) {
        return <div className="mindmap-error">Invalid mind map data provided.</div>;
    }

    return (
        <ReactFlowProvider>
            <MindMapContent mindMapData={mindMapData} ref={ref} />
        </ReactFlowProvider>
    );
});

export default MindMap;