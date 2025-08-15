/**
 * Agentic MCP Integration Layer
 * 
 * This service integrates the Agentic MCP system with ALL existing iMentor application services.
 * It provides a unified interface for agents to access and use every application feature.
 */

const AgenticMCPOrchestrator = require('./agenticMCPOrchestrator');

class AgenticMCPIntegration {
    constructor(serviceManager) {
        this.serviceManager = serviceManager;
        this.applicationServices = this.initializeApplicationServices();
        this.orchestrator = new AgenticMCPOrchestrator(this.applicationServices);
        
        console.log('[Agentic MCP Integration] Initialized with full application service access');
    }

    /**
     * Initialize all application services for agent access
     */
    initializeApplicationServices() {
        const services = this.serviceManager.getServices();
        
        return {
            // Core Services
            vectorStore: services.vectorStore,
            documentProcessor: services.documentProcessor,
            geminiAI: services.geminiAI,
            duckDuckGo: services.duckDuckGo,
            personalizationService: services.personalizationService,
            multiModelService: services.multiModelService,
            metricsCollector: services.metricsCollector,
            
            // RAG Service
            ragService: this.createRagServiceWrapper(),
            
            // Deep Search Services
            deepSearchService: this.createDeepSearchWrapper(),
            
            // Document Generation Services
            pdfGenerator: this.createPdfGeneratorWrapper(),
            pptGenerator: this.createPptGeneratorWrapper(),
            wordGenerator: this.createWordGeneratorWrapper(),
            
            // Enhanced Features
            enhancedContentGenerator: this.createEnhancedContentWrapper(),
            enhancedPersonalization: this.createPersonalizationWrapper(),
            performanceOptimizer: this.createPerformanceWrapper(),
            
            // File Management
            fileUpload: this.createFileUploadWrapper(),
            storage: this.createStorageWrapper(),
            
            // Monitoring and Analytics
            comprehensiveLogger: this.createLoggerWrapper(),
            monitoringService: this.createMonitoringWrapper(),
            
            // Additional Services
            podcastGenerator: this.createPodcastWrapper(),
            agenticProtocolManager: this.createProtocolWrapper()
        };
    }

    /**
     * Main entry point for agentic task processing
     */
    async processAgenticTask(query, context = {}) {
        try {
            console.log(`[Agentic MCP Integration] Processing: "${query.substring(0, 100)}..."`);
            
            // Enhance context with service manager data
            const enhancedContext = {
                ...context,
                serviceManager: this.serviceManager,
                timestamp: new Date().toISOString()
            };
            
            // Process through agentic orchestrator
            const result = await this.orchestrator.processAgenticTask(query, enhancedContext);
            
            // Log the interaction
            await this.logAgenticInteraction(query, result, enhancedContext);
            
            return result;
            
        } catch (error) {
            console.error('[Agentic MCP Integration] Processing failed:', error);
            throw error;
        }
    }

    /**
     * Service Wrappers - These provide agent-friendly interfaces to existing services
     */

    createRagServiceWrapper() {
        return {
            generateResponse: async (query, userId, history, systemPrompt) => {
                try {
                    const ragService = require('./ragService');
                    return await ragService.generateResponse(query, userId, history, systemPrompt);
                } catch (error) {
                    console.error('[Agentic MCP] RAG Service error:', error);
                    throw error;
                }
            },
            
            getRelevantDocuments: async (query, userId) => {
                try {
                    const ragService = require('./ragService');
                    return await ragService.getRelevantDocuments(query, userId);
                } catch (error) {
                    console.error('[Agentic MCP] RAG Document retrieval error:', error);
                    throw error;
                }
            }
        };
    }

