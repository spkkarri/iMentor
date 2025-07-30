// server/services/podcastGenerator.js

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const say = require('say');
const axios = require('axios'); // Keep for potential ElevenLabs use

const execAsync = promisify(exec);
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'podcasts');

/**
 * Creates the audio directory if it doesn't exist.
 */
const createAudioDir = async () => {
    try {
        await fs.mkdir(AUDIO_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create audio directory:', error);
        throw error;
    }
};

// Helper to escape text for PowerShell commands
const escapeForPowerShell = (text) => {
    if (!text) return '';
    return text
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2013\u2014\u2015]/g, '-')
        .replace(/'/g, "''")
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^ -~]/g, '');
};

/**
 * Generates podcast audio using the built-in Windows SAPI.
 * This is the fallback method and requires no API keys.
 */
const generateWithSAPI = async (podcastScript, filename, timestamp) => {
    const outputPath = path.join(AUDIO_DIR, `${filename}_podcast_${timestamp}.wav`);
    console.log(`Generating podcast audio with ${podcastScript.length} segments using SAPI...`);

    const voicesCommand = `powershell -Command "Add-Type –AssemblyName System.speech; $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voices = $synthesizer.GetInstalledVoices(); $voiceNames = @(); foreach($voice in $voices) { $voiceNames += $voice.VoiceInfo.Name; } $voiceNames -join ','; $synthesizer.Dispose();"`;
    const { stdout: voicesOutput } = await execAsync(voicesCommand);
    const availableVoices = voicesOutput.trim().split(',');
    
    const voice1 = availableVoices[0] || 'Microsoft David Desktop';
    const voice2 = availableVoices.length > 1 ? availableVoices[1] : (availableVoices[0] || 'Microsoft Zira Desktop');
    console.log(`Using SAPI voices: ${voice1} and ${voice2}`);

    const tempDir = path.join(AUDIO_DIR, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const segmentFiles = [];

    for (let i = 0; i < podcastScript.length; i++) {
        const segment = podcastScript[i];
        const voiceToUse = (segment.speaker.toLowerCase().includes('b')) ? voice2 : voice1;
        const segmentFile = path.join(tempDir, `segment_${i}.wav`);
        const escapedText = escapeForPowerShell(segment.text);
        
        const segmentCommand = `powershell -Command "Add-Type –AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Rate = 0; $speak.Volume = 100; $speak.SelectVoice('${voiceToUse}'); $speak.SetOutputToWaveFile('${segmentFile}'); $speak.Speak('${escapedText}'); $speak.Dispose();"`;
        
        await execAsync(segmentCommand);
        segmentFiles.push(segmentFile);
    }

    console.log(`Generated ${segmentFiles.length} segments, combining into final podcast...`);
    const fileList = path.join(tempDir, 'filelist.txt');
    const fileListContent = segmentFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
    await fs.writeFile(fileList, fileListContent);

    const combineCommand = `ffmpeg -f concat -safe 0 -i "${fileList}" -c copy "${outputPath}" -y`;
    await execAsync(combineCommand);

    await Promise.allSettled([
        ...segmentFiles.map(file => fs.unlink(file)),
        fs.unlink(fileList),
        fs.rmdir(tempDir).catch(() => {}) // Ignore error if dir not empty
    ]);

    return outputPath;
};

/**
 * Generates podcast audio using the ElevenLabs API.
 * This is the preferred, higher-quality method.
 */
const generateWithElevenLabs = async (podcastScript, filename, timestamp) => {
    const API_KEY = process.env.ELEVENLABS_API_KEY;
    const VOICE_ID_A = process.env.ELEVENLABS_VOICE_ID_A || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
    
    const outputPath = path.join(AUDIO_DIR, `${filename}_podcast_${timestamp}.mp3`);
    console.log(`Generating podcast audio with ${podcastScript.length} segments using ElevenLabs...`);

    const fullScript = podcastScript.map(s => s.text).join(' ');
    
    const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID_A}`,
        headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
        data: { text: fullScript, model_id: 'eleven_multilingual_v2' },
        responseType: 'stream',
    });

    const writer = require('fs').createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
    });
};

/**
 * Main function to generate podcast audio.
 * It checks for an ElevenLabs API key and uses it if available, otherwise falls back to SAPI.
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

    console.log(`✅ Podcast generated: ${path.basename(finalAudioPath)} (${stats.size} bytes)`);
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5005';
    return `${baseUrl}/podcasts/${path.basename(finalAudioPath)}`;
};

module.exports = {
    generatePodcastAudio
};
