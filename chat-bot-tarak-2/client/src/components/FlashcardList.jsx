import React from 'react';

export default function FlashcardList({ cards }) {
  return (
    <div style={{ marginTop: 16 }}>
      {cards.map((card, idx) => (
        <div key={idx} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 10, marginBottom: 8 }}>
          <strong>Term:</strong> {card.term}<br />
          <strong>Definition:</strong> {card.definition}
        </div>
      ))}
    </div>
  );
} 