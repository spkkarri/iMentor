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

        const prompt = `Create an engaging podcast script based on the following document content. Make it sound like a natural conversation between a male and female voice.

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
- Create a 2-3 minute podcast script (approximately 300-450 words)
- Format as a natural conversation between [Male Voice] and [Female Voice]
- Use conversational, engaging tone with natural dialogue
- Include an introduction, main discussion, and conclusion
- Make it sound like real people talking, not reading from a script
- Use natural speech patterns: "Well...", "You know...", "That's interesting..."
- Add interruptions, agreements, and natural flow
- Focus on the key points and insights from the document
- Make it accessible and engaging for listeners
- DO NOT use any actual names, just indicate [Male Voice] and [Female Voice]

Write the script as natural dialogue only. Start directly with the conversation. Example format:

[Female Voice]: Hey everyone, welcome back! Today we're diving into something really fascinating...

[Male Voice]: Absolutely! I was just reading about this and it completely changed how I think about...

[Female Voice]: Right? The part that really caught my attention was...

Write ONLY the conversational dialogue with [Male Voice] and [Female Voice] labels, no JSON, no formatting, just natural conversation between the two voices discussing the document content.`;

        try {
            console.log(`🎙️ Generating conversational podcast script for "${filename}"...`);
            const response = await this.geminiAI.generateText(prompt);

            // Clean up the response to ensure it's natural dialogue
            const cleanScript = response
                .replace(/```[\s\S]*?```/g, '') // Remove any code blocks
                .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
                .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
                .replace(/#{1,6}\s+/g, '') // Remove markdown headers
                .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
                .trim();

            const podcastData = {
                title: `Podcast Discussion: ${filename}`,
                script: cleanScript,
                duration_estimate: "2-3 minutes",
                key_points: ["Natural conversation about document content"]
            };

            console.log(`✅ Conversational podcast script generated: "${podcastData.title}"`);
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

        const prompt = `Create a natural conversation between male and female voices discussing the following document content. Optimize for text-to-speech synthesis.

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
- Create a 2-3 minute conversational script (300-450 words)
- Format as dialogue between [Male Voice] and [Female Voice]
- Use simple, clear sentences that sound natural when spoken
- Add natural pauses with commas and periods
- Avoid complex punctuation that might confuse TTS
- Use conversational language and contractions
- Include natural speech patterns: "Well...", "You know...", "That's really interesting..."
- Make voices interrupt each other naturally and agree/disagree
- Include verbal transitions and natural flow
- Make it engaging and easy to follow when listened to
- DO NOT use any actual names, just indicate [Male Voice] and [Female Voice]

Write ONLY the conversational dialogue, no formatting or JSON. Example:

[Female Voice]: Welcome back everyone! Today we're talking about something really fascinating...
[Male Voice]: Oh absolutely! When I first read about this, I was completely surprised by...
[Female Voice]: Right? The thing that really stood out to me was...

Return ONLY the natural conversation between [Male Voice] and [Female Voice]:`;

        try {
            const script = await this.geminiAI.generateText(prompt);

            // Clean up the script for better TTS and natural conversation
            const cleanScript = script
                .replace(/```[\s\S]*?```/g, '') // Remove any code blocks
                .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
                .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
                .replace(/#{1,6}\s+/g, '') // Remove markdown headers
                .replace(/[""]/g, '"')  // Normalize quotes
                .replace(/['']/g, "'")  // Normalize apostrophes
                .replace(/\s+/g, ' ')   // Normalize whitespace
                .replace(/\n\s*\n/g, '\n\n')  // Normalize line breaks
                .trim();

            return {
                success: true,
                title: `Podcast Discussion: ${filename}`,
                script: cleanScript,
                word_count: cleanScript.split(' ').length,
                estimated_duration: Math.ceil(cleanScript.split(' ').length / 150) + " minutes"
            };

        } catch (error) {
            console.error('Error generating speech-optimized script:', error);
            throw error;
        }
    }

    /**
     * Generate a single-host podcast script
     */
    async generateSingleHostPodcast(documentContent, filename = 'document') {
        await this.initialize();

        // Check if we have quota issues and provide fallback
        try {
            const prompt = `Create an engaging single-host podcast script based on the following document content.

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
- Create a 2-3 minute podcast script (approximately 300-450 words)
- Format as a single host presentation with no names mentioned
- Use conversational, engaging tone as if talking directly to listeners
- Include an introduction, main content, and conclusion
- Make it sound natural and personal, like a friend explaining something interesting
- Use natural speech patterns: "You know...", "Here's what's fascinating...", "Let me tell you about..."
- Address the audience directly: "you", "imagine this", "think about it"
- Focus on the key points and insights from the document
- Make it accessible and engaging for listeners
- DO NOT mention any host names or introduce yourself by name

Write the script as natural monologue only. Start directly with the content. Example format:

Hey there, welcome back! Today I want to share something absolutely fascinating with you...

Write ONLY the natural monologue without any names, no JSON, no formatting, just natural single-host presentation.`;

        try {
            const script = await this.geminiAI.generateText(prompt);

            // Clean up the script
            const cleanScript = script
                .replace(/```[\s\S]*?```/g, '') // Remove any code blocks
                .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
                .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
                .replace(/#{1,6}\s+/g, '') // Remove markdown headers
                .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
                .trim();

            return {
                success: true,
                title: `Podcast: ${filename}`,
                script: cleanScript,
                word_count: cleanScript.split(' ').length,
                estimated_duration: Math.ceil(cleanScript.split(' ').length / 150) + " minutes",
                format: "single-host"
            };

        } catch (error) {
            console.error('Error generating single-host script:', error);

            // If quota exceeded, provide a fallback podcast
            if (error.message.includes('quota') || error.message.includes('429')) {
                console.log('API quota exceeded, generating fallback podcast...');
                return this.generateFallbackPodcast(documentContent, filename);
            }

            throw error;
        }
    }

    /**
     * Generate a fallback podcast when AI service is unavailable
     */
    generateFallbackPodcast(documentContent, filename) {
        const words = documentContent.split(' ');
        const summary = words.slice(0, 100).join(' ') + (words.length > 100 ? '...' : '');

        const script = `Welcome to our podcast! Today we're discussing the document "${filename}".

        This document contains valuable information about ${this.extractKeyTopics(documentContent).join(', ')}.

        Here's a brief overview: ${summary}

        The document covers several important points that are worth exploring further.

        Thank you for listening to this automated podcast summary. For the full content, please refer to the original document.`;

        return {
            success: true,
            title: `Podcast: ${filename}`,
            script: script,
            duration_estimate: "2-3 minutes",
            key_points: this.extractKeyTopics(documentContent),
            instructions: {
                message: "This is a fallback podcast generated when AI services are temporarily unavailable",
                usage: "Click the play button to hear this podcast using your device's text-to-speech"
            }
        };
    }

    /**
     * Extract key topics from document content
     */
    extractKeyTopics(content) {
        const words = content.toLowerCase().split(/\s+/);
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);

        const wordCount = {};
        words.forEach(word => {
            const cleanWord = word.replace(/[^\w]/g, '');
            if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
                wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
            }
        });

        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
}

module.exports = SimplePodcastGenerator;
