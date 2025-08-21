import React from 'react';

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        backgroundColor: '#1a1a1a',
        padding: '20px',
        borderRadius: '8px',
        width: '80%',
        maxWidth: '900px',
        maxHeight: '80%',
        overflowY: 'auto',
      }}>
        {children}
        <button onClick={onClose} style={{
          marginTop: '10px',
          padding: '8px 16px',
          backgroundColor: '#61dafb',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'black',
          fontWeight: 'bold',
        }}>Close</button>
      </div>
    </div>
  );
};

export default Modal;
