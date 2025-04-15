import { createContext, useReducer } from 'react';

export const AppContext = createContext();

const initialState = {
  slr: {
    learningRate: 0.01,
    w: 0,
    b: 0,
    isTraining: false,
    iteration: 0,
    lossHistory: [],
    data: [],
  },
  lr: {
    learningRate: 0.01,
    w1: 0,
    w2: 0,
    b: 0,
    isTraining: false,
    iteration: 0,
    lossHistory: [],
    data: [],
  },
  nn: {
    learningRate: 0.01,
    w1: 0,
    w2: 0,
    b: 0,
    isTraining: false,
    iteration: 0,
    lossHistory: [],
    data: [],
  },
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_SLR_PARAMS':
      return { ...state, slr: { ...state.slr, ...action.payload } };
    case 'SET_LR_PARAMS':
      return { ...state, lr: { ...state.lr, ...action.payload } };
    case 'SET_NN_PARAMS':
      return { ...state, nn: { ...state.nn, ...action.payload } };
    case 'RESET_SLR':
      return { ...state, slr: { ...initialState.slr, data: state.slr.data } };
    case 'RESET_LR':
      return { ...state, lr: { ...initialState.lr, data: state.lr.data } };
    case 'RESET_NN':
      return { ...state, nn: { ...initialState.nn, data: state.nn.data } };
    case 'SET_SLR_DATA':
      return { ...state, slr: { ...state.slr, data: action.payload } };
    case 'SET_LR_DATA':
      return { ...state, lr: { ...state.lr, data: action.payload } };
    case 'SET_NN_DATA':
      return { ...state, nn: { ...state.nn, data: action.payload } };
    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};