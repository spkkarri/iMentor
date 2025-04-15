import { useContext, useEffect } from 'react';
import { Typography, Box, Grid } from '@mui/material';
import Plot from 'react-plotly.js';
import ParameterSlider from '../components/ParameterSlider.jsx';
import ControlButtons from '../components/ControlButtons.jsx';
import ParameterDisplay from '../components/ParameterDisplay.jsx';
import LossCurvePlot from '../components/LossCurvePlot.jsx';
import { AppContext } from '../context/AppContext.jsx';
import { slrData } from '../data/slrData.js';
import { predict } from '../models/slr/simpleLinearRegression.jsx';

function LinearRegressionView() {
  const { state, dispatch } = useContext(AppContext);
  const { data, w, b } = state.slr;

  useEffect(() => {
    dispatch({ type: 'SET_SLR_DATA', payload: slrData });
  }, [dispatch]);

  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  const lineX = [Math.min(...xValues), Math.max(...xValues)];
  const lineY = lineX.map((x) => predict(x, w, b));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Simple Linear Regression
      </Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Plot
            data={[
              {
                x: xValues,
                y: yValues,
                mode: 'markers',
                type: 'scatter',
                name: 'Data',
              },
              {
                x: lineX,
                y: lineY,
                mode: 'lines',
                type: 'scatter',
                name: 'Fit',
              },
            ]}
            layout={{
              title: 'Data and Regression Line',
              xaxis: { title: 'X' },
              yaxis: { title: 'Y' },
              width: 500,
              height: 400,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <LossCurvePlot modelType="slr" />
        </Grid>
        <Grid item xs={12} md={6}>
          <ParameterSlider
            modelType="slr"
            param="learningRate"
            label="Learning Rate"
            min={0.001}
            max={0.1}
            step={0.001}
          />
          <ParameterSlider
            modelType="slr"
            param="w"
            label="Initial Slope (w)"
            min={-2}
            max={2}
            step={0.1}
          />
          <ParameterSlider
            modelType="slr"
            param="b"
            label="Initial Bias (b)"
            min={-5}
            max={5}
            step={0.1}
          />
          <ControlButtons modelType="slr" />
        </Grid>
        <Grid item xs={12} md={6}>
          <ParameterDisplay modelType="slr" />
        </Grid>
      </Grid>
    </Box>
  );
}

export default LinearRegressionView;