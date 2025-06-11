// client/src/components/CustomNodes/CustomDefaultNode.js
import React from 'react';
import { Handle, Position } from 'reactflow';
import './CustomNodes.css';

const CustomDefaultNode = ({ data }) => {
    return (
        <div className="custom-node">
            <Handle type="target" position={Position.Top} />
            <Handle type="source" position={Position.Bottom} />
            <div>{data.label}</div>
        </div>
    );
};

export default CustomDefaultNode;