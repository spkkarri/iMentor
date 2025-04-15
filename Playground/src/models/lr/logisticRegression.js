import * as tf from '@tensorflow/tfjs';

export const trainStep = async (data, weights, bias, learningRate) => {
  return tf.tidy(() => {
    const x1 = tf.tensor1d(data.map((d) => d.x1));
    const x2 = tf.tensor1d(data.map((d) => d.x2));
    const y = tf.tensor1d(data.map((d) => d.y));

    const w1 = tf.variable(tf.scalar(weights.w1));
    const w2 = tf.variable(tf.scalar(weights.w2));
    const b = tf.variable(tf.scalar(bias));

    // Prediction: sigmoid(w1*x1 + w2*x2 + b)
    const logits = x1
      .mul(w1)
      .add(x2.mul(w2))
      .add(b);
    const predictions = logits.sigmoid();

    // Compute binary cross-entropy loss
    const loss = tf.losses.sigmoidCrossEntropy(y, logits).mean();

    // Compute gradients
    const optimizer = tf.train.sgd(learningRate);
    const grads = tf.grads(() => {
      return tf.losses.sigmoidCrossEntropy(y, logits).mean();
    });
    const variables = [w1, w2, b];
    optimizer.applyGradients(grads(variables));

    return {
      w1: w1.dataSync()[0],
      w2: w2.dataSync()[0],
      b: b.dataSync()[0],
      loss: loss.dataSync()[0],
    };
  });
};