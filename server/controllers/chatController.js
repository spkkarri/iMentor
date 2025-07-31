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
        const { query, sessionId, history = [], systemPrompt, deepSearch = false, webSearch = false } = req.body;
        const userId = req.user.id;

        if (!query || !sessionId) {
            return res.status(400).json({ message: 'Query and Session ID are required.' });
        }

        if (deepSearch) {
            // Handle DeepSearch
            console.log(`[DeepSearch] Processing request for user: ${userId}, query: "${query}"`);

            try {
                const deepSearchService = req.serviceManager.getDeepSearchService(userId);
                if (!deepSearchService) {
                    console.error('[DeepSearch] Service not available from ServiceManager');
                    throw new Error('DeepSearchService not available');
                }

                console.log('[DeepSearch] Service obtained, performing search...');
                const results = await deepSearchService.performSearch(query, history);
                console.log('[DeepSearch] Search completed, processing results...');

                if (!results) {
                    console.warn(`[DeepSearch] No results returned for query: "${query}"`);
                    return res.status(500).json({
                        response: 'DeepSearch service returned no results. Please try again.',
                        metadata: {
                            sources: [],
                            searchType: 'error',
                            error: 'No results returned'
                        }
                    });
                }

                const message = results.summary || results.message || 'No response generated';
                const metadata = results.metadata || {
                    sources: results.sources || [],
                    searchType: results.searchType || (results.summary ? 'deep_search' : 'fallback'),
                    aiGenerated: results.aiGenerated !== undefined ? results.aiGenerated : true,
                    query: results.query || query,
                    note: results.note,
                    timestamp: results.timestamp || new Date().toISOString()
                };

                console.log(`[DeepSearch] Sending response with searchType: ${metadata.searchType}`);

                res.json({
                    response: message,
                    metadata: metadata
                });
            } catch (deepSearchError) {
                console.error('[DeepSearch] Error during search:', deepSearchError);

                // Provide a helpful fallback response
                res.json({
                    response: `I encountered an issue while performing deep search for "${query}". The service may be temporarily unavailable. Please try again or disable DeepSearch for a standard response.`,
                    metadata: {
                        sources: [],
                        searchType: 'deep_search_error',
                        error: deepSearchError.message,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        } else if (webSearch) {
            // Handle WebSearch with enhanced simulated results
            const services = req.serviceManager.getServices();
            const { duckDuckGo, geminiAI } = services;

            console.log(`[WebSearch] Services available:`, {
                duckDuckGo: !!duckDuckGo,
                geminiAI: !!geminiAI,
                duckDuckGoType: duckDuckGo ? duckDuckGo.constructor.name : 'undefined'
            });

            try {
                console.log(`[WebSearch] Performing enhanced web search for: "${query}"`);

                // Use the same DuckDuckGo service as DeepSearch for consistency
                let searchResults = [];
                try {
                    console.log(`[WebSearch] Calling duckDuckGo.performSearchWithRetry for: "${query}"`);
                    const searchResponse = await duckDuckGo.performSearchWithRetry(query, 'text');
                    console.log(`[WebSearch] Raw search response:`, searchResponse ? searchResponse.length : 'null/undefined');

                    if (searchResponse && searchResponse.length > 0) {
                        searchResults = searchResponse.map(result => ({
                            title: result.title,
                            url: result.url,
                            snippet: result.description || result.snippet || 'No description available'
                        }));
                        console.log(`[WebSearch] Found ${searchResults.length} enhanced search results`);
                        console.log(`[WebSearch] First result:`, searchResults[0]);
                    } else {
                        console.log(`[WebSearch] No results found from DuckDuckGo service`);
                    }
                } catch (searchError) {
                    console.warn('[WebSearch] Search error, using fallback:', searchError.message);
                    console.warn('[WebSearch] Error stack:', searchError.stack);
                }

                if (searchResults && searchResults.length > 0) {
                    // Create context from search results
                    const searchContext = searchResults
                        .slice(0, 5) // Limit to top 5 results
                        .map(result => `${result.title}: ${result.snippet}`)
                        .join('\n\n');

                    // Generate AI response with search context
                    const enhancedPrompt = `Based on the following web search results, provide a comprehensive answer to: "${query}"\n\nWeb Search Results:\n${searchContext}\n\nPlease provide a helpful response based on this information.`;

                    const aiResponse = await geminiAI.generateText(enhancedPrompt);

                    res.json({
                        response: `🌐 WebSearch active - Enhanced with web results.\n\n${aiResponse}`,
                        metadata: {
                            searchType: 'web_search',
                            sources: searchResults.slice(0, 5).map(r => ({ title: r.title, url: r.url })),
                            resultsCount: searchResults.length,
                            enhanced: true
                        }
                    });
                } else {
                    // No search results found, fall back to standard chat
                    console.log(`[WebSearch] No results found, falling back to standard chat`);
                    const aiResponse = await geminiAI.generateText(query);

                    res.json({
                        response: `⚠️ WebSearch unavailable - Using standard AI response.\n\n${aiResponse}`,
                        metadata: {
                            searchType: 'web_search_fallback',
                            sources: [],
                            note: 'No web search results found, using AI knowledge'
                        }
                    });
                }
            } catch (error) {
                console.error('[WebSearch] Error:', error);
                // Fall back to standard chat on error
                const aiResponse = await geminiAI.generateText(query);

                res.json({
                    response: aiResponse,
                    metadata: {
                        searchType: 'web_search_error',
                        sources: [],
                        error: error.message
                    }
                });
            }
        } else {
            // Handle standard message
            const { geminiAI } = req.serviceManager.getServices();
            let session = await ChatSession.findOne({ sessionId, user: userId });
            if (!session) {
                session = new ChatSession({ sessionId, user: userId, title: query.substring(0, 50), systemPrompt: systemPrompt || "You are a helpful general-purpose AI assistant." });
            }
            
            session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

            const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));
            const aiResponse = await geminiAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
            
            session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
            await session.save();

            // Send back the full response object including follow-up questions
            res.json({
                response: aiResponse.response,
                followUpQuestions: aiResponse.followUpQuestions,
                sessionId: session.sessionId,
                history: session.messages
            });
        }
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

        const filters = { userId };
        if (fileId) filters.fileId = fileId;
        console.log('[RAG] Using filters:', filters);

        let relevantChunks = [];
        try {
            relevantChunks = await documentProcessor.searchDocuments(query, { filters });
            console.log(`[RAG] Found ${relevantChunks.length} relevant chunks.`);
        } catch (docErr) {
            console.error('[RAG] Error during document search:', docErr);
            return res.status(500).json({ message: 'Error searching documents for RAG.', error: docErr.message });
        }
        const sources = [...new Set(relevantChunks.map(chunk => chunk.metadata?.source))];

        if (relevantChunks.length === 0) {
            return res.status(404).json({
                message: 'No content found for the selected document. Please try re-uploading the file or check if the file format is supported.',
                metadata: { sources, documentsFound: 0 }
            });
        }

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
        
        session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
        const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));

        let aiResponse;
        try {
            aiResponse = await geminiAI.generateChatResponse(query, relevantChunks, aiHistory, session.systemPrompt);
            console.log('[RAG] AI response generated.');
        } catch (aiErr) {
            console.error('[RAG] Error generating AI response:', aiErr);
            return res.status(500).json({ message: 'Error generating AI response.', error: aiErr.message });
        }

        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
        await session.save();

        res.json({ 
            response: aiResponse.response, 
            followUpQuestions: aiResponse.followUpQuestions,
            metadata: { sources, documentsFound: relevantChunks.length }
        });
    } catch (error) {
        console.error('[RAG] Unexpected error in /api/chat/rag:', error);
        res.status(500).json({ message: 'RAG query failed (unexpected error).', error: error.message });
    }
};

