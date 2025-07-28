// server/controllers/chatController.js
const { ChatSession } = require('../models/ChatSession');
const { v4: uuidv4 } = require('uuid');
const HybridRagService = require('../services/HybridRagService');
const serviceManager = require('../services/serviceManager');
const personalizationService = require('../services/personalizationService');
const User = require('../models/User');
const Memory = require('../models/Memory');

/**
 * @desc    Get all chat sessions for the authenticated user
 * @route   GET /api/chat/sessions
 * @access  Private
 */
const getSessions = async (req, res) => {
    try {
        const sessions = await ChatSession.find({ user: req.user.id }).sort({ updatedAt: -1 });
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching sessions:', err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Get the full details of a single chat session
 * @route   GET /api/chat/session/:sessionId
 * @access  Private
 */
const getSessionDetails = async (req, res) => {
    try {
        const session = await ChatSession.findOne({ sessionId: req.params.sessionId, user: req.user.id });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json(session);
    } catch (err) {
        console.error('Error fetching session details:', err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Create a new, empty chat session
 * @route   POST /api/chat/session
 * @access  Private
 */
const createSession = async (req, res) => {
    try {
        const newSession = new ChatSession({
            user: req.user.id,
            sessionId: uuidv4(),
            title: 'New Conversation',
            messages: [],
        });
        await newSession.save();
        res.status(201).json(newSession);
    } catch (err) {
        console.error('Error creating session:', err.message);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc    Save or update a chat session's history. This is now primarily for persisting the conversation.
 * @route   POST /api/chat/history
 * @access  Private
 */
const saveChatHistory = async (req, res) => {
    const { sessionId, messages, systemPrompt, title } = req.body;
    if (!sessionId || !messages || messages.length === 0) {
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

/**
 * @desc    Handle a standard chat message, now with autonomous memory updates.
 * @route   POST /api/chat/message
 * @access  Private
 */
const handleStandardMessage = async (req, res) => {
    const { query, history = [], systemPrompt, conversationSummary } = req.body;
    
    if (!query) {
        return res.status(400).json({ message: 'Query is required.' });
    }

    try {
        const { geminiAI } = serviceManager.getServices();
        
        // Step 1: Autonomously update memory based on the latest turn.
        const fullHistoryForMemory = [...history, { role: 'user', parts: [{ text: query }] }];
        const memoryChanges = await personalizationService.extractAndUpdateMemories(req.user.id, fullHistoryForMemory, geminiAI);

        // Step 2: Fetch the user's profile and the now-updated memories.
        const user = await User.findById(req.user.id);
        const personalizationProfile = user ? user.personalizationProfile : '';
        const userMemories = await Memory.find({ user: req.user.id }); // All memories are now active.
        
        // Step 3: Generate the chat response, passing in the memory changes for the AI to announce.
        const responseText = await geminiAI.generateChatResponse(
            query, 
            [], // No RAG context for a standard message
            history, 
            systemPrompt, 
            personalizationProfile, 
            conversationSummary,
            userMemories,
            memoryChanges // Pass memory changes to the AI for potential acknowledgment
        );
        
        res.json({ message: responseText });
    } catch (error) {
        console.error("Standard chat error:", error);
        res.status(500).json({ message: "Failed to get a response from the AI." });
    }
};

/**
 * @desc    Handle a deep search request
 * @route   POST /api/chat/deep-search
 * @access  Private
 */
const handleDeepSearch = async (req, res) => {
    const { query, history = [] } = req.body;
    if (!query) {
        return res.status(400).json({ message: 'Query is required' });
    }
    try {
        const deepSearchService = serviceManager.getDeepSearchService(req.user.id);
        const result = await deepSearchService.performSearch(query, history);
        res.status(200).json({
            message: result.summary,
            metadata: {
                sources: result.sources,
                searchType: 'deep_search'
            }
        });
    } catch (error) {
        console.error('Deep search controller error:', error);
        res.status(500).json({ message: 'Deep search failed.' });
    }
};

/**
 * @desc    Delete a specific chat session
 * @route   DELETE /api/chat/session/:sessionId
 * @access  Private
 */
const deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;
        const result = await ChatSession.findOneAndDelete({ 
            sessionId: sessionId, 
            user: userId 
        });
        if (!result) {
            return res.status(404).json({ message: 'Chat session not found or you are not authorized to delete it.' });
        }
        res.status(200).json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ message: 'Server error while deleting session.' });
    }
};

/**
 * @desc    Handle a RAG query against user documents
 * @route   POST /api/chat/rag-v2
 * @access  Private
 */
const handleHybridRagMessage = async (req, res) => {
    try {
        // Removed fileId from destructuring, as it's no longer mandatory
        const { query, allowDeepSearch } = req.body;
        const userId = req.user.id;

        if (!query) {
            return res.status(400).json({ message: 'Query is required.' });
        }

        // Pass undefined for fileId to processQuery, so it knows to search all files for the user.
        const result = await HybridRagService.processQuery(query, userId, undefined, allowDeepSearch); 
        res.status(200).json(result);

    } catch (error) {
        console.error('Hybrid RAG Error:', error);
        res.status(500).json({ message: 'An error occurred during the RAG process.' });
    }
};

/**
 * @desc    Generate a short-term summary of the current conversation
 * @route   POST /api/chat/summarize
 * @access  Private
 */
const summarizeConversation = async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'A non-empty array of messages is required for summarization.' });
    }
    try {
        const { geminiAI } = serviceManager.getServices();
        const summary = await personalizationService.generateConversationSummary(messages, geminiAI);
        res.json({ summary });
    } catch (error) {
        console.error('Summarization controller error:', error);
        res.status(500).json({ message: 'Failed to summarize conversation.' });
    }
};

// Deprecated RAG endpoint
const handleRagMessage = async (req, res) => {
    res.status(410).json({ message: 'This endpoint is deprecated. Please use /api/chat/rag-v2' });
};

module.exports = {
    getSessions,
    getSessionDetails,
    createSession,
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
    deleteSession,
    handleHybridRagMessage,
    summarizeConversation,
};