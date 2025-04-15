npm create vite@latest ml-education-tool -- --template react

npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-plotly.js plotly.js @tensorflow/tfjs-node react-router-dom
npm install -g npm@latest
npm cache clean --force
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-plotly.js plotly.js @tensorflow/tfjs-node react-router-dom
npm install




ml-education-tool/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ControlButtons.jsx
│   │   ├── LossCurvePlot.jsx
│   │   ├── ParameterDisplay.jsx
│   │   ├── ParameterSlider.jsx
│   ├── context/
│   │   ├── AppContext.jsx
│   ├── data/
│   │   ├── lrData.js
│   │   ├── slrData.js
│   ├── hooks/
│   │   ├── useTrainingLoop.jsx
│   ├── models/
│   │   ├── lr/
│   │   │   ├── logisticRegression.jsx
│   │   ├── nn/
│   │   │   ├── neuralNetwork.jsx
│   │   ├── slr/
│   │   │   ├── simpleLinearRegression.jsx
│   ├── views/
│   │   ├── LinearRegressionView.jsx
│   │   ├── LogisticRegressionView.jsx
│   │   ├── NeuralNetworkView.jsx
│   ├── App.jsx
│   ├── main.jsx
├── package.json
├── README.md







