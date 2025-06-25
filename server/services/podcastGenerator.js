const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Audio directory
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'podcasts');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Create audio directory if it doesn't exist
 */
const createAudioDir = async () => {
    try {
        await fs.mkdir(AUDIO_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create audio directory:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
};

// Helper to escape text for PowerShell
const escapeForPowerShell = (text) => {
    return text
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // curly/special single quotes to straight
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // curly/special double quotes to straight
        .replace(/[\u2013\u2014\u2015]/g, '-') // dashes to hyphen
        .replace(/'/g, "''") // escape single quotes for PowerShell
        .replace(/[\r\n]+/g, ' ') // newlines to space
        .replace(/[^ -~]/g, ''); // remove non-ASCII
};

/**
 * Generate podcast audio using Windows SAPI with multiple voices
 * @param {Array} podcastScript - Array of segments with speaker and text properties
 * @param {string} filename - Base filename for output
 * @returns {Promise<string>} Path to generated audio file
 */
const generatePodcastAudio = async (podcastScript, filename) => {
    try {
        // Validate input
        if (!podcastScript || !Array.isArray(podcastScript)) {
            throw new Error('Podcast script array is required');
        }
        
        // Create directory if it doesn't exist
        await createAudioDir();

        // Generate a unique filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const outputPath = path.join(AUDIO_DIR, `${safeFilename}_podcast_${timestamp}.wav`);

        console.log(`Generating podcast audio with ${podcastScript.length} segments...`);

        // Get available voices and select two different ones
        const voicesCommand = `powershell -Command "Add-Type –AssemblyName System.speech; $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer; $voices = $synthesizer.GetInstalledVoices(); $voiceNames = @(); foreach($voice in $voices) { $voiceNames += $voice.VoiceInfo.Name; } $voiceNames -join ','; $synthesizer.Dispose();"`;
        
        const { stdout: voicesOutput } = await execAsync(voicesCommand);
        const availableVoices = voicesOutput.trim().split(',');
        
        // Simple voice selection - first two available voices
        const voice1 = availableVoices[0] || 'Microsoft David Desktop';
        const voice2 = availableVoices[1] || 'Microsoft Zira Desktop';

        console.log(`Using voices: ${voice1} and ${voice2}`);

        // Create temporary directory for individual segments
        const tempDir = path.join(AUDIO_DIR, 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const segmentFiles = [];

        // Generate audio for each segment with appropriate voice
        for (let i = 0; i < podcastScript.length; i++) {
            const segment = podcastScript[i];
            const speaker = segment.speaker;
            const text = segment.text;
            
            // Determine which voice to use based on speaker
            const voiceToUse = (speaker.toLowerCase().includes('b') || speaker.toLowerCase().includes('host b')) 
                ? voice2 
                : voice1;

            const segmentFile = path.join(tempDir, `segment_${i}.wav`);
            const escapedText = escapeForPowerShell(text);
            
            const segmentCommand = `powershell -Command "Add-Type –AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Rate = 0; $speak.Volume = 100; $speak.SelectVoice('${voiceToUse}'); $speak.SetOutputToWaveFile('${segmentFile}'); $speak.Speak('${escapedText}'); $speak.Dispose();"`;
            
            await execAsync(segmentCommand);
            segmentFiles.push(segmentFile);
        }

        console.log(`Generated ${segmentFiles.length} segments, combining into final podcast...`);
            
        // Combine all segments into one file using FFmpeg
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

        // Verify the file was created and has content
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            throw new Error('Generated audio file is empty (0 bytes)');
        }
        
        console.log(`✅ Podcast generated: ${path.basename(outputPath)} (${stats.size} bytes)`);
        
        // Return the full URL for the frontend
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:5001';
        return `${baseUrl}/podcasts/${path.basename(outputPath)}`;

    } catch (error) {
        console.error('Error in generatePodcastAudio:', error);
        throw new Error(`Audio generation failed: ${error.message}`);
    }
};

module.exports = {
    generatePodcastAudio
};