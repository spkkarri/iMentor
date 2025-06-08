 import React from 'react';
import Lottie from 'lottie-react';
import Balancer from 'react-wrap-balancer';
import animationData from '../assets/lottie-animation.json'; // We will download this file next
import './LoadingAnimator.css';

const LoadingAnimator = ({ statusText }) => {
  return (
    <div className="loading-animator-container">
      <div className="lottie-wrapper">
        <Lottie animationData={animationData} loop={true} />
      </div>
      <p className="status-text">
        <Balancer>{statusText || 'Initializing process...'}</Balancer>
      </p>
    </div>
  );
};

export default LoadingAnimator;