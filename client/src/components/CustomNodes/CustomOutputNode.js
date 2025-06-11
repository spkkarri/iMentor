// client/src/components/CustomNodes/CustomOutputNode.js
import React from 'react';
import { Handle, Position } from 'reactflow';
import './CustomNodes.css';

const CustomOutputNode = ({ data }) => {
    return (
        <div className="custom-node output">
            <Handle type="target" position={Position.Top} />
            <div>{data.label}</div>
        </div>
    );
};

export default CustomOutputNode;