/**
 * @fileoverview Express router for chat-related functionalities.
 * Handles sending messages to the AI service, managing chat sessions,
 * and retrieving chat history.
 */

const express = require('express');
const axios = require('axios'); // Correctly required the module
const { v4: uuidv4 } = require('uuid');
const { tempAuth } = require('../middleware/authMiddleware');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');

const router = express.Router();

// --- Configuration & Constants ---

const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
if (!PYTHON_AI_SERVICE_URL) {
    console.error("FATAL ERROR: PYTHON_AI_CORE_SERVICE_URL is not set. AI features will not work.");
}
const KNOWLEDGE_CHECK_IDENTIFIER = "You are a Socratic quizmaster";

// --- Helper Functions ---

// ==================================================================
//  START OF MODIFICATION
// ==================================================================
/**
 * Parses a response string from the AI to separate the "thinking" process
 * from the final answer.
 * @param {string} fullResponse - The full string response from the LLM.
 * @returns {{answer: string, thinking: string|null}}
 */
const parseThinkingAndAnswer = (fullResponse) => {
    if (typeof fullResponse !== 'string') {
        return { answer: fullResponse, thinking: null };
    }
    const responseText = fullResponse.trim();
    const thinkStartTag = "<thinking>";
    const thinkEndTag = "</thinking>";

    const startIndex = responseText.indexOf(thinkStartTag);
    const endIndex = responseText.indexOf(thinkEndTag, startIndex);

    if (startIndex !== -1 && endIndex !== -1) {
        const thinkingContent = responseText.substring(startIndex + thinkStartTag.length, endIndex).trim();
        const answer = responseText.substring(endIndex + thinkEndTag.length).trim();
        return {
            answer: answer || "[AI response primarily contained reasoning. See thinking process for details.]",
            thinking: thinkingContent
        };
    }
    
    // If tags are not found, return the original response as the answer.
    return { answer: responseText, thinking: null };
};
// ==================================================================
//  END OF MODIFICATION
// ==================================================================


/**
 * Retrieves the appropriate API keys and Ollama host for a user.
 * It prioritizes admin-provided keys if the user's access request is approved,
 * otherwise falling back to the user's personal keys.
 * It also includes special handling for a non-database 'admin-user'.
 *
 * @param {string} userId - The ID of the user making the request.
 * @param {string} selectedLlmProvider - The LLM provider (e.g., 'gemini', 'groq').
 * @returns {Promise<{apiKeys: {gemini: string|null, grok: string|null}, ollamaHost: string|null}>}
 * @throws {Error} If the user is not found or a required API key is missing.
 */
const getApiAuthDetails = async (userId, selectedLlmProvider) => {
    // If the user ID is our special admin string, bypass the database lookup entirely.
    if (userId === 'admin-user') {
        console.log(`>>> Admin user request detected. Using admin keys.`);
        const apiKeys = {
            gemini: process.env.ADMIN_GEMINI_API_KEY,
            grok: process.env.ADMIN_GROQ_API_KEY,
        };
        // Admins use the default Ollama host.
        const ollamaHost = process.env.DEFAULT_OLLAMA_HOST || null;
        
        // Final validation for the admin keys.
        if (selectedLlmProvider.startsWith('gemini') && !apiKeys.gemini) {
            throw new Error("Chat Error: Admin's Gemini API key is not configured on the server.");
        }
        if (selectedLlmProvider.startsWith('groq') && !apiKeys.grok) {
            throw new Error("Chat Error: Admin's Grok API key is not configured on the server.");
        }
        return { apiKeys, ollamaHost };
    }

    // If it's a regular user, proceed with the normal database lookup.
    const user = await User.findById(userId).select('+geminiApiKey +grokApiKey +apiKeyAccessRequest +ollamaHost');
    if (!user) {
        throw new Error("User account not found.");
    }

    const apiKeys = { gemini: null, grok: null };

    if (user.apiKeyAccessRequest?.status === 'approved') {
        console.log(`>>> User ${userId} has APPROVED access to admin keys.`);
        apiKeys.gemini = process.env.ADMIN_GEMINI_API_KEY;
        apiKeys.grok = process.env.ADMIN_GROQ_API_KEY;
    } else {
        console.log(`>>> User ${userId} is using PERSONAL keys.`);
        if (user.geminiApiKey) apiKeys.gemini = decrypt(user.geminiApiKey);
        if (user.grokApiKey) apiKeys.grok = decrypt(user.grokApiKey);
    }

    if (selectedLlmProvider.startsWith('gemini') && !apiKeys.gemini) {
        throw new Error("Chat Error: A required Gemini API key was not available. Request access from an admin or add a key in Settings.");
    }
    if (selectedLlmProvider.startsWith('groq') && !apiKeys.grok) {
        throw new Error("Chat Error: A required Grok API key was not available. Request access from an admin or add a key in Settings.");
    }

    const ollamaHost = user.ollamaHost || process.env.DEFAULT_OLLAMA_HOST || null;
    return { apiKeys, ollamaHost };
};

