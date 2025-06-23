// client/src/components/VoiceInputButton.js
import React from 'react';
import { FiMic } from 'react-icons/fi';

/**
 * A button component that shows a microphone icon and handles toggling voice recognition.
 * It changes its appearance based on whether it's currently listening.
 * @param {object} props - Component props.
 * @param {boolean} props.isListening - Whether the speech recognition is active.
 * @param {function} props.onToggleListen - The function to call when the button is clicked.
 * @param {boolean} props.isSupported - Whether the browser supports speech recognition.
 */
const VoiceInputButton = ({ isListening, onToggleListen, isSupported }) => {
  if (!isSupported) {
    // If the browser doesn't support the feature, render a disabled button with a tooltip.
    return (
      <button
        type="button"
        className="voice-input-button"
        disabled={true}
        title="Voice recognition is not supported in your browser."
      >
        <FiMic size={20} />
      </button>
    );
  }

  return (
    <button
      type="button"
      // Conditionally add the 'listening' class for styling
      className={`voice-input-button ${isListening ? 'listening' : ''}`}
      onClick={onToggleListen}
      title={isListening ? 'Stop Listening' : 'Start Listening'}
    >
      <FiMic size={20} />
    </button>
  );
};

export default VoiceInputButton;