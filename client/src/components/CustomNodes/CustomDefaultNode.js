// client/src/components/CustomNodes/CustomDefaultNode.js
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GoMilestone } from 'react-icons/go'; // Icon for main topics

const CustomDefaultNode = ({ data }) => {
  return (
    <div className="custom-node custom-default-node">
      <GoMilestone className="node-icon" />
      <div className="node-label">{data.label}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default memo(CustomDefaultNode);