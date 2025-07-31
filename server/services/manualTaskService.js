/**
 * Manual Task Service
 * Handles common tasks without AI models using predefined logic and templates
 */

class ManualTaskService {
    constructor() {
        this.taskHandlers = new Map();
        this.initializeTaskHandlers();
    }

    initializeTaskHandlers() {
        // Programming tasks
        this.taskHandlers.set('code_review', this.handleCodeReview.bind(this));
        this.taskHandlers.set('debug_help', this.handleDebugHelp.bind(this));
        this.taskHandlers.set('function_template', this.handleFunctionTemplate.bind(this));
        this.taskHandlers.set('api_documentation', this.handleApiDocumentation.bind(this));
        
        // Data processing tasks
        this.taskHandlers.set('data_analysis', this.handleDataAnalysis.bind(this));
        this.taskHandlers.set('file_processing', this.handleFileProcessing.bind(this));
        this.taskHandlers.set('text_formatting', this.handleTextFormatting.bind(this));
        
        // Research tasks
        this.taskHandlers.set('resource_compilation', this.handleResourceCompilation.bind(this));
        this.taskHandlers.set('topic_outline', this.handleTopicOutline.bind(this));
        this.taskHandlers.set('learning_path', this.handleLearningPath.bind(this));
        
        // Utility tasks
        this.taskHandlers.set('calculation', this.handleCalculation.bind(this));
        this.taskHandlers.set('conversion', this.handleConversion.bind(this));
        this.taskHandlers.set('validation', this.handleValidation.bind(this));
    }

    async performTask(taskType, parameters = {}) {
        console.log(`🔧 Manual task: ${taskType}`);
        
        if (this.taskHandlers.has(taskType)) {
            return await this.taskHandlers.get(taskType)(parameters);
        } else {
            return this.handleGenericTask(taskType, parameters);
        }
    }

    handleCodeReview(params) {
        const { code, language = 'javascript' } = params;
        
        const checklist = {
            javascript: [
                'Use const/let instead of var',
                'Add error handling with try-catch',
                'Use meaningful variable names',
                'Add JSDoc comments',
                'Check for memory leaks',
                'Validate input parameters'
            ],
            python: [
                'Follow PEP 8 style guide',
                'Add type hints',
                'Use docstrings for functions',
                'Handle exceptions properly',
                'Use list comprehensions where appropriate',
                'Check for security vulnerabilities'
            ]
        };

        return {
            task: 'code_review',
            checklist: checklist[language] || checklist.javascript,
            recommendations: [
                'Run linting tools (ESLint, Pylint)',
                'Write unit tests',
                'Check performance implications',
                'Review security considerations',
                'Ensure code readability'
            ],
            tools: {
                javascript: ['ESLint', 'Prettier', 'Jest'],
                python: ['Pylint', 'Black', 'pytest']
            }
        };
    }

    handleDebugHelp(params) {
        const { error, language = 'javascript' } = params;
        
        const debugSteps = [
            '1. Read the error message carefully',
            '2. Check the line number mentioned',
            '3. Look for syntax errors (missing brackets, semicolons)',
            '4. Verify variable names and scope',
            '5. Check function parameters and return values',
            '6. Use console.log() or print() statements',
            '7. Use browser dev tools or IDE debugger',
            '8. Search for similar errors online'
        ];

        const commonErrors = {
            javascript: {
                'ReferenceError': 'Variable not defined or out of scope',
                'TypeError': 'Wrong data type or null/undefined access',
                'SyntaxError': 'Invalid syntax, check brackets and semicolons'
            },
            python: {
                'NameError': 'Variable not defined or misspelled',
                'TypeError': 'Wrong data type or incorrect function call',
                'IndentationError': 'Incorrect indentation'
            }
        };

        return {
            task: 'debug_help',
            steps: debugSteps,
            commonErrors: commonErrors[language] || commonErrors.javascript,
            tools: ['Browser DevTools', 'VS Code Debugger', 'Console logging'],
            resources: [
                'Stack Overflow',
                'MDN Web Docs (JavaScript)',
                'Python.org documentation'
            ]
        };
    }

