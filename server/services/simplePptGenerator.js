// server/services/simplePptGenerator.js
// Simplified PPT generator using the existing pptGenerator

const { generatePPT } = require('./pptGenerator');
const path = require('path');
const fs = require('fs');

/**
 * Generate a simple PowerPoint presentation
 * @param {string} topic - The topic for the presentation
 * @param {string} selectedModel - The AI model to use (default: 'gemini-flash')
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - Path to the generated PPT file
 */
async function generateSimplePPT(topic, selectedModel = 'gemini-flash', userId = null) {
    try {
        console.log(`[SimplePPT] Generating PPT for topic: "${topic}" using model: ${selectedModel}`);
        
        // Use the existing PPT generator
        const pptPath = await generatePPT(topic, selectedModel, userId);
        
        console.log(`[SimplePPT] PPT generated successfully: ${pptPath}`);
        
        // Verify the file exists
        if (!fs.existsSync(pptPath)) {
            throw new Error(`Generated PPT file not found: ${pptPath}`);
        }
        
        // Get file stats
        const stats = fs.statSync(pptPath);
        console.log(`[SimplePPT] File size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        return pptPath;
        
    } catch (error) {
        console.error('[SimplePPT] Error generating PPT:', error);
        throw new Error(`Failed to generate PPT: ${error.message}`);
    }
}

/**
 * Generate PPT with enhanced error handling and fallback
 * @param {string} topic - The topic for the presentation
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} - Result object with success status and file info
 */
async function generateSimplePPTWithFallback(topic, options = {}) {
    const {
        selectedModel = 'gemini-flash',
        userId = null,
        maxRetries = 2
    } = options;
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[SimplePPT] Attempt ${attempt}/${maxRetries} for topic: "${topic}"`);
            
            const pptPath = await generateSimplePPT(topic, selectedModel, userId);
            const fileName = path.basename(pptPath);
            
            return {
                success: true,
                filePath: pptPath,
                fileName: fileName,
                downloadUrl: `/api/files/download-generated/${fileName}`,
                message: `PowerPoint presentation "${topic}" generated successfully!`,
                attempt: attempt
            };
            
        } catch (error) {
            lastError = error;
            console.warn(`[SimplePPT] Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                console.log(`[SimplePPT] Retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    // All attempts failed
    console.error('[SimplePPT] All attempts failed:', lastError);
    
    return {
        success: false,
        error: lastError.message,
        message: `Failed to generate PowerPoint presentation after ${maxRetries} attempts.`,
        fallbackContent: generateFallbackContent(topic)
    };
}

/**
 * Generate fallback content when PPT generation fails
 * @param {string} topic - The topic for the presentation
 * @returns {string} - Fallback content
 */
function generateFallbackContent(topic) {
    return `# PowerPoint Presentation Outline: ${topic}

## Slide 1: Title Slide
- **Title:** ${topic}
- **Subtitle:** Comprehensive Overview
- **Date:** ${new Date().toLocaleDateString()}

## Slide 2: Introduction
- Overview of ${topic}
- Key objectives
- Presentation structure

## Slide 3: Background
- Historical context
- Current relevance
- Why ${topic} matters

## Slide 4: Current Status
- Present situation
- Recent developments
- Key statistics and facts

## Slide 5: Challenges
- Main obstacles
- Common issues
- Areas for improvement

## Slide 6: Opportunities
- Potential benefits
- Future possibilities
- Growth areas

## Slide 7: Conclusion
- Key takeaways
- Summary of main points
- Next steps

---

**Note:** This is a fallback outline. You can use this structure to create your presentation manually in PowerPoint or Google Slides.

**Recommended Tools:**
- Microsoft PowerPoint
- Google Slides
- Canva Presentations
- Prezi

**Tips for Creating Your Presentation:**
1. Use consistent fonts and colors
2. Include relevant images and charts
3. Keep text concise and bullet-pointed
4. Practice your delivery
5. Prepare for questions`;
}

/**
 * Validate topic for PPT generation
 * @param {string} topic - The topic to validate
 * @returns {Object} - Validation result
 */
function validateTopic(topic) {
    if (!topic || typeof topic !== 'string') {
        return {
            valid: false,
            error: 'Topic must be a non-empty string'
        };
    }
    
    const cleanTopic = topic.trim();
    
    if (cleanTopic.length < 3) {
        return {
            valid: false,
            error: 'Topic must be at least 3 characters long'
        };
    }
    
    if (cleanTopic.length > 200) {
        return {
            valid: false,
            error: 'Topic must be less than 200 characters'
        };
    }
    
    return {
        valid: true,
        cleanTopic: cleanTopic
    };
}

/**
 * Get available PPT generation models
 * @returns {Array} - List of available models
 */
function getAvailableModels() {
    return [
        'gemini-flash',
        'gemini-pro',
        'deepseek-chat',
        'qwen-turbo'
    ];
}

module.exports = {
    generateSimplePPT,
    generateSimplePPTWithFallback,
    generateFallbackContent,
    validateTopic,
    getAvailableModels
};
