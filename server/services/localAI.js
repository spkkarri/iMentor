/**
 * Local AI Service
 * Template-based AI responses that work without any external APIs
 */

class LocalAI {
    constructor() {
        this.requestCount = 0;
        this.dailyLimit = 50; // STRICT 50 REQUEST LIMIT (even for local AI)
        this.isEnabled = true;
        this.templates = this.initializeTemplates();
    }

    initializeTemplates() {
        return {
            greeting: [
                "Hello! I'm here to help you with your questions. What would you like to know?",
                "Hi there! I can assist you with various topics including programming, math, science, and general knowledge.",
                "Greetings! Feel free to ask me anything about technology, education, or general information."
            ],
            
            programming: {
                python: `Here's how to write a Python function:

\`\`\`python
def function_name(parameters):
    """
    Function description
    """
    # Your code here
    return result

# Example - factorial function:
def factorial(n):
    """Calculate factorial of n"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Usage
result = factorial(5)  # Returns 120
\`\`\`

Key points:
- Use 'def' keyword to define functions
- Include docstrings for documentation
- Use meaningful parameter and variable names
- Return values when needed`,

                javascript: `Here's how to write JavaScript functions:

\`\`\`javascript
// Function declaration
function functionName(parameters) {
    // Your code here
    return result;
}

// Arrow function
const functionName = (parameters) => {
    // Your code here
    return result;
};

// Example - factorial function:
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// Usage
const result = factorial(5); // Returns 120
\`\`\`

Key points:
- Use 'function' keyword or arrow syntax
- JavaScript is dynamically typed
- Functions are first-class objects`,

                general: `Programming best practices:

1. **Write Clean Code**
   - Use meaningful variable names
   - Keep functions small and focused
   - Add comments for complex logic

2. **Follow DRY Principle**
   - Don't Repeat Yourself
   - Create reusable functions
   - Use modules and libraries

3. **Error Handling**
   - Use try-catch blocks
   - Validate input parameters
   - Provide meaningful error messages

4. **Testing**
   - Write unit tests
   - Test edge cases
   - Use debugging tools

5. **Version Control**
   - Use Git for version control
   - Write descriptive commit messages
   - Use branching strategies`
            },

            math: {
                basic: `Mathematical operations and concepts:

**Basic Arithmetic:**
- Addition: a + b
- Subtraction: a - b  
- Multiplication: a × b
- Division: a ÷ b

**Order of Operations (PEMDAS):**
1. Parentheses
2. Exponents
3. Multiplication and Division (left to right)
4. Addition and Subtraction (left to right)

**Common Formulas:**
- Area of circle: π × r²
- Pythagorean theorem: a² + b² = c²
- Quadratic formula: x = (-b ± √(b²-4ac)) / 2a`,

                algebra: `Algebra fundamentals:

**Solving Linear Equations:**
1. Isolate the variable
2. Use inverse operations
3. Check your answer

Example: 2x + 5 = 15
- Subtract 5: 2x = 10
- Divide by 2: x = 5

**Factoring:**
- Common factor: 6x + 9 = 3(2x + 3)
- Difference of squares: x² - 4 = (x+2)(x-2)
- Quadratic: x² + 5x + 6 = (x+2)(x+3)`
            },

            science: {
                physics: `Physics concepts:

**Newton's Laws:**
1. Object at rest stays at rest (inertia)
2. F = ma (force equals mass times acceleration)
3. Every action has equal and opposite reaction

**Energy:**
- Kinetic Energy: KE = ½mv²
- Potential Energy: PE = mgh
- Conservation: Energy cannot be created or destroyed

**Waves:**
- Frequency × Wavelength = Speed
- Sound travels ~343 m/s in air
- Light travels ~3×10⁸ m/s in vacuum`,

                chemistry: `Chemistry basics:

**Atomic Structure:**
- Protons (positive charge)
- Neutrons (no charge)
- Electrons (negative charge)

**Chemical Bonds:**
- Ionic: Transfer of electrons
- Covalent: Sharing of electrons
- Metallic: Sea of electrons

**Periodic Table:**
- Elements organized by atomic number
- Groups have similar properties
- Periods show electron shell patterns`,

                biology: `Biology fundamentals:

**Cell Theory:**
1. All living things are made of cells
2. Cells are the basic unit of life
3. All cells come from existing cells

**Photosynthesis:**
6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂

**Evolution:**
- Natural selection
- Genetic variation
- Adaptation to environment
- Survival of the fittest`
            },

            general: `I can help you with various topics:

**Technology & Programming:**
- Python, JavaScript, and other languages
- Web development and software engineering
- Algorithms and data structures

**Mathematics:**
- Arithmetic, algebra, geometry
- Calculus and statistics
- Problem-solving techniques

**Science:**
- Physics, chemistry, biology
- Scientific method and principles
- Current scientific understanding

**Learning Resources:**
- Khan Academy for comprehensive education
- Stack Overflow for programming questions
- Wikipedia for general knowledge
- GitHub for code examples and projects

What specific topic would you like to explore?`
        };
    }

