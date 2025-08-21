export function parseFlashcards(text) {
  const cards = [];
  const regex = /Term:\s*(.+?)\s*Definition:\s*(.+?)(?=Term:|$)/gs;
  let match;
  while ((match = regex.exec(text)) !== null) {
    cards.push({ term: match[1].trim(), definition: match[2].trim() });
  }
  return cards;
} 