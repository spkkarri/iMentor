/**
 * Agentic MCP Orchestrator - Complete Integration with iMentor Application
 * 
 * This orchestrator creates intelligent agents that can autonomously use ALL application features:
 * - RAG Service (Document Analysis)
 * - Deep Search (Web Research) 
 * - Document Generation (PDF, PPT, Word)
 * - File Upload & Processing
 * - Enhanced Content Generation
 * - Multi-LLM Routing
 * - Performance Monitoring
 * - Personalization
 * - Analytics & Logging
 * 
 * Agents work together to complete complex tasks using the full application ecosystem.
 */

const { AgenticAgent } = require('./agenticMCPSystem');
const EventEmitter = require('events');

class AgenticMCPOrchestrator extends EventEmitter {
    constructor(applicationServices) {
        super();
        
        // Store references to ALL application services
        this.services = applicationServices;
        
        // Agent management
        this.agents = new Map();
        this.taskQueue = [];
        this.activeWorkflows = new Map();
        
        // Performance tracking
        this.performanceMetrics = {
            totalTasks: 0,
            successfulTasks: 0,
            averageResponseTime: 0,
            agentUtilization: {},
            toolUsage: {},
            workflowSuccess: 0
        };
        
        // Learning and adaptation
        this.learningData = new Map();
        this.workflowTemplates = new Map();
        
        this.initializeAgenticAgents();
        this.startPerformanceMonitoring();
        
        console.log('[Agentic MCP] Orchestrator initialized with full application integration');
    }

    /**
     * Initialize specialized agentic agents with access to all application features
     */
    initializeAgenticAgents() {
        const agentConfigs = [
            {
                id: 'research_analyst',
                name: 'Research Analyst Agent',
                specialization: 'research_and_analysis',
                capabilities: [
                    'web_research', 'document_analysis', 'data_synthesis', 
                    'report_generation', 'source_verification'
                ],
                tools: [
                    'deepSearch', 'ragService', 'pdfGenerator', 
                    'enhancedContentGenerator', 'documentProcessor'
                ]
            },
            {
                id: 'content_creator',
                name: 'Content Creator Agent',
                specialization: 'content_generation',
                capabilities: [
                    'document_creation', 'presentation_design', 'content_optimization',
                    'multi_format_generation', 'creative_writing'
                ],
                tools: [
                    'pdfGenerator', 'pptGenerator', 'wordGenerator',
                    'enhancedContentGenerator', 'podcastGenerator'
                ]
            },
            {
                id: 'document_processor',
                name: 'Document Processor Agent',
                specialization: 'document_management',
                capabilities: [
                    'file_upload', 'document_processing', 'content_extraction',
                    'metadata_analysis', 'format_conversion'
                ],
                tools: [
                    'fileUpload', 'documentProcessor', 'ragService',
                    'vectorStore', 'storage'
                ]
            },
            {
                id: 'learning_assistant',
                name: 'Learning Assistant Agent',
                specialization: 'educational_support',
                capabilities: [
                    'concept_explanation', 'personalized_learning', 'assessment_creation',
                    'study_planning', 'progress_tracking'
                ],
                tools: [
                    'ragService', 'enhancedPersonalization', 'multiModelService',
                    'enhancedContentGenerator', 'performanceOptimizer'
                ]
            },
            {
                id: 'workflow_coordinator',
                name: 'Workflow Coordinator Agent',
                specialization: 'task_orchestration',
                capabilities: [
                    'workflow_planning', 'agent_coordination', 'task_delegation',
                    'quality_assurance', 'performance_optimization'
                ],
                tools: [
                    'agenticProtocolManager', 'performanceOptimizer', 'metricsCollector',
                    'comprehensiveLogger', 'monitoringService'
                ]
            }
        ];

        agentConfigs.forEach(config => {
            const agent = new AgenticAgent(config, this.services);
            this.agents.set(agent.id, agent);
            this.performanceMetrics.agentUtilization[agent.id] = 0;
            
            // Listen to agent events
            agent.on('taskCompleted', (data) => this.handleAgentTaskCompleted(data));
            agent.on('taskFailed', (data) => this.handleAgentTaskFailed(data));
        });

        console.log(`[Agentic MCP] Initialized ${agentConfigs.length} specialized agentic agents`);
    }

