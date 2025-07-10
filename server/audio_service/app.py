import os
import logging
import uuid
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from waitress import serve
from dotenv import load_dotenv
import requests # For calling back to Node.js
import fitz # PyMuPDF

# Import the core logic from the file you provided
from podcast_generator import generate_podcast_script, parse_script_into_dialogue, synthesize_dual_speaker_audio

# --- Initial Setup ---
load_dotenv()
logging.basicConfig(level=logging.INFO, format='[AudioService] %(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Configuration ---
# The URL of our main Node.js backend. We will call it to use its powerful LLMs.
NODE_INTERNAL_LLM_URL = os.getenv('NODE_INTERNAL_LLM_URL', 'http://localhost:5001/api/internal/llm-task')

# The public-facing directory where final MP3s will be stored.
# This path is relative to the Node.js server's root, which will serve the files.
# IMPORTANT: The Node.js server must be configured to serve static files from a 'public' directory.
PUBLIC_AUDIO_DIR_NODE_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
os.makedirs(PUBLIC_AUDIO_DIR_NODE_PATH, exist_ok=True)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts all text from a given PDF file."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")
    try:
        doc = fitz.open(pdf_path)
        text = "".join(page.get_text() for page in doc)
        doc.close()
        logger.info(f"Successfully extracted {len(text)} characters from {os.path.basename(pdf_path)}.")
        return text
    except Exception as e:
        logger.error(f"Failed to extract text from PDF {pdf_path}: {e}", exc_info=True)
        raise IOError(f"Could not process PDF file: {e}") from e

def get_script_from_llm(document_text: str, study_focus: str) -> str:
    """Calls the Node.js server to generate the podcast script."""
    logger.info(f"Calling Node.js LLM service at {NODE_INTERNAL_LLM_URL} to generate script.")
    try:
        payload = {
            "task_type": "podcast_script",
            "document_content": document_text,
            "study_focus": study_focus,
            # We can add more parameters here later, like 'provider': 'gemini'
        }
        response = requests.post(NODE_INTERNAL_LLM_URL, json=payload, timeout=300) # 5 min timeout
        response.raise_for_status() # Raises an exception for 4xx/5xx errors
        
        script = response.json().get('result')
        if not script:
            raise ValueError("Node.js LLM service returned an empty script.")
        
        return script
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error calling Node.js LLM service: {e}", exc_info=True)
        raise ConnectionError(f"Could not connect to the Node.js LLM service: {e}") from e


@app.route('/generate-conversational', methods=['POST'])
def generate_conversational_podcast():
    """
    Main API endpoint to generate a two-speaker podcast from a document.
    """
    data = request.get_json()
    if not data or 'file_path' not in data:
        return jsonify({"error": "Missing 'file_path' in request body"}), 400

    source_file_path = data.get('file_path')
    # Use the document's own name as the study focus by default
    study_focus = data.get('study_focus', os.path.splitext(os.path.basename(source_file_path))[0])
    
    logger.info(f"Received request to generate conversational podcast for: {source_file_path}")

    try:
        # 1. Extract text from the source document
        document_text = extract_text_from_pdf(source_file_path)

        # 2. Generate the dialogue script by calling our Node.js service
        # This replaces the direct LLM call from the original podcast_generator.py
        script_text = get_script_from_llm(document_text, study_focus)
        
        # 3. Parse the script into dialogue parts
        dialogue_parts = parse_script_into_dialogue(script_text)
        if not dialogue_parts:
            raise ValueError("Failed to parse the generated script into dialogue parts.")

        # 4. Synthesize the final audio file
        unique_filename = f"podcast_{uuid.uuid4()}.mp3"
        output_filepath = os.path.join(PUBLIC_AUDIO_DIR_NODE_PATH, unique_filename)
        
        synthesize_dual_speaker_audio(dialogue_parts, output_filepath)

        # 5. Return the public URL for the client to use
        # The URL is relative to the server's root, not a file system path
        public_url = f"/audio/{unique_filename}"
        logger.info(f"Successfully generated podcast. Available at public URL: {public_url}")
        
        return jsonify({"success": True, "audioUrl": public_url}), 200

    except Exception as e:
        logger.error(f"Failed to generate podcast for {source_file_path}: {e}", exc_info=True)
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    port = int(os.getenv('AUDIO_SERVICE_PORT', 5004))
    logger.info(f"--- Starting Python Audio Generation Service ---")
    logger.info(f"Listening on: http://0.0.0.0:{port}")
    logger.info(f"Node.js LLM Endpoint: {NODE_INTERNAL_LLM_URL}")
    logger.info(f"Public Audio Output Directory: {PUBLIC_AUDIO_DIR_NODE_PATH}")
    serve(app, host='0.0.0.0', port=port, threads=4)