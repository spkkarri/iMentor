import { useContext } from 'react';
import { Typography, Box } from '@mui/material';
import { AppContext } from '../context/AppContext.jsx';

function ParameterDisplay({ modelType }) {
  const { state } = useContext(AppContext);
  const params = state[modelType];

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6">Current Parameters</Typography>
      {modelType === 'slr' && (
        <>
          <Typography>Slope (w): {params.w.toFixed(4)}</Typography>
          <Typography>Bias (b): {params.b.toFixed(4)}</Typography>
        </>
      )}
      {(modelType === 'lr' || modelType === 'nn') && (
        <>
          <Typography>Weight 1 (w1): {params.w1.toFixed(4)}</Typography>
          <Typography>Weight 2 (w2): {params.w2.toFixed(4)}</Typography>
          <Typography>Bias (b): {params.b.toFixed(4)}</Typography>
        </>
      )}
      <Typography>Iteration: {params.iteration}</Typography>
    </Box>
  );
}

export default ParameterDisplay;