    /**
     * Main entry point for agentic task processing
     */
    async processAgenticTask(query, context = {}) {
        const startTime = Date.now();
        this.performanceMetrics.totalTasks++;

        try {
            console.log(`[Agentic MCP] Processing agentic task: "${query.substring(0, 100)}..."`);

            // Analyze task and create execution strategy
            const taskAnalysis = await this.analyzeAgenticTask(query, context);
            
            // Determine if single agent or multi-agent workflow is needed
            const executionStrategy = await this.determineExecutionStrategy(taskAnalysis, context);
            
            // Execute the task using appropriate strategy
            const result = await this.executeAgenticStrategy(executionStrategy, taskAnalysis, context);
            
            // Update performance metrics
            this.performanceMetrics.successfulTasks++;
            this.updateResponseTime(Date.now() - startTime);
            
            // Learn from this interaction
            this.updateLearningData(query, taskAnalysis, result, context);

            return {
                success: true,
                result: result,
                analysis: taskAnalysis,
                strategy: executionStrategy,
                processingTime: Date.now() - startTime,
                agentsUsed: result.agentsUsed || [],
                confidence: result.confidence || 0.85,
                workflowType: 'agentic'
            };

        } catch (error) {
            console.error('[Agentic MCP] Task processing failed:', error);
            
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime,
                fallbackSuggestion: this.generateFallbackSuggestion(query)
            };
        }
    }

    /**
     * Analyze task to determine requirements and complexity
     */
    async analyzeAgenticTask(query, context) {
        const analysis = {
            query: query,
            intents: this.detectAgenticIntents(query),
            complexity: this.assessTaskComplexity(query, context),
            requiredServices: this.identifyRequiredServices(query),
            estimatedSteps: this.estimateWorkflowSteps(query),
            priority: this.calculateTaskPriority(query, context),
            agentRequirements: this.determineAgentRequirements(query)
        };

        return analysis;
    }

    /**
     * Detect agentic intents that require application feature integration
     */
    detectAgenticIntents(query) {
        const intents = [];
        const queryLower = query.toLowerCase();
        
        // Research and analysis intents
        if (queryLower.match(/research|investigate|analyze|study|examine/)) {
            intents.push('research_analysis');
        }
        
        // Document processing intents
        if (queryLower.match(/upload|process|extract|analyze.*document/)) {
            intents.push('document_processing');
        }
        
        // Content generation intents
        if (queryLower.match(/generate|create|write|produce.*(?:report|presentation|document)/)) {
            intents.push('content_generation');
        }
        
        // Learning and education intents
        if (queryLower.match(/learn|teach|explain|understand|study/)) {
            intents.push('educational_support');
        }
        
        // Workflow and automation intents
        if (queryLower.match(/automate|workflow|process.*and.*(?:generate|create|analyze)/)) {
            intents.push('workflow_automation');
        }
        
        // Multi-step task intents
        if (queryLower.match(/(?:research.*and.*create)|(?:analyze.*and.*generate)|(?:find.*and.*summarize)/)) {
            intents.push('multi_step_workflow');
        }

        return intents.length > 0 ? intents : ['general_assistance'];
    }

    /**
     * Identify which application services are needed
     */
    identifyRequiredServices(query) {
        const services = [];
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('search') || queryLower.includes('research')) {
            services.push('deepSearch');
        }
        
        if (queryLower.includes('document') || queryLower.includes('file')) {
            services.push('ragService', 'documentProcessor');
        }
        
        if (queryLower.includes('generate') || queryLower.includes('create')) {
            services.push('enhancedContentGenerator');
        }
        
        if (queryLower.includes('pdf') || queryLower.includes('report')) {
            services.push('pdfGenerator');
        }
        
        if (queryLower.includes('presentation') || queryLower.includes('ppt')) {
            services.push('pptGenerator');
        }
        
        if (queryLower.includes('personalize') || queryLower.includes('customize')) {
            services.push('enhancedPersonalization');
        }
        
        if (queryLower.includes('monitor') || queryLower.includes('track')) {
            services.push('performanceOptimizer', 'metricsCollector');
        }

        return services;
    }

    /**
     * Determine execution strategy (single agent vs multi-agent workflow)
     */
    async determineExecutionStrategy(analysis, context) {
        const strategy = {
            type: 'single_agent',
            primaryAgent: null,
            workflow: [],
            collaboration: false,
            estimatedTime: 0
        };

        // Multi-agent workflow conditions
        if (analysis.intents.includes('multi_step_workflow') || 
            analysis.complexity > 0.7 || 
            analysis.requiredServices.length > 3) {
            
            strategy.type = 'multi_agent_workflow';
            strategy.collaboration = true;
            strategy.workflow = await this.createMultiAgentWorkflow(analysis, context);
        } else {
            // Single agent execution
            strategy.primaryAgent = this.selectOptimalAgent(analysis);
            strategy.workflow = [{ agent: strategy.primaryAgent, task: analysis.query }];
        }

        strategy.estimatedTime = this.estimateWorkflowTime(strategy);
        
        return strategy;
    }

    /**
     * Execute the determined strategy
     */
    async executeAgenticStrategy(strategy, analysis, context) {
        if (strategy.type === 'multi_agent_workflow') {
            return await this.executeMultiAgentWorkflow(strategy, analysis, context);
        } else {
            return await this.executeSingleAgentTask(strategy, analysis, context);
        }
    }

    /**
     * Execute single agent task
     */
    async executeSingleAgentTask(strategy, analysis, context) {
        const agent = this.agents.get(strategy.primaryAgent);
        if (!agent) {
            throw new Error(`Agent ${strategy.primaryAgent} not found`);
        }

        const task = {
            id: require('uuid').v4(),
            type: analysis.intents[0] || 'general_assistance',
            query: analysis.query,
            complexity: analysis.complexity,
            priority: analysis.priority,
            userId: context.userId,
            sessionId: context.sessionId,
            selectedModel: context.selectedModel || 'gemini-flash'
        };

        this.performanceMetrics.agentUtilization[agent.id]++;
        
        const result = await agent.processTask(task, context);
        result.agentsUsed = [agent.name];
        result.workflowType = 'single_agent';
        
        return result;
    }

    /**
     * Execute multi-agent workflow
     */
    async executeMultiAgentWorkflow(strategy, analysis, context) {
        const workflowId = require('uuid').v4();
        const workflowResults = {
            id: workflowId,
            type: 'multi_agent_workflow',
            steps: [],
            agentsUsed: [],
            outputs: [],
            finalResult: null
        };

        this.activeWorkflows.set(workflowId, workflowResults);

        try {
            for (const workflowStep of strategy.workflow) {
                const agent = this.agents.get(workflowStep.agent);
                if (!agent) {
                    throw new Error(`Agent ${workflowStep.agent} not found`);
                }

                console.log(`[Agentic MCP] Executing workflow step with agent: ${agent.name}`);

                const task = {
                    id: require('uuid').v4(),
                    type: workflowStep.type || analysis.intents[0],
                    query: workflowStep.task,
                    complexity: analysis.complexity,
                    priority: analysis.priority,
                    userId: context.userId,
                    sessionId: context.sessionId,
                    selectedModel: context.selectedModel || 'gemini-flash',
                    workflowContext: workflowResults.outputs // Pass previous results
                };

                const stepResult = await agent.processTask(task, context);
                
                workflowResults.steps.push({
                    agent: agent.name,
                    task: workflowStep.task,
                    result: stepResult,
                    timestamp: new Date().toISOString()
                });
                
                workflowResults.agentsUsed.push(agent.name);
                workflowResults.outputs.push(stepResult);
                
                this.performanceMetrics.agentUtilization[agent.id]++;
            }

            // Synthesize final workflow result
            workflowResults.finalResult = await this.synthesizeWorkflowResult(workflowResults, analysis);
            
            this.performanceMetrics.workflowSuccess++;
            
            return {
                success: true,
                result: workflowResults.finalResult,
                workflow: workflowResults,
                agentsUsed: [...new Set(workflowResults.agentsUsed)],
                confidence: this.calculateWorkflowConfidence(workflowResults),
                workflowType: 'multi_agent'
            };

        } catch (error) {
            console.error('[Agentic MCP] Multi-agent workflow failed:', error);
            throw error;
        } finally {
            this.activeWorkflows.delete(workflowId);
        }
    }

    /**
     * Create multi-agent workflow based on task analysis
     */
    async createMultiAgentWorkflow(analysis, context) {
        const workflow = [];
        
        // Example workflow for research and document generation
        if (analysis.intents.includes('research_analysis') && 
            analysis.intents.includes('content_generation')) {
            
            workflow.push({
                agent: 'research_analyst',
                task: `Research and analyze: ${analysis.query}`,
                type: 'research_and_document'
            });
            
            workflow.push({
                agent: 'content_creator',
                task: `Create comprehensive document based on research findings`,
                type: 'content_creation'
            });
        }
        
        // Example workflow for document processing and analysis
        else if (analysis.intents.includes('document_processing')) {
            workflow.push({
                agent: 'document_processor',
                task: `Process and analyze documents for: ${analysis.query}`,
                type: 'document_analysis'
            });
            
            workflow.push({
                agent: 'learning_assistant',
                task: `Provide educational insights and explanations`,
                type: 'educational_support'
            });
        }
        
        // Default workflow
        else {
            workflow.push({
                agent: 'workflow_coordinator',
                task: `Coordinate task execution: ${analysis.query}`,
                type: 'comprehensive_analysis'
            });
        }
        
        return workflow;
    }

    /**
     * Select optimal agent for single-agent tasks
     */
    selectOptimalAgent(analysis) {
        const agentScores = new Map();
        
        for (const [agentId, agent] of this.agents) {
            let score = 0;
            
            // Match capabilities with required services
            const capabilityMatches = analysis.requiredServices.filter(service =>
                agent.tools.includes(service)
            ).length;
            score += capabilityMatches * 0.4;
            
            // Match specialization with intents
            const intentMatch = analysis.intents.some(intent =>
                agent.specialization.includes(intent.replace('_', ''))
            );
            score += intentMatch ? 0.3 : 0;
            
            // Performance factor
            score += agent.performance.successRate * 0.2;
            
            // Utilization factor (prefer less utilized agents)
            const utilization = this.performanceMetrics.agentUtilization[agentId] || 0;
            score += Math.max(0, 0.1 - (utilization / 100));
            
            agentScores.set(agentId, score);
        }
        
        // Return agent with highest score
        return Array.from(agentScores.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    /**
     * Helper methods
     */
    assessTaskComplexity(query, context) {
        let complexity = 0.5; // Base complexity
        
        // Length factor
        complexity += Math.min(0.3, query.length / 1000);
        
        // Multi-step indicators
        const multiStepIndicators = query.match(/(?:and|then|after|also|additionally)/gi);
        complexity += (multiStepIndicators?.length || 0) * 0.1;
        
        // Service requirements
        const serviceCount = this.identifyRequiredServices(query).length;
        complexity += serviceCount * 0.05;
        
        return Math.min(1.0, complexity);
    }

    estimateWorkflowSteps(query) {
        const steps = [];
        
        if (query.includes('research')) steps.push('research');
        if (query.includes('analyze')) steps.push('analysis');
        if (query.includes('generate') || query.includes('create')) steps.push('generation');
        if (query.includes('document')) steps.push('documentation');
        
        return steps.length > 0 ? steps : ['process'];
    }

    calculateTaskPriority(query, context) {
        let priority = 0.5;
        
        if (context.urgent) priority += 0.3;
        if (context.userType === 'premium') priority += 0.2;
        if (query.includes('important') || query.includes('urgent')) priority += 0.2;
        
        return Math.min(1.0, priority);
    }

    determineAgentRequirements(query) {
        const requirements = {
            specializations: [],
            tools: [],
            collaboration: false
        };
        
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('research')) {
            requirements.specializations.push('research_and_analysis');
            requirements.tools.push('deepSearch', 'ragService');
        }
        
        if (queryLower.includes('create') || queryLower.includes('generate')) {
            requirements.specializations.push('content_generation');
            requirements.tools.push('enhancedContentGenerator');
        }
        
        if (requirements.specializations.length > 1) {
            requirements.collaboration = true;
        }
        
        return requirements;
    }

    estimateWorkflowTime(strategy) {
        const baseTime = 3000; // 3 seconds base
        const stepTime = strategy.workflow.length * 2000; // 2 seconds per step
        const collaborationTime = strategy.collaboration ? 1000 : 0;
        
        return baseTime + stepTime + collaborationTime;
    }

    calculateWorkflowConfidence(workflowResults) {
        const successfulSteps = workflowResults.steps.filter(s => s.result.success).length;
        const totalSteps = workflowResults.steps.length;
        
        return totalSteps > 0 ? successfulSteps / totalSteps : 0.5;
    }

    async synthesizeWorkflowResult(workflowResults, analysis) {
        const synthesis = {
            type: 'agentic_workflow_result',
            summary: `Completed multi-agent workflow for: ${analysis.query}`,
            stepsCompleted: workflowResults.steps.length,
            agentsInvolved: [...new Set(workflowResults.agentsUsed)],
            outputs: workflowResults.outputs,
            recommendations: this.generateWorkflowRecommendations(workflowResults),
            downloadableFiles: this.extractDownloadableFiles(workflowResults)
        };
        
        return synthesis;
    }

    extractDownloadableFiles(workflowResults) {
        const files = [];
        
        for (const output of workflowResults.outputs) {
            if (output.result && output.result.downloadUrl) {
                files.push({
                    type: output.result.documentType || 'file',
                    url: output.result.downloadUrl,
                    filename: output.result.fileName || 'generated_file'
                });
            }
        }
        
        return files;
    }

    generateWorkflowRecommendations(workflowResults) {
        const recommendations = [];
        
        const successRate = this.calculateWorkflowConfidence(workflowResults);
        
        if (successRate === 1.0) {
            recommendations.push('All workflow steps completed successfully');
        } else if (successRate > 0.8) {
            recommendations.push('Workflow mostly successful with minor issues');
        } else {
            recommendations.push('Workflow had significant issues - consider retrying');
        }
        
        if (workflowResults.outputs.length > 1) {
            recommendations.push('Multiple agents collaborated to provide comprehensive results');
        }
        
        return recommendations;
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            this.generatePerformanceReport();
        }, 300000); // Every 5 minutes
    }

    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalTasks: this.performanceMetrics.totalTasks,
            successRate: this.performanceMetrics.successfulTasks / this.performanceMetrics.totalTasks,
            averageResponseTime: this.performanceMetrics.averageResponseTime,
            agentUtilization: this.performanceMetrics.agentUtilization,
            toolUsage: this.performanceMetrics.toolUsage,
            workflowSuccess: this.performanceMetrics.workflowSuccess,
            activeWorkflows: this.activeWorkflows.size
        };
        
        console.log('[Agentic MCP] Performance Report:', JSON.stringify(report, null, 2));
        this.emit('performanceReport', report);
    }

    updateResponseTime(responseTime) {
        this.performanceMetrics.averageResponseTime = 
            (this.performanceMetrics.averageResponseTime + responseTime) / 2;
    }

    updateLearningData(query, analysis, result, context) {
        const learningEntry = {
            timestamp: Date.now(),
            query: query,
            analysis: analysis,
            result: result,
            context: context,
            success: result.success
        };
        
        const key = analysis.intents.join('_');
        if (!this.learningData.has(key)) {
            this.learningData.set(key, []);
        }
        
        this.learningData.get(key).push(learningEntry);
        
        // Keep only last 100 entries per intent
        if (this.learningData.get(key).length > 100) {
            this.learningData.get(key).shift();
        }
    }

    handleAgentTaskCompleted(data) {
        console.log(`[Agentic MCP] Agent ${data.agent} completed task successfully`);
        this.emit('agentTaskCompleted', data);
    }

    handleAgentTaskFailed(data) {
        console.log(`[Agentic MCP] Agent ${data.agent} task failed:`, data.error);
        this.emit('agentTaskFailed', data);
    }

    generateFallbackSuggestion(query) {
        return `Consider breaking down your request into smaller, specific tasks. For example, if you want to research and create a document, try: "Research [topic]" first, then "Create a report about [topic]"`;
    }
}

module.exports = AgenticMCPOrchestrator;
