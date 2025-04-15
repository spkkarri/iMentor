import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';
import LinearRegressionView from './views/LinearRegressionView.jsx';
import LogisticRegressionView from './views/LogisticRegressionView.jsx';
import NeuralNetworkView from './views/NeuralNetworkView.jsx';
import { AppProvider } from './context/AppContext.jsx';

function App() {
  return (
    <AppProvider>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ML Education Tool
          </Typography>
          <Button color="inherit" component={Link} to="/slr">
            Linear Regression
          </Button>
          <Button color="inherit" component={Link} to="/lr">
            Logistic Regression
          </Button>
          <Button color="inherit" component={Link} to="/nn">
            Neural Network
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Routes>
          <Route path="/slr" element={<LinearRegressionView />} />
          <Route path="/lr" element={<LogisticRegressionView />} />
          <Route path="/nn" element={<NeuralNetworkView />} />
          <Route path="/" element={<Box><Typography variant="h4">Select a model to begin</Typography></Box>} />
        </Routes>
      </Container>
    </AppProvider>
  );
}

export default App;