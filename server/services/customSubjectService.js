/**
 * Custom Subject Service
 * Allows users to define and manage custom subjects with specialized knowledge
 */

class CustomSubjectService {
    constructor() {
        this.subjects = new Map();
        this.modelConfigs = new Map();
        this.initializeDefaultSubjects();
        this.initializeModelConfigs();
    }

    initializeDefaultSubjects() {
        // Programming subjects
        this.addSubject('web-development', {
            name: 'Web Development',
            description: 'Frontend and backend web development',
            keywords: ['html', 'css', 'javascript', 'react', 'node', 'api', 'database'],
            modelSize: 'medium', // 7B parameters for good code understanding
            specialization: 'code',
            knowledgeBase: {
                frameworks: ['React', 'Vue', 'Angular', 'Express', 'Django', 'Flask'],
                languages: ['JavaScript', 'TypeScript', 'Python', 'PHP', 'Ruby'],
                tools: ['Git', 'Docker', 'Webpack', 'npm', 'yarn'],
                concepts: ['REST API', 'GraphQL', 'Authentication', 'Database Design']
            }
        });

        this.addSubject('data-science', {
            name: 'Data Science & Machine Learning',
            description: 'Data analysis, ML, and AI development',
            keywords: ['python', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'sklearn'],
            modelSize: 'large', // 13B+ for complex mathematical reasoning
            specialization: 'analysis',
            knowledgeBase: {
                libraries: ['pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch'],
                techniques: ['regression', 'classification', 'clustering', 'deep learning'],
                tools: ['jupyter', 'anaconda', 'git', 'docker'],
                concepts: ['feature engineering', 'model validation', 'hyperparameter tuning']
            }
        });

        // Academic subjects
        this.addSubject('mathematics', {
            name: 'Mathematics',
            description: 'Pure and applied mathematics',
            keywords: ['algebra', 'calculus', 'geometry', 'statistics', 'probability'],
            modelSize: 'medium', // Good for mathematical reasoning
            specialization: 'math',
            knowledgeBase: {
                areas: ['algebra', 'calculus', 'geometry', 'statistics', 'discrete math'],
                tools: ['wolfram alpha', 'matlab', 'mathematica', 'python'],
                concepts: ['proofs', 'theorems', 'equations', 'functions', 'limits']
            }
        });

        this.addSubject('physics', {
            name: 'Physics',
            description: 'Classical and modern physics',
            keywords: ['mechanics', 'thermodynamics', 'electromagnetism', 'quantum'],
            modelSize: 'large', // Complex scientific reasoning
            specialization: 'science',
            knowledgeBase: {
                areas: ['mechanics', 'thermodynamics', 'electromagnetism', 'quantum physics'],
                tools: ['matlab', 'python', 'mathematica', 'lab equipment'],
                concepts: ['conservation laws', 'wave-particle duality', 'relativity']
            }
        });

        // Business subjects
        this.addSubject('business-analysis', {
            name: 'Business Analysis',
            description: 'Business strategy and analysis',
            keywords: ['strategy', 'analysis', 'market', 'finance', 'operations'],
            modelSize: 'medium',
            specialization: 'business',
            knowledgeBase: {
                areas: ['strategy', 'finance', 'operations', 'marketing', 'hr'],
                tools: ['excel', 'powerbi', 'tableau', 'sql'],
                concepts: ['swot analysis', 'roi', 'kpis', 'process optimization']
            }
        });
    }

    initializeModelConfigs() {
        this.modelConfigs.set('small', {
            parameters: '1B-3B',
            memory: '2-4GB',
            responseTime: '100-500ms',
            costPerRequest: 0.001,
            bestFor: ['quick answers', 'simple tasks', 'real-time chat'],
            limitations: ['basic reasoning', 'limited context']
        });

        this.modelConfigs.set('medium', {
            parameters: '7B-13B',
            memory: '8-16GB',
            responseTime: '1-3s',
            costPerRequest: 0.01,
            bestFor: ['education', 'code explanation', 'general assistance'],
            limitations: ['moderate complexity', 'some specialized knowledge gaps']
        });

        this.modelConfigs.set('large', {
            parameters: '30B+',
            memory: '32GB+',
            responseTime: '3-10s',
            costPerRequest: 0.1,
            bestFor: ['research', 'complex analysis', 'expert consultation'],
            limitations: ['high resource usage', 'slower responses']
        });
    }

    addSubject(id, config) {
        this.subjects.set(id, {
            id: id,
            ...config,
            createdAt: new Date().toISOString(),
            customized: !this.subjects.has(id) // Mark as custom if not default
        });
        console.log(`📚 Added subject: ${config.name} (${config.modelSize} model)`);
    }

