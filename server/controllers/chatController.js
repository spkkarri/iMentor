// server/controllers/chatController.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { ChatSession, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');

const createSession = async (req, res) => {
    try {
        const { title, description, systemPrompt, context } = req.body;
        const session = new ChatSession({ 
            user: req.user.id, 
            title, 
            description, 
            systemPrompt, 
            context 
        });
        await session.save();
        res.status(201).json({ 
            sessionId: session.sessionId, 
            title: session.title, 
            context: session.context, 
            state: session.state 
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ message: 'Error creating session' });
    }
};

const getSessions = async (req, res) => {
    try {
        const sessions = await ChatSession.findByUser(req.user.id);
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ message: 'Error fetching sessions' });
    }
};

const getSessionDetails = async (req, res) => {
    try {
        const session = await ChatSession.findOne({ 
            sessionId: req.params.sessionId, 
            user: req.user.id 
        });
        if (!session) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }
        res.json(session);
    } catch (error) {
        console.error('Error fetching session details:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const saveChatHistory = async (req, res) => {
    const { sessionId, messages, systemPrompt, title } = req.body;
    if (!sessionId || !messages) {
        return res.status(400).json({ message: 'Session ID and messages are required.' });
    }
    try {
        const updatedSession = await ChatSession.findOneAndUpdate(
            { sessionId: sessionId, user: req.user.id },
            { 
                $set: {
                    messages: messages,
                    systemPrompt: systemPrompt,
                    title: title || 'New Conversation',
                    user: req.user.id
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(201).json(updatedSession);
    } catch (error) {
        console.error('Error saving chat session:', error);
        res.status(500).json({ message: 'Server error while saving chat history.' });
    }
};

const handleStandardMessage = async (req, res) => {
    try {
        const { query, sessionId, history = [], systemPrompt } = req.body;
        const userId = req.user.id;
        const { geminiAI } = req.serviceManager.getServices();

        if (!query || !sessionId) {
            return res.status(400).json({ message: 'Query and Session ID are required.' });
        }

        let session = await ChatSession.findOne({ sessionId, user: userId });
        if (!session) {
            session = new ChatSession({ sessionId, user: userId, title: query.substring(0, 50), systemPrompt: systemPrompt || "You are a helpful general-purpose AI assistant." });
        }
        
        session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

        const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));
        const responseText = await geminiAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
        
        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
        await session.save();

        res.json({ message: responseText, sessionId: session.sessionId, history: session.messages });
    } catch (error) {
        console.error('Error in /api/chat/message:', error);
        res.status(500).json({ message: 'Failed to process chat message.', error: error.message });
    }
};

const handleRagMessage = async (req, res) => {
    try {
        const { query, sessionId, fileId } = req.body;
        const userId = req.user.id;
        const { documentProcessor, geminiAI } = req.serviceManager.getServices();

        console.log('[RAG] Incoming request:', { userId, query, sessionId, fileId });

        if (!query || !sessionId) {
            console.warn('[RAG] Missing query or sessionId');
            return res.status(400).json({ message: 'Query and Session ID are required.' });
        }

        // Build filters for document search
        const filters = { userId };
        if (fileId) filters.fileId = fileId;
        console.log('[RAG] Using filters:', filters);

        // Search for relevant document chunks
        let relevantChunks = [];
        try {
            relevantChunks = await documentProcessor.searchDocuments(query, { filters });
            console.log(`[RAG] Found ${relevantChunks.length} relevant chunks.`);
        } catch (docErr) {
            console.error('[RAG] Error during document search:', docErr);
            return res.status(500).json({ message: 'Error searching documents for RAG.', error: docErr.message });
        }
        const sources = [...new Set(relevantChunks.map(chunk => chunk.metadata?.source))];

        // Find or create the chat session
        let session;
        try {
            session = await ChatSession.findOne({ sessionId, user: userId });
            if (!session) {
                console.warn(`[RAG] Session not found, creating new one: ${sessionId}`);
                session = new ChatSession({ 
                    sessionId, 
                    user: userId, 
                    title: `RAG: ${query.substring(0, 40)}`, 
                    systemPrompt: "You are a helpful AI assistant. Answer the user's questions based on the provided documents. If the answer is not in the documents, say so."
                });
            }
        } catch (sessionErr) {
            console.error('[RAG] Error fetching or creating session:', sessionErr);
            return res.status(500).json({ message: 'Error with chat session.', error: sessionErr.message });
        }
        
        // Add user message to session
        session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

        // Build AI history
        const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));

        // Generate AI response
        let responseText = '';
        try {
            responseText = await geminiAI.generateChatResponse(query, relevantChunks, aiHistory, session.systemPrompt);
            console.log('[RAG] AI response generated.');
        } catch (aiErr) {
            console.error('[RAG] Error generating AI response:', aiErr);
            return res.status(500).json({ message: 'Error generating AI response.', error: aiErr.message });
        }

        // Add assistant response and save session
        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
        await session.save();

        res.json({ message: responseText, metadata: { sources, documentsFound: relevantChunks.length }});
    } catch (error) {
        console.error('[RAG] Unexpected error in /api/chat/rag:', error);
        res.status(500).json({ message: 'RAG query failed (unexpected error).', error: error.message });
    }
};

// server/controllers/chatController.js


const handleDeepSearch = async (req, res) => {
    try {
        const { query, history = [] } = req.body;
        const userId = req.user.id;
        
        console.log(`[DeepSearch] Request received: query="${query}", userId=${userId}`);
        
        if (!query) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

        // Get user-specific DeepSearchService instance
        const deepSearchService = req.serviceManager.getDeepSearchService(userId);
        if (!deepSearchService) {
            throw new Error('DeepSearchService not available');
        }
        
        const results = await deepSearchService.performSearch(query, history);
        
        console.log(`[DeepSearch] Service returned:`, {
            hasResults: !!results,
            hasSummary: !!results?.summary,
            hasMessage: !!results?.message,
            messageLength: results?.summary?.length || results?.message?.length,
            metadata: results?.metadata,
            hasSources: !!results?.sources
        });

        if (!results || (!results.summary && !results.message)) {
            console.warn(`[DeepSearch] No valid summary or message returned for query: "${query}"`);
            return res.status(404).json({
                message: 'No relevant results found from deep search.',
                metadata: { sources: [], searchType: 'none' }
            });
        }

        const message = results.summary || results.message;
        const metadata = results.metadata || {
            sources: results.sources || [],
            searchType: results.searchType || (results.summary ? 'deep_search' : 'fallback'),
            aiGenerated: results.aiGenerated,
            query: results.query,
            note: results.note
        };
        
        const response = {
            message: message,
            metadata: metadata
        };
        
        console.log(`[DeepSearch] Sending response:`, {
            messageLength: response.message.length,
            metadata: response.metadata
        });

        res.json(response);
    } catch (error) {
        console.error('Deep Search error:', error);
        res.status(500).json({
            message: error.message || 'Deep search failed.',
            metadata: { sources: [], searchType: 'error', note: error.message }
        });
    }
};


module.exports = {
    createSession,
    getSessions,
    getSessionDetails,
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
};
