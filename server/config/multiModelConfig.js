/**
 * Multi-Model Configuration Management System
 * Centralized configuration for the multi-model LLM system
 */

const fs = require('fs');
const path = require('path');

class MultiModelConfig {
    constructor() {
        this.configPath = path.join(__dirname, 'multi-model-config.json');
        this.defaultConfig = this.getDefaultConfig();
        this.config = this.loadConfig();
        
        // Watch for config file changes
        this.watchConfig();
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            // System Configuration
            system: {
                enabled: process.env.USE_ENHANCED_SEARCH !== 'false',
                pythonServicePort: parseInt(process.env.ML_SERVICE_PORT) || 8001,
                maxConcurrentRequests: 10,
                requestTimeout: 30000,
                healthCheckInterval: 30000
            },

            // Model Management Configuration
            modelManagement: {
                maxModelsInMemory: parseInt(process.env.MAX_MODELS_IN_MEMORY) || 2,
                maxMemoryUsageMB: parseInt(process.env.MODEL_CACHE_SIZE_GB) * 1024 || 4096,
                modelIdleTimeout: 1800, // 30 minutes
                memoryCheckInterval: 60, // 1 minute
                enableModelCaching: true,
                cacheDirectory: path.join(__dirname, '..', 'model_cache'),
                preloadModels: (process.env.PRELOAD_MODELS || 'mathematics,programming').split(',')
            },

            // Subject Definitions
            subjects: {
                mathematics: {
                    id: 'mathematics',
                    name: 'Mathematics',
                    description: 'Arithmetic, algebra, geometry, calculus, statistics, and mathematical problem solving',
                    keywords: [
                        'math', 'mathematics', 'calculate', 'computation', 'solve', 'equation',
                        'formula', 'number', 'digit', 'sum', 'difference', 'product', 'quotient',
                        'add', 'addition', 'subtract', 'subtraction', 'multiply', 'multiplication',
                        'divide', 'division', 'plus', 'minus', 'times', 'divided',
                        'algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'probability',
                        'derivative', 'integral', 'function', 'variable', 'coefficient', 'polynomial',
                        'theorem', 'proof', 'logarithm', 'exponential', 'matrix', 'vector',
                        'triangle', 'circle', 'square', 'rectangle', 'polygon', 'angle', 'area',
                        'perimeter', 'volume', 'radius', 'diameter', 'circumference', 'hypotenuse'
                    ],
                    patterns: [
                        /\b\d+\s*[+\-*/]\s*\d+\b/,
                        /\b\d+\s*=\s*\d+\b/,
                        /\bx\s*[+\-*/=]\s*\d+\b/,
                        /\b\d+\s*%\b/,
                        /\b\d+\.\d+\b/,
                        /\b\d+\/\d+\b/
                    ],
                    priority: 2,
                    modelPath: 'models/mathematics',
                    enabled: true
                },

                programming: {
                    id: 'programming',
                    name: 'Programming',
                    description: 'Software development, coding, algorithms, debugging, and programming concepts',
                    keywords: [
                        'code', 'programming', 'program', 'software', 'development', 'coding',
                        'algorithm', 'function', 'method', 'class', 'object', 'variable',
                        'loop', 'condition', 'if', 'else', 'for', 'while', 'return',
                        'python', 'javascript', 'java', 'c++', 'c#', 'html', 'css', 'sql',
                        'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript',
                        'array', 'list', 'dictionary', 'string', 'integer', 'boolean',
                        'recursion', 'iteration', 'sorting', 'searching', 'data structure',
                        'database', 'api', 'framework', 'library', 'debugging', 'testing',
                        'def', 'class', 'import', 'from', 'try', 'except', 'finally',
                        'lambda', 'yield', 'async', 'await', 'print', 'input'
                    ],
                    patterns: [
                        /\bdef\s+\w+\s*\(/,
                        /\bclass\s+\w+\s*:/,
                        /\bimport\s+\w+/,
                        /\bprint\s*\(/,
                        /\bif\s+.*:/,
                        /\bfor\s+\w+\s+in\s+/,
                        /\b\w+\s*=\s*\[.*\]/
                    ],
                    priority: 2,
                    modelPath: 'models/programming',
                    enabled: true
                },

                science: {
                    id: 'science',
                    name: 'Science',
                    description: 'Physics, chemistry, biology, and general scientific concepts',
                    keywords: [
                        'science', 'scientific', 'experiment', 'hypothesis', 'theory', 'research',
                        'observation', 'data', 'analysis', 'conclusion', 'method',
                        'physics', 'force', 'energy', 'motion', 'velocity', 'acceleration',
                        'gravity', 'mass', 'weight', 'pressure', 'temperature', 'heat',
                        'light', 'sound', 'electricity', 'magnetism', 'atom', 'molecule',
                        'quantum', 'relativity', 'newton', 'einstein',
                        'chemistry', 'chemical', 'element', 'compound', 'reaction', 'bond',
                        'acid', 'base', 'ph', 'ion', 'electron', 'proton', 'neutron',
                        'periodic table', 'oxidation', 'reduction', 'catalyst', 'solution',
                        'biology', 'biological', 'cell', 'organism', 'species', 'evolution',
                        'dna', 'rna', 'protein', 'gene', 'chromosome', 'photosynthesis',
                        'respiration', 'ecosystem', 'habitat', 'biodiversity'
                    ],
                    patterns: [
                        /\b\d+\s*°[CF]\b/,
                        /\b\d+\s*kg\b/,
                        /\b\d+\s*m\/s\b/,
                        /\bH2O\b/,
                        /\bCO2\b/,
                        /\bNaCl\b/
                    ],
                    priority: 1,
                    modelPath: 'models/science',
                    enabled: true
                },

                history: {
                    id: 'history',
                    name: 'History',
                    description: 'Historical events, dates, civilizations, and historical analysis',
                    keywords: [
                        'history', 'historical', 'past', 'ancient', 'medieval', 'modern',
                        'century', 'decade', 'year', 'era', 'period', 'age', 'timeline',
                        'war', 'battle', 'revolution', 'empire', 'kingdom', 'civilization',
                        'culture', 'society', 'politics', 'government', 'democracy',
                        'monarchy', 'republic', 'constitution', 'independence',
                        'king', 'queen', 'emperor', 'president', 'leader', 'general',
                        'europe', 'asia', 'africa', 'america', 'rome', 'greece',
                        'egypt', 'china', 'india', 'britain', 'france', 'germany',
                        'renaissance', 'enlightenment', 'industrial revolution',
                        'world war', 'cold war', 'prehistoric', 'classical'
                    ],
                    patterns: [
                        /\b\d{4}\s*(AD|BC|CE|BCE)\b/,
                        /\b\d{1,2}(st|nd|rd|th)\s+century\b/,
                        /\bWorld\s+War\s+[I1V2]\b/
                    ],
                    priority: 1,
                    modelPath: 'models/history',
                    enabled: true
                },

                literature: {
                    id: 'literature',
                    name: 'Literature',
                    description: 'Books, poetry, authors, literary analysis, and writing techniques',
                    keywords: [
                        'literature', 'literary', 'book', 'novel', 'story', 'poem', 'poetry',
                        'author', 'writer', 'poet', 'playwright', 'character', 'plot',
                        'theme', 'setting', 'narrative', 'fiction', 'non-fiction',
                        'metaphor', 'simile', 'symbolism', 'irony', 'alliteration',
                        'personification', 'hyperbole', 'imagery', 'foreshadowing',
                        'flashback', 'allegory', 'satire', 'tragedy', 'comedy',
                        'drama', 'epic', 'sonnet', 'haiku', 'essay', 'biography',
                        'autobiography', 'memoir', 'journal', 'diary', 'letter',
                        'shakespeare', 'dickens', 'austen', 'hemingway', 'tolkien',
                        'romeo and juliet', 'hamlet', 'pride and prejudice'
                    ],
                    patterns: [
                        /"[^"]*"/,
                        /\b\w+\s+wrote\s+/,
                        /\bchapter\s+\d+\b/,
                        /\bpoem\s+by\s+\w+/
                    ],
                    priority: 1,
                    modelPath: 'models/literature',
                    enabled: true
                }
            },

            // Query Classification Configuration
            classification: {
                confidenceThreshold: 0.6,
                useKeywordClassifier: true,
                useEmbeddingClassifier: true,
                usePatternMatching: true,
                keywordWeight: 0.4,
                embeddingWeight: 0.5,
                patternWeight: 0.1,
                fallbackSubject: 'general'
            },

            // Routing Configuration
            routing: {
                strategy: 'confidence_based', // confidence_based, round_robin, load_balanced, fallback_cascade
                enableFallback: true,
                maxFallbackAttempts: 2,
                routingTimeout: 5000,
                enableLoadBalancing: false
            },

            // Training Configuration
            training: {
                enabled: process.env.ENABLE_MODEL_TRAINING === 'true',
                outputDir: path.join(__dirname, '..', 'ml_training', 'experiments'),
                modelSaveDir: path.join(__dirname, '..', 'models'),
                logsDir: path.join(__dirname, '..', 'ml_training', 'logs'),
                useWandb: !!process.env.WANDB_API_KEY,
                wandbProject: 'multi-model-llm',
                wandbEntity: process.env.WANDB_ENTITY || null
            },

            // Performance Configuration
            performance: {
                enableMetrics: true,
                metricsInterval: 60000, // 1 minute
                enableProfiling: false,
                maxResponseTime: 30000, // 30 seconds
                enableCaching: true,
                cacheSize: 1000,
                cacheTTL: 3600000 // 1 hour
            },

            // Logging Configuration
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                enableFileLogging: true,
                logDirectory: path.join(__dirname, '..', 'logs'),
                maxLogFiles: 10,
                maxLogSize: '10MB'
            }
        };
    }

    /**
     * Load configuration from file or use defaults
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                return this.mergeConfigs(this.defaultConfig, fileConfig);
            }
        } catch (error) {
            console.warn('Failed to load config file, using defaults:', error.message);
        }
        
        return this.defaultConfig;
    }

    /**
     * Deep merge two configuration objects
     */
    mergeConfigs(defaultConfig, userConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        
        deepMerge(merged, userConfig);
        return merged;
    }

    /**
     * Save current configuration to file
     */
    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log('Configuration saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save configuration:', error);
            return false;
        }
    }

    /**
     * Watch for configuration file changes
     */
    watchConfig() {
        if (fs.existsSync(this.configPath)) {
            fs.watchFile(this.configPath, (curr, prev) => {
                if (curr.mtime !== prev.mtime) {
                    console.log('Configuration file changed, reloading...');
                    this.config = this.loadConfig();
                }
            });
        }
    }

    /**
     * Get configuration value by path
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    /**
     * Set configuration value by path
     */
    set(path, value) {
        const keys = path.split('.');
        let target = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[keys[keys.length - 1]] = value;
        return this.saveConfig();
    }

    /**
     * Get all enabled subjects
     */
    getEnabledSubjects() {
        return Object.values(this.config.subjects)
            .filter(subject => subject.enabled)
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get subject configuration by ID
     */
    getSubject(subjectId) {
        return this.config.subjects[subjectId] || null;
    }

    /**
     * Add or update a subject
     */
    setSubject(subjectId, subjectConfig) {
        this.config.subjects[subjectId] = {
            id: subjectId,
            enabled: true,
            priority: 1,
            ...subjectConfig
        };
        return this.saveConfig();
    }

    /**
     * Remove a subject
     */
    removeSubject(subjectId) {
        if (this.config.subjects[subjectId]) {
            delete this.config.subjects[subjectId];
            return this.saveConfig();
        }
        return false;
    }

    /**
     * Get complete configuration
     */
    getAll() {
        return this.config;
    }

    /**
     * Reset to default configuration
     */
    reset() {
        this.config = this.defaultConfig;
        return this.saveConfig();
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        // Validate system configuration
        if (!this.config.system.pythonServicePort || this.config.system.pythonServicePort < 1000) {
            errors.push('Invalid Python service port');
        }
        
        // Validate subjects
        const subjects = this.getEnabledSubjects();
        if (subjects.length === 0) {
            errors.push('No enabled subjects found');
        }
        
        // Validate model paths
        for (const subject of subjects) {
            if (!subject.modelPath) {
                errors.push(`Missing model path for subject: ${subject.id}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Export singleton instance
module.exports = new MultiModelConfig();
