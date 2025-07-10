// server/routes/chat.js
const express = require('express');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware'); // Assuming this sets req.user
const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid');
const { generateGroqChatCompletion } = require('../services/groqService'); // ADD THIS LINE
const { performWebSearch } = require('../services/webSearchService');
const { getSearchOptimizedQuery } = require('../utils/llmUtils');
const MAX_CONTEXT_LENGTH = parseInt(process.env.MAX_CONTEXT_LENGTH) || 15000;
const { searchAcademicSources } = require('../academicSearchService');  

let generateContentWithHistory;
try {
    const geminiService = require('../services/geminiService');
    generateContentWithHistory = geminiService.generateContentWithHistory;
    if (typeof generateContentWithHistory !== 'function') {
        console.error("[Node Backend] CRITICAL: generateContentWithHistory is not a function in geminiService.js");
        generateContentWithHistory = async () => ({ answer: "Gemini service function not loaded correctly.", thinking: null });
    }
} catch (e) {
    console.error("[Node Backend] CRITICAL: Failed to load geminiService.js:", e.message, e.stack);
    generateContentWithHistory = async () => ({ answer: "Gemini service module failed to load.", thinking: null });
}

const router = express.Router();

async function queryPythonRagService(userId, query, k = 5) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("[Node Backend] PYTHON_RAG_SERVICE_URL is not set. Cannot query RAG service.");
        return { context: "RAG service configuration error. Please check server settings.", references: [] };
    }
    const queryUrl = `${pythonServiceUrl.replace(/\/$/, '')}/query`;
    console.log(`[Node Backend] Querying RAG: ${queryUrl} for User ${userId}, k=${k}, Query: "${query.substring(0, 50)}..."`);
    try {
        const response = await axios.post(queryUrl, { user_id: userId, query: query, k: k }, { timeout: 30000 });
        if (response.data && response.data.context !== undefined && Array.isArray(response.data.references)) {
            console.log(`[Node Backend] RAG service returned ${response.data.references.length} references.`);
            return { context: response.data.context, references: response.data.references };
        } else {
            console.warn(`[Node Backend] RAG service returned unexpected data structure or no context/references:`, response.data);
            return { context: "No relevant context was found by the RAG service for your query.", references: [] };
        }
    } catch (error) {
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Node Backend] Error querying RAG service for User ${userId}:`, errorMsg);
        return { context: "Error connecting to RAG service. Answering from general knowledge.", references: [] };
    }
}

async function saveChatMessage(userId, sessionId, role, text, references, thinking, provider) {
    try {
        const newMessagePayload = { // This is the message object to be pushed into the messages array
            role: role, // 'user' or 'model' (ensure consistency with how you store/retrieve)
            parts: [{ text: text }], // Assuming 'parts' is an array with at least one part object
            timestamp: new Date()
        };

        // Only add these fields to the message if they are relevant (e.g., for bot/model messages)
        if (role === 'model' || role === 'bot') { // Adjust 'bot' if you only use 'model'
            newMessagePayload.references = references || [];
            newMessagePayload.thinking = thinking || null;
            newMessagePayload.provider = provider || 'unknown';
        }

        const updatedHistory = await ChatHistory.findOneAndUpdate(
            { userId: userId, sessionId: sessionId }, // Query to find the existing session document
            { 
                $push: { messages: newMessagePayload }, // Add the new message to the 'messages' array
                $set: { 
                    updatedAt: new Date(), 
                    userId: userId // Ensure userId is set, especially on upsert
                },
                $setOnInsert: { // These fields are only set if a new document is created (upsert)
                    createdAt: new Date(),
                    sessionId: sessionId, // Ensure sessionId is set on upsert
                    // userId: userId // Already handled by $set if needed, but can be here too for explicitness on insert
                }
            },
            { 
                upsert: true, // If no document matches, create a new one
                new: true,    // Return the modified document rather than the original
                setDefaultsOnInsert: true // Apply schema defaults if a new document is created
            }
        );

        if (updatedHistory) {
            console.log(`[Node Backend] Appended/Saved ${role} message to session ${sessionId}. Provider: ${provider}`);
        } else {
            console.error(`[Node Backend] Failed to update or create chat history for session ${sessionId}`);
        }

    } catch (dbError) {
        console.error(`[Node Backend] DB Error saving/appending ${role} message for session ${sessionId}:`, dbError.message, dbError.stack);
        // Optionally, you could re-throw the error or handle it more specifically
        // if the calling function needs to know about the failure.
    }
}



router.post('/rag', tempAuth, async (req, res) => {
    const { message, k } = req.body;
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'User not authenticated for RAG query.' });
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ error: 'Query message text required.' });
    }
    console.log(`>>> POST /api/chat/rag: User=${userId}`);
    try {
        const kValue = (typeof k === 'number' && k > 0 && k <=10) ? k : 5;
        const ragResult = await queryPythonRagService(userId, message.trim(), kValue);
        const relevantDocsForClient = (ragResult.references || []).map((ref, index) => ({
            documentName: ref.source || `Source ${index + 1}`,
            content: ref.chunk_content || ref.content_preview || "Content unavailable",
            score: ref.score || null
        }));
        console.log(`<<< POST /api/chat/rag successful for User ${userId}. Found ${relevantDocsForClient.length} docs.`);
        res.status(200).json({ relevantDocs: relevantDocsForClient });
    } catch (error) {
        console.error(`!!! Error processing RAG query for User ${userId}:`, error.message);
        res.status(500).json({ error: "Failed to retrieve relevant documents." });
    }
});

// +++ NEW AND IMPROVED WEB SEARCH PIPELINE +++
// server/routes/chat.js

// +++ FINAL AND CORRECTED WEB SEARCH PIPELINE +++
async function performFullWebSearch(originalQuery, llmProviderForRefinement, modelIdForRefinement, sessionIdForRefinement) {
    let thinkingLog = "";
    let contextFromWeb = null;
    let sourceName = "Web Search (No Results)";
    let queryForWebSearch = originalQuery;

    // --- Step 1: Query Refinement (This logic is good and we keep it) ---
    const queryRefinementStartTime = Date.now();
    try {
        thinkingLog += `Attempting to refine query for web search using '${llmProviderForRefinement}'...\n`;
        const refinedQuery = await getSearchOptimizedQuery(originalQuery, llmProviderForRefinement, modelIdForRefinement, sessionIdForRefinement);
        if (refinedQuery && refinedQuery.trim().toLowerCase() !== originalQuery.trim().toLowerCase()) {
            queryForWebSearch = refinedQuery;
            thinkingLog += `Using refined query for web search: "${queryForWebSearch}"\n`;
        } else {
            thinkingLog += `Using original query for web search.\n`;
        }
    } catch (e) {
        console.error("[WebSearchPipeline] Error during query refinement:", e);
        thinkingLog += `Error during query refinement. Using original query.\n`;
    }
    const queryRefinementEndTime = Date.now();
    thinkingLog += `Query Refinement Time: ${queryRefinementEndTime - queryRefinementStartTime} ms.\n`;

    // --- Step 2: Call Our New Web Search Service ---
    const webSearchApiCallStartTime = Date.now();
    const searchResults = await performWebSearch(queryForWebSearch, 5); // Request 5 results from DuckDuckGo service
    const webSearchApiCallEndTime = Date.now();
    thinkingLog += `DuckDuckGo Search Service Call Time: ${webSearchApiCallEndTime - webSearchApiCallStartTime} ms.\n`;

    // --- Step 3: Format the Results ---
    if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        contextFromWeb = searchResults.map((item) => {
            return `Source: ${item.link}\nTitle: ${item.title}\nSnippet: ${item.snippet}`;
        }).join('\n\n---\n\n');
        
        thinkingLog += `Web search found ${searchResults.length} results.\n`;
        sourceName = "Web Search";
        console.log("[WebSearchPipeline] Web search via DuckDuckGo provided context.");
    } else {
        thinkingLog += `No relevant information found from web search.\n`;
        console.log("[WebSearchPipeline] Web search via DuckDuckGo did not provide meaningful context.");
    }

    // --- Step 4: Return the Final Object ---
    return { webContext: contextFromWeb, webThinking: thinkingLog, webSourceName: sourceName };
}
// +++ END OF WEB SEARCH PIPELINE +++



// router.post('/message', tempAuth, async (req, res) => { ... });

router.post('/message', tempAuth, async (req, res) => {
    try {
        const {
            query,
            history = [],
            sessionId: clientSessionId,
            systemPrompt,
            llmProvider, // For Groq, Ollama, Gemini selection
            groqModelId,
            ollamaModelName,
            toolMode: clientToolMode // Expect 'web_explicit', 'academic', or undefined/null
        } = req.body;
        const userId = req.user?._id?.toString();

        if (!userId && !req.user?.isGuest) {
            console.error("[Node Backend] /api/chat/message: User ID not found after auth middleware (and not guest).");
            return res.status(401).json({ error: 'User authentication failed or user ID is missing.' });
        }
        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({ error: 'Query cannot be empty.' });
        }

        const effectiveLlmProvider = llmProvider || 'gemini';
        const currentSessionId = clientSessionId || uuidv4();

        if (userId) {
           await saveChatMessage(userId, currentSessionId, 'user', query, null, `Tool Mode Received by Backend: ${clientToolMode || 'Not Specified'}`, null);
        }

    //     let toolMode = clientToolMode;
    //     const validModes = ['general', 'academic', 'rag_as_primary'];

        
    // // //   //THIS BLOCK FOR toolMode VALIDATION AND DEFAULTING
    // // //     if (!toolMode || !validModes.includes(toolMode)) {
    // // //         console.warn(`[Node Backend /message] Invalid or missing toolMode: "${toolMode}". Defaulting to 'general'.`);
    // // //         toolMode = 'general'; // Default behavior if not specified or invalid
    //     }      
    // +++ END OF toolMode VALIDATION BLOCK +++

          /// Determine effective tool mode for backend processing
         let effectiveToolMode = 'default_behavior';
        if (clientToolMode === 'academic') effectiveToolMode = 'academic_search';
        else if (clientToolMode === 'web_explicit') effectiveToolMode = 'web_search_explicit';
        
        console.log(`[Node Backend] CHAT /message: User=${userId || 'Guest'}, Session=${currentSessionId}, Provider=${effectiveLlmProvider}, Mode=${effectiveToolMode}, Query="${query}"`);

        // --- RAG Context Retrieval ---
        let actualRagContext = null;
        let referencesFromRagService = [];
        let ragThinking = "RAG Status: Always attempting context retrieval.\n";
        const ragResult = await queryPythonRagService(userId, query.trim());
        const isContextMeaningful = ragResult.context && !ragResult.context.toLowerCase().includes("no relevant information") && !ragResult.context.toLowerCase().includes("error connecting");
        if (isContextMeaningful) {
            actualRagContext = ragResult.context;
            referencesFromRagService = ragResult.references || [];
            ragThinking += `RAG Result: Context retrieved (length: ${actualRagContext.length}).\n`;
        } else {
            ragThinking += `RAG Result: No meaningful context returned.\n`;
        }
        let thinkingProcess = ragThinking;




    let primaryToolContext = null;    
    let toolSpecificThinkingLog = ""; // Use this to accumulate thinking for the current tool
    let contextSourceName = null; 

    if (effectiveToolMode === 'academic_search') {
        toolSpecificThinkingLog += "Academic Search Tool Explicitly Selected.\n";
        const academicSearchOptions = { sortBy: 'relevance', limit: 5 }; // Your desired limit
        console.log(`[Node Backend] Academic Search: searching for "${query}"`);
        const academicStartTime = Date.now();
        const academicResults = await searchAcademicSources(query, academicSearchOptions);
        const academicEndTime = Date.now();
        toolSpecificThinkingLog += `Academic Search Call Time: ${academicEndTime - academicStartTime} ms.\n`;

        if (academicResults && academicResults.length > 0) {
            let formattedCtx = ""; // <<<< Initialize formatted context string
            academicResults.forEach((item, index) => {
                formattedCtx += `Result ${index + 1}:\n  Title: ${item.title}\n  Authors: ${item.authors.map(a=>a.name).join(', ')}\n  Year: ${item.publicationYear}\n  URL: ${item.url}\n  Abstract: ${item.abstract ? item.abstract.substring(0,250)+'...' : 'N/A'}\n\n`;
            });
            primaryToolContext = formattedCtx; // <<<< ASSIGN to primaryToolContext
            toolSpecificThinkingLog += `Academic Search found ${academicResults.length} results.\n`;
            contextSourceName = "Academic Search"; // <<<< SET contextSourceName
            console.log("[Node Backend] Academic Search provided context.");
        } else {
            primaryToolContext = null; // Ensure it's null if no results
            toolSpecificThinkingLog += "Academic Search found no relevant results.\n";
            contextSourceName = "Academic Search (No Results)";
            console.log("[Node Backend] Academic Search found no results.");
        }
    
    } else if (effectiveToolMode === 'web_search_explicit') {
        toolSpecificThinkingLog += "Web Search Tool Explicitly Selected. Performing unconditional web search.\n";
        const webSearchResult = await performFullWebSearch(query, effectiveLlmProvider, (effectiveLlmProvider === 'groq' ? groqModelId : ollamaModelName), currentSessionId);
        primaryToolContext = webSearchResult.webContext;
        toolSpecificThinkingLog += webSearchResult.webThinking; // Add thinking from the helper
        contextSourceName = webSearchResult.webSourceName;
    } else { // effectiveToolMode === 'default_behavior'
        toolSpecificThinkingLog += "Default Mode (RAG + LLM). Checking for conditional web search trigger.\n";
        // VV VV VV isContextMeaningful is used here and should now be in scope VV VV VV
        const isRagContextInsufficientForWeb = !isContextMeaningful; 
        const forceWebSearchByKeyword = query.toLowerCase().includes("search web for") || query.toLowerCase().includes("search online for");
        
        if (isRagContextInsufficientForWeb || forceWebSearchByKeyword) {
            toolSpecificThinkingLog += forceWebSearchByKeyword ? "Keyword triggered web search.\n" : "RAG insufficient, attempting web search.\n";
            const webSearchResult = await performFullWebSearch(query, effectiveLlmProvider, (effectiveLlmProvider === 'groq' ? groqModelId : ollamaModelName), currentSessionId);
            primaryToolContext = webSearchResult.webContext;
            toolSpecificThinkingLog += webSearchResult.webThinking; // Add thinking from the helper
            contextSourceName = webSearchResult.webSourceName;
        } else {
            toolSpecificThinkingLog += "No web search trigger in default mode (RAG sufficient and no keywords).\n";
        }
    }
    thinkingProcess += toolSpecificThinkingLog; // Append the tool-specific thinking to the main log
    // --- End Tool-Specific Logic ---
    console.log("--- Primary Tool Context BEFORE Combine ---");
    console.log(primaryToolContext);
    console.log("--- Actual RAG Context BEFORE Combine ---");
    console.log(actualRagContext);

        // +++ NEW: COMBINE CONTEXTS for LLM +++
        let combinedContextForLLM = "";
        let contextHeader = ""; 
        let finalContextSourceNameForLLM = null;

        if (primaryToolContext) {
            contextHeader = `Context from ${contextSourceName}:\n---\n`;
            combinedContextForLLM = primaryToolContext;
            finalContextSourceNameForLLM = contextSourceName;
        }
        if (actualRagContext) {
            if (combinedContextForLLM.length > 0) { 
                combinedContextForLLM += `\n\nSupporting Context from Uploaded Documents (RAG):\n---\n${actualRagContext}`;
            } else { 
                contextHeader = `Context from Uploaded Documents (RAG):\n---\n`;
                combinedContextForLLM = actualRagContext;
                finalContextSourceNameForLLM = "RAG Document Search"; 
            }
        }
        

         if (combinedContextForLLM.trim() === "") {
            combinedContextForLLM = null; 
            thinkingProcess += "No specific external context (Tool or RAG) was found/meaningful.\n";
        } else {
            if (contextHeader) { 
                combinedContextForLLM = contextHeader + combinedContextForLLM; 
            }


       if (combinedContextForLLM.length > MAX_CONTEXT_LENGTH) {
                console.warn(`[ChatRoute] Combined context length (${combinedContextForLLM.length}) exceeds MAX_CONTEXT_LENGTH (${MAX_CONTEXT_LENGTH}). Truncating.`);
                combinedContextForLLM = combinedContextForLLM.substring(0, MAX_CONTEXT_LENGTH);
                thinkingProcess += `Warning: Combined context was truncated to ${MAX_CONTEXT_LENGTH} characters.\n`;
            }
        }
        // +++ END: COMBINE CONTEXTS +++

        let finalAnswer = "Sorry, I could not generate a response at this time.";
        let llmInstruction = "Based on the provided context (if any), please answer the user's query. If the context does not contain the answer, or if no context is provided, try to answer from your general knowledge. If you use information from the context, please cite the source or result number if applicable. If you cannot answer, say so.";
        if (finalContextSourceNameForLLM === "Academic Search") {
            llmInstruction = "Using the provided Academic Search results and any supporting RAG documents, answer the user's query. Please cite result numbers from the Academic Search if you use them.";
        } else if (finalContextSourceNameForLLM === "Web Search") {
            llmInstruction = "Using the provided Web Search results and any supporting RAG documents, answer the user's query. Please try to synthesize information if multiple sources are relevant.";
        } else if (finalContextSourceNameForLLM === "RAG Document Search") {
            llmInstruction = "Using ONLY the provided 'Context from Uploaded Documents (RAG)', answer the user's query. If the documents don't contain the answer, state that.";
        }
        
        // thinkingProcess is already being built up

        // LLM Provider Logic (Gemini, Groq, Ollama)
        if (effectiveLlmProvider === 'groq') {
                console.log(`[Node Backend] Orchestrating to Groq Cloud AI: ${groqModelId}`);
                if (!groqModelId || typeof groqModelId !== 'string' || groqModelId.trim() === '') {
                    finalAnswer = "Error: Groq model ID was not specified for the request.";
                    thinkingProcess += "Groq Error: Model ID missing.\n";
                } else {
                    try {
                        // For Groq, typically the context and instruction are part of the messages array or system prompt
                        // We'll prepend the context and instruction to the user's query if context exists
                        let queryWithContextForGroq = query;
                        if (combinedContextForLLM) {
                            queryWithContextForGroq = `Context:\n${combinedContextForLLM}\n\nInstruction: ${llmInstruction}\n\nUser Query: ${query}`;
                        } else {
                            queryWithContextForGroq = `Instruction: ${llmInstruction}\n\nUser Query: ${query}`;
                        }
                        
                        const groqResult = await generateGroqChatCompletion(
                            history, // Pass existing history
                            queryWithContextForGroq, // Pass the query bundled with context and instruction
                            null, // Context is now part of the query/prompt for Groq in this setup
                            systemPrompt,
                            groqModelId
                        );
                        if (groqResult.error) {
                            console.error("[Node Backend] Groq service returned an error:", groqResult.errorMessage);
                            finalAnswer = groqResult.answer || "An error occurred with the Groq service.";
                            thinkingProcess += groqResult.thinking || `Error from Groq: ${groqResult.errorMessage}\n`;
                        } else {
                            finalAnswer = groqResult.answer;
                            thinkingProcess += groqResult.thinking || `Processed by Groq (Model: ${groqModelId}).\n`;
                            console.log("[Node Backend] Successfully received and processed response from Groq service.");
                        }
                    } catch (groqServiceError) {
                        console.error("[Node Backend] Error during Groq service call from chat route:", groqServiceError.message);
                        finalAnswer = "Sorry, there was an issue connecting to the Groq AI model.";
                        thinkingProcess += `Groq Invocation Error: ${groqServiceError.message}\n`;
                    }
                }
            } else if (effectiveLlmProvider === 'ollama') {
                console.log(`[Node Backend] Orchestrating to Ollama: ${ollamaModelName}`);
                const ollamaUrl = process.env.NOTEBOOK_OLLAMA_CHAT_API_URL || process.env.OLLAMA_API_URL; // Check for a general Ollama URL too
                if (!ollamaUrl) {
                    finalAnswer = "Error: Ollama service URL not configured."; 
                    thinkingProcess += "Ollama Error: URL missing.\n";
                } else {
                    try {
                        let ollamaMessages = history.map(h => ({ 
                            role: h.role === 'model' ? 'assistant' : h.role, // Ollama uses 'assistant'
                            content: h.parts[0].text 
                        }));
                        
                        let userQueryForOllama = query;
                        // For Ollama, context is often best prepended to the user's current query,
                        // or the LLM needs to be specifically trained/instructed to look for a 'context' field in the payload.
                        // The `messages` format is preferred for chat models.
                        if (combinedContextForLLM) {
                            userQueryForOllama = `Context:\n${combinedContextForLLM}\n\nInstruction: ${llmInstruction}\n\nQuestion: ${userQueryForOllama}`;
                        } else {
                            userQueryForOllama = `Instruction: ${llmInstruction}\n\nQuestion: ${userQueryForOllama}`;
                        }
                        ollamaMessages.push({ role: 'user', content: userQueryForOllama });

                        const ollamaPayload = { 
                            model: ollamaModelName, 
                            messages: ollamaMessages,
                            stream: false,
                            // Ollama's /api/chat often takes system prompt within the messages array if not a dedicated field
                            // system: systemPrompt, // Check if your Ollama endpoint/model supports a separate system field
                        };
                        if (systemPrompt) { // Some Ollama setups expect system prompt as first message
                            ollamaPayload.messages.unshift({role: "system", content: systemPrompt });
                        }

                        const ollamaApiResponse = await axios.post(ollamaUrl, ollamaPayload, { timeout: 60000 }); // 60s timeout
                        
                        if (ollamaApiResponse.data && ollamaApiResponse.data.message && ollamaApiResponse.data.message.content) {
                            finalAnswer = ollamaApiResponse.data.message.content;
                        } else if (ollamaApiResponse.data && ollamaApiResponse.data.response) { // Older Ollama format
                            finalAnswer = ollamaApiResponse.data.response;
                        } else {
                            console.error("[Node Backend] Ollama response missing expected content:", ollamaApiResponse.data);
                            finalAnswer = "Received an unexpected response format from Ollama.";
                        }
                        thinkingProcess += `Processed by Ollama (Model: ${ollamaModelName}).\n`;
                        // Add thinking from Ollama if it provides it, e.g., ollamaApiResponse.data.thinking
                    } catch (ollamaError) {
                        const errorDetail = ollamaError.response ? JSON.stringify(ollamaError.response.data) : ollamaError.message;
                        console.error("[Node Backend] Error during Ollama service call:", errorDetail, ollamaError.stack);
                        finalAnswer = "Sorry, there was an issue connecting to the Ollama AI model.";
                        thinkingProcess += `Ollama Invocation Error: ${ollamaError.message}\n`;
                    }
                }
            } else { // Default to Gemini
                console.log("[Node Backend] Orchestrating to Google Gemini service...");
                try {
                    const geminiResult = await generateContentWithHistory(
                        history, 
                        query, 
                        combinedContextForLLM, // Pass the combined context
                        systemPrompt,
                        llmInstruction // Pass the specific instruction
                    ); 
                    finalAnswer = geminiResult.answer;
                    thinkingProcess += geminiResult.thinking || "Processed by Gemini.\n";
                    if(geminiResult.error) {
                        console.error("[Node Backend] Gemini service returned an error:", geminiResult.errorMessage);
                    }
                } catch (geminiError) {
                    console.error("[Node Backend] Error during Gemini service call:", geminiError.message);
                    finalAnswer = "Sorry, there was an issue connecting to the Gemini AI model.";
                    thinkingProcess += `Gemini Invocation Error: ${geminiError.message}\n`;
                }
            }
            // --- End LLM Provider Logic ---

            console.log("--- Combined Context FOR LLM (snippet) ---");
            console.log(combinedContextForLLM ? combinedContextForLLM.substring(0, 1000) + "..." : "null");

        if (userId) {
             await saveChatMessage(userId, currentSessionId, 'bot', finalAnswer, referencesFromRagService, thinkingProcess, effectiveLlmProvider);
        }

        res.json({
            reply: { role: 'model', parts: [{ text: finalAnswer }], timestamp: new Date() },
            thinking: thinkingProcess,
            references: referencesFromRagService,
            session_id: currentSessionId,
            toolUsed: finalContextSourceNameForLLM, 
            toolModeSelected: clientToolMode || 'default_behavior' 
        });

     } catch (error) { 
        console.error('[Node Backend] CRITICAL unhandled error in /api/chat/message route:', error.message, error.stack);
        const clientErrorMessage = (process.env.NODE_ENV === 'production' && (!error.isOperational && error.status !== 400 && error.status !== 401))
            ? 'An unexpected error occurred on the server.'
            : error.message;
        res.status(error.status || 500).json({ error: 'Internal server error during chat.', message: clientErrorMessage });
    }
});
router.get('/sessions', tempAuth, async (req, res) => {
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ message: 'User not authenticated for fetching sessions.' }); // Proper JSON response
    try {
        const sessions = await ChatHistory.find({ userId: userId }).sort({ updatedAt: -1 }).select('sessionId createdAt updatedAt messages').lean();
        const sessionSummaries = sessions.map(session => {
             const firstUserMessage = session.messages?.find(m => m.role === 'user');
             let preview = 'Chat Session';
             if (firstUserMessage?.parts?.[0]?.text) {
                 preview = firstUserMessage.parts[0].text.substring(0, 75) + (firstUserMessage.parts[0].text.length > 75 ? '...' : '');
             }
             return { sessionId: session.sessionId, createdAt: session.createdAt, updatedAt: session.updatedAt, messageCount: session.messages?.length || 0, preview: preview };
        });
        res.status(200).json(sessionSummaries);
    } catch (error) {
        console.error(`[Node Backend] Error fetching chat sessions for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve chat sessions.' });
    }
});

router.get('/session/:sessionId', tempAuth, async (req, res) => {
    const userId = req.user?._id?.toString();
    const { sessionId } = req.params;
    if (!userId) return res.status(401).json({ message: 'User not authenticated for fetching session details.' }); // Proper JSON response
    if (!sessionId) return res.status(400).json({ message: 'Session ID parameter is required.' });
    try {
        const session = await ChatHistory.findOne({ sessionId: sessionId, userId: userId }).select('-userId -__v').lean();
        if (!session) return res.status(404).json({ message: 'Chat session not found or access denied.' });
        res.status(200).json({
            sessionId: session.sessionId, createdAt: session.createdAt, updatedAt: session.updatedAt,
            messages: (session.messages || []).map(m => ({
                role: m.role,
                parts: Array.isArray(m.parts) && m.parts.length > 0 ? m.parts.map(p => ({ text: p.text || '' })) : [{ text: m.text || '' }],
                timestamp: m.timestamp
            }))
        });
    } catch (error) {
        console.error(`[Node Backend] Error fetching chat session ${sessionId} for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve chat session details.' });
    }
});

module.exports = router;