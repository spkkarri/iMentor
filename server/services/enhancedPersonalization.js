/**
 * Enhanced Personalization System
 * Provides advanced personalization based on all previous conversations across sessions
 */

const { v4: uuidv4 } = require('uuid');

class EnhancedPersonalization {
    constructor() {
        this.userProfiles = new Map();
        this.conversationHistory = new Map();
        this.learningPatterns = new Map();
        this.preferences = new Map();
        this.contextualMemory = new Map();
        
        // Personalization weights
        this.weights = {
            recentConversations: 0.4,
            topicPreferences: 0.3,
            communicationStyle: 0.2,
            learningPatterns: 0.1
        };
        
        this.initializePersonalization();
    }

    /**
     * Initialize personalization system
     */
    initializePersonalization() {
        console.log('[Personalization] Enhanced personalization system initialized');
    }

    /**
     * Create or update user profile
     */
    async createUserProfile(userId, initialData = {}) {
        const profile = {
            userId,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            
            // Communication preferences
            communicationStyle: {
                formality: 'balanced', // formal, casual, balanced
                verbosity: 'moderate', // brief, moderate, detailed
                tone: 'friendly', // professional, friendly, enthusiastic
                technicalLevel: 'intermediate' // beginner, intermediate, advanced, expert
            },
            
            // Topic interests and expertise
            topicInterests: new Map(),
            expertiseAreas: new Map(),
            learningGoals: [],
            
            // Interaction patterns
            interactionPatterns: {
                preferredResponseLength: 'moderate',
                likesExamples: true,
                prefersStepByStep: false,
                asksFollowUpQuestions: false,
                sessionDuration: 'medium'
            },
            
            // Learning style
            learningStyle: {
                visual: 0.3,
                auditory: 0.3,
                kinesthetic: 0.2,
                readingWriting: 0.2
            },
            
            // Context and memory
            contextualMemory: {
                recentTopics: [],
                ongoingProjects: [],
                previousQuestions: [],
                resolvedIssues: []
            },
            
            // Preferences
            preferences: {
                preferredModels: [],
                contentTypes: [],
                responseFormat: 'conversational',
                includeSourceLinks: true,
                includeExamples: true
            },
            
            // Analytics
            analytics: {
                totalSessions: 0,
                totalInteractions: 0,
                averageSessionLength: 0,
                mostActiveTimeOfDay: null,
                satisfactionScore: 0.8
            },
            
            ...initialData
        };
        
        this.userProfiles.set(userId, profile);
        console.log(`[Personalization] Created profile for user ${userId}`);
        
        return profile;
    }

    /**
     * Update user profile based on interaction
     */
    async updateProfileFromInteraction(userId, interaction) {
        let profile = this.userProfiles.get(userId);
        if (!profile) {
            profile = await this.createUserProfile(userId);
        }
        
        // Update interaction patterns
        this.updateInteractionPatterns(profile, interaction);
        
        // Update topic interests
        this.updateTopicInterests(profile, interaction);
        
        // Update communication style
        this.updateCommunicationStyle(profile, interaction);
        
        // Update contextual memory
        this.updateContextualMemory(profile, interaction);
        
        // Update analytics
        this.updateAnalytics(profile, interaction);
        
        profile.lastUpdated = new Date().toISOString();
        
        console.log(`[Personalization] Updated profile for user ${userId}`);
    }

    /**
     * Update interaction patterns
     */
    updateInteractionPatterns(profile, interaction) {
        const patterns = profile.interactionPatterns;
        
        // Analyze query length preference
        if (interaction.query.length > 200) {
            patterns.preferredResponseLength = 'detailed';
        } else if (interaction.query.length < 50) {
            patterns.preferredResponseLength = 'brief';
        }
        
        // Check for example requests
        if (interaction.query.toLowerCase().includes('example')) {
            patterns.likesExamples = true;
        }
        
        // Check for step-by-step requests
        if (interaction.query.toLowerCase().includes('step') || 
            interaction.query.toLowerCase().includes('how to')) {
            patterns.prefersStepByStep = true;
        }
        
        // Check for follow-up questions
        if (interaction.isFollowUp) {
            patterns.asksFollowUpQuestions = true;
        }
    }

    /**
     * Update topic interests based on conversation
     */
    updateTopicInterests(profile, interaction) {
        const topics = this.extractTopics(interaction.query);
        
        topics.forEach(topic => {
            const currentInterest = profile.topicInterests.get(topic) || 0;
            profile.topicInterests.set(topic, currentInterest + 1);
        });
        
        // Determine expertise level based on question complexity
        const complexity = this.analyzeQuestionComplexity(interaction.query);
        topics.forEach(topic => {
            const currentExpertise = profile.expertiseAreas.get(topic) || 'beginner';
            if (complexity === 'advanced' && currentExpertise !== 'expert') {
                profile.expertiseAreas.set(topic, 'advanced');
            } else if (complexity === 'intermediate' && currentExpertise === 'beginner') {
                profile.expertiseAreas.set(topic, 'intermediate');
            }
        });
    }