    createCustomSubject(userConfig) {
        const {
            name,
            description,
            keywords = [],
            modelSize = 'medium',
            specialization = 'general',
            knowledgeBase = {},
            userId
        } = userConfig;

        const id = this.generateSubjectId(name);
        
        const subject = {
            id: id,
            name: name,
            description: description,
            keywords: keywords,
            modelSize: modelSize,
            specialization: specialization,
            knowledgeBase: knowledgeBase,
            customized: true,
            createdBy: userId,
            createdAt: new Date().toISOString()
        };

        this.subjects.set(id, subject);
        
        console.log(`✨ Created custom subject: ${name} by user ${userId}`);
        return subject;
    }

    generateSubjectId(name) {
        return name.toLowerCase()
                  .replace(/[^a-z0-9\s]/g, '')
                  .replace(/\s+/g, '-')
                  .substring(0, 50);
    }

    getSubject(id) {
        return this.subjects.get(id);
    }

    getAllSubjects() {
        return Array.from(this.subjects.values());
    }

    getSubjectsBySpecialization(specialization) {
        return Array.from(this.subjects.values())
                   .filter(subject => subject.specialization === specialization);
    }

    findBestSubject(query) {
        const queryLower = query.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (const subject of this.subjects.values()) {
            let score = 0;
            
            // Check keywords
            for (const keyword of subject.keywords) {
                if (queryLower.includes(keyword.toLowerCase())) {
                    score += 2;
                }
            }
            
            // Check name and description
            if (queryLower.includes(subject.name.toLowerCase())) {
                score += 3;
            }
            
            if (queryLower.includes(subject.description.toLowerCase())) {
                score += 1;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = subject;
            }
        }

        return {
            subject: bestMatch,
            confidence: bestScore / 10, // Normalize to 0-1
            matchedKeywords: bestMatch ? 
                bestMatch.keywords.filter(k => queryLower.includes(k.toLowerCase())) : []
        };
    }

    getModelRecommendation(subject, userConstraints = {}) {
        const { maxMemory, maxResponseTime, budget } = userConstraints;
        const subjectConfig = this.subjects.get(subject);
        
        if (!subjectConfig) {
            return { error: 'Subject not found' };
        }

        const recommendedSize = subjectConfig.modelSize;
        const modelConfig = this.modelConfigs.get(recommendedSize);
        
        // Check if user constraints allow recommended model
        const constraints = [];
        if (maxMemory && this.parseMemory(modelConfig.memory) > maxMemory) {
            constraints.push('memory');
        }
        if (maxResponseTime && this.parseResponseTime(modelConfig.responseTime) > maxResponseTime) {
            constraints.push('response_time');
        }
        if (budget && modelConfig.costPerRequest > budget) {
            constraints.push('budget');
        }

        let finalRecommendation = recommendedSize;
        if (constraints.length > 0) {
            // Downgrade to smaller model if constraints exist
            if (recommendedSize === 'large') finalRecommendation = 'medium';
            else if (recommendedSize === 'medium') finalRecommendation = 'small';
        }

        return {
            subject: subjectConfig.name,
            recommended: recommendedSize,
            final: finalRecommendation,
            config: this.modelConfigs.get(finalRecommendation),
            constraints: constraints,
            reasoning: this.getRecommendationReasoning(subjectConfig, finalRecommendation, constraints)
        };
    }

    parseMemory(memoryStr) {
        const match = memoryStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    parseResponseTime(timeStr) {
        const match = timeStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    getRecommendationReasoning(subject, modelSize, constraints) {
        const reasons = [];
        
        reasons.push(`${subject.name} typically requires ${subject.modelSize} model for optimal performance`);
        
        if (constraints.length > 0) {
            reasons.push(`Downgraded to ${modelSize} due to constraints: ${constraints.join(', ')}`);
        }
        
        const config = this.modelConfigs.get(modelSize);
        reasons.push(`${modelSize} model provides: ${config.bestFor.join(', ')}`);
        
        return reasons;
    }

    exportSubjectConfig(subjectId) {
        const subject = this.subjects.get(subjectId);
        if (!subject) return null;

        return {
            config: subject,
            modelRecommendation: this.getModelRecommendation(subjectId),
            exportedAt: new Date().toISOString()
        };
    }

    importSubjectConfig(configData) {
        try {
            const { config } = configData;
            this.subjects.set(config.id, {
                ...config,
                importedAt: new Date().toISOString()
            });
            return { success: true, subject: config };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getSubjectStats() {
        const subjects = Array.from(this.subjects.values());
        const stats = {
            total: subjects.length,
            custom: subjects.filter(s => s.customized).length,
            default: subjects.filter(s => !s.customized).length,
            bySpecialization: {},
            byModelSize: {}
        };

        subjects.forEach(subject => {
            stats.bySpecialization[subject.specialization] = 
                (stats.bySpecialization[subject.specialization] || 0) + 1;
            stats.byModelSize[subject.modelSize] = 
                (stats.byModelSize[subject.modelSize] || 0) + 1;
        });

        return stats;
    }
}

module.exports = CustomSubjectService;