// --- Routes ---

/**
 * @route   POST /api/chat/message
 * @desc    Send a message to the AI and get a response.
 * @access  Private
 */
router.post('/message', tempAuth, async (req, res) => {
    const {
        message, history, sessionId, systemPrompt, isRagEnabled,
        llmProvider, llmModelName, enableMultiQuery
    } = req.body;
    const userId = req.user._id.toString();

    // Input Validation
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: 'Message text required.' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'Session ID required.' });
    }
    if (!Array.isArray(history)) {
        return res.status(400).json({ message: 'Invalid history format.' });
    }
    if (!PYTHON_AI_SERVICE_URL) {
        return res.status(503).json({ message: "AI Service is temporarily unavailable due to a configuration issue." });
    }

    try {
        const selectedLlmProvider = llmProvider || 'gemini';
        const { apiKeys, ollamaHost } = await getApiAuthDetails(userId, selectedLlmProvider);

        const isKnowledgeCheck = systemPrompt?.includes(KNOWLEDGE_CHECK_IDENTIFIER) && history?.length === 0;
        const performRagRequest = isKnowledgeCheck ? false : !!isRagEnabled;

        const pythonPayload = {
                user_id: userId,
                query: message.trim(),
                chat_history: history,
                llm_provider: selectedLlmProvider,
                llm_model_name: llmModelName || null,
                system_prompt: systemPrompt,
                perform_rag: performRagRequest,
                enable_multi_query: enableMultiQuery ?? true,
                api_keys: apiKeys,
                ollama_host: ollamaHost,
                active_file: req.body.activeFile || null
            };
        console.log('[DEBUG] /chat/message payload ollama_host:', pythonPayload.ollama_host);

        const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/generate_chat_response`, pythonPayload, { timeout: 120000 });

        if (pythonResponse.data?.status !== 'success') {
            throw new Error(pythonResponse.data?.error || "Failed to get valid response from AI service.");
        }

        // ==================================================================
        //  START OF MODIFICATION
        // ==================================================================
        // The original response from Python is now parsed here.
        const { answer, thinking } = parseThinkingAndAnswer(pythonResponse.data.llm_response);
        
        // The object sent to the frontend now has correctly separated data.
        const modelResponseMessage = {
            role: 'model',
            parts: [{ text: answer || "[No response text from AI]" }],
            timestamp: new Date(),
            references: pythonResponse.data.references || [],
            thinking: thinking, // Use the parsed thinking content
        };
        // ==================================================================
        //  END OF MODIFICATION
        // ==================================================================

        res.status(200).json({ reply: modelResponseMessage });

    } catch (error) {
        console.error(`!!! Error in /message route for session ${sessionId}:`, error.message);
        if (error.message.includes("User account not found")) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.startsWith("Chat Error:")) {
            return res.status(400).json({ message: error.message });
        }
        if (error.response) {
            return res.status(error.response.status).json({ message: error.response.data?.error || "Failed to get response from the AI service." });
        }
        res.status(500).json({ message: error.message || "An unexpected server error occurred." });
    }
});

/**
 * @route   POST /api/chat/history
 * @desc    Save (upsert) the history of a chat session.
 * @access  Private
 */
router.post('/history', tempAuth, async (req, res) => {
    const { sessionId, messages } = req.body;
    const userId = req.user._id;

    if (!sessionId) return res.status(400).json({ message: 'Session ID required.' });
    if (!Array.isArray(messages)) return res.status(400).json({ message: 'Invalid messages format.' });

    try {
        const validMessages = messages
            .filter(m => m && m.role && m.parts?.[0]?.text && m.timestamp)
            .map(m => ({
                role: m.role,
                parts: m.parts,
                timestamp: m.timestamp,
                references: m.role === 'model' ? (m.references || []) : undefined,
                thinking: m.role === 'model' ? (m.thinking || null) : undefined,
            }));

        const newSessionId = uuidv4();
        if (validMessages.length === 0) {
            return res.status(200).json({ message: 'No history to save.', savedSessionId: null, newSessionId });
        }

        const savedHistory = await ChatHistory.findOneAndUpdate(
            { sessionId: sessionId, userId: userId },
            { $set: { userId, sessionId, messages: validMessages, updatedAt: Date.now() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: 'Chat history saved.', savedSessionId: savedHistory.sessionId, newSessionId });
    } catch (error) {
        console.error(`Error saving chat history for session ${sessionId}:`, error);
        res.status(500).json({ message: 'Failed to save chat history.' });
    }
});

/**
 * @route   GET /api/chat/sessions
 * @desc    Get a summary of all chat sessions for the user.
 * @access  Private
 */
router.get('/sessions', tempAuth, async (req, res) => {
    const userId = req.user._id;
    try {
        const sessions = await ChatHistory.find({ userId })
            .sort({ updatedAt: -1 })
            .select('sessionId createdAt updatedAt messages')
            .lean();

        const sessionSummaries = sessions.map(session => {
            const firstUserMessage = session.messages?.find(m => m.role === 'user');
            let preview = firstUserMessage?.parts?.[0]?.text.substring(0, 75) || 'Chat Session';
            if (preview.length === 75) preview += '...';

            return {
                sessionId: session.sessionId,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.messages?.length || 0,
                preview: preview,
            };
        });
        res.status(200).json(sessionSummaries);
    } catch (error) {
        console.error(`Error fetching sessions for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve sessions.' });
    }
});

