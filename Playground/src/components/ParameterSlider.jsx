import { useContext } from 'react';
import { Slider, Typography, Box } from '@mui/material';
import { AppContext } from '../context/AppContext.jsx';

function ParameterSlider({ modelType, param, label, min, max, step }) {
  const { state, dispatch } = useContext(AppContext);
  const value = state[modelType][param];

  const handleChange = (event, newValue) => {
    dispatch({
      type: `SET_${modelType.toUpperCase()}_PARAMS`,
      payload: { [param]: newValue },
    });
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography>{label}</Typography>
      <Slider
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        valueLabelDisplay="auto"
        disabled={state[modelType].isTraining}
      />
    </Box>
  );
}

export default ParameterSlider;