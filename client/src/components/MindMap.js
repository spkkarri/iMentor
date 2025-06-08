import React, { useEffect } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import CustomNode from './CustomNode'; // Import our custom node

// Tell React Flow about our custom node types
const nodeTypes = {
  customInput: CustomNode,
  customDefault: CustomNode,
  customOutput: CustomNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// This function calculates the positions of nodes automatically
const getLayoutedElements = (nodes, edges) => {
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 25, ranksep: 75 }); // Top-to-Bottom layout

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 100, // Center the node
      y: nodeWithPosition.y - 30,
    };
    return node;
  });

  return { nodes, edges };
};

const MindMap = ({ mindMapData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // This effect runs when the mind map data is received
  useEffect(() => {
    if (mindMapData && mindMapData.nodes) {
      // Get the layouted elements from our function
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        mindMapData.nodes,
        mindMapData.edges
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [mindMapData, setNodes, setEdges]);

  return (
    <div style={{ height: '70vh', width: '100%', backgroundColor: '#1f1f1f', borderRadius: '8px', border: '1px solid #2d2d2d', marginTop: '15px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} // Use our custom nodes
        fitView // Automatically zoom to fit the whole mind map
        proOptions={{ hideAttribution: true }} // Hides the "React Flow" branding
      >
        <Controls />
        {/*
          =================================================================
           THIS IS THE ONLY MODIFIED PART
          =================================================================
        */}
        <MiniMap 
          // Add a style prop to make the minimap match the dark theme
          style={{
            backgroundColor: '#1f1f1f', // Match the main background
            border: '1px solid #424242', // Add a subtle border
          }}
          nodeColor={(node) => {
            switch (node.type) {
                case 'customInput': return '#90caf9';
                case 'customDefault': return '#80cbc4';
                case 'customOutput': return '#ffab91';
                default: return '#eee';
            }
        }} nodeStrokeWidth={3} zoomable pannable />
        <Background variant="dots" gap={12} size={1} color="#424242" />
      </ReactFlow>
    </div>
  );
};

export default MindMap;