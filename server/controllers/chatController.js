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
const userAwareServiceFactory = require('../services/userAwareServiceFactory');
const GroqAI = require('../services/groqAI');
const TogetherAI = require('../services/togetherAI');
const CohereAI = require('../services/cohereAI');
const HuggingFaceAI = require('../services/huggingFaceAI');
const MCPOrchestrator = require('../services/mcpOrchestrator');
const AgenticMCPIntegration = require('../services/agenticMCPIntegration');

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
    console.log('🔥 [DEBUG] handleStandardMessage called with query:', req.body.query?.substring(0, 50));
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
            mcpEnabled = false,
            agenticMCP = false,
            selectedModel = 'gemini-flash'
        } = req.body;
        const userId = req.user.id;

        console.log(`[Chat] Request: query="${query.substring(0, 50)}...", ragEnabled=${ragEnabled}, deepSearch=${deepSearch}, autoDetectWebSearch=${autoDetectWebSearch}, multiLLM=${multiLLM}, mcpEnabled=${mcpEnabled}, agenticMCP=${agenticMCP}, selectedModel=${selectedModel}`);

        if (!query || !sessionId) {
            return res.status(400).json({ message: 'Query and Session ID are required.' });
        }

        // Document generation detection
        let shouldGenerateDocument = false;
        let documentType = null;
        let documentTopic = null;

        // Check if user is requesting document generation
        const documentKeywords = {
            ppt: ['ppt', 'powerpoint', 'presentation', 'slides'],
            report: ['report', 'pdf', 'document'],
            excel: ['excel', 'spreadsheet', 'xls', 'xlsx'],
            word: ['word', 'doc', 'docx']
        };

        const generateKeywords = ['generate', 'genarate', 'genearte', 'genrate', 'generete', 'create', 'make', 'build', 'prepare', 'produce', 'develop'];
        const queryLower = query.toLowerCase();

        // Check for document generation request
        console.log(`🔍 [DEBUG] Checking document generation for query: "${queryLower}"`);
        console.log(`🔍 [DEBUG] Document keywords:`, documentKeywords);
        console.log(`🔍 [DEBUG] Generate keywords:`, generateKeywords);

        for (const [type, keywords] of Object.entries(documentKeywords)) {
            const hasDocKeyword = keywords.some(keyword => queryLower.includes(keyword));
            const hasGenKeyword = generateKeywords.some(keyword => queryLower.includes(keyword));

            console.log(`🔍 [DEBUG] Type: ${type}, hasDocKeyword: ${hasDocKeyword}, hasGenKeyword: ${hasGenKeyword}`);

            if (hasDocKeyword && hasGenKeyword) {
                shouldGenerateDocument = true;
                documentType = type;
                // Extract topic from query (remove generation keywords and common words)
                documentTopic = query
                    .replace(/\b(generate|create|make|build|prepare|ppt|powerpoint|presentation|slides|report|pdf|document|excel|spreadsheet|xls|xlsx|word|doc|docx|for|me|a|an|the|on|about|of)\b/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // If topic is empty or too short, use a default based on the original query
                if (!documentTopic || documentTopic.length < 2) {
                    documentTopic = query.replace(/\b(generate|create|make|build|prepare)\b/gi, '').trim() || 'General Topic';
                }

                console.log(`🔍 [DEBUG] Document generation detected! Type: ${type}, Topic: "${documentTopic}"`);
                break;
            }
        }

        // Automatic web search detection (like ChatGPT)
        let shouldUseWebSearch = false;
        let autoDetectionMetadata = {};

        if (!ragEnabled && !deepSearch && autoDetectWebSearch && !shouldGenerateDocument) {
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

        // Handle document generation requests
        if (shouldGenerateDocument) {
            console.log(`[DocGen] 📄 Detected ${documentType} generation request for topic: "${documentTopic}"`);

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

            try {
                if (documentType === 'ppt') {
                    const { generateSimplePPTWithFallback } = require('../services/simplePptGenerator');

                    try {
                        // Generate PPT using enhanced generator with fallback
                        console.log(`[DocGen] 📊 Starting PPT generation for topic: "${documentTopic}"`);

                        const result = await generateSimplePPTWithFallback(documentTopic || query, {
                            selectedModel: selectedModel,
                            userId: userId,
                            maxRetries: 2
                        });

                        if (!result.success) {
                            throw new Error(result.error || 'PPT generation failed');
                        }

                        const responseText = `✅ **PowerPoint Presentation Generated Successfully!**\n\n📊 **Topic:** ${documentTopic}\n\n🎯 **Features:**\n- Professional title slide\n- Comprehensive introduction\n- Background information\n- Current status analysis\n- Challenges and opportunities\n- Conclusion and next steps\n\n📁 **File:** ${result.fileName}\n💾 **Ready for download**\n🎨 **Format:** Professional PowerPoint (.pptx)\n\n[📥 Download Presentation](${result.downloadUrl})`;

                        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
                        await session.save();

                        return res.json({
                            response: responseText,
                            downloadUrl: result.downloadUrl,
                            fileName: result.fileName,
                            documentType: 'ppt',
                            metadata: {
                                searchType: 'document_generation',
                                generatedType: 'ppt',
                                downloadUrl: result.downloadUrl,
                                fileName: result.fileName,
                                documentType: 'ppt',
                                attempt: result.attempt
                            },
                            sessionId: session.sessionId,
                            history: session.messages
                        });
                    } catch (pptError) {
                        console.error('[DocGen] AI PPT generation failed:', pptError);
                        console.log('[DocGen] Attempting standalone PPT generation...');

                        try {
                            // Use standalone PPT generator as fallback
                            const { generateStandalonePPTWithResult } = require('../services/standalonePptGenerator');

                            const standaloneResult = await generateStandalonePPTWithResult(documentTopic || query, {
                                selectedModel: selectedModel,
                                userId: userId
                            });

                            if (standaloneResult.success) {
                                const responseText = `✅ **PowerPoint Presentation Generated Successfully!**\n\n📊 **Topic:** ${documentTopic}\n\n🎯 **Features:**\n- Professional title slide\n- Structured content\n- Multiple informative slides\n- Professional formatting\n\n📁 **File:** ${standaloneResult.fileName}\n💾 **Ready for download**\n🎨 **Format:** Professional PowerPoint (.pptx)\n\n[📥 Download Presentation](${standaloneResult.downloadUrl})\n\n💡 **Note:** Generated using our reliable presentation template system.`;

                                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
                                await session.save();

                                return res.json({
                                    response: responseText,
                                    downloadUrl: standaloneResult.downloadUrl,
                                    fileName: standaloneResult.fileName,
                                    documentType: 'ppt',
                                    metadata: {
                                        searchType: 'document_generation',
                                        generatedType: 'ppt',
                                        downloadUrl: standaloneResult.downloadUrl,
                                        fileName: standaloneResult.fileName,
                                        documentType: 'ppt',
                                        generationType: 'standalone'
                                    },
                                    sessionId: session.sessionId,
                                    history: session.messages
                                });
                            } else {
                                throw new Error(standaloneResult.error);
                            }
                        } catch (standaloneError) {
                            console.error('[DocGen] Standalone PPT generation also failed:', standaloneError);

                            // Final fallback - provide outline
                            const fallbackText = `📄 **PowerPoint Presentation Outline Generated!**\n\n📊 **Topic:** ${documentTopic}\n\n**Here's a comprehensive outline for your presentation:**\n\n**Slide 1: Title Slide**\n- Title: ${documentTopic}\n- Subtitle: A Comprehensive Overview\n\n**Slide 2: Introduction**\n- Overview of the topic\n- Key objectives\n- Agenda\n\n**Slide 3: Background**\n- Historical context\n- Current situation\n- Importance\n\n**Slide 4: Key Points**\n- Main concept 1\n- Main concept 2\n- Main concept 3\n\n**Slide 5: Analysis**\n- Benefits and advantages\n- Challenges and limitations\n- Opportunities\n\n**Slide 6: Conclusion**\n- Summary of key points\n- Recommendations\n- Next steps\n\n💡 **Note:** Due to technical issues, I've provided you with a detailed outline. You can use this structure to create your presentation in PowerPoint, Google Slides, or any presentation software.`;

                            session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', fallbackText);
                            await session.save();

                            return res.json({
                                response: fallbackText,
                                documentType: 'ppt',
                                metadata: { searchType: 'document_generation_outline', generatedType: 'ppt_outline' },
                                sessionId: session.sessionId,
                                history: session.messages
                            });
                        }
                    }

                } else if (documentType === 'report') {
                    // For reports, we'll use the enhanced PDF generation logic
                    const GeminiService = require('../services/geminiService');
                    const { GeminiAI } = require('../services/geminiAI');
                    const DuckDuckGoService = require('../utils/duckduckgo');
                    const DeepSearchService = require('../deep_search/services/deepSearchService');
                    const { generateReportPdf } = require('../services/pdfGenerator');

                    try {
                        // Initialize services
                        const geminiService = new GeminiService();
                        await geminiService.initialize();
                        const geminiAI = new GeminiAI(geminiService);
                        const deepSearchService = new DeepSearchService(userId, geminiAI, new DuckDuckGoService());

                        console.log(`[PDFGen] Starting research for topic: ${documentTopic || query}`);

                        // Perform search for report content
                        const searchResults = await deepSearchService.performSearch(documentTopic || query);

                        console.log(`[PDFGen] Research completed, generating PDF...`);

                        // Generate PDF file
                        const pdfResult = await generateReportPdf(
                            documentTopic || query,
                            searchResults.summary || "Report content based on research",
                            searchResults.sources || []
                        );

                        console.log(`[PDFGen] PDF generated successfully: ${pdfResult.filename}`);

                        const responseText = `✅ **Research Report Generated Successfully!**\n\n📋 **Topic:** ${documentTopic || query}\n\n🔗 **Download Link:** [Click here to download your report](${pdfResult.downloadUrl})\n\n📊 **Report Contents:**\n- Executive Summary\n- Detailed Analysis\n- Key Findings\n- Sources and References\n\nThe report has been generated based on current research and is formatted professionally.`;

                        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
                        await session.save();

                        return res.json({
                            response: responseText,
                            documentType: 'report',
                            downloadUrl: pdfResult.downloadUrl,
                            fileName: pdfResult.filename,
                            reportData: searchResults,
                            metadata: { searchType: 'document_generation', generatedType: 'report' },
                            sessionId: session.sessionId,
                            history: session.messages
                        });

                    } catch (pdfError) {
                        console.error('[PDFGen] Error generating PDF:', pdfError);

                        const errorText = `❌ **Error Generating REPORT**\n\nI encountered an error while generating your report. Please try again or contact support if the issue persists.\n\n**Error:** ${pdfError.message}`;

                        session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', errorText);
                        await session.save();

                        return res.json({
                            response: errorText,
                            documentType: 'report',
                            error: pdfError.message,
                            metadata: { searchType: 'document_generation', generatedType: 'report', error: true },
                            sessionId: session.sessionId,
                            history: session.messages
                        });
                    }

                } else if (documentType === 'excel') {
                    const { generateExcel } = require('../services/excelGenerator');

                    // Generate Excel
                    const excelPath = await generateExcel(documentTopic || query);
                    const path = require('path');
                    const fileName = path.basename(excelPath);

                    // Create download URL
                    const downloadUrl = `/api/files/download-generated/${fileName}`;

                    const responseText = `✅ **Excel Spreadsheet Generated Successfully!**\n\n📊 **Topic:** ${documentTopic}\n\n🔗 **Download Link:** [Click here to download your spreadsheet](${downloadUrl})\n\nYour spreadsheet includes:\n- Summary sheet with key metrics\n- Detailed data analysis\n- Structured categories\n- Professional formatting\n\nThe spreadsheet is ready for analysis and further customization!`;

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
                    await session.save();

                    return res.json({
                        response: responseText,
                        downloadUrl: downloadUrl,
                        fileName: fileName,
                        documentType: 'excel',
                        metadata: { searchType: 'document_generation', generatedType: 'excel' },
                        sessionId: session.sessionId,
                        history: session.messages
                    });

                } else if (documentType === 'word') {
                    const { generateWord } = require('../services/wordGenerator');

                    // Generate Word document
                    const wordPath = await generateWord(documentTopic || query);
                    const path = require('path');
                    const fileName = path.basename(wordPath);

                    // Create download URL
                    const downloadUrl = `/api/files/download-generated/${fileName}`;

                    const responseText = `✅ **Word Document Generated Successfully!**\n\n📄 **Topic:** ${documentTopic}\n\n🔗 **Download Link:** [Click here to download your document](${downloadUrl})\n\nYour document includes:\n- Professional formatting\n- Structured sections\n- Comprehensive analysis\n- Introduction and conclusion\n\nThe document is ready for review and further editing!`;

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', responseText);
                    await session.save();

                    return res.json({
                        response: responseText,
                        downloadUrl: downloadUrl,
                        fileName: fileName,
                        documentType: 'word',
                        metadata: { searchType: 'document_generation', generatedType: 'word' },
                        sessionId: session.sessionId,
                        history: session.messages
                    });
                }

            } catch (docError) {
                console.error(`[DocGen] Error generating ${documentType}:`, docError);
                const errorText = `❌ **Error Generating ${documentType.toUpperCase()}**\n\nI encountered an error while generating your ${documentType}. Please try again or contact support if the issue persists.\n\n**Error:** ${docError.message}`;

                session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', errorText);
                await session.save();

                return res.json({
                    response: errorText,
                    error: true,
                    metadata: { searchType: 'document_generation_error' },
                    sessionId: session.sessionId,
                    history: session.messages
                });
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
        } else if (mcpEnabled) {
            // Handle MCP (Model Context Protocol) - Intelligent Agent Routing
            console.log(`[MCP] 🤖 Starting intelligent agent processing for user: ${userId}, query: "${query}"`);

            try {
                const mcpOrchestrator = new MCPOrchestrator();

                // Create enhanced context for MCP processing
                const mcpContext = {
                    userId: userId,
                    sessionId: sessionId,
                    history: history,
                    selectedModel: selectedModel,
                    systemPrompt: systemPrompt,
                    userPreferences: req.user.preferences || {},
                    timestamp: new Date().toISOString()
                };

                // Process query through MCP system
                const mcpResult = await mcpOrchestrator.processQuery(query, mcpContext);

                let session = await ChatSession.findOne({ sessionId, user: userId });
                if (!session) {
                    session = new ChatSession({
                        sessionId,
                        user: userId,
                        title: query.substring(0, 50),
                        systemPrompt: systemPrompt || "You are a helpful AI assistant with specialized agents."
                    });
                }

                session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

                if (mcpResult.success) {
                    // Format MCP response for user
                    const mcpResponse = formatMCPResponse(mcpResult, query);

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', mcpResponse.text);
                    await session.save();

                    console.log(`[MCP] ✅ Query processed successfully by agents: ${mcpResult.agentsUsed?.join(', ')} in ${mcpResult.processingTime}ms`);

                    return res.json({
                        response: mcpResponse.text,
                        metadata: {
                            searchType: 'mcp_processing',
                            agentsUsed: mcpResult.agentsUsed,
                            processingTime: mcpResult.processingTime,
                            confidence: mcpResult.confidence,
                            analysis: mcpResult.analysis,
                            mcpVersion: '2.0.0'
                        },
                        sessionId: session.sessionId,
                        history: session.messages,
                        mcpData: {
                            agentRecommendations: mcpResult.analysis?.recommendedAgents,
                            taskComplexity: mcpResult.analysis?.complexity,
                            collaborationUsed: mcpResult.analysis?.needsCollaboration
                        }
                    });
                } else {
                    // MCP failed, provide fallback response
                    const fallbackResponse = `I encountered an issue processing your request through our specialized agents. ${mcpResult.fallbackSuggestion || 'Please try rephrasing your question or contact support.'}`;

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', fallbackResponse);
                    await session.save();

                    console.log(`[MCP] ❌ Processing failed: ${mcpResult.error}`);

                    return res.json({
                        response: fallbackResponse,
                        metadata: {
                            searchType: 'mcp_fallback',
                            error: mcpResult.error,
                            suggestion: mcpResult.fallbackSuggestion
                        },
                        sessionId: session.sessionId,
                        history: session.messages
                    });
                }

            } catch (mcpError) {
                console.error('[MCP] Unexpected error:', mcpError);

                // Fallback to standard processing
                console.log('[MCP] Falling back to standard message processing...');
                // Continue to standard processing below
            }
        } else if (agenticMCP) {
            // Handle Agentic MCP - Full Application Integration
            console.log(`[Agentic MCP] 🤖 Starting agentic task processing for user: ${userId}, query: "${query}"`);

            try {
                // Initialize Agentic MCP Integration with service manager
                const serviceManager = req.app.locals.serviceManager || {
                    getServices: () => ({}),
                    getDeepSearchService: () => null,
                    getMetricsCollector: () => null
                };

                const agenticMCP = new AgenticMCPIntegration(serviceManager);

                // Create enhanced context for agentic processing
                const agenticContext = {
                    userId: userId,
                    sessionId: sessionId,
                    history: history,
                    selectedModel: selectedModel,
                    systemPrompt: systemPrompt,
                    userPreferences: req.user?.preferences || {},
                    timestamp: new Date().toISOString(),
                    requestMetadata: {
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    }
                };

                // Process query through Agentic MCP system
                const agenticResult = await agenticMCP.processAgenticTask(query, agenticContext);

                let session = await ChatSession.findOne({ sessionId, user: userId });
                if (!session) {
                    session = new ChatSession({
                        sessionId,
                        user: userId,
                        title: query.substring(0, 50),
                        systemPrompt: systemPrompt || "You are an intelligent agentic AI assistant with access to comprehensive application features."
                    });
                }

                session.addMessage(MESSAGE_TYPES.TEXT, 'user', query);

                if (agenticResult.success) {
                    // Format Agentic MCP response for user
                    const agenticResponse = formatAgenticMCPResponse(agenticResult, query);

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', agenticResponse.text);
                    await session.save();

                    console.log(`[Agentic MCP] ✅ Task completed successfully by agents: ${agenticResult.agentsUsed?.join(', ')} in ${agenticResult.processingTime}ms`);

                    return res.json({
                        response: agenticResponse.text,
                        metadata: {
                            searchType: 'agentic_mcp_processing',
                            agentsUsed: agenticResult.agentsUsed,
                            processingTime: agenticResult.processingTime,
                            confidence: agenticResult.confidence,
                            workflowType: agenticResult.workflowType,
                            analysis: agenticResult.analysis,
                            agenticVersion: '1.0.0'
                        },
                        sessionId: session.sessionId,
                        history: session.messages,
                        agenticData: {
                            strategy: agenticResult.strategy,
                            workflow: agenticResult.result?.workflow,
                            downloadableFiles: agenticResult.result?.downloadableFiles || [],
                            recommendations: agenticResult.result?.recommendations || []
                        }
                    });
                } else {
                    // Agentic MCP failed, provide fallback response
                    const fallbackResponse = `I encountered an issue processing your request through our agentic system. ${agenticResult.fallbackSuggestion || 'Please try breaking down your request into smaller, specific tasks.'}`;

                    session.addMessage(MESSAGE_TYPES.TEXT, 'assistant', fallbackResponse);
                    await session.save();

                    console.log(`[Agentic MCP] ❌ Processing failed: ${agenticResult.error}`);

                    return res.json({
                        response: fallbackResponse,
                        metadata: {
                            searchType: 'agentic_mcp_fallback',
                            error: agenticResult.error,
                            suggestion: agenticResult.fallbackSuggestion
                        },
                        sessionId: session.sessionId,
                        history: session.messages
                    });
                }

            } catch (agenticError) {
                console.error('[Agentic MCP] Unexpected error:', agenticError);

                // Fallback to standard processing
                console.log('[Agentic MCP] Falling back to standard message processing...');
                // Continue to standard processing below
            }
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
                // Use user-aware Gemini service with user's API key
                const geminiService = await userAwareServiceFactory.getAIService(userId, 'gemini', req.userApiConfig);
                if (geminiService) {
                    aiResponse = await geminiService.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                    console.log(`Using ${req.userApiConfig?.useUserKeys ? 'user' : 'admin'} Gemini API key for user ${userId}`);
                } else {
                    // Fallback to standard user AI
                    const standardUserAI = await userServiceManager.getUserAIService(userId);
                    aiResponse = await standardUserAI.generateChatResponse(query, [], aiHistory, session.systemPrompt);
                    modelUsed = 'gemini-fallback';
                }
            } else if (selectedModel === 'llama-model' || selectedModel.startsWith('llama')) {
                // Use user-specific Ollama service for Llama model
                try {
                    console.log(`🦙 Attempting to use user-specific Ollama service for model: ${selectedModel}`);
                    const userServices = await userSpecificAI.getUserAIServices(userId);

                    if (userServices.ollama) {
                        // Modify system prompt for conversational Llama-style responses
                        const llamaSystemPrompt = session.systemPrompt +
                            "\n\nYou are a friendly, conversational AI assistant powered by Llama. " +
                            "Be warm, engaging, and personable in your responses. " +
                            "Provide helpful and detailed answers while maintaining a casual, approachable tone.";

                        console.log('🦙 Using user-specific Ollama service for Llama model');

                        // Use the default model or extract model name from selectedModel
                        let modelName = 'llama3.2:latest'; // Default model
                        if (selectedModel.includes(':')) {
                            modelName = selectedModel.replace('llama-', '').replace('_', ':');
                        }

                        const ollamaResult = await userServices.ollama.generateChatResponse(query, modelName);
                        const responseText = typeof ollamaResult === 'string' ? ollamaResult : ollamaResult.response;
                        aiResponse = { response: responseText, followUpQuestions: [] };
                        modelUsed = selectedModel;

                    } else {
                        throw new Error('User-specific Ollama service not available');
                    }

                } catch (error) {
                    console.warn('🦙 User Ollama service failed:', error.message);
                    // Return error message instead of fallback
                    return res.status(503).json({
                        success: false,
                        error: 'Ollama service is currently unavailable',
                        message: 'Your Ollama server is not accessible. Please check your Ollama URL configuration or try using the Gemini model instead.',
                        suggestedAction: 'switch_to_gemini',
                        availableModels: ['gemini-flash', 'gemini-pro'],
                        ollamaError: error.message
                    });
                }
            } else if (selectedModel.startsWith('groq-')) {
                // Use user-aware Groq service
                const groqAI = await userAwareServiceFactory.getAIService(userId, 'groq', req.userApiConfig);
                if (groqAI) {
                    const response = await groqAI.generateText(query);
                    aiResponse = { response, followUpQuestions: [] };
                    console.log(`Using ${req.userApiConfig?.useUserKeys ? 'user' : 'admin'} Groq API key for user ${userId}`);
                } else {
                    throw new Error('Groq service not available');
                }
            } else if (selectedModel.startsWith('together-')) {
                // Use user-aware Together AI service
                const togetherAI = await userAwareServiceFactory.getAIService(userId, 'together', req.userApiConfig);
                if (togetherAI) {
                    const response = await togetherAI.generateText(query);
                    aiResponse = { response, followUpQuestions: [] };
                    console.log(`Using ${req.userApiConfig?.useUserKeys ? 'user' : 'admin'} Together API key for user ${userId}`);
                } else {
                    throw new Error('Together AI service not available');
                }
            } else if (selectedModel.startsWith('cohere-')) {
                // Use user-aware Cohere service
                const cohereAI = await userAwareServiceFactory.getAIService(userId, 'cohere', req.userApiConfig);
                if (cohereAI) {
                    const response = await cohereAI.generateText(query);
                    aiResponse = { response, followUpQuestions: [] };
                    console.log(`Using ${req.userApiConfig?.useUserKeys ? 'user' : 'admin'} Cohere API key for user ${userId}`);
                } else {
                    throw new Error('Cohere service not available');
                }
            } else if (selectedModel.startsWith('hf-')) {
                // Use user-aware HuggingFace service
                const hfAI = await userAwareServiceFactory.getAIService(userId, 'huggingface', req.userApiConfig);
                if (hfAI) {
                    const response = await hfAI.generateText(query);
                    aiResponse = { response, followUpQuestions: [] };
                    console.log(`Using ${req.userApiConfig?.useUserKeys ? 'user' : 'admin'} HuggingFace API key for user ${userId}`);
                } else {
                    throw new Error('HuggingFace service not available');
                }
            } else if (selectedModel.startsWith('ollama-')) {
                // Use user's Ollama service
                const userServices = await userSpecificAI.getUserAIServices(userId);
                if (userServices.ollama) {
                    const modelName = selectedModel.replace('ollama-', '').replace('_', ':');
                    const ollamaResult = await userServices.ollama.generateChatResponse(query, modelName);
                    const responseText = typeof ollamaResult === 'string' ? ollamaResult : ollamaResult.response;
                    aiResponse = { response: responseText, followUpQuestions: [] };
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

        // Provide specific error messages based on the error type
        let userMessage = 'Failed to process chat message.';
        let suggestions = [];

        if (error.message.includes('quota') || error.message.includes('429')) {
            userMessage = `🚨 API quota exceeded for ${selectedModel.includes('gemini') ? 'Gemini' : 'the selected AI model'}.`;
            suggestions = [
                '🦙 Switch to Llama model (unlimited local processing)',
                '⏰ Wait for quota reset (usually resets daily)',
                '💳 Consider upgrading your API plan for higher limits'
            ];
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
            userMessage = '🌐 Unable to connect to the AI service.';
            suggestions = [
                '🔄 Check your internet connection',
                '🔀 Try switching to a different model',
                '📞 Contact support if the issue persists'
            ];
        } else if (selectedModel.includes('llama') && error.message.includes('Ollama')) {
            userMessage = '🦙 Ollama service is currently unavailable.';
            suggestions = [
                '🤖 Switch to Gemini model',
                '🔧 Check if Ollama is running properly',
                '⏳ Try again in a few moments'
            ];
        }

        res.status(500).json({
            message: userMessage,
            error: error.message,
            suggestions: suggestions,
            recommendedAction: suggestions.length > 0 ? suggestions[0] : '🔄 Try again later',
            currentModel: selectedModel
        });
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
            message: `I apologize, but I encountered an issue while searching for information about "${req.body.query || 'your query'}". This could be due to network connectivity or search service limitations.

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


// Enhanced Deep Search with Media
const handleEnhancedDeepSearch = async (req, res) => {
    try {
        const { query, history = [] } = req.body;
        const userId = req.user.id;

        console.log(`🔍 Enhanced deep search request: "${query}" from user ${userId}`);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

        // Use efficient deep search as fallback for enhanced search
        const EfficientDeepSearch = require('../services/efficientDeepSearch');
        const deepSearchService = new EfficientDeepSearch('gemini-flash', userId);

        // Perform the search
        const searchResults = await deepSearchService.performSearch(query, history);

        // Return the results in enhanced format
        res.json({
            response: searchResults.response,
            sources: searchResults.sources || [],
            media: {
                videos: [],
                images: [],
                news: []
            },
            metadata: {
                searchType: 'enhanced_deep_search',
                model: 'gemini-flash',
                sourcesCount: searchResults.sources?.length || 0,
                timestamp: new Date().toISOString(),
                enhanced: true,
                hasMedia: false
            }
        });

    } catch (error) {
        console.error('Enhanced deep search error:', error);
        res.status(500).json({
            message: 'Deep search failed',
            error: error.message,
            response: 'I apologize, but I encountered an error while searching. Please try again with a different query.'
        });
    }
};

// Efficient Deep Search - Reliable and fast
const handleEfficientDeepSearch = async (req, res) => {
    try {
        const { query, history = [], selectedModel = 'gemini-flash' } = req.body;
        const userId = req.user.id;

        console.log(`🔍 Efficient deep search request: "${query}" from user ${userId} using model ${selectedModel}`);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

        // Use the efficient deep search service
        const EfficientDeepSearch = require('../services/efficientDeepSearch');
        const deepSearchService = new EfficientDeepSearch(selectedModel, userId);

        // Perform the search
        const searchResults = await deepSearchService.performSearch(query, history);

        console.log(`✅ [EfficientDeepSearch] Search completed successfully`);

        // Return the results
        res.json({
            response: searchResults.response,
            sources: searchResults.sources || [],
            metadata: searchResults.metadata,
            followUpQuestions: [
                "Can you search for more specific information about this topic?",
                "What are the latest developments in this area?",
                "Are there any related topics I should explore?"
            ]
        });

    } catch (error) {
        console.error('[EfficientDeepSearch] Error:', error);
        res.status(500).json({
            message: 'Deep search failed',
            error: error.message,
            response: 'I apologize, but I encountered an error while searching. Please try again with a different query.'
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

// Efficient Deep Search Handler
const handleEfficientDeepSearchNew = async (req, res) => {
    try {
        const { query, history = [], selectedModel = 'gemini-flash' } = req.body;
        const userId = req.user.id;

        console.log(`🔍 [EfficientDeepSearch] Starting search for: "${query}" using model: ${selectedModel}`);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Query is required for deep search.' });
        }

        // Use the efficient deep search service
        const EfficientDeepSearch = require('../services/efficientDeepSearch');
        const deepSearchService = new EfficientDeepSearch(selectedModel, userId);

        // Perform the search
        const searchResults = await deepSearchService.performSearch(query, history);

        console.log(`✅ [EfficientDeepSearch] Search completed successfully`);

        // Return the results
        res.json({
            response: searchResults.response,
            sources: searchResults.sources || [],
            metadata: searchResults.metadata,
            followUpQuestions: [
                "Can you search for more specific information about this topic?",
                "What are the latest developments in this area?",
                "Are there any related topics I should explore?"
            ]
        });

    } catch (error) {
        console.error('[EfficientDeepSearch] Error:', error);
        res.status(500).json({
            message: 'Deep search failed',
            error: error.message,
            response: 'I apologize, but I encountered an error while searching. Please try again with a different query.'
        });
    }
};

// Enhanced Deep Search V2 - Rich media content with YouTube, blogs, and embedded videos
const handleEnhancedDeepSearchV2 = async (req, res) => {
    try {
        const { query, history = [], selectedModel = 'gemini-flash' } = req.body;
        const userId = req.user.id;

        console.log(`🚀 [EnhancedDeepSearchV2] Starting enhanced search for: "${query}" using model: ${selectedModel}`);

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: 'Query is required for enhanced deep search.' });
        }

        // Use the enhanced deep search service V2
        const EnhancedDeepSearchV2 = require('../services/enhancedDeepSearchV2');
        const deepSearchService = new EnhancedDeepSearchV2(selectedModel, userId);

        // Perform the enhanced search
        const searchResults = await deepSearchService.performEnhancedSearch(query, history);

        console.log(`✅ [EnhancedDeepSearchV2] Enhanced search completed successfully`);

        // Return the comprehensive enhanced results with ALL media types
        res.json({
            success: true,
            data: {
                response: searchResults.answer,
                sources: searchResults.sources,
                videos: searchResults.media.videos,
                blogs: searchResults.media.blogs,
                academic: searchResults.media.academic,
                wikipedia: searchResults.media.wikipedia,
                documentation: searchResults.media.documentation,
                news: searchResults.media.news || [],
                tutorials: searchResults.media.tutorials || [],
                community: searchResults.media.community || [],
                metadata: {
                    searchType: 'enhanced-deep-search-v2',
                    query: query,
                    timestamp: searchResults.timestamp,
                    model: selectedModel,
                    userId: userId,
                    hasRichMedia: true,
                    videoCount: searchResults.media.videos.length,
                    blogCount: searchResults.media.blogs.length,
                    academicCount: searchResults.media.academic.length,
                    newsCount: searchResults.media.news?.length || 0,
                    tutorialCount: searchResults.media.tutorials?.length || 0,
                    communityCount: searchResults.media.community?.length || 0,
                    totalSources: searchResults.totalSources || searchResults.sources.length
                }
            }
        });

    } catch (error) {
        console.error('[EnhancedDeepSearchV2] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Enhanced deep search failed',
            error: error.message
        });
    }
};

/**
 * Format Agentic MCP response for user display
 * @param {Object} agenticResult - Result from Agentic MCP orchestrator
 * @param {string} originalQuery - Original user query
 * @returns {Object} Formatted response object
 */
function formatAgenticMCPResponse(agenticResult, originalQuery) {
    const { result, analysis, agentsUsed, confidence, processingTime, workflowType } = agenticResult;

    // Create agent badges with specialized icons
    const agentBadges = agentsUsed?.map(agent => {
        const agentEmojis = {
            'Research Analyst Agent': '🔬',
            'Content Creator Agent': '📝',
            'Document Processor Agent': '📄',
            'Learning Assistant Agent': '🎓',
            'Workflow Coordinator Agent': '⚙️'
        };
        return `${agentEmojis[agent] || '🤖'} ${agent}`;
    }).join(' • ') || '🤖 Agentic AI System';

    // Format confidence level
    const confidenceLevel = confidence >= 0.9 ? 'Excellent' :
                           confidence >= 0.8 ? 'High' :
                           confidence >= 0.7 ? 'Good' : 'Moderate';

    const confidenceEmoji = confidence >= 0.9 ? '🎯' :
                           confidence >= 0.8 ? '✅' :
                           confidence >= 0.7 ? '👍' : '⚡';

    // Create response header
    let responseText = `${confidenceEmoji} **Agentic AI Response** (${confidenceLevel} Confidence)\n\n`;
    responseText += `**🤖 Agents Used:** ${agentBadges}\n`;
    responseText += `**🔍 Task Analysis:** ${analysis?.intents?.join(', ') || 'Comprehensive assistance'}\n`;
    responseText += `**⚡ Processing Time:** ${processingTime}ms\n`;
    responseText += `**🔄 Workflow Type:** ${workflowType === 'multi_agent' ? 'Multi-Agent Collaboration' : 'Single Agent Execution'}\n\n`;
    responseText += `---\n\n`;

    // Add the main result content
    if (result.type === 'agentic_workflow_result') {
        responseText += `## 🎯 Agentic Workflow Results\n\n`;
        responseText += `**Summary:** ${result.summary}\n\n`;
        responseText += `**Steps Completed:** ${result.stepsCompleted}\n`;
        responseText += `**Agents Involved:** ${result.agentsInvolved?.join(', ')}\n\n`;

        if (result.downloadableFiles && result.downloadableFiles.length > 0) {
            responseText += `**📁 Generated Files:**\n`;
            result.downloadableFiles.forEach((file, index) => {
                responseText += `${index + 1}. [📥 Download ${file.type.toUpperCase()}](${file.url}) - ${file.filename}\n`;
            });
            responseText += `\n`;
        }

        if (result.recommendations && result.recommendations.length > 0) {
            responseText += `**💡 Recommendations:**\n`;
            result.recommendations.forEach(rec => {
                responseText += `• ${rec}\n`;
            });
        }
    } else if (result.finalResult) {
        responseText += `## 🎯 Task Completion Summary\n\n`;
        responseText += `${result.finalResult.summary || 'Task completed successfully using agentic workflow.'}\n\n`;

        if (result.outputs && result.outputs.length > 0) {
            responseText += `**📊 Generated Outputs:**\n`;
            result.outputs.forEach((output, index) => {
                if (output.result && output.result.data) {
                    responseText += `${index + 1}. ${output.tool || 'Processing step'}: ${output.result.data.summary || 'Completed'}\n`;
                }
            });
        }
    } else {
        // Generic agentic response format
        responseText += result.message || result.content || 'Agentic task completed successfully with comprehensive analysis and processing.';
    }

    // Add footer with Agentic MCP info
    responseText += `\n\n---\n\n`;
    responseText += `🤖 **Powered by Agentic MCP (Model Context Protocol)**\n`;
    responseText += `This response was generated using intelligent agents that can autonomously access and coordinate all application features including research, document generation, analysis, and personalization.`;

    return {
        text: responseText,
        confidence: confidence,
        agentsUsed: agentsUsed,
        processingTime: processingTime,
        workflowType: workflowType
    };
}

/**
 * Format MCP response for user display
 * @param {Object} mcpResult - Result from MCP orchestrator
 * @param {string} originalQuery - Original user query
 * @returns {Object} Formatted response object
 */
function formatMCPResponse(mcpResult, originalQuery) {
    const { result, analysis, agentsUsed, confidence, processingTime } = mcpResult;

    // Create agent badges
    const agentBadges = agentsUsed?.map(agent => {
        const agentEmojis = {
            'Research Specialist': '🔬',
            'Code Specialist': '💻',
            'Academic Specialist': '🎓',
            'Creative Specialist': '🎨'
        };
        return `${agentEmojis[agent] || '🤖'} ${agent}`;
    }).join(' • ') || '🤖 AI Assistant';

    // Format confidence level
    const confidenceLevel = confidence >= 0.9 ? 'Very High' :
                           confidence >= 0.8 ? 'High' :
                           confidence >= 0.7 ? 'Good' : 'Moderate';

    const confidenceEmoji = confidence >= 0.9 ? '🎯' :
                           confidence >= 0.8 ? '✅' :
                           confidence >= 0.7 ? '👍' : '⚡';

    // Create response header
    let responseText = `${confidenceEmoji} **Intelligent Response** (${confidenceLevel} Confidence)\n\n`;
    responseText += `**Processed by:** ${agentBadges}\n`;
    responseText += `**Analysis:** ${analysis?.intents?.join(', ') || 'General assistance'}\n`;
    responseText += `**Processing Time:** ${processingTime}ms\n\n`;
    responseText += `---\n\n`;

    // Add the main result content
    if (result.type === 'research_report') {
        responseText += `## 🔬 Research Report\n\n`;
        responseText += `**Topic:** ${result.query}\n\n`;
        responseText += `**Analysis:** ${result.analysis.summary}\n\n`;
        responseText += `**Key Findings:**\n`;
        result.analysis.keyFindings?.forEach((finding, index) => {
            responseText += `${index + 1}. ${finding}\n`;
        });
        responseText += `\n**Recommendations:**\n`;
        result.recommendations?.forEach((rec, index) => {
            responseText += `• ${rec}\n`;
        });
    } else if (result.type === 'code_generation') {
        responseText += `## 💻 Code Generation\n\n`;
        responseText += `**Language:** ${result.language}\n\n`;
        responseText += `**Generated Code:**\n\`\`\`${result.language}\n${result.code}\n\`\`\`\n\n`;
        if (result.tests) {
            responseText += `**Tests:**\n\`\`\`${result.language}\n${result.tests}\n\`\`\`\n\n`;
        }
        responseText += `**Best Practices:**\n`;
        result.bestPractices?.forEach(practice => {
            responseText += `• ${practice}\n`;
        });
    } else if (result.type === 'concept_explanation') {
        responseText += `## 🎓 Concept Explanation\n\n`;
        responseText += `**Concept:** ${result.concept}\n\n`;
        responseText += `**Explanation:**\n${result.explanation.detailed}\n\n`;
        responseText += `**Examples:**\n`;
        result.examples?.forEach((example, index) => {
            responseText += `${index + 1}. **${example.type}:** ${example.example}\n`;
        });
        responseText += `\n**Next Steps:**\n`;
        result.nextSteps?.forEach(step => {
            responseText += `• ${step}\n`;
        });
    } else if (result.type === 'creative_content') {
        responseText += `## 🎨 Creative Content\n\n`;
        responseText += `**${result.content.title}**\n\n`;
        responseText += `${result.content.introduction}\n\n`;
        responseText += `${result.content.body}\n\n`;
        responseText += `**Conclusion:** ${result.content.conclusion}\n\n`;
        if (result.content.callToAction) {
            responseText += `**Call to Action:** ${result.content.callToAction}\n\n`;
        }
        responseText += `**Creative Recommendations:**\n`;
        result.recommendations?.forEach(rec => {
            responseText += `• ${rec}\n`;
        });
    } else {
        // Generic response format
        responseText += result.message || result.content || 'Response generated successfully.';
    }

    // Add footer with MCP info
    responseText += `\n\n---\n\n`;
    responseText += `💡 **Powered by MCP (Model Context Protocol)**\n`;
    responseText += `This response was intelligently routed to specialized agents for optimal accuracy and relevance.`;

    return {
        text: responseText,
        confidence: confidence,
        agentsUsed: agentsUsed,
        processingTime: processingTime
    };
}

module.exports = {
    createSession,
    getSessions,
    getSessionDetails,
    saveChatHistory,
    handleStandardMessage,
    handleRagMessage,
    handleDeepSearch,
    handleEnhancedDeepSearch,
    handleEfficientDeepSearch,
    testDeepSearch,
    handleEfficientDeepSearchNew,
    handleEnhancedDeepSearchV2,
    formatMCPResponse,
    formatAgenticMCPResponse
};