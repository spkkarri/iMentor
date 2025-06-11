// client/src/components/CustomNodes/CustomOutputNode.js
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { FaFileAlt } from 'react-icons/fa'; // Icon for sub-topics

const CustomOutputNode = ({ data }) => {
  return (
    <div className="custom-node custom-output-node">
      <FaFileAlt className="node-icon" />
      <div className="node-label">{data.label}</div>
      <Handle type="target" position={Position.Top} />
    </div>
  );
};

export default memo(CustomOutputNode);