    createDeepSearchWrapper() {
        return {
            performSearch: async (query, history = []) => {
                try {
                    // Try multiple deep search services
                    const services = [
                        () => this.tryEnhancedDeepSearchV2(query, history),
                        () => this.tryEfficientDeepSearch(query, history),
                        () => this.tryBasicDeepSearch(query, history)
                    ];
                    
                    for (const service of services) {
                        try {
                            const result = await service();
                            if (result && result.success) {
                                return result;
                            }
                        } catch (serviceError) {
                            console.log('[Agentic MCP] Deep search service failed, trying next...');
                        }
                    }
                    
                    throw new Error('All deep search services failed');
                    
                } catch (error) {
                    console.error('[Agentic MCP] Deep Search error:', error);
                    throw error;
                }
            }
        };
    }

    async tryEnhancedDeepSearchV2(query, history) {
        const EnhancedDeepSearchV2 = require('./enhancedDeepSearchV2');
        const service = new EnhancedDeepSearchV2();
        return await service.performSearch(query, history);
    }

    async tryEfficientDeepSearch(query, history) {
        const EfficientDeepSearch = require('./efficientDeepSearch');
        const service = new EfficientDeepSearch();
        return await service.performSearch(query, history);
    }

    async tryBasicDeepSearch(query, history) {
        const DeepSearchService = require('../deep_search/services/deepSearchService');
        const userId = 'agentic-user';
        const service = this.serviceManager.getDeepSearchService(userId);
        return await service.performSearch(query, history);
    }

    createPdfGeneratorWrapper() {
        return {
            generateReportPdf: async (topic, content, sources = []) => {
                try {
                    const pdfGenerator = require('./pdfGenerator');
                    return await pdfGenerator.generateReportPdf(topic, content, sources);
                } catch (error) {
                    console.error('[Agentic MCP] PDF Generator error:', error);
                    throw error;
                }
            }
        };
    }

    createPptGeneratorWrapper() {
        return {
            generatePresentation: async (topic, options = {}) => {
                try {
                    const { generateSimplePPTWithFallback } = require('./simplePptGenerator');
                    return await generateSimplePPTWithFallback(topic, options);
                } catch (error) {
                    // Fallback to standalone generator
                    const { generateStandalonePPTWithResult } = require('./standalonePptGenerator');
                    return await generateStandalonePPTWithResult(topic, options);
                }
            }
        };
    }

    createWordGeneratorWrapper() {
        return {
            generateDocument: async (topic, content = '') => {
                try {
                    const { generateWord } = require('./wordGenerator');
                    return await generateWord(topic, content);
                } catch (error) {
                    console.error('[Agentic MCP] Word Generator error:', error);
                    throw error;
                }
            }
        };
    }

    createEnhancedContentWrapper() {
        return {
            generateFromChatInput: async (input, type, options = {}) => {
                try {
                    const EnhancedContentGenerator = require('./enhancedContentGenerator');
                    const generator = new EnhancedContentGenerator();
                    return await generator.generateFromChatInput(input, type, options);
                } catch (error) {
                    console.error('[Agentic MCP] Enhanced Content Generator error:', error);
                    throw error;
                }
            }
        };
    }

    createPersonalizationWrapper() {
        return {
            getPersonalizedResponse: async (query, userId, context = {}) => {
                try {
                    const personalizationService = this.serviceManager.getServices().personalizationService;
                    if (personalizationService && personalizationService.getPersonalizedResponse) {
                        return await personalizationService.getPersonalizedResponse(query, userId, context);
                    }
                    return { response: query, personalized: false };
                } catch (error) {
                    console.error('[Agentic MCP] Personalization error:', error);
                    return { response: query, personalized: false };
                }
            }
        };
    }

    createPerformanceWrapper() {
        return {
            optimizeQuery: async (query, context = {}) => {
                try {
                    const PerformanceOptimizer = require('./performanceOptimizer');
                    const optimizer = new PerformanceOptimizer();
                    return await optimizer.optimizeQuery(query, context);
                } catch (error) {
                    console.error('[Agentic MCP] Performance Optimizer error:', error);
                    return query; // Return original query if optimization fails
                }
            }
        };
    }

    createFileUploadWrapper() {
        return {
            processFile: async (filePath, metadata = {}) => {
                try {
                    const documentProcessor = this.serviceManager.getServices().documentProcessor;
                    return await documentProcessor.processFile(filePath, metadata);
                } catch (error) {
                    console.error('[Agentic MCP] File Upload error:', error);
                    throw error;
                }
            }
        };
    }

