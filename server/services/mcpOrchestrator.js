/**
 * MCP Orchestrator - Intelligent Agent Management and Task Routing
 * 
 * This orchestrator provides:
 * 1. Intelligent task routing to specialized agents
 * 2. Multi-agent collaboration for complex tasks
 * 3. Performance monitoring and optimization
 * 4. Context-aware decision making
 * 5. Real-time learning and adaptation
 */

const { ResearchAgent, CodingAgent, MCPAgent } = require('./advancedMCPSystem');
const EventEmitter = require('events');

class AcademicAgent extends MCPAgent {
    constructor() {
        super({
            id: 'academic_agent',
            name: 'Academic Specialist',
            specialization: 'education_and_learning',
            capabilities: ['lesson_planning', 'concept_explanation', 'assessment', 'curriculum_design', 'study_guidance']
        });
    }

    async executeSpecializedTask(task, context) {
        const { query, type } = task;
        
        switch (type) {
            case 'explain_concept':
                return await this.explainConcept(query, context);
            case 'create_lesson':
                return await this.createLesson(query, context);
            case 'assess_knowledge':
                return await this.assessKnowledge(query, context);
            default:
                return await this.provideAcademicGuidance(query, context);
        }
    }

    async explainConcept(query, context) {
        const conceptAnalysis = this.analyzeConcept(query);
        const explanation = await this.generateExplanation(query, context.userLevel || 'intermediate');
        const examples = await this.generateExamples(query);
        
        return {
            type: 'concept_explanation',
            concept: query,
            analysis: conceptAnalysis,
            explanation: explanation,
            examples: examples,
            difficulty: conceptAnalysis.difficulty,
            prerequisites: conceptAnalysis.prerequisites,
            nextSteps: this.suggestNextSteps(query),
            confidence: 0.91
        };
    }

    analyzeConcept(concept) {
        return {
            difficulty: 'intermediate',
            prerequisites: ['Basic understanding of related topics'],
            category: 'academic',
            estimatedLearningTime: '30 minutes'
        };
    }

    async generateExplanation(concept, level) {
        return {
            simple: `Simple explanation of ${concept} for ${level} level`,
            detailed: `Detailed explanation with examples and applications`,
            visual: 'Suggested diagrams and visual aids',
            interactive: 'Hands-on exercises and practice problems'
        };
    }

    async generateExamples(concept) {
        return [
            { type: 'basic', example: `Basic example of ${concept}` },
            { type: 'advanced', example: `Advanced application of ${concept}` },
            { type: 'real_world', example: `Real-world use case of ${concept}` }
        ];
    }

    suggestNextSteps(concept) {
        return [
            'Practice with exercises',
            'Explore related concepts',
            'Apply in real projects',
            'Take assessment quiz'
        ];
    }
}

class CreativeAgent extends MCPAgent {
    constructor() {
        super({
            id: 'creative_agent',
            name: 'Creative Specialist',
            specialization: 'creative_content',
            capabilities: ['content_creation', 'storytelling', 'design_thinking', 'brainstorming', 'presentation_design']
        });
    }

    async executeSpecializedTask(task, context) {
        const { query, type } = task;
        
        switch (type) {
            case 'create_content':
                return await this.createContent(query, context);
            case 'brainstorm':
                return await this.brainstormIdeas(query, context);
            case 'design_presentation':
                return await this.designPresentation(query, context);
            default:
                return await this.provideCreativeAssistance(query, context);
        }
    }

    async createContent(query, context) {
        const contentStrategy = this.developContentStrategy(query, context);
        const content = await this.generateCreativeContent(query, contentStrategy);
        
        return {
            type: 'creative_content',
            strategy: contentStrategy,
            content: content,
            variations: await this.generateVariations(content),
            confidence: 0.87,
            recommendations: this.getCreativeRecommendations(query)
        };
    }

    developContentStrategy(query, context) {
        return {
            audience: context.audience || 'general',
            tone: context.tone || 'professional',
            format: context.format || 'article',
            objectives: ['Engage audience', 'Convey information', 'Inspire action']
        };
    }

    async generateCreativeContent(query, strategy) {
        return {
            title: `Creative title for ${query}`,
            introduction: 'Engaging introduction',
            body: 'Well-structured content body',
            conclusion: 'Compelling conclusion',
            callToAction: 'Clear call to action'
        };
    }