    handleFunctionTemplate(params) {
        const { language = 'javascript', functionName = 'myFunction', purpose = 'general' } = params;
        
        const templates = {
            javascript: {
                basic: `function ${functionName}(param1, param2) {
    // TODO: Add function description
    try {
        // Your code here
        return result;
    } catch (error) {
        console.error('Error in ${functionName}:', error);
        throw error;
    }
}`,
                async: `async function ${functionName}(param1, param2) {
    // TODO: Add function description
    try {
        const result = await someAsyncOperation(param1, param2);
        return result;
    } catch (error) {
        console.error('Error in ${functionName}:', error);
        throw error;
    }
}`,
                arrow: `const ${functionName} = (param1, param2) => {
    // TODO: Add function description
    try {
        // Your code here
        return result;
    } catch (error) {
        console.error('Error in ${functionName}:', error);
        throw error;
    }
};`
            },
            python: {
                basic: `def ${functionName}(param1, param2):
    """
    TODO: Add function description
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        Description of return value
    """
    try:
        # Your code here
        return result
    except Exception as e:
        print(f"Error in ${functionName}: {e}")
        raise`,
                class_method: `def ${functionName}(self, param1, param2):
    """
    TODO: Add method description
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        Description of return value
    """
    try:
        # Your code here
        return result
    except Exception as e:
        print(f"Error in ${functionName}: {e}")
        raise`
            }
        };

        return {
            task: 'function_template',
            language: language,
            templates: templates[language] || templates.javascript,
            bestPractices: [
                'Use descriptive function names',
                'Add proper documentation',
                'Handle errors gracefully',
                'Keep functions focused on single responsibility',
                'Use type hints (Python) or JSDoc (JavaScript)'
            ]
        };
    }

    handleResourceCompilation(params) {
        const { topic = 'programming' } = params;
        
        const resources = {
            programming: {
                documentation: [
                    'MDN Web Docs - developer.mozilla.org',
                    'Python.org - python.org',
                    'Node.js Docs - nodejs.org/docs'
                ],
                tutorials: [
                    'freeCodeCamp - freecodecamp.org',
                    'Codecademy - codecademy.com',
                    'Khan Academy - khanacademy.org'
                ],
                practice: [
                    'LeetCode - leetcode.com',
                    'HackerRank - hackerrank.com',
                    'Codewars - codewars.com'
                ],
                communities: [
                    'Stack Overflow - stackoverflow.com',
                    'GitHub - github.com',
                    'Reddit r/programming - reddit.com/r/programming'
                ]
            },
            'machine learning': {
                courses: [
                    'Coursera ML Course - coursera.org',
                    'edX MIT Introduction to ML - edx.org',
                    'Udacity ML Nanodegree - udacity.com'
                ],
                tools: [
                    'Jupyter Notebooks - jupyter.org',
                    'Google Colab - colab.research.google.com',
                    'Kaggle - kaggle.com'
                ],
                libraries: [
                    'scikit-learn - scikit-learn.org',
                    'TensorFlow - tensorflow.org',
                    'PyTorch - pytorch.org'
                ]
            }
        };

        return {
            task: 'resource_compilation',
            topic: topic,
            resources: resources[topic] || resources.programming,
            nextSteps: [
                'Start with documentation to understand basics',
                'Follow tutorials for hands-on practice',
                'Join communities for support and networking',
                'Work on personal projects to apply knowledge'
            ]
        };
    }

    handleCalculation(params) {
        const { expression, type = 'basic' } = params;
        
        // Simple calculator for basic operations
        const calculate = (expr) => {
            try {
                // Basic safety check - only allow numbers and basic operators
                if (!/^[0-9+\-*/.() ]+$/.test(expr)) {
                    throw new Error('Invalid characters in expression');
                }
                
                // Use Function constructor for safe evaluation
                return Function('"use strict"; return (' + expr + ')')();
            } catch (error) {
                return 'Error: Invalid expression';
            }
        };

        const result = expression ? calculate(expression) : null;

        return {
            task: 'calculation',
            expression: expression,
            result: result,
            formulas: {
                area: {
                    circle: 'π × r²',
                    rectangle: 'length × width',
                    triangle: '½ × base × height'
                },
                physics: {
                    force: 'F = ma',
                    energy: 'E = mc²',
                    power: 'P = VI'
                }
            },
            tools: [
                'Wolfram Alpha - wolframalpha.com',
                'Desmos Calculator - desmos.com/calculator',
                'Google Calculator - google.com'
            ]
        };
    }

    handleGenericTask(taskType, params) {
        return {
            task: taskType,
            message: `Manual task handler for "${taskType}" not implemented yet.`,
            suggestions: [
                'Break down the task into smaller steps',
                'Use online tools and resources',
                'Consult documentation and tutorials',
                'Ask for help in relevant communities'
            ],
            resources: [
                'Google Search',
                'Stack Overflow',
                'GitHub',
                'Documentation sites'
            ]
        };
    }

    getAvailableTasks() {
        return Array.from(this.taskHandlers.keys());
    }
}

module.exports = ManualTaskService;
