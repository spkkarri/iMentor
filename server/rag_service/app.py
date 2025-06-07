# server/rag_service/app.py

import os
import sys
import uuid
import re
import json
import google.generativeai as genai
from flask import Flask, request, jsonify, send_from_directory
import pyttsx3
from pydub import AudioSegment

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
        if len(current_chunk) + len(sentence) + 1 < max_chars_per_chunk:
            current_chunk += (sentence + " ").strip()
        else:
            if current_chunk: chunks.append(current_chunk.strip())
            current_chunk = sentence.strip()
    if current_chunk: chunks.append(current_chunk.strip())
    return chunks

def generate_conversational_script(text_chunks):
    script = [{"speaker": "Alex", "line": "Welcome everyone! Today, we're diving into an interesting document."}]
    speakers = ["Brenda", "Alex"]
    for i, chunk in enumerate(text_chunks):
        script.append({"speaker": speakers[i % 2], "line": chunk})
    script.append({"speaker": "Alex", "line": "And that covers the main points. Thanks for joining us!"})
    return script

def create_podcast_audio(script, output_filename_base, user_id):
    output_dir = os.path.join(config.PODCAST_OUTPUT_DIR, user_id)
    os.makedirs(output_dir, exist_ok=True)
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    if len(voices) < 2:
        logger.error("Not enough TTS voices available for a two-person podcast.")
        return None
    voice_map = {"Alex": voices[0].id, "Brenda": voices[1].id}
    engine.setProperty('rate', 160)
    combined_audio = AudioSegment.empty()
    temp_files = []
    for i, part in enumerate(script):
        engine.setProperty('voice', voice_map[part["speaker"]])
        temp_filename = os.path.join(output_dir, f"temp_{i}.wav")
        engine.save_to_file(part["line"], temp_filename)
        engine.runAndWait()
        if os.path.exists(temp_filename):
            segment = AudioSegment.from_wav(temp_filename)
            combined_audio += segment
            temp_files.append(temp_filename)
    final_path = os.path.join(output_dir, f"{output_filename_base}.mp3")
    combined_audio.export(final_path, format="mp3")
    for f in temp_files: os.remove(f)
    return os.path.join(user_id, f"{output_filename_base}.mp3")

def generate_mindmap_data_with_gemini(text_content):
    model = genai.GenerativeModel(MODEL_NAME)
    prompt = f"""Analyze the following text and generate a mind map in JSON format. The structure must be: {{"central_idea": "...", "main_topics": [{{"topic": "...", "sub_topics": ["..."]}}]}}. Output only the valid JSON. Text: --- {text_content[:15000]} ---"""
    try:
        response = model.generate_content(prompt)
        raw_text = response.text
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            json_string = json_match.group(0)
            try:
                return json.loads(json_string)
            except json.JSONDecodeError as json_err:
                logger.error(f"Failed to decode extracted JSON: {json_err}")
                return None
        else:
            logger.error(f"No JSON object found in the AI's response. Raw response: {raw_text}")
            return None
    except Exception as e:
        logger.error(f"Gemini mind map generation failed with an API error: {e}")
        return None

def format_for_react_flow(mindmap_data):
    if not mindmap_data: return None
    nodes, edges = [], []
    central_id = 'node-central'
    nodes.append({'id': central_id, 'position': {'x': 400, 'y': 50}, 'data': {'label': mindmap_data.get('central_idea', 'Central Idea')}, 'type': 'input'})
    for i, main_topic in enumerate(mindmap_data.get('main_topics', [])):
        main_id = f'node-main-{i}'
        nodes.append({'id': main_id, 'position': {'x': 150 + i * 350, 'y': 250}, 'data': {'label': main_topic.get('topic', '')}})
        edges.append({'id': f'edge-central-main-{i}', 'source': central_id, 'target': main_id, 'animated': True})
        for j, sub_topic in enumerate(main_topic.get('sub_topics', [])):
            sub_id = f'node-sub-{i}-{j}'
            nodes.append({'id': sub_id, 'position': {'x': 150 + i * 350, 'y': 400 + j * 120}, 'data': {'label': sub_topic}, 'type': 'output'})
            edges.append({'id': f'edge-main-{i}-sub-{j}', 'source': main_id, 'target': sub_id})
    return {'nodes': nodes, 'edges': edges}

# --- API ENDPOINTS ---

def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message}), status_code

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

