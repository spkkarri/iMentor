// Singleton instance for vector store
const VectorStore = require('./vectorStore');
const vectorStore = new VectorStore();

// Optionally initialize on startup
(async () => {
  try {
    await vectorStore.initialize();
  } catch (err) {
    console.error('Failed to initialize vector store:', err);
  }
})();

module.exports = vectorStore;
