import { useContext } from 'react';
import { Button, Box } from '@mui/material';
import { PlayArrow, Stop, Refresh } from '@mui/icons-material';
import { AppContext } from '../context/AppContext.jsx';
import { useTrainingLoop } from '../hooks/useTrainingLoop.jsx';

function ControlButtons({ modelType }) {
  const { state } = useContext(AppContext);
  const { startTraining, stopTraining, resetTraining } = useTrainingLoop(modelType);
  const isTraining = state[modelType].isTraining;

  return (
    <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
      <Button
        variant="contained"
        startIcon={<PlayArrow />}
        onClick={startTraining}
        disabled={isTraining}
      >
        Start
      </Button>
      <Button
        variant="contained"
        startIcon={<Stop />}
        onClick={stopTraining}
        disabled={!isTraining}
      >
        Stop
      </Button>
      <Button
        variant="contained"
        startIcon={<Refresh />}
        onClick={resetTraining}
      >
        Reset
      </Button>
    </Box>
  );
}

export default ControlButtons;