@app.route('/add_document', methods=['POST'])
def add_document():
    logger.info("\n--- Received request at /add_document (RAG Processing) ---")
    data = request.get_json()
    user_id, file_path = data.get('user_id'), data.get('file_path')
    if not all([user_id, file_path]): return create_error_response("Missing user_id or file_path", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text_content = file_parser.parse_file(file_path)
        if not text_content: return create_error_response("Could not extract text.", 400)
        faiss_handler.create_and_save_faiss_index(user_id, text_content)
        logger.info(f"Successfully indexed document for user {user_id}")
        return jsonify({"status": "processed_and_indexed"}), 200
    except Exception as e:
        logger.error(f"Error in /add_document: {e}", exc_info=True)
        return create_error_response("Error during document processing.", 500)

@app.route('/chat', methods=['POST'])
def chat_route():
    logger.info("\n--- Received request at /chat ---")
    data = request.get_json()
    history, system_prompt = data.get('history'), data.get('system_prompt', "You are a helpful assistant.")
    if not history: return create_error_response("Missing history", 400)
    try:
        model = get_model_with_prompt(system_prompt)
        history_for_session, last_message = history[:-1], history[-1]['parts'][0]['text']
        formatted_history = format_history_for_gemini(history_for_session)
        chat_session = model.start_chat(history=formatted_history)
        response = chat_session.send_message(last_message)
        return jsonify({"text": response.text})
    except Exception as e:
        logger.error(f"Error in /chat: {e}", exc_info=True)
        return create_error_response("Error during chat processing.", 500)

@app.route('/query', methods=['POST'])
def query_index_route():
    logger.info("\n--- Received request at /query (RAG) ---")
    data = request.get_json()
    user_id, history, system_prompt = data.get('user_id'), data.get('history', []), data.get('system_prompt', "You are a helpful assistant.")
    if not user_id or not history: return create_error_response("Missing user_id or history", 400)
    try:
        model = get_model_with_prompt(system_prompt)
        query, history_for_session = history[-1]['parts'][0]['text'], history[:-1]
        relevant_docs = faiss_handler.search_faiss_index(user_id, query, k=3)
        context = "\n".join([doc.page_content for doc in relevant_docs])
        rag_prompt = f"Context:\n---\n{context}\n---\nBased ONLY on the context and our conversation, answer the query. If the context is not relevant, say so.\n\nQuery: \"{query}\""
        formatted_history = format_history_for_gemini(history_for_session)
        chat_session = model.start_chat(history=formatted_history)
        response = chat_session.send_message(rag_prompt)
        return jsonify({"text": response.text, "relevantDocs": [doc.metadata for doc in relevant_docs]})
    except Exception as e:
        logger.error(f"Error in /query: {e}", exc_info=True)
        return create_error_response("Error during RAG processing.", 500)

@app.route('/generate_podcast', methods=['POST'])
def generate_podcast_from_path_route():
    logger.info("\n--- Received request at /generate_podcast ---")
    data = request.get_json()
    user_id, file_path, original_name = data.get('user_id'), data.get('file_path'), data.get('original_name')
    if not all([user_id, file_path, original_name]): return create_error_response("Missing data", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text_content = file_parser.parse_file(file_path)
        if not text_content: return create_error_response("Could not extract text.", 400)
        cleaned_text = clean_text(text_content)
        text_chunks = split_text_into_chunks(cleaned_text)
        script = generate_conversational_script(text_chunks)
        unique_id = uuid.uuid4()
        safe_filename = "".join(c for c in os.path.splitext(original_name)[0] if c.isalnum()).rstrip()
        podcast_filename_base = f"podcast_{safe_filename}_{unique_id}"
        relative_audio_path = create_podcast_audio(script, podcast_filename_base, user_id)
        if relative_audio_path:
            audio_url = f"{request.host_url}podcasts/{relative_audio_path.replace(os.path.sep, '/')}"
            return jsonify({"audioUrl": audio_url})
        else:
            return create_error_response("Failed to generate podcast audio.", 500)
    except Exception as e:
        logger.error(f"Error in /generate_podcast: {e}", exc_info=True)
        return create_error_response("Error during podcast generation.", 500)

@app.route('/generate_mindmap', methods=['POST'])
def generate_mindmap_route():
    logger.info("\n--- Received request at /generate_mindmap ---")
    data = request.get_json()
    file_path = data.get('file_path')
    if not file_path: return create_error_response("Missing file_path", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text_content = file_parser.parse_file(file_path)
        if not text_content: return create_error_response("Could not extract text.", 400)
        mindmap_data = generate_mindmap_data_with_gemini(text_content)
        if not mindmap_data: return create_error_response("AI model failed to generate mind map.", 500)
        react_flow_data = format_for_react_flow(mindmap_data)
        if not react_flow_data: return create_error_response("Failed to format mind map data.", 500)
        return jsonify(react_flow_data)
    except Exception as e:
        logger.error(f"Error in /generate_mindmap: {e}", exc_info=True)
        return create_error_response("Error during mind map generation.", 500)

@app.route('/podcasts/<path:filename>')
def serve_podcast(filename):
    return send_from_directory(config.PODCAST_OUTPUT_DIR, filename)

if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        os.makedirs(config.PODCAST_OUTPUT_DIR, exist_ok=True)
        logger.info(f"Podcast output directory ensured at: {config.PODCAST_OUTPUT_DIR}")
    except Exception as e:
        logger.critical(f"CRITICAL: Could not create base directories. Exiting. Error: {e}", exc_info=True)
        sys.exit(1)
    
    port = config.RAG_SERVICE_PORT
    logger.info(f"--- Starting RAG service on port {port} ---")
    app.run(host='0.0.0.0', port=port, debug=True)