# rag_service/app.py

import os
import sys
import uuid
import re
import json
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
import pyttsx3
from pydub import AudioSegment
import random

# --- Configuration ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("FATAL: GEMINI_API_KEY environment variable is not set.")
genai.configure(api_key=GEMINI_API_KEY)

current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.dirname(current_dir)
sys.path.insert(0, server_dir)

from rag_service import config
import rag_service.file_parser as file_parser
import rag_service.faiss_handler as faiss_handler
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- MODEL NAME CONSTANT ---
MODEL_NAME = "gemini-1.5-flash-latest"

# --- HELPER FUNCTIONS ---
def get_model_with_prompt(system_prompt):
    return genai.GenerativeModel(MODEL_NAME, system_instruction=system_prompt)

def format_history_for_gemini(history):
    gemini_history = []
    for msg in history:
        role = 'model' if msg['role'] == 'assistant' else 'user'
        if gemini_history and gemini_history[-1]['role'] == role:
            gemini_history[-1]['parts'].append(msg['parts'][0]['text'])
        else:
            gemini_history.append({'role': role, 'parts': [part['text'] for part in msg['parts']]})
    return gemini_history

# --- PODCAST HELPER FUNCTIONS ---
def generate_advanced_podcast_script(text_content: str):
    logger.info("Generating ADVANCED conversational podcast script with Gemini...")
    model = genai.GenerativeModel(MODEL_NAME)
    prompt = f"""
    You are a master podcast scriptwriter. Your task is to transform the following technical document into an engaging, conversational podcast script for two hosts: Alex and Brenda.
    **CRITICAL INSTRUCTIONS:**
    1.  **Create a Real Dialogue:** Do not just split the text. Alex should explain a concept, and Brenda should react, ask clarifying questions, or summarize. This back-and-forth is essential.
    2.  **Use Conversational Language:** Inject natural filler words and phrases (e.g., "So, what you're saying is...", "Right, that makes sense.", "Hmm, interesting.", "Well...", "You know...").
    3.  **Structure:** The script must have a clear intro, a body with conversational turns, and a concluding outro.
    4.  **Output Format:** Your output MUST be a valid JSON array of objects. Each object must have a "speaker" key ("Alex" or "Brenda") and a "line" key. Do not include any text outside of the JSON array.
    Example of good dialogue flow:
    [
      {{"speaker": "Aswanth", "line": "Welcome to 'Docu-Dive'! Today, we're tackling a paper on Ohm's Law."}},
      {{"speaker": "Syamala", "line": "Great! So, for anyone new to this, what's the core idea of Ohm's Law, Alex?"}},
      {{"speaker": "Aswanth", "line": "Well, at its heart, it's a simple formula: V equals I times R. It describes how voltage, current, and resistance are related."}},
      {{"speaker": "Syamala", "line": "Right, so V=IR. And what do those letters actually stand for in a practical sense?"}}
    ]
    Here is the document text to transform:
    ---
    {text_content[:12000]}
    ---
    """
    try:
        response = model.generate_content(prompt)
        raw_text = response.text
        json_match = re.search(r'\[.*\]', raw_text, re.DOTALL)
        if json_match:
            json_string = json_match.group(0)
            return json.loads(json_string)
        return None
    except Exception as e:
        logger.error(f"Error during Gemini advanced script generation: {e}", exc_info=True)
        return None

def create_dynamic_podcast_audio(script, output_filename_base, user_id):
    output_dir = os.path.join(config.PODCAST_OUTPUT_DIR, user_id)
    os.makedirs(output_dir, exist_ok=True)
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        if len(voices) < 2: return None
        voice_map = {"Alex": voices[0].id, "Brenda": voices[1].id}
        combined_audio = AudioSegment.silent(duration=500)
        temp_files = []
        for i, part in enumerate(script):
            speaker, line = part.get("speaker"), part.get("line")
            if not all([speaker, line, speaker in voice_map]): continue
            engine.setProperty('rate', random.randint(155, 170))
            engine.setProperty('voice', voice_map[speaker])
            temp_filename = os.path.join(output_dir, f"temp_{i}.wav")
            engine.save_to_file(line, temp_filename)
            engine.runAndWait()
            if os.path.exists(temp_filename):
                segment = AudioSegment.from_wav(temp_filename)
                combined_audio += segment
                temp_files.append(temp_filename)
                is_last = (i == len(script) - 1)
                pause = random.randint(600, 900) if not is_last and script[i+1]['speaker'] != speaker else random.randint(250, 400)
                combined_audio += AudioSegment.silent(duration=pause)
        final_path = os.path.join(output_dir, f"{output_filename_base}.mp3")
        combined_audio.export(final_path, format="mp3")
        return os.path.join(user_id, f"{output_filename_base}.mp3")
    except Exception as e:
        logger.error(f"Error during dynamic pyttsx3 podcast generation: {e}", exc_info=True)
        return None
    finally:
        for f in temp_files:
            try: os.remove(f)
            except OSError: pass

