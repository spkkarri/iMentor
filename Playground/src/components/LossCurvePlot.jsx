import { useContext } from 'react';
import Plot from 'react-plotly.js';
import { AppContext } from '../context/AppContext.jsx';

function LossCurvePlot({ modelType }) {
  const { state } = useContext(AppContext);
  const lossHistory = state[modelType].lossHistory;
  const iterations = lossHistory.map((_, i) => i + 1);

  return (
    <Plot
      data={[
        {
          x: iterations,
          y: lossHistory,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Loss',
        },
      ]}
      layout={{
        title: 'Loss vs. Iteration',
        xaxis: { title: 'Iteration' },
        yaxis: { title: 'Loss' },
        width: 400,
        height: 300,
      }}
    />
  );
}

export default LossCurvePlot;