import React from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Typography } from '@mui/material';

// Node styles for consistent appearance
const nodeStyles = {
  padding: '10px 15px',
  borderRadius: '8px',
  border: '2px solid',
  minWidth: 150,
  maxWidth: 250,
  textAlign: 'center',
  boxSizing: 'border-box',
  userSelect: 'none',
  cursor: 'pointer',
};

// Define type-based styles for nodes
const styles = {
  customInput: {
    ...nodeStyles,
    backgroundColor: '#1a237e', // Dark Blue
    borderColor: '#90caf9', // Primary Blue
    color: 'white',
  },
  customDefault: {
    ...nodeStyles,
    backgroundColor: '#004d40', // Dark Teal
    borderColor: '#80cbc4', // Light Teal
    color: 'white',
  },
  customOutput: {
    ...nodeStyles,
    backgroundColor: '#3e2723', // Dark Brown
    borderColor: '#ffab91', // Light Orange/Brown
    color: 'white',
  },
};

const CustomNode = ({ data, type }) => {
  // Fallback to default style if unknown type
  const nodeStyle = styles[type] || styles.customDefault;

  return (
    <Paper elevation={5} style={nodeStyle}>
      {/* Only show target handle if not input node */}
      {type !== 'customInput' && (
        <Handle type="target" position={Position.Top} style={{ background: '#90caf9' }} />
      )}
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {data.label}
      </Typography>
      {/* Only show source handle if not output node */}
      {type !== 'customOutput' && (
        <Handle type="source" position={Position.Bottom} style={{ background: '#90caf9' }} />
      )}
    </Paper>
  );
};

export default CustomNode;