# --- MINDMAP HELPER FUNCTIONS ---
def generate_mindmap_data_with_gemini(text_content):
    logger.info("Generating mind map data with Gemini...")
    model = genai.GenerativeModel(MODEL_NAME)
    prompt = f"""
    Analyze the following text and generate a mind map structure.
    Your output MUST be ONLY a single, valid JSON object. Do not include any other text, markdown, or explanations.
    The JSON structure must be: {{"central_idea": "...", "main_topics": [{{"topic": "...", "sub_topics": ["..."]}}]}}.
    Text to analyze:
    ---
    {text_content[:15000]}
    ---
    """
    try:
        response = model.generate_content(prompt)
        raw_text = response.text.strip()
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            json_string = json_match.group(0)
            try: return json.loads(json_string)
            except json.JSONDecodeError as json_err:
                logger.error(f"Failed to decode extracted JSON for mind map: {json_err}\nString was: {json_string}")
                return None
        else:
            logger.error(f"No JSON object in mind map response. Raw: {raw_text}")
            return None
    except Exception as e:
        logger.error(f"Gemini mind map generation failed: {e}", exc_info=True)
        return None

def format_for_react_flow(mindmap_data):
    if not mindmap_data or 'central_idea' not in mindmap_data:
        return None
        
    nodes, edges = [], []
    
    central_id = 'node-central'
    nodes.append({
        'id': central_id,
        'data': {'label': mindmap_data.get('central_idea', 'Central Idea')},
        'type': 'customInput'
    })
    
    for i, main_topic in enumerate(mindmap_data.get('main_topics', [])):
        main_id = f'node-main-{i}'
        nodes.append({
            'id': main_id,
            'data': {'label': main_topic.get('topic', 'Main Topic')},
            'type': 'customDefault'
        })
        edges.append({'id': f'edge-central-main-{i}', 'source': central_id, 'target': main_id, 'animated': True})
        
        for j, sub_topic in enumerate(main_topic.get('sub_topics', [])):
            sub_id = f'node-sub-{i}-{j}'
            nodes.append({
                'id': sub_id,
                'data': {'label': sub_topic},
                'type': 'customOutput'
            })
            edges.append({'id': f'edge-main-{i}-sub-{j}', 'source': main_id, 'target': sub_id})
            
    return {'nodes': nodes, 'edges': edges}

# --- API ENDPOINTS ---
def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message}), status_code

@app.route('/health', methods=['GET'])
def health_check(): return jsonify({"status": "ok"}), 200

@app.route('/add_document', methods=['POST'])
def add_document():
    data = request.get_json()
    user_id, file_path = data.get('user_id'), data.get('file_path')
    if not all([user_id, file_path]): return create_error_response("Missing user_id or file_path", 400)
    try:
        text_content = file_parser.parse_file(file_path)
        faiss_handler.create_and_save_faiss_index(user_id, text_content)
        return jsonify({"status": "processed_and_indexed"}), 200
    except Exception as e:
        return create_error_response(f"Error during document processing: {e}", 500)

@app.route('/chat', methods=['POST'])
def chat_route():
    data = request.get_json()
    history, system_prompt = data.get('history'), data.get('system_prompt', "You are a helpful assistant.")
    try:
        model = get_model_with_prompt(system_prompt)
        history_for_session, last_message = history[:-1], history[-1]['parts'][0]['text']
        chat_session = model.start_chat(history=format_history_for_gemini(history_for_session))
        response = chat_session.send_message(last_message)
        return jsonify({"text": response.text})
    except Exception as e:
        return create_error_response(f"Error during chat processing: {e}", 500)