    async generateText(prompt, maxTokens = 500) {
        if (!this.isEnabled) {
            throw new Error('Local AI service disabled');
        }

        // Check 50 request limit
        if (this.requestCount >= this.dailyLimit) {
            throw new Error(`🚫 Daily request limit exceeded (${this.requestCount}/50). Please try again tomorrow.`);
        }

        this.requestCount++;
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        const lowerPrompt = prompt.toLowerCase();
        let response = '';

        try {
            // Classify the prompt and generate appropriate response
            if (this.isGreeting(lowerPrompt)) {
                response = this.getRandomTemplate(this.templates.greeting);
            } else if (this.isProgrammingQuestion(lowerPrompt)) {
                response = this.handleProgrammingQuestion(lowerPrompt);
            } else if (this.isMathQuestion(lowerPrompt)) {
                response = this.handleMathQuestion(lowerPrompt);
            } else if (this.isScienceQuestion(lowerPrompt)) {
                response = this.handleScienceQuestion(lowerPrompt);
            } else {
                response = this.templates.general;
            }

            // Add context-aware introduction
            const contextIntro = this.generateContextIntro(prompt);
            response = contextIntro + '\n\n' + response;

            console.log(`✅ Local AI generated response (${this.requestCount}/50 requests used)`);
            return response;

        } catch (error) {
            console.error('Local AI error:', error);
            throw new Error('Failed to generate local AI response');
        }
    }

    isGreeting(prompt) {
        const greetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'];
        return greetings.some(greeting => prompt.includes(greeting));
    }

    isProgrammingQuestion(prompt) {
        const keywords = ['function', 'code', 'program', 'python', 'javascript', 'programming', 'algorithm', 'variable'];
        return keywords.some(keyword => prompt.includes(keyword));
    }

    isMathQuestion(prompt) {
        const keywords = ['calculate', 'math', 'equation', 'formula', 'algebra', 'geometry', 'number'];
        return keywords.some(keyword => prompt.includes(keyword));
    }

    isScienceQuestion(prompt) {
        const keywords = ['physics', 'chemistry', 'biology', 'science', 'atom', 'cell', 'energy'];
        return keywords.some(keyword => prompt.includes(keyword));
    }

    handleProgrammingQuestion(prompt) {
        if (prompt.includes('python')) {
            return this.templates.programming.python;
        } else if (prompt.includes('javascript')) {
            return this.templates.programming.javascript;
        } else {
            return this.templates.programming.general;
        }
    }

    handleMathQuestion(prompt) {
        if (prompt.includes('algebra') || prompt.includes('equation')) {
            return this.templates.math.algebra;
        } else {
            return this.templates.math.basic;
        }
    }

    handleScienceQuestion(prompt) {
        if (prompt.includes('physics')) {
            return this.templates.science.physics;
        } else if (prompt.includes('chemistry')) {
            return this.templates.science.chemistry;
        } else if (prompt.includes('biology')) {
            return this.templates.science.biology;
        } else {
            return this.templates.science.physics; // Default to physics
        }
    }

    generateContextIntro(prompt) {
        const intros = [
            `Based on your question about "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}", here's a comprehensive explanation:`,
            `Great question! Let me help you understand this topic:`,
            `I'd be happy to explain this concept:`,
            `Here's what you need to know:`
        ];
        return this.getRandomTemplate(intros);
    }

    getRandomTemplate(templates) {
        return templates[Math.floor(Math.random() * templates.length)];
    }

    getStatus() {
        return {
            service: 'LocalAI',
            enabled: this.isEnabled,
            requestCount: this.requestCount,
            dailyLimit: this.dailyLimit,
            remaining: this.dailyLimit - this.requestCount,
            type: 'template-based'
        };
    }

    reset() {
        this.requestCount = 0;
        this.isEnabled = true;
        console.log('🔄 Local AI service reset');
    }
}

module.exports = LocalAI;
