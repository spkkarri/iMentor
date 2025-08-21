import React from 'react';

export default function FlashcardSuggestion({ onAccept }) {
  return (
    <div style={{ marginTop: 12, background: '#f5f5fa', padding: 12, borderRadius: 8 }}>
      👉 Would you like me to generate flashcards based on this response?
      <button style={{ marginLeft: 10 }} onClick={onAccept}>Yes</button>
    </div>
  );
} 