# --- THIS IS THE MODIFIED AND CORRECTED ROUTE ---
@app.route('/query', methods=['POST'])
def query_index_route():
    data = request.get_json()
    user_id, history, system_prompt = data.get('user_id'), data.get('history', []), data.get('system_prompt', "You are a helpful assistant.")
    
    if not history:
        return create_error_response("History cannot be empty for a query.", 400)

    try:
        model = get_model_with_prompt(system_prompt)
        query = history[-1]['parts'][0]['text']
        history_for_session = history[:-1]
        
        relevant_docs = faiss_handler.search_faiss_index(user_id, query, k=3)
        context = "\n".join([doc.page_content for doc in relevant_docs])

        # --- BUG FIX: New, more seamless RAG prompt ---
        rag_prompt = f"""
        You are a helpful assistant. You are given a user's question and a piece of context from their document.

        Your task is to follow these rules:
        1.  First, analyze the provided context and the user's question.
        2.  If the context contains information that is relevant and sufficient to answer the question, you MUST base your answer only on that context.
        3.  If the context is NOT relevant or does not help answer the question, you MUST ignore the context completely and answer the question using your own general knowledge. Do NOT mention the context or that you are using general knowledge. Just give the direct answer.

        [CONTEXT]:
        ---
        {context}
        ---
        
        [USER'S QUESTION]: "{query}"
        """
        # --- END BUG FIX ---

        chat_session = model.start_chat(history=format_history_for_gemini(history_for_session))
        response = chat_session.send_message(rag_prompt)
        
        return jsonify({"text": response.text, "relevantDocs": [doc.metadata for doc in relevant_docs]})
    except Exception as e:
        return create_error_response(f"Error during RAG processing: {e}", 500)
# --- END OF MODIFIED ROUTE ---

@app.route('/generate_podcast', methods=['POST'])
def generate_podcast_from_path_route():
    data = request.get_json()
    user_id, file_path, original_name = data.get('user_id'), data.get('file_path'), data.get('original_name')
    try:
        text_content = file_parser.parse_file(file_path)
        script = generate_advanced_podcast_script(text_content)
        unique_id = uuid.uuid4()
        safe_filename = "".join(c for c in os.path.splitext(original_name)[0] if c.isalnum()).rstrip()
        podcast_filename_base = f"podcast_{safe_filename}_{unique_id}"
        relative_audio_path = create_dynamic_podcast_audio(script, podcast_filename_base, user_id)
        audio_url = f"{request.host_url}podcasts/{relative_audio_path.replace(os.path.sep, '/')}"
        return jsonify({"audioUrl": audio_url})
    except Exception as e:
        return create_error_response(f"Error during podcast generation: {e}", 500)

@app.route('/generate_mindmap', methods=['POST'])
def generate_mindmap_route():
    data = request.get_json()
    file_path = data.get('file_path')
    try:
        text_content = file_parser.parse_file(file_path)
        mindmap_data = generate_mindmap_data_with_gemini(text_content)
        react_flow_data = format_for_react_flow(mindmap_data)
        if react_flow_data is None:
            return create_error_response("Failed to format mind map data for React Flow.", 500)
        return jsonify(react_flow_data)
    except Exception as e:
        return create_error_response(f"Error during mind map generation: {e}", 500)

@app.route('/podcasts/<path:filename>')
def serve_podcast(filename):
    return send_from_directory(config.PODCAST_OUTPUT_DIR, filename)

# --- THIS IS THE MISSING BLOCK THAT STARTS THE SERVER ---
if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        os.makedirs(config.PODCAST_OUTPUT_DIR, exist_ok=True)
        logger.info(f"Podcast output directory ensured at: {config.PODCAST_OUTPUT_DIR}")
    except Exception as e:
        logger.critical(f"CRITICAL: Could not create base directories. Exiting. Error: {e}", exc_info=True)
        sys.exit(1)
    
    # Use the port from your config file
    port = config.RAG_SERVICE_PORT
    logger.info(f"--- Starting RAG service on port {port} ---")
    # The command that actually starts the server
    app.run(host='0.0.0.0', port=port, debug=True)