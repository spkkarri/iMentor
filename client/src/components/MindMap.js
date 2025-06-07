// client/src/components/MindMap.js

import React from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';

const MindMap = ({ nodes, edges }) => {
    return (
        <div style={{ height: '500px', width: '100%', backgroundColor: '#2d2d2d', borderRadius: '8px', border: '1px solid #444' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
            >
                <MiniMap nodeColor="#90caf9" />
                <Controls />
                <Background color="#4a4a4a" gap={16} />
            </ReactFlow>
        </div>
    );
};

export default MindMap;