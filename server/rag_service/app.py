# server/rag_service/app.py

import os
import sys
import uuid
import re  # <-- NEW
from flask import Flask, request, jsonify, send_from_directory
import pyttsx3  # <-- NEW
from pydub import AudioSegment  # <-- NEW

# Add server directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(current_dir)
sys.path.insert(0, server_dir)

# Now import local modules AFTER adjusting sys.path
from rag_service import config
import rag_service.file_parser as file_parser
import rag_service.faiss_handler as faiss_handler
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- HELPER FUNCTIONS FOR PODCAST GENERATION (FROM YOUR SCRIPT) ---

def clean_text(text):
    text = re.sub(r'\n+', '\n', text).strip()
    text = re.sub(r'[ \t]+', ' ', text)
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')
    return text

def split_text_into_chunks(text, max_chars_per_chunk=200):
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    for sentence in sentences:
        if not sentence.strip():
            continue
        if len(current_chunk) + len(sentence) + 1 < max_chars_per_chunk:
            current_chunk += (sentence + " ").strip()
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence.strip()
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    final_chunks = []
    for chunk in chunks:
        if len(chunk) > max_chars_per_chunk:
            words = chunk.split()
            temp_chunk = ""
            for i, word in enumerate(words):
                if len(temp_chunk) + len(word) + 1 < max_chars_per_chunk:
                    temp_chunk += word + " "
                else:
                    if temp_chunk:
                        final_chunks.append(temp_chunk.strip())
                    temp_chunk = word + " "
                if i == len(words) - 1 and temp_chunk:
                     final_chunks.append(temp_chunk.strip())
        else:
            final_chunks.append(chunk)
    return final_chunks

def generate_conversational_script(text_chunks):
    script = []
    speakers = ["Alex", "Brenda"]
    
    script.append({
        "speaker": speakers[0],
        "line": "Welcome everyone! Today, we're diving into an interesting document."
    })
    script.append({
        "speaker": speakers[1],
        "line": f"That's right, {speakers[0]}. Let's see what it's all about. What's the first part you have?"
    })

    for i, chunk in enumerate(text_chunks):
        speaker_idx = i % 2
        current_speaker = speakers[speaker_idx]
        other_speaker = speakers[(speaker_idx + 1) % 2]
        script.append({"speaker": current_speaker, "line": chunk})
        if i < len(text_chunks) - 1:
            if (i + 1) % 4 == 0:
                 script.append({
                    "speaker": other_speaker,
                    "line": f"Interesting point, {current_speaker}. What comes next?"
                })
    
    script.append({
        "speaker": speakers[len(text_chunks) % 2],
        "line": "And that seems to cover the main points from the document."
    })
    script.append({
        "speaker": speakers[(len(text_chunks) + 1) % 2],
        "line": f"Indeed, {speakers[len(text_chunks) % 2]}. A good overview. Thanks for joining us, listeners!"
    })
    return script

def create_podcast_audio(script, output_filename_base, user_id):
    output_dir = os.path.join(config.PODCAST_OUTPUT_DIR, user_id)
    os.makedirs(output_dir, exist_ok=True)
    
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    voice_map = {}
    if len(voices) >= 2:
        voice_map["Alex"] = voices[0].id
        voice_map["Brenda"] = voices[1].id
    elif len(voices) == 1:
        logger.warning("Only one TTS voice available. Both speakers will sound the same.")
        voice_map["Alex"] = voice_map["Brenda"] = voices[0].id
    else:
        logger.error("No TTS voices found!")
        return None

    engine.setProperty('rate', 160)
    temp_audio_files = []
    combined_audio = AudioSegment.empty()

    for i, part in enumerate(script):
        speaker, line = part["speaker"], part["line"]
        if not line.strip(): continue
        engine.setProperty('voice', voice_map[speaker])
        temp_filename = os.path.join(output_dir, f"temp_{output_filename_base}_{i}.wav")
        
        try:
            engine.save_to_file(line, temp_filename)
            engine.runAndWait()
            if os.path.exists(temp_filename) and os.path.getsize(temp_filename) > 0:
                segment = AudioSegment.from_wav(temp_filename)
                combined_audio += segment
                temp_audio_files.append(temp_filename)
            else:
                logger.warning(f"Failed to generate or empty audio for: {line[:50]}")
        except Exception as e:
            logger.error(f"Error during TTS for '{line[:50]}...': {e}")

    final_audio_path = os.path.join(output_dir, f"{output_filename_base}.mp3")
    try:
        if len(combined_audio) > 0:
            combined_audio.export(final_audio_path, format="mp3")
        else:
            logger.error("Combined audio is empty. Cannot export.")
            return None
    finally:
        for f_path in temp_audio_files:
            if os.path.exists(f_path):
                try:
                    os.remove(f_path)
                except Exception as e_clean:
                    logger.error(f"Error deleting temp file {f_path}: {e_clean}")
    
    return os.path.join(user_id, f"{output_filename_base}.mp3")