    /**
     * Update communication style preferences
     */
    updateCommunicationStyle(profile, interaction) {
        const style = profile.communicationStyle;
        
        // Analyze formality
        if (interaction.query.includes('please') || interaction.query.includes('thank you')) {
            style.formality = 'formal';
        } else if (interaction.query.includes('hey') || interaction.query.includes('what\'s up')) {
            style.formality = 'casual';
        }
        
        // Analyze technical level
        const technicalTerms = this.countTechnicalTerms(interaction.query);
        if (technicalTerms > 3) {
            style.technicalLevel = 'advanced';
        } else if (technicalTerms > 1) {
            style.technicalLevel = 'intermediate';
        }
    }

    /**
     * Update contextual memory
     */
    updateContextualMemory(profile, interaction) {
        const memory = profile.contextualMemory;
        
        // Add to recent topics
        const topics = this.extractTopics(interaction.query);
        topics.forEach(topic => {
            if (!memory.recentTopics.includes(topic)) {
                memory.recentTopics.unshift(topic);
                if (memory.recentTopics.length > 10) {
                    memory.recentTopics.pop();
                }
            }
        });
        
        // Add to previous questions
        memory.previousQuestions.unshift({
            query: interaction.query,
            timestamp: new Date().toISOString(),
            topics: topics
        });
        if (memory.previousQuestions.length > 50) {
            memory.previousQuestions.pop();
        }
        
        // Detect ongoing projects
        if (interaction.query.toLowerCase().includes('project') || 
            interaction.query.toLowerCase().includes('working on')) {
            const project = this.extractProjectInfo(interaction.query);
            if (project && !memory.ongoingProjects.some(p => p.name === project.name)) {
                memory.ongoingProjects.push(project);
            }
        }
    }

    /**
     * Update analytics
     */
    updateAnalytics(profile, interaction) {
        const analytics = profile.analytics;
        
        analytics.totalInteractions++;
        
        // Update session analytics if new session
        if (interaction.isNewSession) {
            analytics.totalSessions++;
        }
        
        // Update time of day analytics
        const hour = new Date().getHours();
        if (!analytics.mostActiveTimeOfDay || 
            this.getTimeOfDayCategory(hour) !== analytics.mostActiveTimeOfDay) {
            analytics.mostActiveTimeOfDay = this.getTimeOfDayCategory(hour);
        }
        
        // Update satisfaction based on interaction success
        if (interaction.success !== false) {
            analytics.satisfactionScore = Math.min(1.0, analytics.satisfactionScore + 0.01);
        }
    }

    /**
     * Generate personalized response configuration
     */
    async generatePersonalizedConfig(userId, query, conversationHistory = []) {
        const profile = this.userProfiles.get(userId);
        if (!profile) {
            return this.getDefaultConfig();
        }
        
        const config = {
            // Communication style adjustments
            tone: profile.communicationStyle.tone,
            formality: profile.communicationStyle.formality,
            verbosity: profile.communicationStyle.verbosity,
            technicalLevel: profile.communicationStyle.technicalLevel,
            
            // Content preferences
            includeExamples: profile.interactionPatterns.likesExamples,
            stepByStepFormat: profile.interactionPatterns.prefersStepByStep,
            responseLength: profile.interactionPatterns.preferredResponseLength,
            
            // Contextual information
            recentTopics: profile.contextualMemory.recentTopics.slice(0, 5),
            expertiseAreas: Array.from(profile.expertiseAreas.entries()),
            ongoingProjects: profile.contextualMemory.ongoingProjects,
            
            // Model preferences
            preferredModels: profile.preferences.preferredModels,
            
            // Personalization prompt
            personalizationPrompt: this.generatePersonalizationPrompt(profile, query)
        };
        
        return config;
    }

    /**
     * Generate personalization prompt for AI
     */
    generatePersonalizationPrompt(profile, query) {
        const recentTopics = profile.contextualMemory.recentTopics.slice(0, 3);
        const expertiseLevel = this.determineOverallExpertiseLevel(profile);
        
        let prompt = `User Context: This user prefers ${profile.communicationStyle.tone} communication with ${profile.communicationStyle.verbosity} responses. `;
        
        if (recentTopics.length > 0) {
            prompt += `They have recently discussed: ${recentTopics.join(', ')}. `;
        }
        
        prompt += `Their technical level is ${profile.communicationStyle.technicalLevel}. `;
        
        if (profile.interactionPatterns.likesExamples) {
            prompt += `They appreciate concrete examples. `;
        }
        
        if (profile.interactionPatterns.prefersStepByStep) {
            prompt += `They prefer step-by-step explanations. `;
        }
        
        if (profile.contextualMemory.ongoingProjects.length > 0) {
            const projects = profile.contextualMemory.ongoingProjects.map(p => p.name).join(', ');
            prompt += `Current projects: ${projects}. `;
        }
        
        return prompt;
    }

