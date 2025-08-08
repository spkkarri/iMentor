// server/services/intelligentMultiLLM.js
// Intelligent Multi-LLM Router - Routes queries to optimal models based on conversation type

const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');
const OllamaConnector = require('./modelConnectors/ollamaConnector');
const DeepSeekConnector = require('./modelConnectors/deepseekConnector');
const QwenConnector = require('./modelConnectors/qwenConnector');
const userOllamaConnector = require('./userOllamaConnector');
const userSpecificAI = require('./userSpecificAI');

class IntelligentMultiLLM {
    constructor() {
        this.models = new Map();
        this.conversationAnalyzer = null;
        this.routingStats = {
            totalQueries: 0,
            routingDecisions: {},
            modelPerformance: {},
            userSatisfaction: {}
        };
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('🧠 Initializing Intelligent Multi-LLM System...');

            // Initialize conversation analyzer (using Gemini for now)
            const geminiService = new GeminiService();
            await geminiService.initialize();
            this.conversationAnalyzer = new GeminiAI(geminiService);

            // Initialize model connectors
            this.connectors = {
                ollama: new OllamaConnector(),
                deepseek: new DeepSeekConnector(),
                qwen: new QwenConnector(),
                gemini: this.conversationAnalyzer // Reuse Gemini for analysis and fallback
            };

            // Define available models with their specializations
            this.models = new Map([
                ['llama3.2', {
                    name: 'Llama 3.2',
                    specialties: ['general_chat', 'casual_conversation', 'creative_writing', 'storytelling'],
                    strengths: ['Natural conversation', 'Creative tasks', 'General knowledge'],
                    connector: 'ollama',
                    model: 'llama3.2:latest',
                    priority: 1,
                    available: false
                }],
                ['deepseek', {
                    name: 'DeepSeek',
                    specialties: ['reasoning', 'problem_solving', 'analysis', 'logic', 'mathematics'],
                    strengths: ['Complex reasoning', 'Mathematical problems', 'Logical analysis'],
                    connector: 'deepseek',
                    model: 'deepseek-chat',
                    priority: 1,
                    available: false
                }],
                ['qwen', {
                    name: 'Qwen',
                    specialties: ['technical', 'programming', 'code_review', 'debugging', 'system_design'],
                    strengths: ['Technical discussions', 'Code generation', 'Programming help'],
                    connector: 'qwen',
                    model: 'qwen-turbo',
                    priority: 1,
                    available: false
                }],
                ['gemini', {
                    name: 'Gemini Pro',
                    specialties: ['research', 'comprehensive_analysis', 'factual_queries', 'web_search'],
                    strengths: ['Research tasks', 'Factual accuracy', 'Comprehensive responses'],
                    connector: 'gemini',
                    model: 'gemini-2.0-flash',
                    priority: 2,
                    available: true // Always available as fallback
                }]
            ]);

            // Check model availability (placeholder - would implement actual checks)
            await this.checkModelAvailability();

            this.isInitialized = true;
            console.log('✅ Intelligent Multi-LLM System initialized');
            this.logAvailableModels();

        } catch (error) {
            console.error('❌ Failed to initialize Intelligent Multi-LLM:', error);
            throw error;
        }
    }

    /**
     * Analyze conversation type and route to optimal model
     */
    async routeQuery(query, conversationHistory = [], userPreferences = {}) {
        await this.initialize();

        try {
            console.log(`🔍 Analyzing query for optimal model routing: "${query.substring(0, 50)}..."`);

            // Analyze conversation type
            const conversationType = await this.analyzeConversationType(query, conversationHistory);
            console.log(`📊 Detected conversation type: ${conversationType.type} (confidence: ${conversationType.confidence})`);

            // Select optimal model
            const modelSelection = this.selectOptimalModel(conversationType, userPreferences);
            console.log(`🎯 Selected model: ${modelSelection.model.name} (${modelSelection.reasoning})`);

            // Update routing stats
            this.updateRoutingStats(conversationType, modelSelection);

            return {
                selectedModel: modelSelection.model,
                conversationType: conversationType,
                reasoning: modelSelection.reasoning,
                confidence: conversationType.confidence,
                fallbackModels: modelSelection.fallbacks
            };

        } catch (error) {
            console.error('❌ Query routing failed:', error);
            return this.getFallbackRouting(query);
        }
    }

    /**
     * Analyze conversation type using AI
     */
    async analyzeConversationType(query, conversationHistory = []) {
        const analysisPrompt = `Analyze this conversation to determine the optimal AI model type needed.

Current Query: "${query}"

Recent Conversation History:
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Analyze and classify this conversation into one of these types:

1. **general_chat** - Casual conversation, greetings, general questions
2. **reasoning** - Complex problem solving, logical analysis, mathematical reasoning
3. **technical** - Programming, code review, technical discussions, system design
4. **creative_writing** - Storytelling, creative content, poetry, fiction
5. **research** - Factual queries, research tasks, comprehensive analysis
6. **problem_solving** - Step-by-step solutions, troubleshooting, debugging

Consider:
- The complexity and nature of the query
- The conversation context and flow
- The type of response that would be most helpful

Return in JSON format:
{
  "type": "conversation_type",
  "confidence": 0.85,
  "reasoning": "Why this classification was chosen",
  "secondaryTypes": ["alternative_type1", "alternative_type2"],
  "complexity": "low|medium|high",
  "expectedResponseStyle": "conversational|analytical|technical|creative"
}`;

        try {
            const result = await this.conversationAnalyzer.generateText(analysisPrompt);

            // Clean the result to extract JSON from markdown code blocks
            let cleanResult = result.trim();
            if (cleanResult.startsWith('```json')) {
                cleanResult = cleanResult.replace(/```json\s*/, '').replace(/```\s*$/, '');
            } else if (cleanResult.startsWith('```')) {
                cleanResult = cleanResult.replace(/```\s*/, '').replace(/```\s*$/, '');
            }

            return JSON.parse(cleanResult);
        } catch (error) {
            console.warn('Conversation analysis failed, using fallback classification:', error.message);
            return this.getFallbackClassification(query);
        }
    }

    /**
     * Select the optimal model based on conversation type
     */
    selectOptimalModel(conversationType, userPreferences = {}) {
        const availableModels = Array.from(this.models.entries())
            .filter(([key, model]) => model.available)
            .map(([key, model]) => ({ key, ...model }));

        if (availableModels.length === 0) {
            return this.getFallbackModelSelection();
        }

        // Score models based on specialties match
        const scoredModels = availableModels.map(model => {
            let score = 0;
            
            // Primary specialty match
            if (model.specialties.includes(conversationType.type)) {
                score += 10;
            }
            
            // Secondary specialty match
            if (conversationType.secondaryTypes) {
                conversationType.secondaryTypes.forEach(type => {
                    if (model.specialties.includes(type)) {
                        score += 5;
                    }
                });
            }
            
            // Confidence bonus
            score += conversationType.confidence * 3;
            
            // Priority bonus (lower priority number = higher bonus)
            score += (3 - model.priority);
            
            // User preference bonus
            if (userPreferences.preferredModel === model.key) {
                score += 8;
            }

            return { ...model, score };
        });

        // Sort by score (highest first)
        scoredModels.sort((a, b) => b.score - a.score);

        const selectedModel = scoredModels[0];
        const fallbacks = scoredModels.slice(1, 3);

        return {
            model: selectedModel,
            reasoning: this.generateSelectionReasoning(selectedModel, conversationType),
            fallbacks: fallbacks,
            score: selectedModel.score
        };
    }

    /**
     * Generate reasoning for model selection
     */
    generateSelectionReasoning(model, conversationType) {
        const reasons = [];
        
        if (model.specialties.includes(conversationType.type)) {
            reasons.push(`specialized in ${conversationType.type}`);
        }
        
        if (conversationType.confidence > 0.8) {
            reasons.push(`high confidence classification (${conversationType.confidence})`);
        }
        
        if (model.priority === 1) {
            reasons.push('top-tier model');
        }

        return reasons.length > 0 ? reasons.join(', ') : 'best available option';
    }

    /**
     * Check availability of external models
     */
    async checkModelAvailability() {
        console.log('🔍 Checking model availability...');

        // Initialize and check each connector
        for (const [connectorName, connector] of Object.entries(this.connectors)) {
            if (connectorName === 'gemini') continue; // Already initialized

            try {
                await connector.initialize();
                console.log(`✅ ${connectorName} connector initialized`);
            } catch (error) {
                console.warn(`⚠️ ${connectorName} connector failed:`, error.message);
            }
        }

        // Update model availability based on connector status
        for (const [key, model] of this.models) {
            if (key === 'gemini') {
                model.available = true; // Always available
            } else {
                const connector = this.connectors[model.connector];
                model.available = connector && connector.isAvailable;
            }
        }
    }

    /**
     * Log available models
     */
    logAvailableModels() {
        console.log('📋 Available Models:');
        for (const [key, model] of this.models) {
            const status = model.available ? '✅' : '❌';
            console.log(`   ${status} ${model.name} - ${model.specialties.join(', ')}`);
        }
    }

    /**
     * Update routing statistics
     */
    updateRoutingStats(conversationType, modelSelection) {
        this.routingStats.totalQueries++;
        
        if (!this.routingStats.routingDecisions[conversationType.type]) {
            this.routingStats.routingDecisions[conversationType.type] = 0;
        }
        this.routingStats.routingDecisions[conversationType.type]++;
        
        if (!this.routingStats.modelPerformance[modelSelection.model.key]) {
            this.routingStats.modelPerformance[modelSelection.model.key] = 0;
        }
        this.routingStats.modelPerformance[modelSelection.model.key]++;
    }

    /**
     * Enhanced fallback classification when analysis fails
     */
    getFallbackClassification(query) {
        const lowerQuery = query.toLowerCase();

        // Technical/Programming keywords
        const technicalKeywords = ['code', 'program', 'debug', 'function', 'python', 'javascript', 'java', 'c++', 'html', 'css', 'api', 'database', 'algorithm', 'variable', 'loop', 'array', 'object'];
        if (technicalKeywords.some(keyword => lowerQuery.includes(keyword))) {
            return {
                type: 'technical',
                confidence: 0.7,
                reasoning: 'keyword-based technical classification',
                secondaryTypes: ['programming'],
                complexity: 'medium',
                expectedResponseStyle: 'technical'
            };
        }

        // Reasoning/Math keywords
        const reasoningKeywords = ['solve', 'calculate', 'math', 'equation', 'step by step', 'logic', 'analyze', 'problem', 'reasoning', 'proof', 'theorem'];
        if (reasoningKeywords.some(keyword => lowerQuery.includes(keyword))) {
            return {
                type: 'reasoning',
                confidence: 0.7,
                reasoning: 'keyword-based reasoning classification',
                secondaryTypes: ['problem_solving'],
                complexity: 'medium',
                expectedResponseStyle: 'analytical'
            };
        }

        // Creative writing keywords
        const creativeKeywords = ['story', 'write', 'creative', 'poem', 'fiction', 'character', 'plot', 'narrative', 'imagine', 'create'];
        if (creativeKeywords.some(keyword => lowerQuery.includes(keyword))) {
            return {
                type: 'creative_writing',
                confidence: 0.7,
                reasoning: 'keyword-based creative classification',
                secondaryTypes: ['storytelling'],
                complexity: 'medium',
                expectedResponseStyle: 'creative'
            };
        }

        // Research keywords
        const researchKeywords = ['research', 'latest', 'developments', 'what is', 'explain', 'information', 'facts', 'study', 'analysis', 'report'];
        if (researchKeywords.some(keyword => lowerQuery.includes(keyword))) {
            return {
                type: 'research',
                confidence: 0.6,
                reasoning: 'keyword-based research classification',
                secondaryTypes: ['factual_queries'],
                complexity: 'medium',
                expectedResponseStyle: 'analytical'
            };
        }

        // Casual conversation keywords
        const casualKeywords = ['hello', 'hi', 'how are you', 'thanks', 'thank you', 'good morning', 'good evening', 'bye', 'goodbye'];
        if (casualKeywords.some(keyword => lowerQuery.includes(keyword))) {
            return {
                type: 'general_chat',
                confidence: 0.8,
                reasoning: 'keyword-based casual conversation classification',
                secondaryTypes: ['casual_conversation'],
                complexity: 'low',
                expectedResponseStyle: 'conversational'
            };
        }

        return {
            type: 'general_chat',
            confidence: 0.5,
            reasoning: 'default classification',
            secondaryTypes: [],
            complexity: 'medium',
            expectedResponseStyle: 'conversational'
        };
    }

    /**
     * Fallback routing when main routing fails
     */
    getFallbackRouting(query) {
        const geminiModel = this.models.get('gemini');
        return {
            selectedModel: geminiModel,
            conversationType: { type: 'general_chat', confidence: 0.3 },
            reasoning: 'fallback to Gemini due to routing failure',
            confidence: 0.3,
            fallbackModels: []
        };
    }

    /**
     * Fallback model selection when no models available
     */
    getFallbackModelSelection() {
        const geminiModel = this.models.get('gemini');
        return {
            model: geminiModel,
            reasoning: 'fallback to Gemini - only available model',
            fallbacks: [],
            score: 0
        };
    }

    /**
     * Generate response using the selected model
     */
    async generateResponse(query, conversationHistory = [], userPreferences = {}) {
        try {
            // Route query to optimal model
            const routing = await this.routeQuery(query, conversationHistory, userPreferences);

            console.log(`🎯 Using ${routing.selectedModel.name} for response generation`);

            // Get the appropriate connector
            const connector = this.connectors[routing.selectedModel.connector];

            if (!connector || !routing.selectedModel.available) {
                throw new Error(`Model ${routing.selectedModel.name} not available`);
            }

            // Generate response based on connector type
            let response;
            if (routing.selectedModel.connector === 'gemini') {
                // Use user-specific Gemini service
                const userId = userPreferences.userId;
                if (userId) {
                    const userServices = await userSpecificAI.getUserAIServices(userId);
                    if (userServices.gemini) {
                        response = await userServices.gemini.generateChatResponse(
                            query,
                            [],
                            this.formatConversationHistoryForGemini(conversationHistory),
                            this.getSystemPromptForType(routing.conversationType.type)
                        );
                    } else {
                        throw new Error('Gemini service not available for user');
                    }
                } else {
                    // Fallback to default connector
                    response = await connector.generateChatResponse(
                        query,
                        [],
                        conversationHistory,
                        this.getSystemPromptForType(routing.conversationType.type)
                    );
                }

                return {
                    response: response.response,
                    model: routing.selectedModel.name,
                    conversationType: routing.conversationType.type,
                    confidence: routing.confidence,
                    reasoning: routing.reasoning,
                    followUpQuestions: response.followUpQuestions || [],
                    metadata: {
                        modelUsed: routing.selectedModel.name,
                        conversationType: routing.conversationType.type,
                        routingConfidence: routing.confidence,
                        routingReasoning: routing.reasoning
                    }
                };
            } else {
                // Use external model connectors
                if (routing.selectedModel.connector === 'ollama') {
                    // Use user-specific Ollama connector
                    const userId = userPreferences.userId;
                    if (userId) {
                        response = await userOllamaConnector.generateUserConversationResponse(
                            userId,
                            this.formatConversationHistory(conversationHistory, query),
                            {
                                model: routing.selectedModel.model,
                                conversationType: routing.conversationType.type,
                                temperature: this.getTemperatureForType(routing.conversationType.type),
                                max_tokens: 2048
                            }
                        );
                    } else {
                        throw new Error('User ID required for Ollama connector');
                    }
                } else {
                    // Use user-specific external model connectors (DeepSeek, Qwen)
                    const userId = userPreferences.userId;
                    if (userId && (routing.selectedModel.connector === 'deepseek' || routing.selectedModel.connector === 'qwen')) {
                        const userServices = await userSpecificAI.getUserAIServices(userId);
                        const userConnector = userServices[routing.selectedModel.connector];

                        if (userConnector) {
                            response = await userConnector.generateConversationResponse(
                                this.formatConversationHistory(conversationHistory, query),
                                routing.selectedModel.model,
                                {
                                    conversationType: routing.conversationType.type,
                                    temperature: this.getTemperatureForType(routing.conversationType.type),
                                    max_tokens: 2048
                                }
                            );
                        } else {
                            throw new Error(`${routing.selectedModel.connector} service not available for user`);
                        }
                    } else {
                        // Fallback to default connector
                        response = await connector.generateConversationResponse(
                            this.formatConversationHistory(conversationHistory, query),
                            routing.selectedModel.model,
                            {
                                conversationType: routing.conversationType.type,
                                temperature: this.getTemperatureForType(routing.conversationType.type),
                                max_tokens: 2048
                            }
                        );
                    }
                }

                return {
                    response: response.response,
                    model: routing.selectedModel.name,
                    conversationType: routing.conversationType.type,
                    confidence: routing.confidence,
                    reasoning: routing.reasoning,
                    followUpQuestions: this.generateFollowUpQuestions(query, routing.conversationType.type),
                    metadata: {
                        modelUsed: routing.selectedModel.name,
                        conversationType: routing.conversationType.type,
                        routingConfidence: routing.confidence,
                        routingReasoning: routing.reasoning,
                        modelResponse: response
                    }
                };
            }

        } catch (error) {
            console.error('Multi-LLM response generation failed:', error);

            // Fallback to Gemini
            console.log('🔄 Falling back to Gemini...');
            return await this.generateFallbackResponse(query, conversationHistory);
        }
    }

    /**
     * Format conversation history for external models
     */
    formatConversationHistory(history, currentQuery) {
        const messages = [];

        // Add conversation history
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content || msg.parts?.[0]?.text || ''
            });
        });

        // Add current query
        messages.push({
            role: 'user',
            content: currentQuery
        });

        return messages;
    }

    /**
     * Format conversation history for Gemini (different format)
     */
    formatConversationHistoryForGemini(history) {
        return history.map(msg => ({
            role: msg.role,
            parts: msg.parts || [{ text: msg.content || '' }]
        }));
    }

    /**
     * Get system prompt for conversation type
     */
    getSystemPromptForType(conversationType) {
        switch (conversationType) {
            case 'general_chat':
                return 'You are a helpful AI assistant. Be conversational, friendly, and engaging.';
            case 'reasoning':
                return 'You are an AI assistant specialized in logical reasoning and problem-solving. Provide step-by-step analysis.';
            case 'technical':
                return 'You are a technical AI assistant. Provide accurate technical information with examples and best practices.';
            case 'creative_writing':
                return 'You are a creative AI assistant. Help with storytelling, creative writing, and imaginative content.';
            case 'research':
                return 'You are a research AI assistant. Provide comprehensive, well-sourced information and analysis.';
            default:
                return 'You are a helpful AI assistant.';
        }
    }

    /**
     * Get temperature setting for conversation type
     */
    getTemperatureForType(conversationType) {
        switch (conversationType) {
            case 'creative_writing':
                return 0.8; // Higher creativity
            case 'general_chat':
                return 0.7; // Balanced
            case 'reasoning':
            case 'technical':
                return 0.1; // Lower for accuracy
            default:
                return 0.5; // Default
        }
    }

    /**
     * Generate follow-up questions based on conversation type
     */
    generateFollowUpQuestions(query, conversationType) {
        const baseQuestions = [
            "Would you like me to explain any part in more detail?",
            "Do you have any follow-up questions?",
            "Is there anything else I can help you with?"
        ];

        switch (conversationType) {
            case 'technical':
                return [
                    "Would you like to see a code example?",
                    "Do you need help implementing this?",
                    "Are there any specific technical details you'd like me to clarify?"
                ];
            case 'reasoning':
                return [
                    "Would you like me to break down any step further?",
                    "Do you want to explore alternative approaches?",
                    "Are there any assumptions you'd like me to verify?"
                ];
            case 'creative_writing':
                return [
                    "Would you like me to continue the story?",
                    "Do you want to explore different creative directions?",
                    "Would you like suggestions for character development?"
                ];
            default:
                return baseQuestions;
        }
    }

    /**
     * Generate fallback response using Gemini
     */
    async generateFallbackResponse(query, conversationHistory) {
        try {
            const geminiConnector = this.connectors.gemini;

            // Format conversation history properly for Gemini
            const formattedHistory = conversationHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            }));

            const response = await geminiConnector.generateChatResponse(
                query,
                [],
                formattedHistory,
                'You are a helpful AI assistant.'
            );

            return {
                response: response.response,
                model: 'Gemini Pro (Fallback)',
                conversationType: 'general_chat',
                confidence: 0.5,
                reasoning: 'fallback due to routing failure',
                followUpQuestions: response.followUpQuestions || [],
                metadata: {
                    modelUsed: 'gemini-fallback',
                    conversationType: 'general_chat',
                    routingConfidence: 0.5,
                    routingReasoning: 'fallback'
                }
            };
        } catch (error) {
            console.error('Even fallback failed:', error);
            return {
                response: "I apologize, but I'm experiencing technical difficulties. Please try again later.",
                model: 'Error Handler',
                conversationType: 'error',
                confidence: 0.1,
                reasoning: 'system error',
                followUpQuestions: [],
                metadata: { error: error.message }
            };
        }
    }

    /**
     * Get routing statistics
     */
    getRoutingStats() {
        return {
            ...this.routingStats,
            availableModels: Array.from(this.models.entries())
                .filter(([key, model]) => model.available)
                .map(([key, model]) => ({ key, name: model.name, specialties: model.specialties })),
            connectorStatus: Object.entries(this.connectors).map(([name, connector]) => ({
                name,
                available: connector.isAvailable || (name === 'gemini'),
                status: connector.getStatus ? connector.getStatus() : { name }
            }))
        };
    }
}

module.exports = IntelligentMultiLLM;