# --- API ENDPOINTS ---

def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message}), status_code

# ... (keep your existing /health, /add_document, /query routes here) ...
@app.route('/health', methods=['GET'])
def health_check():
    # ... your existing health check code ...
    return jsonify({"status": "ok"}), 200

@app.route('/add_document', methods=['POST'])
def add_document():
    # ... your existing add_document code ...
    return jsonify({"status": "added"}), 200

@app.route('/query', methods=['POST'])
def query_index_route():
    # ... your existing query code ...
    return jsonify({"relevantDocs": []}), 200


# --- NEW ENDPOINT FOR THE NODE.JS SERVER TO CALL ---
@app.route('/generate_podcast', methods=['POST'])
def generate_podcast_from_path_route():
    logger.info("\n--- Received request at /generate_podcast ---")
    data = request.get_json()
    user_id = data.get('user_id')
    file_path = data.get('file_path')
    original_name = data.get('original_name')

    if not all([user_id, file_path, original_name]):
        return create_error_response("Missing user_id, file_path, or original_name", 400)

    if not os.path.exists(file_path):
        return create_error_response(f"File not found on server: {file_path}", 404)

    try:
        text_content = file_parser.parse_file(file_path)
        if not text_content:
            return create_error_response("Could not extract text from document.", 400)

        cleaned_text = clean_text(text_content)
        text_chunks = split_text_into_chunks(cleaned_text)
        if not text_chunks:
            return create_error_response("No text chunks could be generated from the document.", 400)

        script = generate_conversational_script(text_chunks)
        
        unique_id = uuid.uuid4()
        safe_filename = "".join(c for c in os.path.splitext(original_name)[0] if c.isalnum() or c in (' ', '_')).rstrip()
        podcast_filename_base = f"podcast_{safe_filename}_{unique_id}"
        
        relative_audio_path = create_podcast_audio(script, podcast_filename_base, user_id)

        if relative_audio_path:
            audio_url = f"{request.host_url}podcasts/{relative_audio_path.replace(os.path.sep, '/')}"
            logger.info(f"Podcast generated. URL: {audio_url}")
            return jsonify({"audioUrl": audio_url})
        else:
            return create_error_response("Server failed to generate podcast audio.", 500)
    except Exception as e:
        logger.error(f"Error in /generate_podcast route: {e}", exc_info=True)
        return create_error_response("An internal server error occurred during podcast generation.", 500)

# --- ROUTE TO SERVE THE AUDIO FILES ---
@app.route('/podcasts/<path:filename>')
def serve_podcast(filename):
    logger.info(f"Serving podcast file: {filename}")
    return send_from_directory(config.PODCAST_OUTPUT_DIR, filename)

if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        os.makedirs(config.PODCAST_OUTPUT_DIR, exist_ok=True)
        logger.info(f"Podcast output directory ensured at: {config.PODCAST_OUTPUT_DIR}")
    except Exception as e:
        logger.critical(f"CRITICAL: Could not create base directories. Exiting. Error: {e}", exc_info=True)
        sys.exit(1)

    # ... (rest of your startup code for embedding model, etc.)
    
    port = config.RAG_SERVICE_PORT
    logger.info(f"--- Starting RAG service on port {port} ---")
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG') == '1')