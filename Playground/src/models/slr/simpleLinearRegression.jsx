// Compute prediction: y = wx + b
export const predict = (x, w, b) => x * w + b;

// Compute Mean Squared Error loss
export const computeLoss = (data, w, b) => {
  let sumSquaredError = 0;
  for (const point of data) {
    const prediction = predict(point.x, w, b);
    const error = prediction - point.y;
    sumSquaredError += error * error;
  }
  return sumSquaredError / data.length;
};

// Compute gradients for w and b
export const computeGradients = (data, w, b) => {
  let dw = 0;
  let db = 0;
  for (const point of data) {
    const prediction = predict(point.x, w, b);
    const error = prediction - point.y;
    dw += error * point.x;
    db += error;
  }
  return { dw: dw / data.length, db: db / data.length };
};

// Update parameters using gradient descent
export const updateParameters = (w, b, gradients, learningRate) => {
  return {
    w: w - learningRate * gradients.dw,
    b: b - learningRate * gradients.db,
  };
};