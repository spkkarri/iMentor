export function shouldSuggestFlashcards(response, alreadySuggested) {
  const minWords = 80;
  const educationalKeywords = [
    'explain', 'definition', 'how', 'why', 'process', 'system', 'data', 'algorithm', 'science', 'technology', 'history', 'theory', 'concept', 'principle', 'method'
  ];
  const wordCount = response.split(/\s+/).length;
  const isEducational = educationalKeywords.some(kw => response.toLowerCase().includes(kw));
  return wordCount >= minWords && isEducational && !alreadySuggested;
} 