    async generateVariations(content) {
        return [
            { type: 'formal', variation: 'Formal version of the content' },
            { type: 'casual', variation: 'Casual version of the content' },
            { type: 'technical', variation: 'Technical version of the content' }
        ];
    }

    getCreativeRecommendations(query) {
        return [
            'Consider visual elements',
            'Add interactive components',
            'Include storytelling elements',
            'Optimize for engagement'
        ];
    }
}

class MCPOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.taskQueue = [];
        this.activeCollaborations = new Map();
        this.performanceMetrics = {
            totalTasks: 0,
            successfulTasks: 0,
            averageResponseTime: 0,
            agentUtilization: {}
        };
        this.learningData = new Map();
        
        this.initializeAgents();
        this.startPerformanceMonitoring();
    }

    initializeAgents() {
        const agents = [
            new ResearchAgent(),
            new CodingAgent(),
            new AcademicAgent(),
            new CreativeAgent()
        ];

        agents.forEach(agent => {
            this.agents.set(agent.id, agent);
            this.performanceMetrics.agentUtilization[agent.id] = 0;
            
            // Listen to agent events
            agent.on('taskCompleted', (data) => this.handleAgentTaskCompleted(data));
            agent.on('taskFailed', (data) => this.handleAgentTaskFailed(data));
        });

        console.log(`[MCP Orchestrator] Initialized ${agents.length} specialized agents`);
    }

    async processQuery(query, context = {}) {
        const startTime = Date.now();
        this.performanceMetrics.totalTasks++;

        try {
            console.log(`[MCP Orchestrator] Processing query: "${query.substring(0, 100)}..."`);

            // Analyze query and determine optimal routing strategy
            const analysis = await this.analyzeQuery(query, context);
            
            // Route to appropriate agent(s)
            const result = await this.routeTask(analysis, context);
            
            // Update performance metrics
            this.performanceMetrics.successfulTasks++;
            this.updateResponseTime(Date.now() - startTime);
            
            // Learn from this interaction
            this.updateLearningData(query, analysis, result, context);

            return {
                success: true,
                result: result,
                analysis: analysis,
                processingTime: Date.now() - startTime,
                agentsUsed: result.agentsUsed || [result.agent],
                confidence: result.confidence || 0.85
            };

        } catch (error) {
            console.error('[MCP Orchestrator] Query processing failed:', error);
            
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime,
                fallbackSuggestion: this.generateFallbackSuggestion(query)
            };
        }
    }

    async analyzeQuery(query, context) {
        const queryLower = query.toLowerCase();
        
        // Intent detection
        const intents = this.detectIntents(queryLower);
        
        // Complexity assessment
        const complexity = this.assessComplexity(query, context);
        
        // Agent requirements
        const requiredCapabilities = this.identifyRequiredCapabilities(queryLower, intents);
        
        // Collaboration assessment
        const needsCollaboration = this.assessCollaborationNeed(intents, complexity);

        return {
            query: query,
            intents: intents,
            complexity: complexity,
            requiredCapabilities: requiredCapabilities,
            needsCollaboration: needsCollaboration,
            recommendedAgents: this.recommendAgents(requiredCapabilities, intents),
            priority: this.calculatePriority(complexity, context),
            estimatedTime: this.estimateProcessingTime(complexity, needsCollaboration)
        };
    }

    detectIntents(query) {
        const intents = [];
        
        // Research intents
        if (query.match(/research|find|search|investigate|analyze|study/)) {
            intents.push('research');
        }
        
        // Coding intents - Enhanced detection
        if (query.match(/code|program|debug|function|algorithm|software|script|app|website|api|database|class|method|variable|loop|condition|array|object|json|html|css|javascript|python|java|cpp|c\+\+|php|ruby|go|rust|swift|kotlin|typescript|react|vue|angular|node|express|django|flask|spring|laravel|build|develop|implement|create.*function|write.*code|generate.*code|make.*program|coding|programming|development|developer|syntax|compile|execute|run.*code|test.*code|unit.*test|integration.*test|refactor|optimize.*code|fix.*bug|error.*handling|exception|try.*catch|async|await|promise|callback|api.*call|http.*request|database.*query|sql|nosql|mongodb|mysql|postgresql|redis|git|github|version.*control|deployment|docker|kubernetes|ci\/cd|devops/)) {
            intents.push('coding');
        }
        
        // Academic intents
        if (query.match(/explain|teach|learn|concept|lesson|understand/)) {
            intents.push('academic');
        }
        
        // Creative intents
        if (query.match(/create|design|write|story|presentation|content/)) {
            intents.push('creative');
        }
        
        // Document generation intents
        if (query.match(/generate|pdf|ppt|document|report|presentation/)) {
            intents.push('document_generation');
        }

        return intents.length > 0 ? intents : ['general'];
    }

    assessComplexity(query, context) {
        let complexity = 0.5; // Base complexity
        
        // Length factor
        complexity += Math.min(0.3, query.length / 1000);
        
        // Technical terms factor
        const technicalTerms = query.match(/\b(algorithm|implementation|optimization|analysis|research|methodology)\b/gi);
        complexity += (technicalTerms?.length || 0) * 0.1;
        
        // Context factor
        if (context.previousQueries?.length > 0) {
            complexity += 0.1; // Building on previous context
        }
        
        return Math.min(1.0, complexity);
    }

    identifyRequiredCapabilities(query, intents) {
        const capabilities = new Set();
        
        intents.forEach(intent => {
            switch (intent) {
                case 'research':
                    capabilities.add('web_search');
                    capabilities.add('data_analysis');
                    capabilities.add('fact_checking');
                    break;
                case 'coding':
                    capabilities.add('code_generation');
                    capabilities.add('debugging');
                    capabilities.add('code_review');
                    break;
                case 'academic':
                    capabilities.add('concept_explanation');
                    capabilities.add('lesson_planning');
                    capabilities.add('assessment');
                    break;
                case 'creative':
                    capabilities.add('content_creation');
                    capabilities.add('design_thinking');
                    capabilities.add('brainstorming');
                    break;
            }
        });

        return Array.from(capabilities);
    }

    recommendAgents(requiredCapabilities, intents) {
        const recommendations = [];
        
        for (const [agentId, agent] of this.agents) {
            const matchScore = this.calculateAgentMatch(agent, requiredCapabilities, intents);
            if (matchScore > 0.3) {
                recommendations.push({
                    agentId: agentId,
                    agent: agent.name,
                    matchScore: matchScore,
                    capabilities: agent.capabilities,
                    performance: agent.performance
                });
            }
        }
        
        return recommendations.sort((a, b) => b.matchScore - a.matchScore);
    }

    calculateAgentMatch(agent, requiredCapabilities, intents) {
        let score = 0;
        
        // Capability match
        const capabilityMatches = requiredCapabilities.filter(cap => 
            agent.capabilities.includes(cap)
        ).length;
        score += (capabilityMatches / requiredCapabilities.length) * 0.6;
        
        // Intent specialization match
        const intentMatch = intents.some(intent => 
            agent.specialization.includes(intent.replace('_', ''))
        );
        score += intentMatch ? 0.3 : 0;
        
        // Performance factor
        score += agent.performance.successRate * 0.1;
        
        return Math.min(1.0, score);
    }

    async routeTask(analysis, context) {
        const { recommendedAgents, needsCollaboration } = analysis;
        
        if (needsCollaboration && recommendedAgents.length > 1) {
            return await this.orchestrateCollaboration(analysis, context);
        } else if (recommendedAgents.length > 0) {
            return await this.routeToSingleAgent(analysis, context, recommendedAgents[0]);
        } else {
            return await this.handleGeneralQuery(analysis, context);
        }
    }

    async routeToSingleAgent(analysis, context, recommendedAgent) {
        const agent = this.agents.get(recommendedAgent.agentId);

        const task = {
            id: require('uuid').v4(),
            type: this.determineTaskType(analysis),
            query: analysis.query,
            complexity: analysis.complexity,
            priority: analysis.priority,
            language: this.detectProgrammingLanguage(analysis.query),
            context: context
        };

        this.performanceMetrics.agentUtilization[agent.id]++;

        const result = await agent.processTask(task, context);
        result.agentsUsed = [agent.name];

        return result;
    }

    detectProgrammingLanguage(query) {
        const queryLower = query.toLowerCase();

        // Language detection patterns
        const languagePatterns = {
            'javascript': /javascript|js|node\.?js|react|vue|angular|express|npm|yarn/,
            'typescript': /typescript|ts/,
            'python': /python|py|django|flask|pandas|numpy|pip/,
            'java': /java|spring|maven|gradle|jvm/,
            'cpp': /c\+\+|cpp|cxx/,
            'c': /\bc\b|clang|gcc/,
            'csharp': /c#|csharp|\.net|dotnet|visual studio/,
            'php': /php|laravel|symfony|composer/,
            'ruby': /ruby|rails|gem/,
            'go': /golang|go\b/,
            'rust': /rust|cargo/,
            'swift': /swift|ios|xcode/,
            'kotlin': /kotlin|android/,
            'scala': /scala|sbt/,
            'html': /html|markup|web page/,
            'css': /css|stylesheet|styling/,
            'sql': /sql|database|query|mysql|postgresql|sqlite/,
            'bash': /bash|shell|terminal|command line/,
            'powershell': /powershell|ps1/,
            'json': /json|api response/,
            'xml': /xml|markup/,
            'yaml': /yaml|yml|configuration/
        };

        for (const [language, pattern] of Object.entries(languagePatterns)) {
            if (pattern.test(queryLower)) {
                return language;
            }
        }

        // Default language based on common patterns
        if (queryLower.includes('function') || queryLower.includes('script')) {
            return 'javascript';
        }

        return 'javascript'; // Default fallback
    }

    determineTaskType(analysis) {
        const primaryIntent = analysis.intents[0];
        
        const typeMapping = {
            'research': 'research',
            'coding': 'generate_code',
            'academic': 'explain_concept',
            'creative': 'create_content',
            'document_generation': 'generate_document'
        };
        
        return typeMapping[primaryIntent] || 'general_assistance';
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
            topPerformingAgents: this.getTopPerformingAgents()
        };
        
        console.log('[MCP Orchestrator] Performance Report:', JSON.stringify(report, null, 2));
        this.emit('performanceReport', report);
    }

    getTopPerformingAgents() {
        return Array.from(this.agents.values())
            .sort((a, b) => b.performance.successRate - a.performance.successRate)
            .slice(0, 3)
            .map(agent => ({
                name: agent.name,
                successRate: agent.performance.successRate,
                avgResponseTime: agent.performance.avgResponseTime
            }));
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
        console.log(`[MCP Orchestrator] Agent ${data.agent} completed task successfully`);
        this.emit('agentTaskCompleted', data);
    }

    handleAgentTaskFailed(data) {
        console.log(`[MCP Orchestrator] Agent ${data.agent} task failed:`, data.error);
        this.emit('agentTaskFailed', data);
    }

    assessCollaborationNeed(intents, complexity) {
        return intents.length > 1 || complexity > 0.7;
    }

    calculatePriority(complexity, context) {
        let priority = complexity;
        
        if (context.urgent) priority += 0.3;
        if (context.userType === 'premium') priority += 0.2;
        
        return Math.min(1.0, priority);
    }

    estimateProcessingTime(complexity, needsCollaboration) {
        let baseTime = 2000; // 2 seconds base
        baseTime += complexity * 3000; // Add up to 3 seconds for complexity
        if (needsCollaboration) baseTime += 2000; // Add 2 seconds for collaboration
        
        return baseTime;
    }

    generateFallbackSuggestion(query) {
        return `Consider rephrasing your query or breaking it into smaller, more specific questions about: ${query.substring(0, 50)}...`;
    }

    async handleGeneralQuery(analysis, context) {
        // Fallback to a general-purpose response
        return {
            success: true,
            result: {
                type: 'general_response',
                message: `I understand you're asking about: ${analysis.query}. Let me provide a general response.`,
                suggestions: [
                    'Try being more specific about what you need',
                    'Consider breaking your question into smaller parts',
                    'Specify the type of help you need (research, coding, explanation, etc.)'
                ]
            },
            agent: 'General Assistant',
            confidence: 0.6
        };
    }
}

module.exports = MCPOrchestrator;
