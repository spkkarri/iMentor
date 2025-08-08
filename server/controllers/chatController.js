// server/controllers/chatController.js
const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { ChatSession, MESSAGE_TYPES } = require('../models/ChatSession');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const RealTimeDeepSearch = require('../services/realTimeDeepSearch');
const userServiceManager = require('../services/userServiceManager');
const IntelligentMultiLLM = require('../services/intelligentMultiLLM');
const userSpecificAI = require('../services/userSpecificAI');
const GroqAI = require('../services/groqAI');
const TogetherAI = require('../services/togetherAI');
const CohereAI = require('../services/cohereAI');
const HuggingFaceAI = require('../services/huggingFaceAI');

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
        const {
            query,
            sessionId,
            history = [],
            systemPrompt,
            ragEnabled = false,
            deepSearch = false,
            autoDetectWebSearch = false,
            multiLLM = false,
            selectedModel = 'gemini-flash'
        } = req.body;
        const userId = req.user.id;

        console.log(`[Chat] Request: query="${query.substring(0, 50)}...", ragEnabled=${ragEnabled}, deepSearch=${deepSearch}, autoDetectWebSearch=${autoDetectWebSearch}, multiLLM=${multiLLM}, selectedModel=${selectedModel}`);

        if (!query || !sessionId) {
            return res.status(400).json({ message: 'Query and Session ID are required.' });
        }

        // Automatic web search detection (like ChatGPT)
        let shouldUseWebSearch = false;
        let autoDetectionMetadata = {};

        if (!ragEnabled && !deepSearch && autoDetectWebSearch) {
            console.log('[Chat] 🧠 Analyzing prompt for automatic web search detection...');

            try {
                const IntelligentPromptAnalyzer = require('../services/intelligentPromptAnalyzer');
                const promptAnalyzer = new IntelligentPromptAnalyzer();

                // Convert history to expected format
                const conversationHistory = history.map(item => ({
                    role: item.role || 'user',
                    content: item.content || item.parts?.[0]?.text || item.text || ''
                })).filter(item => item.content.trim().length > 0);

                const analysis = await promptAnalyzer.shouldUseWebSearch(query, conversationHistory);

                console.log(`[Chat] 🔍 Auto-detection result: ${analysis.needsWebSearch ? 'WEB SEARCH' : 'STANDARD'} (${analysis.confidence} confidence)`);
                console.log(`[Chat] 📋 Analysis: ${analysis.reasoning}`);

                if (analysis.needsWebSearch && analysis.confidence !== 'low') {
                    shouldUseWebSearch = true;
                    autoDetectionMetadata = {
                        autoDetected: true,
                        analysisReasoning: analysis.reasoning,
                        queryType: analysis.queryType,
                        searchKeywords: analysis.searchKeywords,
                        confidence: analysis.confidence
                    };
                }

            } catch (analysisError) {
                console.warn('[Chat] ⚠️ Auto-detection failed, using standard response:', analysisError.message);
            }
        }

        if (ragEnabled) {
            // Handle RAG-enabled message
            console.log('[RAG] Processing RAG-enabled message:', query);
            const { vectorStore } = req.serviceManager.getServices();
            const userAI = await userServiceManager.getUserAIService(userId);

            // Search for relevant documents across all user's uploaded files
            const filters = { userId };
            let relevantChunks = [];
            try {
                // Use a higher threshold for better relevance (0.4 instead of default 0.3)
                relevantChunks = await vectorStore.searchDocuments(query, {
                    filters,
                    limit: 8,
                    minThreshold: 0.4
                });
                console.log(`[RAG] Found ${relevantChunks.length} relevant chunks with scores:`,
                    relevantChunks.map(chunk => ({ source: chunk.metadata?.source, score: chunk.score.toFixed(3) })));
            } catch (docErr) {
                console.error('[RAG] Error during document search:', docErr);
                return res.status(500).json({ message: 'Error searching documents for RAG.', error: docErr.message });
            }

            let session = await ChatSession.findOne({ sessionId, user: userId });
            if (!session) {
                session = new ChatSession({
                    sessionId,
                    user: userId,
                    title: query.substring(0, 50),
                    systemPrompt: systemPrompt || "You are a helpful AI assistant with access to uploaded documents."
                });
            }

            session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
            const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));

            let aiResponse;
            let responseMetadata;

            if (relevantChunks.length === 0) {
                // No relevant documents found, provide a helpful message
                console.log('[RAG] No relevant documents found with sufficient relevance, providing fallback response');
                try {
                    aiResponse = await userAI.generateChatResponse(
                        `The user asked: "${query}"\n\nI searched through their uploaded documents but couldn't find any content that's sufficiently relevant to answer this question. Please provide a helpful response explaining that the uploaded documents don't contain information about this topic, and suggest they either upload more relevant documents or ask about topics covered in their existing files.`,
                        [],
                        aiHistory,
                        session.systemPrompt
                    );
                    responseMetadata = {
                        searchType: 'rag_no_documents',
                        sources: [],
                        documentsFound: 0,
                        note: 'No sufficiently relevant documents found in uploaded files (threshold: 0.4)'
                    };
                } catch (aiErr) {
                    console.error('[RAG] Error generating fallback response:', aiErr);
                    return res.status(500).json({ message: 'Error generating AI response.', error: aiErr.message });
                }
            } else {
                // Found relevant documents, use them for RAG
                try {
                    aiResponse = await userAI.generateChatResponse(query, relevantChunks, aiHistory, session.systemPrompt);
                    console.log('[RAG] AI response generated with document context.');

                    const sources = [...new Set(relevantChunks.map(chunk => chunk.metadata?.source))];
                    responseMetadata = {
                        searchType: 'rag',
                        sources: sources,
                        documentsFound: relevantChunks.length,
                        enhanced: true
                    };
                } catch (aiErr) {
                    console.error('[RAG] Error generating AI response:', aiErr);
                    return res.status(500).json({ message: 'Error generating AI response.', error: aiErr.message });
                }
            }

            session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
            await session.save();

            res.json({
                response: aiResponse.response,
                followUpQuestions: aiResponse.followUpQuestions,
                sessionId: session.sessionId,
                history: session.messages,
                metadata: responseMetadata
            });
        } else if (deepSearch) {
            // Handle Advanced Deep Research with 6-stage verification process
            console.log(`[AdvancedDeepResearch] Starting 6-stage deep research for user: ${userId}, query: "${query}"`);

            try {
                const AdvancedDeepResearch = require('../services/advancedDeepResearch');
                const researchEngine = new AdvancedDeepResearch();
                console.log('[AdvancedDeepResearch] Initializing advanced research engine...');

                // Convert history to expected format
                const conversationHistory = history.map(item => ({
                    role: item.role || 'user',
                    content: item.content || item.parts?.[0]?.text || item.text || ''
                })).filter(item => item.content.trim().length > 0);

                const researchResults = await researchEngine.conductDeepResearch(query, conversationHistory);
                console.log(`[AdvancedDeepResearch] Research completed in ${researchResults.metadata.researchTime}ms`);

                // Create or get session
                let session = await ChatSession.findOne({ sessionId, user: userId });
                if (!session) {
                    session = new ChatSession({
                        sessionId,
                        user: userId,
                        title: query.substring(0, 50),
                        systemPrompt: systemPrompt || "You are an advanced AI research assistant with multi-stage verification capabilities."
                    });
                }

                // Add messages to session
                session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', researchResults.answer);
                await session.save();

                res.json({
                    response: researchResults.answer,
                    followUpQuestions: [
                        "Can you conduct deeper research on any specific aspect?",
                        "What are the confidence levels for different parts of this information?",
                        "Are there any contradictory sources I should be aware of?",
                        "Can you verify this information with additional sources?"
                    ],
                    sessionId: session.sessionId,
                    history: session.messages,
                    metadata: researchResults.metadata
                });
            } catch (researchError) {
                console.error('[AdvancedDeepResearch] Research failed, falling back to real-time search:', researchError);

                // Fallback to real-time search
                try {
                    const realTimeSearch = new RealTimeDeepSearch();
                    console.log('[AdvancedDeepResearch] Falling back to real-time search...');

                    const searchResults = await realTimeSearch.performRealTimeSearch(query);

                    let session = await ChatSession.findOne({ sessionId, user: userId });
                    if (!session) {
                        session = new ChatSession({
                            sessionId,
                            user: userId,
                            title: query.substring(0, 50),
                            systemPrompt: systemPrompt || "You are a helpful AI assistant with web search capabilities."
                        });
                    }

                    session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', searchResults.response);
                    await session.save();

                    res.json({
                        response: searchResults.response,
                        followUpQuestions: [
                            "Can you search for more recent information about this topic?",
                            "What are the latest developments in this area?",
                            "Are there any related topics I should know about?"
                        ],
                        sessionId: session.sessionId,
                        history: session.messages,
                        metadata: {
                            ...searchResults.metadata,
                            searchType: 'real_time_search_fallback',
                            fallbackReason: 'Advanced research failed, used real-time search'
                        }
                    });
                } catch (searchError) {
                    console.error('[AdvancedDeepResearch] All search methods failed, using standard AI:', searchError);

                    // Final fallback to standard AI
                    const standardUserAI = await userServiceManager.getUserAIService(userId);
                    let session = await ChatSession.findOne({ sessionId, user: userId });
                    if (!session) {
                        session = new ChatSession({
                            sessionId,
                            user: userId,
                            title: query.substring(0, 50),
                            systemPrompt: systemPrompt || "You are a helpful AI assistant."
                        });
                    }

                    session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
                    const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));
                    const aiResponse = await standardUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
                    await session.save();

                    res.json({
                        response: aiResponse.response,
                        followUpQuestions: aiResponse.followUpQuestions || [],
                        sessionId: session.sessionId,
                        history: session.messages,
                        metadata: {
                            searchType: 'deep_search_final_fallback',
                            fallbackReason: 'All search methods failed, used standard AI',
                            error: researchError.message
                        }
                    });
                }
            }
        } else if (shouldUseWebSearch) {
            // Handle automatic web search using Gemini-style search
            console.log(`[Chat] 🔍 Using Gemini-style web search (${autoDetectionMetadata.autoDetected ? 'auto-detected' : 'manual'})`);

            try {
                const GeminiStyleSearchEngine = require('../services/geminiStyleSearch');
                const searchEngine = new GeminiStyleSearchEngine();

                // Convert history to expected format
                const conversationHistory = history.map(item => ({
                    role: item.role || 'user',
                    content: item.content || item.parts?.[0]?.text || item.text || ''
                })).filter(item => item.content.trim().length > 0);

                const searchResult = await searchEngine.performGeminiStyleSearch(query, conversationHistory);


                // Save to session
                let session = await ChatSession.findOne({ sessionId, user: userId });
                if (!session) {
                    session = new ChatSession({
                        sessionId,
                        user: userId,
                        title: query.substring(0, 50),
                        systemPrompt: systemPrompt || "You are a helpful AI assistant with web search capabilities."
                    });
                }

                session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', searchResult.answer);
                await session.save();

                // Combine metadata
                const responseMetadata = {
                    ...autoDetectionMetadata,
                    ...searchResult.metadata,
                    searchType: autoDetectionMetadata.autoDetected ? 'auto_web_search' : 'manual_web_search'
                };

                res.json({
                    response: searchResult.answer,
                    metadata: responseMetadata,
                    sessionId: session.sessionId,
                    history: session.messages
                });

            } catch (searchError) {
                console.warn('[Chat] ⚠️ Web search failed, falling back to standard response:', searchError.message);


                // Fallback to user's AI service
                const fallbackUserAI = await userServiceManager.getUserAIService(userId);
                let session = await ChatSession.findOne({ sessionId, user: userId });
                if (!session) {
                    session = new ChatSession({ sessionId, user: userId, title: query.substring(0, 50), systemPrompt: systemPrompt || "You are a helpful general-purpose AI assistant." });
                }

                session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);
                const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));
                const aiResponse = await fallbackUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
                await session.save();

                res.json({
                    response: aiResponse.response,
                    followUpQuestions: aiResponse.followUpQuestions,
                    metadata: {
                        ...autoDetectionMetadata,
                        searchType: 'web_search_fallback',
                        fallbackReason: searchError.message
                    },
                    sessionId: session.sessionId,
                    history: session.messages
                });
            }
        } else if (multiLLM) {
            // Handle Multi-LLM routing
            console.log('[Chat] 🧠 Using Intelligent Multi-LLM routing');

            let session = await ChatSession.findOne({ sessionId, user: userId });
            if (!session) {
                session = new ChatSession({ sessionId, user: userId, title: query.substring(0, 50), systemPrompt: systemPrompt || "You are a helpful AI assistant." });
            }

            session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

            // Format conversation history for Multi-LLM
            const conversationHistory = session.messages.map(m => ({
                role: m.role,
                content: m.parts.map(p => p.text).join(' ')
            }));

            try {
                // Initialize Multi-LLM system
                const multiLLMSystem = new IntelligentMultiLLM();

                // Generate response using selected or optimal model
                const multiLLMResponse = await multiLLMSystem.generateResponse(
                    query,
                    conversationHistory.slice(-10), // Last 10 messages for context
                    {
                        userId,
                        selectedModel: selectedModel !== 'gemini-flash' ? selectedModel : null, // Use selected model if not default
                        systemPrompt: session.systemPrompt
                    }
                );

                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', multiLLMResponse.response);
                await session.save();

                // Send back the Multi-LLM response
                res.json({
                    response: multiLLMResponse.response,
                    followUpQuestions: multiLLMResponse.followUpQuestions,
                    metadata: {
                        searchType: 'multi_llm',
                        modelUsed: multiLLMResponse.model,
                        conversationType: multiLLMResponse.conversationType,
                        routingConfidence: multiLLMResponse.confidence,
                        routingReasoning: multiLLMResponse.reasoning,
                        ...multiLLMResponse.metadata
                    },
                    sessionId: session.sessionId,
                    history: session.messages
                });

            } catch (multiLLMError) {
                console.error('Multi-LLM failed, falling back to standard AI:', multiLLMError);

                // Fallback to standard AI
                const fallbackUserAI = await userServiceManager.getUserAIService(userId);
                const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));
                const aiResponse = await fallbackUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);

                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
                await session.save();

                res.json({
                    response: aiResponse.response,
                    followUpQuestions: aiResponse.followUpQuestions,
                    metadata: {
                        searchType: 'standard_ai_fallback',
                        fallbackReason: 'Multi-LLM system unavailable',
                        originalError: multiLLMError.message
                    },
                    sessionId: session.sessionId,
                    history: session.messages
                });
            }
        } else {
            // Handle standard message with model selection
            console.log(`[Chat] 🤖 Using selected model: ${selectedModel}`);

            let session = await ChatSession.findOne({ sessionId, user: userId });
            if (!session) {
                session = new ChatSession({ sessionId, user: userId, title: query.substring(0, 50), systemPrompt: systemPrompt || "You are a helpful general-purpose AI assistant." });
            }

            session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

            const aiHistory = session.messages.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) }));

            let aiResponse;
            let modelUsed = selectedModel;

            // Route to appropriate service based on selected model
            if (selectedModel.startsWith('gemini-') || selectedModel === 'gemini-pro') {
                // Use user-specific Gemini service
                const userServices = await userSpecificAI.getUserAIServices(userId);
                if (userServices.gemini) {
                    aiResponse = await userServices.gemini.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                } else {
                    // Fallback to standard user AI
                    const standardUserAI = await userServiceManager.getUserAIService(userId);
                    aiResponse = await standardUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                    modelUsed = 'gemini-fallback';
                }
            } else if (selectedModel === 'llama-model') {
                // Use real Ollama service for Llama model
                try {
                    const { OllamaService } = require('../services/ollamaService');
                    const ollamaService = new OllamaService();

                    // Check if Ollama is available
                    const isConnected = await ollamaService.checkConnection();
                    if (!isConnected) {
                        throw new Error('Ollama service is not available');
                    }

                    // Modify system prompt for conversational Llama-style responses
                    const llamaSystemPrompt = session.systemPrompt +
                        "\n\nYou are a friendly, conversational AI assistant powered by Llama. " +
                        "Be warm, engaging, and personable in your responses. " +
                        "Provide helpful and detailed answers while maintaining a casual, approachable tone.";

                    console.log('🦙 Using real Ollama service for Llama model');
                    aiResponse = await ollamaService.generateChatResponse(query, [], aiHistory, llamaSystemPrompt);
                    modelUsed = 'llama-model';

                } catch (error) {
                    console.warn('🦙 Ollama service failed:', error.message);
                    // Return error message instead of fallback
                    return res.status(503).json({
                        success: false,
                        error: 'Ollama service is currently unavailable',
                        message: 'The Llama model server is not running. Please try using the Gemini model instead, or contact your administrator to start the Ollama service.',
                        suggestedAction: 'switch_to_gemini',
                        availableModels: ['gemini-flash', 'gemini-pro']
                    });
                }
            } else if (selectedModel.startsWith('groq-')) {
                // Use Groq service
                const groqAI = new GroqAI();
                const response = await groqAI.generateText(query);
                aiResponse = { response, followUpQuestions: [] };
            } else if (selectedModel.startsWith('together-')) {
                // Use Together AI service
                const togetherAI = new TogetherAI();
                const response = await togetherAI.generateText(query);
                aiResponse = { response, followUpQuestions: [] };
            } else if (selectedModel.startsWith('cohere-')) {
                // Use Cohere service
                const cohereAI = new CohereAI();
                const response = await cohereAI.generateText(query);
                aiResponse = { response, followUpQuestions: [] };
            } else if (selectedModel.startsWith('hf-')) {
                // Use HuggingFace service
                const hfAI = new HuggingFaceAI();
                const response = await hfAI.generateText(query);
                aiResponse = { response, followUpQuestions: [] };
            } else if (selectedModel.startsWith('ollama-')) {
                // Use user's Ollama service
                const userServices = await userSpecificAI.getUserAIServices(userId);
                if (userServices.ollama) {
                    const modelName = selectedModel.replace('ollama-', '').replace('_', ':');
                    const response = await userServices.ollama.generateResponse(query, modelName);
                    aiResponse = { response, followUpQuestions: [] };
                } else {
                    throw new Error('Ollama service not available');
                }
            } else {
                // Use Multi-LLM or fallback to standard
                try {
                    const multiLLMSystem = new IntelligentMultiLLM();
                    const multiLLMResponse = await multiLLMSystem.generateResponse(
                        query,
                        aiHistory.slice(-10),
                        {
                            userId,
                            selectedModel,
                            systemPrompt: session.systemPrompt
                        }
                    );
                    aiResponse = multiLLMResponse;
                    modelUsed = multiLLMResponse.modelUsed || selectedModel;
                } catch (error) {
                    console.warn('Multi-LLM failed, using standard AI:', error);
                    const standardUserAI = await userServiceManager.getUserAIService(userId);
                    aiResponse = await standardUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                    modelUsed = 'gemini-fallback';
                }
            }

            session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', aiResponse.response);
            await session.save();

            // Send back the full response object including follow-up questions
            res.json({
                response: aiResponse.response,
                followUpQuestions: aiResponse.followUpQuestions,
                metadata: {
                    searchType: 'standard_ai',
                    modelUsed: modelUsed,
                    selectedModel: selectedModel
                },
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
        const { vectorStore } = req.serviceManager.getServices();
        const ragUserAI = await userServiceManager.getUserAIService(userId);

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
            relevantChunks = await vectorStore.searchDocuments(query, { filters });
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
            aiResponse = await ragUserAI.generateChatResponse(query, relevantChunks, aiHistory, session.systemPrompt);
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

        console.log(`🔍 Gemini-style search request: "${query}" from user ${userId}`);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

        // Import and initialize Gemini-style search engine
        const GeminiStyleSearchEngine = require('../services/geminiStyleSearch');
        const geminiSearchEngine = new GeminiStyleSearchEngine();

        // Convert history to the expected format
        const conversationHistory = history.map(item => ({
            role: item.role || 'user',
            content: item.content || item.message || item.text || ''
        })).filter(item => item.content.trim().length > 0);

        console.log(`🚀 Starting Gemini-style search with ${conversationHistory.length} context messages`);

        // Perform Gemini-style search
        const results = await geminiSearchEngine.performGeminiStyleSearch(query, conversationHistory);

        console.log(`✅ Gemini-style search completed:`, {
            hasAnswer: !!results.answer,
            answerLength: results.answer?.length,
            sourcesCount: results.sources?.length,
            confidence: results.metadata?.confidence,
            intent: results.metadata?.intent
        });

        if (!results || !results.answer) {
            console.warn(`🚫 No valid response generated for query: "${query}"`);
            return res.status(404).json({
                message: 'I apologize, but I could not find relevant information for your query. Please try rephrasing your question or being more specific.',
                metadata: {
                    sources: [],
                    searchType: 'gemini_style_search_failed',
                    confidence: 'low'
                }
            });
        }

        const response = {
            message: results.answer,
            metadata: {
                sources: results.sources || [],
                searchType: 'gemini_style_search',
                intent: results.metadata?.intent,
                confidence: results.metadata?.confidence,
                resultsFound: results.metadata?.resultsFound,
                searchQueries: results.metadata?.searchQueries,
                searchTime: Date.now() - results.metadata?.searchTime,
                aiGenerated: true
            }
        };

        console.log(`✅ Sending Gemini-style response:`, {
            messageLength: response.message.length,
            sourcesCount: response.metadata.sources.length,
            confidence: response.metadata.confidence,
            intent: response.metadata.intent
        });

        res.json(response);

    } catch (error) {
        console.error('🚫 Gemini-style search error:', error);

        // Provide a helpful fallback response
        const fallbackResponse = {
            message: `I apologize, but I encountered an issue while searching for information about "${query}". This could be due to network connectivity or search service limitations.

**What you can try:**
- Rephrase your question to be more specific
- Try breaking down complex questions into simpler parts
- Check your internet connection and try again

If you have a specific question, I can try to help based on my general knowledge without web search.`,
            metadata: {
                sources: [],
                searchType: 'gemini_style_search_error',
                confidence: 'low',
                error: error.message,
                aiGenerated: true
            }
        };

        res.status(200).json(fallbackResponse);
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