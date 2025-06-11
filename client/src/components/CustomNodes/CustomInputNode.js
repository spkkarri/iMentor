// client/src/components/CustomNodes/CustomInputNode.js
import React from 'react';
import { Handle, Position } from 'reactflow';
import './CustomNode.css';

const CustomInputNode = ({ data }) => {
    return (
        <div className="custom-node input">
            <Handle type="source" position={Position.Bottom} />
            <div>{data.label}</div>
        </div>
    );
};

export default CustomInputNode;