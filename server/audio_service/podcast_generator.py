# server/rag_service/podcast_generator.py
import logging
import os
import re
import uuid
import subprocess
from gtts import gTTS
import io

logger = logging.getLogger(__name__)

# --- UPDATED AND MORE DIRECT PROMPT ---
PODCAST_SCRIPT_PROMPT_TEMPLATE = """
You are an AI podcast script generator. Your SOLE task is to generate a realistic, two-speaker educational dialogue based on the provided text.

**CRITICAL INSTRUCTION:** Your entire output must be ONLY the script itself. Start directly with "SPEAKER_A:". Do NOT include any preamble, introduction, or metadata like "Here is the script:".

---
## Podcast Style Guide

- **Format**: Two-speaker conversational podcast.
- **SPEAKER_A**: The "Curious Learner". Asks clarifying questions and represents the student's perspective.
- **SPEAKER_B**: The "Expert Teacher". Provides clear explanations and examples based on the document text.
- **Dialogue Flow**: The conversation must be a natural back-and-forth. SPEAKER_A asks a question, SPEAKER_B answers, and SPEAKER_A follows up.
- **Content Source**: All explanations and facts provided by SPEAKER_B MUST come from the `DOCUMENT TEXT` provided below.

---
## Script Structure

### 1. Opening
The script must begin with a brief, engaging conversation to set the stage.
`SPEAKER_A: Hey, I was just reading this document about {study_focus}, and I'm a bit stuck on a few things. Can we talk through it?`
`SPEAKER_B: Absolutely! I'd be happy to. What's on your mind?`

### 2. Main Body
The main part of the script should be a question-and-answer dialogue driven by SPEAKER_A, focusing on the key points of the `STUDY FOCUS`. Use the `DOCUMENT TEXT` to formulate SPEAKER_B's expert answers.

### 3. Closing
Conclude the podcast with a quick summary and an encouraging sign-off.
`SPEAKER_A: This makes so much more sense now. Thanks for clarifying everything!`
`SPEAKER_B: You're welcome! The key is to break it down. Keep up the great work!`

---
## Source Material

**STUDY FOCUS (The main topic for the podcast):**
{study_focus}

**DOCUMENT TEXT (Use this for all factual answers):**
{document_content}

---
**FINAL SCRIPT OUTPUT (Remember: Start IMMEDIATELY with "SPEAKER_A:")**
"""


def generate_podcast_script(source_document_text, outline_content, llm_function):
    """
    Generates a two-speaker podcast script using the LLM.
    """
    logger.info("Generating two-speaker podcast script with updated prompt...")
    
    prompt = PODCAST_SCRIPT_PROMPT_TEMPLATE.format(
        document_content=source_document_text[:40000], # Limit context to avoid excessive token usage
        study_focus=outline_content,
    )
    
    script = llm_function(prompt)
    if not script or not script.strip():
        raise ValueError("LLM failed to generate a podcast script.")
    
    logger.info(f"LLM generated two-speaker podcast script. Length: {len(script)}")
    return script

def parse_script_into_dialogue(script_text):
    """Parses the script text into a list of (speaker, text) tuples."""
    dialogue = []
    lines = script_text.split('\n')
    current_speaker = None
    current_text = ""

    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        match = re.match(r'^(SPEAKER_[AB]):(.*)', line, re.IGNORECASE)
        if match:
            if current_speaker and current_text:
                dialogue.append((current_speaker, current_text.strip()))
            
            current_speaker = match.group(1).upper()
            current_text = match.group(2).strip()
        elif current_speaker:
            current_text += " " + line
            
    if current_speaker and current_text:
        dialogue.append((current_speaker, current_text.strip()))
        
    return dialogue

def synthesize_dual_speaker_audio(dialogue, output_path):
    """
    Creates a two-speaker audio file using gTTS and FFmpeg subprocess.
    This version uses normalized, absolute paths for better compatibility on Windows.
    """
    logger.info(f"Synthesizing dual-speaker audio for {len(dialogue)} parts.")
    
    # --- MODIFICATION 1: Use absolute paths and normalize them ---
    absolute_output_path = os.path.abspath(output_path)
    temp_dir = os.path.dirname(absolute_output_path)
    session_id = str(uuid.uuid4())
    temp_files = []
    ffmpeg_playlist_path = os.path.join(temp_dir, f"playlist_{session_id}.txt")

    tts_voices = {
        'SPEAKER_A': {'lang': 'en', 'tld': 'co.uk'},
        'SPEAKER_B': {'lang': 'en', 'tld': 'com'}
    }

    try:
        for i, (speaker, text) in enumerate(dialogue):
            if not text:
                continue
            
            try:
                # Use absolute paths for all temp files
                temp_filename = os.path.join(temp_dir, f"temp_{session_id}_{i:03d}.mp3")
                voice_params = tts_voices.get(speaker, tts_voices['SPEAKER_A'])
                clean_text = text.replace('*', '').replace('[PAUSE]', '...')

                tts = gTTS(text=clean_text, lang=voice_params['lang'], tld=voice_params['tld'], slow=False)
                tts.save(temp_filename)
                
                silence_filename = os.path.join(temp_dir, f"silence_{session_id}_{i:03d}.mp3")
                # Use absolute path for silence file as well
                subprocess.run(
                    ['ffmpeg', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.7', '-q:a', '9', '-acodec', 'libmp3lame', os.path.abspath(silence_filename)],
                    check=True, capture_output=True, text=True
                )

                temp_files.append(temp_filename)
                temp_files.append(silence_filename)

            except Exception as e:
                logger.warning(f"Skipping dialogue part due to gTTS/ffmpeg silence error: {e}. Text: '{text[:50]}...'")

        if not temp_files:
            raise ValueError("No audio segments were successfully generated.")

        with open(ffmpeg_playlist_path, 'w') as f:
            for temp_file in temp_files:
                # --- MODIFICATION 2: Simplify the path written to the playlist file ---
                # Just write the direct, absolute path without extra quotes or escaping.
                f.write(f"file '{os.path.abspath(temp_file)}'\n")
        
        temp_files.append(ffmpeg_playlist_path)

        logger.info(f"Concatenating {len(temp_files)-1} audio segments into final podcast file.")
        
        # Use absolute paths in the final command as well for consistency
        ffmpeg_command = [
            'ffmpeg', '-f', 'concat', '-safe', '0', '-i', os.path.abspath(ffmpeg_playlist_path),
            '-acodec', 'libmp3lame', '-q:a', '4',
            absolute_output_path  # <-- ADD THIS MISSING VARIABLE
        ]
        
        logger.info(f"Executing FFmpeg command: {' '.join(ffmpeg_command)}")
        result = subprocess.run(ffmpeg_command, capture_output=True, text=True, check=True)
        logger.debug(f"FFmpeg stdout: {result.stdout}")
        logger.debug(f"FFmpeg stderr: {result.stderr}")
        
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg command failed with exit code {e.returncode}\nFFmpeg stderr: {e.stderr}")
        raise IOError(f"FFmpeg failed during audio processing: {e.stderr}") from e
    except Exception as e:
        logger.error(f"An unexpected error occurred during audio synthesis: {e}", exc_info=True)
        raise
    finally:
        logger.info(f"Cleaning up {len(temp_files)} temporary files...")
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except OSError as e_remove:
                logger.error(f"Error removing temporary file {temp_file}: {e_remove}")
