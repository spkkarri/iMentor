/**
 * @fileoverview Express router for chat-related functionalities.
 */
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { tempAuth } = require('../middleware/authMiddleware');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const { decrypt } = require('../services/encryptionService');
const summarizeHistory = require('../utils/summarizeHistory'); // You will create this
const fs = require('fs');
const path = require('path');

const router = express.Router();

// --- Configuration & Constants ---
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_CORE_SERVICE_URL;
if (!PYTHON_AI_SERVICE_URL) {
    console.error("FATAL ERROR: PYTHON_AI_CORE_SERVICE_URL is not set.");
}
const KNOWLEDGE_CHECK_IDENTIFIER = "You are a Socratic quizmaster";

// Health check function for Python AI service
async function checkPythonServiceHealth() {
    try {
        const resp = await axios.get(`${PYTHON_AI_SERVICE_URL}/health`, { timeout: 3000 });
        return resp.status === 200;
    } catch (err) {
        return false;
    }
}

// Run health check at startup
(async () => {
    const healthy = await checkPythonServiceHealth();
    if (!healthy) {
        console.error('FATAL: Python AI service is not reachable at startup. Please check the service.');
    } else {
        console.log('Python AI service is healthy at startup.');
    }
})();

// --- Helper Functions ---
const getApiAuthDetails = async (userId, selectedLlmProvider) => {
    // This function is correct.
    if (!selectedLlmProvider) throw new Error("LLM Provider is required.");
    const user = await User.findById(userId).select('+geminiApiKey +grokApiKey +apiKeyAccessRequest +ollamaHost');
    if (!user) throw new Error("User account not found.");
    const apiKeys = { gemini: null, grok: null };
    if (user.apiKeyAccessRequest?.status === 'approved') {
        apiKeys.gemini = process.env.ADMIN_GEMINI_API_KEY;
        apiKeys.grok = process.env.ADMIN_GROQ_API_KEY;
    } else {
        if (user.geminiApiKey) apiKeys.gemini = decrypt(user.geminiApiKey);
        if (user.grokApiKey) apiKeys.grok = decrypt(user.grokApiKey);
    }
    if (selectedLlmProvider.startsWith('gemini') && !apiKeys.gemini) throw new Error("A required Gemini API key was not available.");
    if (selectedLlmProvider.startsWith('groq') && !apiKeys.grok) throw new Error("A required Groq API key was not available.");
    const ollamaHost = user.ollamaHost || null;
    return { apiKeys, ollamaHost };
};

