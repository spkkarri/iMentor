// server/routes/services.js
// Exposes all services in server/services/ as API endpoints for testing and integration

const express = require('express');
const router = express.Router();

// Import all services
const aiSearch = require('../services/aiSearch');
const aiService = require('../services/aiService');
const cacheService = require('../services/cacheService');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const { GeminiAI } = require('../services/geminiAI');
const documentProcessor = require('../services/documentProcessor');
const DuckDuckGoService = require('../utils/duckduckgo');
const geminiService = require('../services/geminiService');
const geminiServiceDS = require('../services/geminiServiceDS');
const podcastGenerator = require('../services/podcastGenerator');
const storage = require('../services/storage');
const vectorStore = require('../services/vectorStoreInstance');

// Example: Expose a health/status endpoint for each service
router.get('/status', (req, res) => {
  res.json({
    aiSearch: !!aiSearch,
    aiService: !!aiService,
    cacheService: !!cacheService,
    deepSearch: !!DeepSearchService,
    documentProcessor: !!documentProcessor,
    duckduckgo: !!DuckDuckGoService,
    geminiAI: !!GeminiAI,
    geminiService: !!geminiService,
    geminiServiceDS: !!geminiServiceDS,
    podcastGenerator: !!podcastGenerator,
    storage: !!storage,
    vectorStore: !!vectorStore
  });
});

// --- Efficiency & Best Practices Improvements ---
// Adds input validation, consistent response, and better error logging for all endpoints

function validateField(field, value, res) {
  if (!value) {
    res.status(400).json({ success: false, error: `Missing required field: ${field}` });
    return false;
  }
  return true;
}

// Expose a generic endpoint for each service (for demonstration/testing)

// aiSearch example endpoint
router.post('/ai-search', async (req, res) => {
  const { query } = req.body;
  if (!validateField('query', query, res)) return;
  try {
    if (typeof aiSearch.search !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await aiSearch.search(query);
    res.json({ success: true, result });
  } catch (err) {
    console.error('aiSearch.search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// aiService example endpoint
router.post('/ai-service', async (req, res) => {
  const { prompt } = req.body;
  if (!validateField('prompt', prompt, res)) return;
  try {
    if (typeof aiService.generateChatResponse !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await aiService.generateChatResponse(prompt);
    res.json({ success: true, result });
  } catch (err) {
    console.error('aiService.generateChatResponse error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// cacheService example endpoint
router.post('/cache', async (req, res) => {
  const { key } = req.body;
  if (!validateField('key', key, res)) return;
  try {
    if (typeof cacheService.get !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const value = await cacheService.get(key);
    res.json({ success: true, value });
  } catch (err) {
    console.error('cacheService.get error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/deep-search/search', async (req, res) => {
  const { query, history, sessionId } = req.body;
  if (!validateField('query', query, res)) return;
  if (!validateField('sessionId', sessionId, res)) return;
  try {
    // Create instances of required services
    const geminiService = new geminiService();
    await geminiService.initialize();
    const duckDuckGoService = new DuckDuckGoService();
    
    // Create DeepSearchService instance with correct parameters
    const deepSearchService = new DeepSearchService(sessionId, geminiService, duckDuckGoService);
    const result = await deepSearchService.performSearch(query, history || []);
    res.json({ success: true, result });
  } catch (err) {
    console.error('DeepSearchService.performSearch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// documentProcessor example endpoint
router.post('/process-document', async (req, res) => {
  const { filePath, originalName } = req.body;
  if (!validateField('filePath', filePath, res) || !validateField('originalName', originalName, res)) return;
  try {
    if (typeof documentProcessor.processDocument !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await documentProcessor.processDocument(filePath, originalName);
    res.json({ success: true, result });
  } catch (err) {
    console.error('documentProcessor.processDocument error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// duckduckgo example endpoint
router.post('/duckduckgo', async (req, res) => {
  const { query } = req.body;
  if (!validateField('query', query, res)) return;
  try {
    if (typeof duckduckgo.performSearch !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await duckduckgo.performSearch(query);
    res.json({ success: true, result });
  } catch (err) {
    console.error('duckduckgo.performSearch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// geminiAI example endpoint
router.post('/gemini-ai', async (req, res) => {
  const { prompt } = req.body;
  if (!validateField('prompt', prompt, res)) return;
  try {
    if (typeof geminiAI.generate !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await geminiAI.generate(prompt);
    res.json({ success: true, result });
  } catch (err) {
    console.error('geminiAI.generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// geminiService example endpoint
router.post('/gemini-service', async (req, res) => {
  const { query } = req.body;
  if (!validateField('query', query, res)) return;
  try {
    if (typeof geminiService.decomposeQuery !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await geminiService.decomposeQuery(query);
    res.json({ success: true, result });
  } catch (err) {
    console.error('geminiService.decomposeQuery error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// geminiServiceDS example endpoint
router.post('/gemini-service-ds', async (req, res) => {
  const { input } = req.body;
  if (!validateField('input', input, res)) return;
  try {
    if (typeof geminiServiceDS.someFunction !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await geminiServiceDS.someFunction(input);
    res.json({ success: true, result });
  } catch (err) {
    console.error('geminiServiceDS.someFunction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// podcastGenerator example endpoint
router.post('/podcast', async (req, res) => {
  const { script } = req.body;
  if (!validateField('script', script, res)) return;
  try {
    if (typeof podcastGenerator.generatePodcastAudio !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    // Use a default filename or allow user to pass one in the future
    const result = await podcastGenerator.generatePodcastAudio(script, "podcast");
    res.json({ success: true, result });
  } catch (err) {
    console.error('podcastGenerator.generatePodcastAudio error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// storage example endpoint
router.post('/storage', async (req, res) => {
  const { documentId } = req.body;
  if (!validateField('documentId', documentId, res)) return;
  try {
    if (typeof storage.getDocument !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await storage.getDocument(documentId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('storage.getDocument error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// vectorStore example endpoint
router.post('/vector-store', async (req, res) => {
  const { query } = req.body;
  if (!validateField('query', query, res)) return;
  try {
    if (typeof vectorStore.search !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const result = await vectorStore.search(query);
    res.json({ success: true, result });
  } catch (err) {
    console.error('vectorStore.search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add document(s) to vectorStore for RAG testing
router.post('/vector-store/add', async (req, res) => {
  const { documents } = req.body;
  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or empty documents array' });
  }
  try {
    if (typeof vectorStore.addDocuments !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    await vectorStore.addDocuments(documents);
    res.json({ success: true, message: `Added ${documents.length} document(s) to vector store.` });
  } catch (err) {
    console.error('vectorStore.addDocuments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// RAG endpoint using vectorStore (for direct RAG testing)
router.post('/rag', async (req, res) => {
  const { query, limit = 5 } = req.body;
  if (!validateField('query', query, res)) return;
  try {
    if (typeof vectorStore.search !== 'function') return res.status(501).json({ success: false, error: 'Not implemented' });
    const results = await vectorStore.search(query, { limit });
    res.json({ success: true, results });
  } catch (err) {
    console.error('vectorStore.rag error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

// Removed all Python-based service endpoints and imports (none present in this file)
