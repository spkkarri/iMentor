import * as tf from '@tensorflow/tfjs';

export const createModel = () => {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 1,
      inputShape: [2],
      activation: 'sigmoid',
    })
  );
  return model;
};

export const trainStep = async (model, data, learningRate) => {
  return tf.tidy(() => {
    const xs = tf.tensor2d(
      data.map((d) => [d.x1, d.x2]),
      [data.length, 2]
    );
    const ys = tf.tensor2d(
      data.map((d) => [d.y]),
      [data.length, 1]
    );

    model.compile({
      optimizer: tf.train.sgd(learningRate),
      loss: 'binaryCrossentropy',
    });

    const history = model.trainOnBatch(xs, ys);
    const weights = model.getWeights();
    const w = weights[0].dataSync();
    const b = weights[1].dataSync();

    return {
      w1: w[0],
      w2: w[1],
      b: b[0],
      loss: history,
    };
  });
};