    /**
     * Extract topics from query
     */
    extractTopics(query) {
        const topics = [];
        const queryLower = query.toLowerCase();
        
        // Common topic keywords
        const topicKeywords = {
            'programming': ['code', 'programming', 'development', 'software'],
            'ai': ['ai', 'artificial intelligence', 'machine learning', 'ml'],
            'web': ['web', 'html', 'css', 'javascript', 'react'],
            'data': ['data', 'database', 'sql', 'analytics'],
            'business': ['business', 'marketing', 'strategy', 'management'],
            'science': ['science', 'research', 'study', 'analysis']
        };
        
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => queryLower.includes(keyword))) {
                topics.push(topic);
            }
        }
        
        return topics;
    }

    /**
     * Analyze question complexity
     */
    analyzeQuestionComplexity(query) {
        const queryLower = query.toLowerCase();
        
        // Advanced indicators
        if (queryLower.includes('implement') || 
            queryLower.includes('architecture') || 
            queryLower.includes('optimize') ||
            queryLower.includes('algorithm')) {
            return 'advanced';
        }
        
        // Intermediate indicators
        if (queryLower.includes('how to') || 
            queryLower.includes('best practice') || 
            queryLower.includes('compare')) {
            return 'intermediate';
        }
        
        // Basic indicators
        if (queryLower.includes('what is') || 
            queryLower.includes('explain') || 
            queryLower.includes('define')) {
            return 'basic';
        }
        
        return 'intermediate';
    }

    /**
     * Count technical terms in query
     */
    countTechnicalTerms(query) {
        const technicalTerms = [
            'api', 'database', 'algorithm', 'framework', 'library', 'function',
            'variable', 'array', 'object', 'class', 'method', 'interface',
            'protocol', 'server', 'client', 'backend', 'frontend', 'deployment'
        ];
        
        const queryLower = query.toLowerCase();
        return technicalTerms.filter(term => queryLower.includes(term)).length;
    }

    /**
     * Extract project information
     */
    extractProjectInfo(query) {
        const projectMatch = query.match(/(?:project|working on|building)\s+([^.!?]+)/i);
        if (projectMatch) {
            return {
                name: projectMatch[1].trim(),
                startedAt: new Date().toISOString(),
                lastMentioned: new Date().toISOString()
            };
        }
        return null;
    }

    /**
     * Get time of day category
     */
    getTimeOfDayCategory(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    /**
     * Determine overall expertise level
     */
    determineOverallExpertiseLevel(profile) {
        const expertiseLevels = Array.from(profile.expertiseAreas.values());
        if (expertiseLevels.includes('expert')) return 'expert';
        if (expertiseLevels.includes('advanced')) return 'advanced';
        if (expertiseLevels.includes('intermediate')) return 'intermediate';
        return 'beginner';
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            tone: 'friendly',
            formality: 'balanced',
            verbosity: 'moderate',
            technicalLevel: 'intermediate',
            includeExamples: true,
            stepByStepFormat: false,
            responseLength: 'moderate',
            recentTopics: [],
            expertiseAreas: [],
            ongoingProjects: [],
            preferredModels: [],
            personalizationPrompt: 'Provide helpful, clear, and engaging responses.'
        };
    }

    /**
     * Get user profile
     */
    getUserProfile(userId) {
        return this.userProfiles.get(userId) || null;
    }

    /**
     * Get personalization analytics
     */
    getPersonalizationAnalytics() {
        const totalUsers = this.userProfiles.size;
        const activeUsers = Array.from(this.userProfiles.values())
            .filter(profile => {
                const lastUpdate = new Date(profile.lastUpdated);
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return lastUpdate > dayAgo;
            }).length;
        
        return {
            totalUsers,
            activeUsers,
            averageInteractionsPerUser: totalUsers > 0 ? 
                Array.from(this.userProfiles.values())
                    .reduce((sum, profile) => sum + profile.analytics.totalInteractions, 0) / totalUsers : 0,
            averageSatisfactionScore: totalUsers > 0 ?
                Array.from(this.userProfiles.values())
                    .reduce((sum, profile) => sum + profile.analytics.satisfactionScore, 0) / totalUsers : 0
        };
    }
}

module.exports = EnhancedPersonalization;