/**
 * @route   GET /api/chat/session/:sessionId
 * @desc    Get the full message history for a specific session.
 * @access  Private
 */
router.get('/session/:sessionId', tempAuth, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!sessionId) return res.status(400).json({ message: 'Session ID is required.' });

    try {
        const session = await ChatHistory.findOne({ sessionId, userId }).lean();
        if (!session) {
            return res.status(404).json({ message: 'Chat session not found or access denied.' });
        }
        res.status(200).json(session);
    } catch (error) {
        console.error(`Error fetching session ${sessionId} for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve session.' });
    }
});

/**
 * @route   DELETE /api/chat/session/:sessionId
 * @desc    Delete a specific chat session.
 * @access  Private
 */
router.delete('/session/:sessionId', tempAuth, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!sessionId) return res.status(400).json({ message: 'Session ID is required to delete.' });

    try {
        console.log(`>>> DELETE /api/chat/session/${sessionId} requested by User ${userId}`);
        const result = await ChatHistory.findOneAndDelete({ sessionId, userId });

        if (!result) {
            console.warn(`   Session not found or user mismatch for session ${sessionId} and user ${userId}.`);
            return res.status(404).json({ message: 'Session not found or you do not have permission to delete it.' });
        }

        console.log(`<<< Session ${sessionId} successfully deleted for user ${userId}.`);
        res.status(200).json({ message: 'Session deleted successfully.' });
    } catch (error) {
        console.error(`!!! Error deleting session ${sessionId} for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to delete session due to a server error.' });
    }
});

module.exports = router;