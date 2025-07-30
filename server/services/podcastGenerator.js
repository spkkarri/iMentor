const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const say = require('say');

const execAsync = promisify(exec);

// Audio directory
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'podcasts');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ElevenLabs API key (should be stored securely in production)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
    throw new Error('Missing ElevenLabs API key. Set ELEVENLABS_API_KEY in your environment.');
}
// Default English voices (can be customized)
const ELEVENLABS_MALE_VOICE = 'pNInz6obpgDQGcFmaJgB'; // Example: Adam
const ELEVENLABS_FEMALE_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Example: Rachel

/**
 * Create audio directory if it doesn't exist
 */
const createAudioDir = async () => {
    try {
        await fs.mkdir(AUDIO_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create audio directory:', error);
        throw error;
    }
};

/**
 * Generate TTS audio for a segment using ElevenLabs
 * @param {string} text - The text to synthesize
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {string} outputPath - Path to save the audio file
 */
async function generateTTSWithElevenLabs(text, voiceId, outputPath) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const body = {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.7,
            style: 0.5,
            use_speaker_boost: true
        }
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
}

/**
 * Generate podcast audio using ElevenLabs for TTS and FFmpeg for combining segments
 * @param {Array} podcastScript - Array of segments with speaker and text properties
 * @param {string} filename - Base filename for output
 * @returns {Promise<string>} Path to generated audio file
 */
const generatePodcastAudio = async (podcastScript, filename) => {
    try {
        if (!podcastScript || !Array.isArray(podcastScript)) {
            throw new Error('Podcast script array is required');
        }
        await createAudioDir();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const tempDir = path.join(AUDIO_DIR, 'temp_' + timestamp);
        await fs.mkdir(tempDir, { recursive: true });
        const segmentFiles = [];
        // List available voices on your Mac with: say -v '?'
        const voiceA = 'Samantha'; // Change to a valid macOS voice
        const voiceB = 'Daniel';   // Change to a valid macOS voice

        for (let i = 0; i < podcastScript.length; i++) {
            const segment = podcastScript[i];
            const text = segment.text;
            const voiceToUse = (segment.speaker.toLowerCase().includes('b') || segment.speaker.toLowerCase().includes('host b')) 
                ? voiceB 
                : voiceA;
            const segmentFile = path.join(tempDir, `segment_${i}.wav`);
            await new Promise((resolve, reject) => {
                say.export(text, voiceToUse, 1.0, segmentFile, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            segmentFiles.push(segmentFile);
        }

        // Combine segments into one file using ffmpeg
        const outputPath = path.join(AUDIO_DIR, `${safeFilename}_podcast_${timestamp}.wav`);
        const fileList = path.join(tempDir, 'filelist.txt');
        const fileListContent = segmentFiles.map(file => `file '${file}'`).join('\n');
        await fs.writeFile(fileList, fileListContent);
        const combineCommand = `ffmpeg -f concat -safe 0 -i "${fileList}" -c copy "${outputPath}" -y`;
        await execAsync(combineCommand);
        // Clean up temporary files
        await Promise.allSettled([
            ...segmentFiles.map(file => fs.unlink(file)),
            fs.unlink(fileList),
            fs.rmdir(tempDir)
        ]);
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            throw new Error('Generated audio file is empty (0 bytes)');
        }

        const port = process.env.PORT || 5007;
        const baseUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
        return `${baseUrl}/podcasts/${path.basename(outputPath)}`;
    } catch (error) {
        console.error('Error in generatePodcastAudio:', error);
        throw new Error(`Audio generation failed: ${error.message}`);
    }
};

module.exports = {
    generatePodcastAudio
};