const handleDeepSearch = async (req, res) => {
    try {
        const { query, history = [] } = req.body;
        const userId = req.user.id;
        
        console.log(`[DeepSearch] Request received: query="${query}", userId=${userId}`);
        
        if (!query) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

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


// Test endpoint for DeepSearch debugging
const testDeepSearch = async (req, res) => {
    try {
        const { query = "What is artificial intelligence?" } = req.body;
        const userId = req.user?.id || 'test-user';

        console.log(`[DeepSearch Test] Starting test for query: "${query}"`);

        // Test service manager availability
        if (!req.serviceManager) {
            return res.status(500).json({
                success: false,
                error: 'ServiceManager not available',
                step: 'service_manager_check'
            });
        }

        // Test DeepSearch service creation
        let deepSearchService;
        try {
            deepSearchService = req.serviceManager.getDeepSearchService(userId);
            console.log('[DeepSearch Test] Service obtained successfully');
        } catch (serviceError) {
            return res.status(500).json({
                success: false,
                error: serviceError.message,
                step: 'service_creation',
                details: serviceError.stack
            });
        }

        // Test search execution
        try {
            const results = await deepSearchService.performSearch(query, []);
            console.log('[DeepSearch Test] Search completed successfully');

            res.json({
                success: true,
                results: results,
                metadata: results.metadata,
                step: 'search_completed'
            });
        } catch (searchError) {
            console.error('[DeepSearch Test] Search failed:', searchError);
            res.status(500).json({
                success: false,
                error: searchError.message,
                step: 'search_execution',
                stack: searchError.stack
            });
        }

    } catch (error) {
        console.error('[DeepSearch Test] Unexpected error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            step: 'unexpected_error',
            stack: error.stack
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
    testDeepSearch
};