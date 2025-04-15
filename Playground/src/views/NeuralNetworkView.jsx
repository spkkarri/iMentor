import { useContext, useEffect } from 'react';
import { Typography, Box, Grid } from '@mui/material';
import Plot from 'react-plotly.js';
import ParameterSlider from '../components/ParameterSlider.jsx';
import ControlButtons from '../components/ControlButtons.jsx';
import ParameterDisplay from '../components/ParameterDisplay.jsx';
import LossCurvePlot from '../components/LossCurvePlot.jsx';
import { AppContext } from '../context/AppContext.jsx';
import { lrData } from '../data/lrData.js';

function NeuralNetworkView() {
  const { state, dispatch } = useContext(AppContext);
  const { data, w1, w2, b } = state.nn;

  useEffect(() => {
    dispatch({ type: 'SET_NN_DATA', payload: lrData });
  }, [dispatch]);

  const x1Class0 = data.filter((d) => d.y === 0).map((d) => d.x1);
  const x2Class0 = data.filter((d) => d.y === 0).map((d) => d.x2);
  const x1Class1 = data.filter((d) => d.y === 1).map((d) => d.x1);
  const x2Class1 = data.filter((d) => d.y === 1).map((d) => d.x2);

  // Decision boundary: w1*x1 + w2*x2 + b = 0 => x2 = -(w1*x1 + b)/w2
  const x1Boundary = [Math.min(...data.map((d) => d.x1)), Math.max(...data.map((d) => d.x1))];
  const x2Boundary = x1Boundary.map((x1) => -(w1 * x1 + b) / w2);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Neural Network (Single Perceptron)
      </Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Plot
            data={[
              {
                x: x1Class0,
                y: x2Class0,
                mode: 'markers',
                type: 'scatter',
                name: 'Class 0',
                marker: { color: 'blue' },
              },
              {
                x: x1Class1,
                y: x2Class1,
                mode: 'markers',
                type: 'scatter',
                name: 'Class 1',
                marker: { color: 'red' },
              },
              {
                x: x1Boundary,
                y: x2Boundary,
                mode: 'lines',
                type: 'scatter',
                name: 'Decision Boundary',
              },
            ]}
            layout={{
              title: 'Data and Decision Boundary',
              xaxis: { title: 'X1' },
              yaxis: { title: 'X2' },
              width: 500,
              height: 400,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <LossCurvePlot modelType="nn" />
        </Grid>
        <Grid item xs={12} md={6}>
          <ParameterSlider
            modelType="nn"
            param="learningRate"
            label="Learning Rate"
            min={0.001}
            max={0.1}
            step={0.001}
          />
          <ParameterSlider
            modelType="nn"
            param="w1"
            label="Initial Weight 1 (w1)"
            min={-2}
            max={2}
            step={0.1}
          />
          <ParameterSlider
            modelType="nn"
            param="w2"
            label="Initial Weight 2 (w2)"
            min={-2}
            max={2}
            step={0.1}
          />
          <ParameterSlider
            modelType="nn"
            param="b"
            label="Initial Bias (b)"
            min={-5}
            max={5}
            step={0.1}
          />
          <ControlButtons modelType="nn" />
        </Grid>
        <Grid item xs={12} md={6}>
          <ParameterDisplay modelType="nn" />
        </Grid>
      </Grid>
    </Box>
  );
}

export default NeuralNetworkView;