// --- Routes ---
router.post('/message', tempAuth, async (req, res) => {
    // Check Python AI service health before handling the request
    const healthy = await checkPythonServiceHealth();
    if (!healthy) {
        return res.status(503).json({ message: 'Python AI service is unavailable. Please try again later.' });
    }

    console.log("--- Received /message request from frontend with body: ---");
    console.log(req.body);
    console.log("----------------------------------------------------------");

    // ==================================================================
    //  2. REPLACE the start of your route with this block to fix the path
    // ==================================================================
    const {
        message, history, sessionId, systemPrompt, isRagEnabled, llmProvider, llmModelName, enableMultiQuery, activeFile: originalActiveFile, showReasoning
    } = req.body;
    const userId = req.user._id.toString();

    // This line takes the path from the client (e.g., 'docs/123-file.pdf')
    // and returns ONLY the filename ('123-file.pdf'). This is the crucial fix.
    const activeFile = originalActiveFile ? path.basename(originalActiveFile) : null;
    // ==================================================================


    if (!message || !sessionId || !llmProvider) {
        return res.status(400).json({ message: 'Bad request: message, sessionId, and llmProvider are required.' });
    }

    if (!PYTHON_AI_SERVICE_URL) {
        return res.status(503).json({ message: "AI Service is temporarily unavailable." });
    }

    // === New logic: If user asks for topics/summary and a file is present, extract headings/subheadings ===
    let extractedHeadings = null;
    let chunksAdded = 0;
    let filePath, metaPath;
    if (activeFile) {
        const userAssetsDir = path.join(__dirname, '..', 'assets', req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_'));
        filePath = path.join(userAssetsDir, activeFile);
        metaPath = filePath + '.meta.json';
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                chunksAdded = meta.chunks_added || 0;
            } catch (err) {
                console.warn('Could not read PDF metadata:', err.message);
            }
        }
    }
    // Safeguard: If PDF already processed, skip extraction
    if (chunksAdded > 0) {
        console.log(`PDF ${activeFile} already processed (chunks_added=${chunksAdded}), skipping extraction.`);
        // You can add your vector DB retrieval logic here if needed
        return res.status(200).json({ message: `PDF already processed, skipping extraction.`, chunks_added: chunksAdded });
    }
    // ...existing code...
    if (activeFile && typeof message === 'string' && /(topics|summary|headings|subheadings)/i.test(message)) {
        try {
            // Assume activeFile is a relative path like 'docs/1751045132926-Chapter5.pdf'
            const userAssetsDir = path.join(__dirname, '..', 'assets', req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_'));
            const filePath = path.join(userAssetsDir, activeFile);
            console.log('DEBUG: Checking file path for extraction:', filePath);
            if (fs.existsSync(filePath)) {
                // Call Python AI backend to extract headings from the file
                const extractResp = await axios.post(`${PYTHON_AI_SERVICE_URL}/extract_headings`, { file_path: filePath }, { timeout: 60000 });
                console.log('DEBUG: /extract_headings response:', extractResp.data);
                if (extractResp.data && extractResp.data.headings) {
                    extractedHeadings = extractResp.data.headings;
                } else {
                    console.warn('WARNING: No headings extracted from file:', filePath);
                }
            } else {
                console.warn('WARNING: File does not exist for extraction:', filePath);
            }
        } catch (err) {
            console.error('Error extracting headings from file:', err.message);
        }
    }

    // 1. If user asks for topics/headings and a file is present, send the actual PDF text to the LLM with a strong prompt
    if (activeFile && typeof message === 'string' && /(topics|headings|subheadings)/i.test(message)) {
        try {
            const userAssetsDir = path.join(__dirname, '..', 'assets', req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_'));
            const filePath = path.join(userAssetsDir, activeFile);
            if (fs.existsSync(filePath)) {
                // Call Python AI backend to extract the full text from the file
                const extractTextResp = await axios.post(`${PYTHON_AI_SERVICE_URL}/extract_text`, { file_path: filePath }, { timeout: 60000 });
                const pdfText = extractTextResp.data && extractTextResp.data.text ? extractTextResp.data.text : null;
                if (pdfText) {
                    // Compose a strong prompt for the LLM
                    const prompt = `Given the following text from a PDF, list the main topics and subtopics as they appear in the document. Be as faithful to the document's structure as possible.\n\n${pdfText.substring(0, 8000)}\n\nList the topics and subtopics:`;
                    const { apiKeys, ollamaHost } = await getApiAuthDetails(userId, llmProvider);
                    const pythonPayload = {
                        user_id: userId,
                        query: prompt,
                        chat_history: history || [],
                        llm_provider: llmProvider,
                        llm_model_name: llmModelName || null,
                        system_prompt: systemPrompt,
                        perform_rag: false,
                        enable_multi_query: false,
                        api_keys: apiKeys,
                        ollama_host: ollamaHost,
                        active_file: activeFile || null
                    };
                    const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/generate_chat_response`, pythonPayload, { timeout: 120000 });
                    if (pythonResponse.data?.status !== 'success') {
                        throw new Error(pythonResponse.data?.error || "Failed to get valid response from AI service.");
                    }
                    const modelResponseMessage = {
                        role: 'model',
                        parts: [{ text: pythonResponse.data.llm_response || "[No response text from AI]" }],
                        timestamp: new Date(),
                        references: pythonResponse.data.references || [],
                        thinking: pythonResponse.data.thinking_content || null,
                        provider: pythonResponse.data.provider_used,
                        model: pythonResponse.data.model_used,
                        context_source: pythonResponse.data.context_source
                    };
                    return res.status(200).json({ reply: modelResponseMessage });
                }
            }
        } catch (err) {
            console.error('Error extracting text from file for LLM:', err.message);
        }
    }

    try {
        // --- BEGIN: Added logic for conversation history summary ---
        let historySummary = '';
        try {
            // Fetch the most recent 3 sessions for the user to create a summary.
            const recentSessions = await ChatHistory.find({ userId: req.user._id })
                .sort({ updatedAt: -1 })
                .limit(3);

            if (recentSessions && recentSessions.length > 0) {
                // Combine messages from all recent sessions into one flat array for summarization.
                const historyForSummary = recentSessions.reduce((acc, session) => {
                    if (Array.isArray(session.messages)) {
                        return acc.concat(session.messages);
                    }
                    return acc;
                }, []);

                if (historyForSummary.length > 0) {
                    // Use your existing utility to create a summary.
                    historySummary = await summarizeHistory(historyForSummary);
                    console.log(`Generated history summary for user ${userId}.`);
                }
            }
        } catch (summaryError) {
            console.error(`Could not generate history summary for user ${userId}:`, summaryError);
            // If this fails, we'll just send an empty summary and the chat can proceed normally.
        }
        // --- END: Added logic for conversation history summary ---

        const { apiKeys, ollamaHost } = await getApiAuthDetails(userId, llmProvider);
        const isKnowledgeCheck = systemPrompt?.includes(KNOWLEDGE_CHECK_IDENTIFIER) && history?.length === 0;
        const performRagRequest = !isKnowledgeCheck && !!isRagEnabled;

        // --- Chain-of-Thought Reasoning ---
        let finalPrompt = message.trim();
        if (showReasoning) {
            finalPrompt = `${finalPrompt}\n\nPlease show your step-by-step reasoning before giving the final answer. Use a clear chain-of-thought format.`;
        }

        const pythonPayload = {
            user_id: userId,
            query: finalPrompt,
            chat_history: history || [],
            llm_provider: llmProvider,
            llm_model_name: llmModelName || null,
            system_prompt: systemPrompt,
            perform_rag: performRagRequest,
            enable_multi_query: enableMultiQuery ?? true,
            api_keys: apiKeys,
            ollama_host: ollamaHost,
            active_file: activeFile || null,
            extracted_headings: extractedHeadings, // Pass to backend if available
            user_history_summary: historySummary // <-- ADD THIS LINE
        };

        const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/generate_chat_response`, pythonPayload, { timeout: 120000 });

        if (pythonResponse.data?.status !== 'success') {
            throw new Error(pythonResponse.data?.error || "Failed to get valid response from AI service.");
        }

        const modelResponseMessage = {
            role: 'model',
            parts: [{ text: pythonResponse.data.llm_response || "[No response text from AI]" }],
            timestamp: new Date(),
            references: pythonResponse.data.references || [],
            thinking: pythonResponse.data.thinking_content || null, // <-- LLM's reasoning
            provider: pythonResponse.data.provider_used,
            model: pythonResponse.data.model_used,
            context_source: pythonResponse.data.context_source
        };
        res.status(200).json({ reply: modelResponseMessage });
    } catch (error) {
        console.error(`!!! Error in /message route for session ${sessionId}:`, error);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message || "An unexpected server error occurred.";
        res.status(status).json({ message });
    }
});

// --- MODIFIED AGENTIC ROUTE ---
router.post('/agentic', tempAuth, async (req, res) => {
    console.log("--- Received /agentic request from frontend ---");
    const healthy = await checkPythonServiceHealth();
    if (!healthy) {
        return res.status(503).json({ message: 'Python AI service is unavailable.' });
    }

    const { message, history } = req.body; // Pass history for context
    const userId = req.user._id.toString();

    if (!message) {
        return res.status(400).json({ message: 'Bad request: a message is required.' });
    }

    try {
        // --- THIS IS THE FIX ---
        // By passing "ollama" here, we prevent getApiAuthDetails from throwing an
        // error if Gemini/Groq keys are missing. It will simply gather whatever
        // keys ARE available and pass them to the Python service.
        const { apiKeys, ollamaHost } = await getApiAuthDetails(userId, "ollama");

        // 2. Prepare the payload for the Python agent service
        const pythonPayload = {
            user_id: userId,
            query: message,
            api_keys: apiKeys,
            ollama_host: ollamaHost, // Pass the host URL for the fallback
            chat_history: history || [] // Pass chat history
        };

        // 3. Call the new /agent/invoke endpoint
        console.log("Forwarding request to Python agent at /agent/invoke");
        const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/agent/invoke`, pythonPayload, { 
            timeout: 300000 // Agentic tasks can take a long time (5 minutes)
        });

        if (pythonResponse.data?.status !== 'success') {
            throw new Error(pythonResponse.data?.error || "Agent service returned an error.");
        }

        // 4. Format the response for the frontend
        const agentResponseMessage = {
            role: 'model',
            parts: [{ text: pythonResponse.data.agent_response || "[Agent provided no response]" }],
            timestamp: new Date(),
            isAgent: true,
            agentTrace: pythonResponse.data.agent_trace || null 
        };
        
        res.status(200).json({ reply: agentResponseMessage });

    } catch (error) {
        console.error(`!!! Error in /agentic route:`, error.message);
        if (error.response) {
            console.error('Python service response error:', error.response.data);
        }
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || "An unexpected server error occurred.";
        res.status(status).json({ message });
    }
});

// ADD THIS ENTIRE NEW ROUTE BLOCK
router.post('/refine-prompt', tempAuth, async (req, res) => {
    console.log("--- Received /refine-prompt request from frontend ---");
    const healthy = await checkPythonServiceHealth();
    if (!healthy) {
        return res.status(503).json({ message: 'Python AI service is unavailable.' });
    }

    const { raw_prompt } = req.body;
    const userId = req.user._id.toString();

    if (!raw_prompt) {
        return res.status(400).json({ message: 'Bad request: raw_prompt is required.' });
    }

    try {
        // --- THIS IS THE FIX ---
        // Instead of demanding the 'groq' key, we now ask for 'ollama'.
        // The getApiAuthDetails function doesn't have a strict check for an Ollama key,
        // so it will simply gather ALL available keys (Groq, Gemini, etc.) without throwing an error.
        // This allows the request to proceed to the Python service, which contains the actual fallback logic.
        const { apiKeys } = await getApiAuthDetails(userId, "ollama");

        const pythonPayload = {
            raw_prompt: raw_prompt,
            api_keys: apiKeys
        };

        // Call the /chat/refine-prompt endpoint in the Python service
        console.log("Forwarding request to Python at /chat/refine-prompt");
        const pythonResponse = await axios.post(`${PYTHON_AI_SERVICE_URL}/chat/refine-prompt`, pythonPayload, {
            timeout: 30000 // 30 seconds should be plenty for this task
        });

        if (pythonResponse.data?.status !== 'success') {
            throw new Error(pythonResponse.data?.error || "Prompt refinement service returned an error.");
        }

        res.status(200).json({
            refined_prompt: pythonResponse.data.refined_prompt
        });

    } catch (error) {
        // This log now correctly reports errors from the Python service or connection issues.
        console.error(`!!! Error in /refine-prompt route:`, error.message);
        if (error.response) { console.error('Python service response error:', error.response.data); }
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || error.message || "An unexpected server error occurred.";
        res.status(status).json({ message });
    }
});

router.post('/start-chat', async (req, res) => {
  const { userId, message } = req.body;

  // Fetch user's recent history
  const history = await ChatHistory.find({ userId }).sort({ timestamp: -1 }).limit(10);

  // Summarize that history (step 2 will create this function)
  const user_history_summary = await summarizeHistory(history);

  // Forward to Python AI backend
  const response = await axios.post('http://localhost:5000/chat', {
    message,
    user_history_summary
  });

  res.json(response.data);
});

router.post('/history', tempAuth, async (req, res) => {
    // ... (code is unchanged) ...
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

router.get('/sessions', tempAuth, async (req, res) => {
    // ... (code is unchanged) ...
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

// <<< ADD THIS ENTIRE NEW ROUTE HANDLER FOR STREAMING >>>
router.post('/message-stream', tempAuth, async (req, res) => {
    console.log("--- Received STREAMING request at /message-stream ---");
    const healthy = await checkPythonServiceHealth();
    if (!healthy) {
        console.error("Python AI service is unavailable for streaming.");
        // For streams, we can't send a JSON error easily, so we end the response.
        return res.status(503).end();
    }

    const {
        message, history, sessionId, systemPrompt,
        llmProvider, llmModelName
    } = req.body;
    const userId = req.user._id.toString();

    if (!message || !llmProvider) {
        return res.status(400).end();
    }

    try {
        const { apiKeys, ollamaHost } = await getApiAuthDetails(userId, llmProvider);

        const pythonPayload = {
            user_id: userId,
            query: message,
            chat_history: history || [],
            llm_provider: llmProvider,
            llm_model_name: llmModelName || null,
            system_prompt: systemPrompt,
            api_keys: apiKeys,
            ollama_host: ollamaHost,
            // Note: RAG and Agent modes are not used in this simple streaming endpoint
        };

        // This is the core of the streaming proxy
        const pythonStreamResponse = await axios({
            method: 'post',
            url: `${PYTHON_AI_SERVICE_URL}/generate_chat_response_stream`,
            data: pythonPayload,
            responseType: 'stream' // This is the most important part!
        });

        // Set the correct headers to notify the client that this is a stream
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Pipe the data from the Python service directly to the client's response
        pythonStreamResponse.data.pipe(res);

        // Handle potential errors on the Python stream
        pythonStreamResponse.data.on('error', (err) => {
            console.error('Error in Python response stream:', err);
            res.end();
        });

    } catch (error) {
        console.error(`!!! Error in /message-stream route for session ${sessionId}:`, error.message);
        if (error.response) {
            console.error('Error response data from Python service:', error.response.data);
        }
        // If an error occurs before the stream starts, send a status code.
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to start stream from AI service." });
        } else {
            res.end();
        }
    }
});
// <<< END OF NEW ROUTE HANDLER >>>

module.exports = router;