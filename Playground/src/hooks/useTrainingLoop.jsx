import { useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import {
  computeLoss,
  computeGradients,
  updateParameters,
} from '../models/slr/simpleLinearRegression.jsx';
import { trainStep as lrTrainStep } from '../models/lr/logisticRegression.js';
import { createModel, trainStep as nnTrainStep } from '../models/nn/neuralNetwork.js';

export const useTrainingLoop = (modelType) => {
  const { state, dispatch } = useContext(AppContext);
  const requestRef = useRef();
  const modelRef = useRef(null);

  const trainStep = async () => {
    if (!state[modelType].isTraining) return;

    if (modelType === 'slr') {
      const { data, w, b, learningRate, iteration, lossHistory } = state.slr;
      const loss = computeLoss(data, w, b);
      const gradients = computeGradients(data, w, b);
      const newParams = updateParameters(w, b, gradients, learningRate);

      dispatch({
        type: 'SET_SLR_PARAMS',
        payload: {
          w: newParams.w,
          b: newParams.b,
          iteration: iteration + 1,
          lossHistory: [...lossHistory, loss],
        },
      });
    } else if (modelType === 'lr') {
      const { data, w1, w2, b, learningRate, iteration, lossHistory } = state.lr;
      const result = await lrTrainStep(
        data,
        { w1, w2 },
        b,
        learningRate
      );

      dispatch({
        type: 'SET_LR_PARAMS',
        payload: {
          w1: result.w1,
          w2: result.w2,
          b: result.b,
          iteration: iteration + 1,
          lossHistory: [...lossHistory, result.loss],
        },
      });
    } else if (modelType === 'nn') {
      if (!modelRef.current) {
        modelRef.current = createModel();
      }
      const { data, learningRate, iteration, lossHistory } = state.nn;
      const result = await nnTrainStep(modelRef.current, data, learningRate);

      dispatch({
        type: 'SET_NN_PARAMS',
        payload: {
          w1: result.w1,
          w2: result.w2,
          b: result.b,
          iteration: iteration + 1,
          lossHistory: [...lossHistory, result.loss],
        },
      });
    }

    requestRef.current = requestAnimationFrame(trainStep);
  };

  useEffect(() => {
    if (state[modelType].isTraining) {
      requestRef.current = requestAnimationFrame(trainStep);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [state[modelType].isTraining]);

  const startTraining = () => {
    dispatch({ type: `SET_${modelType.toUpperCase()}_PARAMS`, payload: { isTraining: true } });
  };

  const stopTraining = () => {
    dispatch({ type: `SET_${modelType.toUpperCase()}_PARAMS`, payload: { isTraining: false } });
  };

  const resetTraining = () => {
    dispatch({ type: `RESET_${modelType.toUpperCase()}` });
    if (modelType === 'nn') {
      modelRef.current = null;
    }
  };

  return { startTraining, stopTraining, resetTraining };
};