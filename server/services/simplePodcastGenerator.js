// server/services/simplePodcastGenerator.js
// Simplified podcast generator using only Gemini AI - no third-party dependencies

const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');

class SimplePodcastGenerator {
    constructor() {
        this.geminiAI = null;
    }

    /**
     * Initialize Gemini AI service
     */
    async initialize() {
        if (!this.geminiAI) {
            try {
                const geminiService = new GeminiService();
                await geminiService.initialize();
                this.geminiAI = new GeminiAI(geminiService);
                console.log('🎙️ SimplePodcastGenerator initialized with Gemini AI');
            } catch (error) {
                console.error('Failed to initialize Gemini AI for podcast generation:', error);
                throw error;
            }
        }
    }

    /**
     * Generate a podcast script from document content using Gemini AI
     */
    async generatePodcastScript(documentContent, filename = 'document') {
        await this.initialize();

        if (!documentContent || documentContent.trim().length < 100) {
            throw new Error('Document content is too short to generate a meaningful podcast');
        }

        const prompt = `Create an engaging podcast script based on the following document content. The podcast should be conversational, informative, and suitable for audio consumption.

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
- Create a 2-3 minute podcast script (approximately 300-450 words)
- Use a conversational, engaging tone
- Structure it as a single host presentation
- Include an introduction, main content, and conclusion
- Make it sound natural when spoken aloud
- Focus on the key points and insights from the document
- Add natural transitions and pauses
- Make it accessible to a general audience

Format the response as a JSON object with this structure:
{
  "title": "Engaging podcast title based on the content",
  "script": "The complete podcast script text",
  "duration_estimate": "Estimated duration in minutes",
  "key_points": ["key point 1", "key point 2", "key point 3"]
}`;

        try {
            console.log(`🎙️ Generating podcast script for "${filename}"...`);
            const response = await this.geminiAI.generateText(prompt);
            
            // Try to parse as JSON, fallback to plain text if needed
            let podcastData;
            try {
                podcastData = JSON.parse(response);
            } catch (parseError) {
                console.warn('Failed to parse JSON response, using fallback format');
                podcastData = {
                    title: `Podcast: ${filename}`,
                    script: response,
                    duration_estimate: "2-3 minutes",
                    key_points: ["Generated from document content"]
                };
            }

            console.log(`✅ Podcast script generated: "${podcastData.title}"`);
            return podcastData;

        } catch (error) {
            console.error('Error generating podcast script:', error);
            throw new Error(`Failed to generate podcast script: ${error.message}`);
        }
    }

    /**
     * Generate a simple podcast response for browser-based text-to-speech
     * This returns the script that can be used with browser's speechSynthesis API
     */
    async generateSimplePodcast(documentContent, filename = 'document') {
        try {
            const podcastData = await this.generatePodcastScript(documentContent, filename);
            
            // Return data that can be used by the frontend for text-to-speech
            return {
                success: true,
                title: podcastData.title,
                script: podcastData.script,
                duration_estimate: podcastData.duration_estimate,
                key_points: podcastData.key_points,
                instructions: {
                    message: "Use your browser's built-in text-to-speech to listen to this podcast",
                    usage: "Click the play button to hear the podcast using your device's voice synthesis"
                }
            };

        } catch (error) {
            console.error('Error generating simple podcast:', error);
            return {
                success: false,
                error: error.message,
                fallback_script: `I apologize, but I encountered an error while generating the podcast for "${filename}". Please try again or check if the document has sufficient content.`
            };
        }
    }

    /**
     * Generate podcast script with enhanced formatting for better speech synthesis
     */
    async generateSpeechOptimizedScript(documentContent, filename = 'document') {
        await this.initialize();

        const prompt = `Create a podcast script optimized for text-to-speech synthesis based on the following document content.

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
- Create a 2-3 minute script (300-450 words)
- Use simple, clear sentences that sound natural when spoken
- Add natural pauses with commas and periods
- Avoid complex punctuation that might confuse TTS
- Use conversational language and contractions
- Include verbal transitions like "Now," "Next," "Finally"
- Make it engaging and easy to follow when listened to
- Structure: Brief intro, main points, conclusion

Return ONLY the script text, no JSON formatting:`;

        try {
            const script = await this.geminiAI.generateText(prompt);
            
            // Clean up the script for better TTS
            const cleanScript = script
                .replace(/[""]/g, '"')  // Normalize quotes
                .replace(/['']/g, "'")  // Normalize apostrophes
                .replace(/\s+/g, ' ')   // Normalize whitespace
                .replace(/\n\s*\n/g, '\n\n')  // Normalize line breaks
                .trim();

            return {
                success: true,
                title: `Podcast: ${filename}`,
                script: cleanScript,
                word_count: cleanScript.split(' ').length,
                estimated_duration: Math.ceil(cleanScript.split(' ').length / 150) + " minutes"
            };

        } catch (error) {
            console.error('Error generating speech-optimized script:', error);
            throw error;
        }
    }
}

module.exports = SimplePodcastGenerator;
