const gtts = require('node-gtts')('en');
const fs = require('fs');
const path = require('path');

class TextToSpeechService {
    constructor() {
        this.outputDir = path.join(__dirname, '../public/audio');
        this.ensureOutputDirectory();
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Convert text to speech and save as MP3
     * @param {string} text - Text to convert to speech
     * @param {string} filename - Output filename (without extension)
     * @returns {Promise<string>} - Path to generated audio file
     */
    async generateAudio(text, filename) {
        return new Promise((resolve, reject) => {
            try {
                const outputPath = path.join(this.outputDir, `${filename}.mp3`);
                
                console.log(`🎙️ Generating audio for: ${filename}`);
                console.log(`📝 Text length: ${text.length} characters`);
                
                // Clean up text for better speech synthesis
                const cleanText = this.cleanTextForSpeech(text);
                
                gtts.save(outputPath, cleanText, (err) => {
                    if (err) {
                        console.error('❌ TTS Error:', err);
                        reject(new Error(`Failed to generate audio: ${err.message}`));
                    } else {
                        console.log(`✅ Audio generated: ${outputPath}`);
                        resolve(outputPath);
                    }
                });
            } catch (error) {
                console.error('❌ TTS Service Error:', error);
                reject(error);
            }
        });
    }

    /**
     * Clean text for better speech synthesis
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     */
    cleanTextForSpeech(text) {
        return text
            // Remove markdown formatting
            .replace(/#{1,6}\s/g, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`(.*?)`/g, '$1') // Remove code blocks
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
            
            // Clean up special characters
            .replace(/[•·]/g, '') // Remove bullet points
            .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
            .replace(/\s{2,}/g, ' ') // Reduce multiple spaces
            
            // Add pauses for better speech flow
            .replace(/\.\s/g, '. ') // Ensure space after periods
            .replace(/\?\s/g, '? ') // Ensure space after questions
            .replace(/!\s/g, '! ') // Ensure space after exclamations
            .replace(/:\s/g, ': ') // Ensure space after colons
            
            // Trim and clean
            .trim();
    }

    /**
     * Get the public URL for an audio file
     * @param {string} filename - Filename (without extension)
     * @returns {string} - Public URL
     */
    getAudioUrl(filename) {
        return `/audio/${filename}.mp3`;
    }

    /**
     * Check if audio file exists
     * @param {string} filename - Filename (without extension)
     * @returns {boolean} - Whether file exists
     */
    audioExists(filename) {
        const filePath = path.join(this.outputDir, `${filename}.mp3`);
        return fs.existsSync(filePath);
    }

    /**
     * Delete audio file
     * @param {string} filename - Filename (without extension)
     * @returns {boolean} - Success status
     */
    deleteAudio(filename) {
        try {
            const filePath = path.join(this.outputDir, `${filename}.mp3`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted audio file: ${filename}.mp3`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error deleting audio file:', error);
            return false;
        }
    }

    /**
     * Get file size in MB
     * @param {string} filename - Filename (without extension)
     * @returns {number} - File size in MB
     */
    getFileSize(filename) {
        try {
            const filePath = path.join(this.outputDir, `${filename}.mp3`);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return (stats.size / (1024 * 1024)).toFixed(2); // Convert to MB
            }
            return 0;
        } catch (error) {
            console.error('❌ Error getting file size:', error);
            return 0;
        }
    }
}

module.exports = TextToSpeechService;
