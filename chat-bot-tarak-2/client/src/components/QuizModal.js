import React from 'react';
import './QuizModal.css'; // We'll create this CSS file for styling

const QuizModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="quiz-modal-overlay" onClick={onClose}>
      <div className="quiz-modal-content" onClick={e => e.stopPropagation()}>
        <button className="quiz-modal-close" onClick={onClose} aria-label="Close Quiz Modal">
          &times;
        </button>
        {children}
      </div>
    </div>
  );
};

export default QuizModal;