    createStorageWrapper() {
        return {
            store: async (data, key) => {
                try {
                    const storage = require('./storage');
                    return await storage.store(data, key);
                } catch (error) {
                    console.error('[Agentic MCP] Storage error:', error);
                    throw error;
                }
            }
        };
    }

    createLoggerWrapper() {
        return {
            log: async (event, data, context = {}) => {
                try {
                    const logger = require('./comprehensiveLogger');
                    return await logger.log(event, data, context);
                } catch (error) {
                    console.error('[Agentic MCP] Logger error:', error);
                    // Don't throw for logging errors
                }
            }
        };
    }

    createMonitoringWrapper() {
        return {
            trackMetric: async (metric, value, context = {}) => {
                try {
                    const metricsCollector = this.serviceManager.getMetricsCollector();
                    if (metricsCollector && metricsCollector.trackMetric) {
                        return await metricsCollector.trackMetric(metric, value, context);
                    }
                } catch (error) {
                    console.error('[Agentic MCP] Monitoring error:', error);
                    // Don't throw for monitoring errors
                }
            }
        };
    }

    createPodcastWrapper() {
        return {
            generateScript: async (topic, options = {}) => {
                try {
                    const podcastGenerator = require('./podcastGenerator');
                    return await podcastGenerator.generateScript(topic, options);
                } catch (error) {
                    console.error('[Agentic MCP] Podcast Generator error:', error);
                    throw error;
                }
            }
        };
    }

    createProtocolWrapper() {
        return {
            executeProtocol: async (protocol, data, context = {}) => {
                try {
                    const AgenticProtocolManager = require('./agenticProtocolManager');
                    const manager = new AgenticProtocolManager();
                    return await manager.executeProtocol(protocol, data, context);
                } catch (error) {
                    console.error('[Agentic MCP] Protocol Manager error:', error);
                    throw error;
                }
            }
        };
    }

    /**
     * Log agentic interactions for analytics and learning
     */
    async logAgenticInteraction(query, result, context) {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                query: query,
                success: result.success,
                agentsUsed: result.agentsUsed || [],
                processingTime: result.processingTime,
                workflowType: result.workflowType,
                userId: context.userId,
                sessionId: context.sessionId
            };
            
            // Log to comprehensive logger if available
            const logger = this.applicationServices.comprehensiveLogger;
            if (logger && logger.log) {
                await logger.log('agentic_task_completed', logData, context);
            }
            
            // Track metrics if available
            const monitoring = this.applicationServices.monitoringService;
            if (monitoring && monitoring.trackMetric) {
                await monitoring.trackMetric('agentic_task_success_rate', result.success ? 1 : 0, context);
                await monitoring.trackMetric('agentic_task_processing_time', result.processingTime, context);
            }
            
        } catch (error) {
            console.error('[Agentic MCP Integration] Logging failed:', error);
            // Don't throw for logging failures
        }
    }

    /**
     * Get system status and metrics
     */
    getSystemStatus() {
        return {
            orchestrator: {
                agents: this.orchestrator.agents.size,
                activeWorkflows: this.orchestrator.activeWorkflows.size,
                performance: this.orchestrator.performanceMetrics
            },
            services: {
                available: Object.keys(this.applicationServices).length,
                serviceManager: !!this.serviceManager,
                integration: 'active'
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get available capabilities
     */
    getCapabilities() {
        const capabilities = [];
        
        // Collect capabilities from all agents
        for (const [agentId, agent] of this.orchestrator.agents) {
            capabilities.push({
                agent: agent.name,
                specialization: agent.specialization,
                capabilities: agent.capabilities,
                tools: agent.tools
            });
        }
        
        return {
            agents: capabilities,
            services: Object.keys(this.applicationServices),
            workflows: ['single_agent', 'multi_agent_workflow'],
            integrations: 'full_application_access'
        };
    }
}

module.exports = AgenticMCPIntegration;
