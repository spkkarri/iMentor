import React from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Typography } from '@mui/material';

const nodeStyles = {
  padding: '10px 15px',
  borderRadius: '8px',
  border: '2px solid',
  minWidth: 150,
  maxWidth: 250,
  textAlign: 'center',
};

const CustomNode = ({ data, type }) => {
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

  return (
    <Paper elevation={5} style={styles[type] || styles.customDefault}>
      {type !== 'customInput' && <Handle type="target" position={Position.Top} />}
      <Typography variant="body2">{data.label}</Typography>
      {type !== 'customOutput' && <Handle type="source" position={Position.Bottom} />}
    </Paper>
  );
};

export default CustomNode;