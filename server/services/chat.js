const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { ChatSession, SESSION_STATES, SESSION_CONTEXTS, MESSAGE_TYPES } = require('../models/ChatSession');
const aiService = require('../aiService');
const vectorStore = require('../services/vectorStore');
const storage = require('../storage');
const DuckDuckGoService = require('../utils/duckduckgo');
const GeminiService = require('../deep_search/services/geminiService');

router.post('/', tempAuth, async (req, res) => {
  try {
    const { query, history = [], sessionId } = req.body;
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    let session = await ChatSession.findOne({ sessionId, user: req.user.id });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get document chunks for RAG
    const documentChunks = await vectorStore.search(query, { userId: req.user.id });
    const chatHistory = session.messages.map(msg => ({
      role: msg.role,
      content: msg.parts[0].text
    }));

    // Generate response using Gemini
    const responseText = await aiService.generateChatResponse(query, documentChunks, chatHistory, session.systemPrompt);

    // Save messages
    session.messages.push(
      { role: 'user', parts: [{ text: query }], type: 'text' },
      { role: 'assistant', parts: [{ text: responseText }], type: 'text' }
    );
    await session.save();

    res.status(200).json({
      message: responseText,
      sessionId: session.sessionId,
      type: 'text'
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/deep-search', tempAuth, async (req, res) => {
  try {
    const { query, history = [] } = req.body;
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    const geminiService = GeminiService;
    const duckDuckGoService = new DuckDuckGoService();

    const decomposition = await geminiService.decomposeQuery(query);
    const searchPromises = decomposition.searchQueries.map(q =>
      duckDuckGoService.performSearch(q, 'text', { maxResults: 5 })
    );
    const searchResultsArrays = await Promise.all(searchPromises);
    const searchResults = searchResultsArrays
      .flatMap(arr => arr.results)
      .filter((result, index, self) =>
        index === self.findIndex(r => r.url === result.url)
      );

    const synthesized = await geminiService.synthesizeResults(query, searchResults, decomposition);

    const session = await ChatSession.findOne({ user: req.user.id, sessionId: req.body.sessionId });
    if (session) {
      session.messages.push(
        { role: 'user', parts: [{ text: query }], type: 'text' },
        { role: 'assistant', parts: [{ text: synthesized.answer }], type: 'text' }
      );
      await session.save();
    }

    res.status(200).json({
      message: synthesized.answer,
      sources: synthesized.sources,
      type: 'text',
      sessionId: session?.sessionId
    });
  } catch (error) {
    console.error('Deep search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;