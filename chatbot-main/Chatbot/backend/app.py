# backend/app.py
# --- START OF FILE app.py ---

import os
import logging
import json
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from waitress import serve
from datetime import datetime, timezone # Correct import

# --- Initialize Logging and Configuration First ---
import config # This will now also import CHAT_CONTEXT_BUFFER_SIZE
config.setup_logging() # Configure logging based on config
logger = logging.getLogger(__name__) # Get logger for this module

# --- Import Core Modules ---
import database
import ai_core
import utils

# --- Global Flask App Setup ---
backend_dir = os.path.dirname(__file__)
# Ensure paths to templates and static are absolute or correctly relative
template_folder = os.path.join(backend_dir, 'templates')
static_folder = os.path.join(backend_dir, 'static')

if not os.path.exists(template_folder): logger.error(f"Template folder not found: {template_folder}")
if not os.path.exists(static_folder): logger.error(f"Static folder not found: {static_folder}")

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

# --- Configure CORS ---
CORS(app, resources={r"/*": {"origins": "*"}})
logger.info("CORS configured to allow all origins ('*'). This is suitable for development/campus LAN but insecure for public deployment.")

# --- Configure Uploads ---
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024 # 64MB limit
logger.info(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
logger.info(f"Max upload size: {app.config['MAX_CONTENT_LENGTH'] / (1024*1024)} MB")

try:
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    logger.info(f"Upload directory ensured: {app.config['UPLOAD_FOLDER']}")
except OSError as e:
    logger.error(f"Could not create upload directory {app.config['UPLOAD_FOLDER']}: {e}", exc_info=True)

# --- Application Initialization ---
app_db_ready = False
app_ai_ready = False
app_vector_store_ready = False
app_doc_cache_loaded = False 

def initialize_app():
    global app_db_ready, app_ai_ready, app_vector_store_ready, app_doc_cache_loaded
    if hasattr(app, 'initialized') and app.initialized:
        return

    logger.info("--- Starting Application Initialization ---")
    initialization_successful = True

    try:
        database.init_db() 
        app_db_ready = True
        logger.info("Database initialization successful.")
    except Exception as e:
        logger.critical(f"Database initialization failed: {e}. Chat history will be unavailable.", exc_info=True)
        app_db_ready = False
        initialization_successful = False 

    logger.info("Initializing AI components...")
    embed_instance, llm_instance = ai_core.initialize_ai_components()
    if not embed_instance or not llm_instance:
         logger.warning("AI components (LLM/Embeddings) failed to initialize. Check Ollama connection and model names. Chat/Analysis/Upload features relying on AI will be unavailable.")
         app_ai_ready = False
    else:
         app_ai_ready = True
         logger.info("AI components initialized successfully.")

    if app_ai_ready:
        logger.info("Loading FAISS vector store...")
        if ai_core.load_vector_store():
            app_vector_store_ready = True
            index_size = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"FAISS vector store loaded successfully (or is empty). Index size: {index_size}")
        else:
            app_vector_store_ready = False
            logger.warning("Failed to load existing FAISS vector store or it wasn't found. RAG will start with an empty index until uploads or default.py runs.")
    else:
         app_vector_store_ready = False
         logger.warning("Skipping vector store loading because AI components failed to initialize.")

    logger.info("Loading document texts into cache...")
    try:
         ai_core.load_all_document_texts()
         app_doc_cache_loaded = True
         logger.info(f"Document text cache loading complete. Cached {len(ai_core.document_texts_cache)} documents.")
    except Exception as e:
         logger.error(f"Error loading document texts into cache: {e}. Analysis of uncached docs may require on-the-fly extraction.", exc_info=True)
         app_doc_cache_loaded = False

    app.initialized = True 
    logger.info("--- Application Initialization Complete ---")
    if not initialization_successful:
         logger.critical("Initialization failed (Database Error). Application may not function correctly.")
    elif not app_ai_ready:
         logger.warning("Initialization complete, but AI components failed. Some features unavailable.")

@app.before_request
def ensure_initialized():
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

# --- Flask Routes ---

@app.route('/')
def index():
    logger.debug("Serving index.html")
    try:
        return render_template('index.html')
    except Exception as e:
         logger.error(f"Error rendering index.html: {e}", exc_info=True)
         return "Error loading application interface. Check server logs.", 500

@app.route('/favicon.ico')
def favicon():
    return Response(status=204)

@app.route('/status', methods=['GET'])
def get_status():
     vector_store_count = -1 
     if app_ai_ready and app_vector_store_ready: 
        if ai_core.vector_store and hasattr(ai_core.vector_store, 'index') and ai_core.vector_store.index:
            try:
                vector_store_count = ai_core.vector_store.index.ntotal
            except Exception as e:
                logger.warning(f"Could not get vector store count: {e}")
                vector_store_count = -2 
        else:
             vector_store_count = 0 

     status_data = {
         "status": "ok" if app_db_ready else "error", 
         "database_initialized": app_db_ready,
         "ai_components_loaded": app_ai_ready,
         "vector_store_loaded": app_vector_store_ready,
         "vector_store_entries": vector_store_count, 
         "doc_cache_loaded": app_doc_cache_loaded,
         "cached_docs_count": len(ai_core.document_texts_cache) if app_doc_cache_loaded else 0,
         "ollama_model": config.OLLAMA_MODEL,
         "embedding_model": config.OLLAMA_EMBED_MODEL,
         "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z') 
     }
     return jsonify(status_data)


@app.route('/documents', methods=['GET'])
def get_documents():
    default_files = []
    uploaded_files = []
    error_messages = []

    def _list_pdfs(folder_path, folder_name_for_error):
        files = []
        if not os.path.exists(folder_path):
            logger.warning(f"Document folder not found: {folder_path}")
            error_messages.append(f"Folder not found: {folder_name_for_error}")
            return files
        try:
            files = sorted([
                f for f in os.listdir(folder_path)
                if os.path.isfile(os.path.join(folder_path, f)) and
                   f.lower().endswith('.pdf') and
                   not f.startswith('~') 
            ])
        except OSError as e:
            logger.error(f"Error listing files in {folder_path}: {e}", exc_info=True)
            error_messages.append(f"Could not read folder: {folder_name_for_error}")
        return files

    default_files = _list_pdfs(config.DEFAULT_PDFS_FOLDER, "Default PDFs")
    uploaded_files = _list_pdfs(config.UPLOAD_FOLDER, "Uploaded PDFs")

    response_data = {
        "default_files": default_files,
        "uploaded_files": uploaded_files,
        "errors": error_messages if error_messages else None
    }
    logger.debug(f"Returning document lists: {len(default_files)} default, {len(uploaded_files)} uploaded.")
    return jsonify(response_data)


@app.route('/upload', methods=['POST'])
def upload_file():
    logger.info("File upload request received.")

    if not app_ai_ready or not ai_core.embeddings:
         logger.error("Upload failed: AI Embeddings component not initialized.")
         return jsonify({"error": "Cannot process upload: AI processing components are not ready. Check server status."}), 503

    if 'file' not in request.files:
        logger.warning("Upload request missing 'file' part.")
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if not file or not file.filename: 
        logger.warning("Upload request received with no selected file name.")
        return jsonify({"error": "No file selected"}), 400

    if not utils.allowed_file(file.filename):
         logger.warning(f"Upload attempt with disallowed file type: {file.filename}")
         return jsonify({"error": "Invalid file type. Only PDF files (.pdf) are allowed."}), 400

    filename = secure_filename(file.filename)
    if not filename: 
         logger.warning(f"Could not secure filename from: {file.filename}. Using generic name.")
         filename = f"upload_{uuid.uuid4()}.pdf" 

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    logger.debug(f"Attempting to save uploaded file to: {filepath}")

    try:
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(filepath)
        logger.info(f"File '{filename}' saved successfully to {filepath}")

        logger.info(f"Processing uploaded file: {filename}...")
        text = ai_core.extract_text_from_pdf(filepath)
        if not text:
            try:
                os.remove(filepath)
                logger.info(f"Removed file {filepath} because text extraction failed.")
            except OSError as rm_err:
                logger.error(f"Error removing problematic file {filepath} after failed text extraction: {rm_err}")
            logger.error(f"Could not extract text from uploaded file: {filename}. It might be empty, corrupted, or password-protected.")
            return jsonify({"error": f"Could not read text from '{filename}'. Please check if the PDF is valid and not password-protected."}), 400

        ai_core.document_texts_cache[filename] = text
        logger.info(f"Text extracted ({len(text)} chars) and cached for {filename}.")

        logger.debug(f"Creating document chunks for {filename}...")
        documents = ai_core.create_chunks_from_text(text, filename)
        if not documents:
             logger.error(f"Could not create document chunks for {filename}, although text was extracted. File kept and cached, but cannot add to knowledge base for chat.")
             return jsonify({"error": f"Could not process the structure of '{filename}' into searchable chunks. Analysis might work, but chat context cannot be added for this file."}), 500

        logger.debug(f"Adding {len(documents)} chunks for {filename} to vector store...")
        if not ai_core.add_documents_to_vector_store(documents):
            logger.error(f"Failed to add document chunks for '{filename}' to the vector store or save the index. Check logs.")
            return jsonify({"error": f"File '{filename}' processed, but failed to update the knowledge base index. Consult server logs."}), 500

        vector_count = -1
        if ai_core.vector_store and hasattr(ai_core.vector_store, 'index'):
             vector_count = getattr(ai_core.vector_store.index, 'ntotal', 0)
        logger.info(f"Successfully processed, cached, and indexed '{filename}'. New vector count: {vector_count}")
        return jsonify({
            "message": f"File '{filename}' uploaded and added to knowledge base successfully.",
            "filename": filename,
            "vector_count": vector_count
        }), 200 

    except Exception as e:
        logger.error(f"Unexpected error processing upload for filename '{filename}': {e}", exc_info=True)
        if 'filepath' in locals() and os.path.exists(filepath):
             try:
                 os.remove(filepath)
                 logger.info(f"Cleaned up file {filepath} after upload processing error.")
             except OSError as rm_err:
                 logger.error(f"Error attempting to clean up file {filepath} after error: {rm_err}")
        return jsonify({"error": f"An unexpected server error occurred while processing the file: {type(e).__name__}. Please check server logs."}), 500


@app.route('/analyze', methods=['POST'])
def analyze_document():
    if not app_ai_ready or not ai_core.llm:
         logger.error("Analysis request failed: LLM component not initialized.")
         return jsonify({"error": "Analysis unavailable: AI model is not ready.", "thinking": None}), 503

    data = request.get_json()
    if not data:
        logger.warning("Analysis request received without JSON body.")
        return jsonify({"error": "Invalid request: JSON body required.", "thinking": None}), 400

    filename = data.get('filename')
    analysis_type = data.get('analysis_type')
    logger.info(f"Analysis request received: type='{analysis_type}', file='{filename}'")

    if not filename or not isinstance(filename, str) or not filename.strip() or '/' in filename or '\\' in filename:
        logger.warning(f"Invalid filename received for analysis: {filename}")
        return jsonify({"error": "Missing or invalid 'filename'.", "thinking": None}), 400
    filename = filename.strip()

    allowed_types = list(config.ANALYSIS_PROMPTS.keys()) 
    if not analysis_type or analysis_type not in allowed_types:
        logger.warning(f"Invalid analysis_type received: {analysis_type}")
        return jsonify({"error": f"Invalid 'analysis_type'. Must be one of: {', '.join(allowed_types)}", "thinking": None}), 400

    try:
        analysis_content, thinking_content = ai_core.generate_document_analysis(filename, analysis_type)

        # Log content before sending to frontend for debugging
        logger.debug(f"--- Analysis for Frontend ---")
        logger.debug(f"Analysis Type: {analysis_type}")
        logger.debug(f"Raw 'analysis_content' being sent (first 300 chars): '''{analysis_content[:300] if analysis_content else 'None'}...'''")
        logger.debug(f"Raw 'thinking_content' being sent (first 300 chars): '''{thinking_content[:300] if thinking_content else 'None'}...'''")
        logger.debug(f"--- End Analysis for Frontend ---")

        if analysis_content is None:
             error_msg = f"Analysis failed: Could not retrieve or process document '{filename}'."
             status_code = 404 
             logger.error(error_msg)
             return jsonify({"error": error_msg, "thinking": thinking_content}), status_code

        elif analysis_content.startswith("Error:"):
            error_message = analysis_content 
            status_code = 500 
            if "not found" in error_message.lower():
                 status_code = 404
            elif "AI model failed" in error_message or "AI model is not available" in error_message:
                 status_code = 503 
            logger.error(f"Analysis failed for '{filename}' ({analysis_type}): {error_message}")
            return jsonify({"error": error_message, "thinking": thinking_content}), status_code
        else:
            logger.info(f"Analysis successful for '{filename}' ({analysis_type}). Content length: {len(analysis_content)}")
            return jsonify({
                "content": analysis_content,
                "thinking": thinking_content 
            })

    except Exception as e:
        logger.error(f"Unexpected error in /analyze route for '{filename}' ({analysis_type}): {e}", exc_info=True)
        return jsonify({"error": f"Unexpected server error during analysis: {type(e).__name__}. Check logs.", "thinking": None}), 500


@app.route('/chat', methods=['POST'])
def chat():
    if not app_db_ready:
        logger.error("Chat request failed: Database not initialized.")
        return jsonify({
            "error": "Chat unavailable: Database connection failed.",
            "answer": "Cannot process chat, the database is currently unavailable. Please try again later or contact support.",
            "thinking": None, "references": [], "session_id": None
        }), 503 

    if not app_ai_ready or not ai_core.llm or not ai_core.embeddings:
        logger.error("Chat request failed: AI components not initialized.")
        return jsonify({
            "error": "Chat unavailable: AI components not ready.",
            "answer": "Cannot process chat, the AI components are not ready. Please ensure Ollama is running and models are available.",
            "thinking": None, "references": [], "session_id": None
        }), 503 

    if not app_vector_store_ready and config.RAG_CHUNK_K > 0: 
        logger.warning("Chat request proceeding, but vector store is not loaded/ready. RAG context will be empty or unavailable.")

    data = request.get_json()
    if not data:
        logger.warning("Chat request received without JSON body.")
        return jsonify({"error": "Invalid request: JSON body required."}), 400

    query = data.get('query')
    session_id = data.get('session_id') 

    if not query or not isinstance(query, str) or not query.strip():
        logger.warning("Chat request received with empty or invalid query.")
        return jsonify({"error": "Query cannot be empty"}), 400
    query = query.strip()

    is_new_session = False
    if session_id:
        try:
            uuid.UUID(session_id, version=4)
        except (ValueError, TypeError, AttributeError):
            logger.warning(f"Received invalid session_id format: '{session_id}'. Generating a new session ID.")
            session_id = str(uuid.uuid4()) 
            is_new_session = True
    else:
        session_id = str(uuid.uuid4())
        is_new_session = True
        logger.info(f"New chat session started. ID: {session_id}")

    logger.info(f"Processing chat query (Session: {session_id}, New: {is_new_session}): '{query[:150]}...'")

    user_message_id = None
    try:
        user_message_id = database.save_message(session_id, 'user', query, None, None)
        if not user_message_id:
             logger.error(f"Failed to save user message to database for session {session_id}. Continuing with response generation.")
    except Exception as db_err:
         logger.error(f"Database error occurred while saving user message for session {session_id}: {db_err}", exc_info=True)

    bot_answer = "Sorry, I encountered an issue processing your request." 
    references = []
    thinking_content = None 
    chat_history_buffer_str = "No recent chat history available for this turn." # Default

    try:
        # --- START: Prepare Chat History Buffer ---
        if config.CHAT_CONTEXT_BUFFER_SIZE > 0 and not is_new_session:
            logger.debug(f"Retrieving chat history for session {session_id} to build context buffer (size: {config.CHAT_CONTEXT_BUFFER_SIZE}).")
            all_session_messages = database.get_messages_by_session(session_id) # This already orders by timestamp ASC

            if all_session_messages:
                # We want the last N Q/A pairs. Each pair is 2 messages (user, bot).
                # So, we need the last `CHAT_CONTEXT_BUFFER_SIZE * 2` messages.
                # Exclude the current user message if it's already in all_session_messages
                # (it might not be if get_messages_by_session was called before the commit flushed for the current user message)
                # For simplicity, we'll take the last N*2 messages from history *before* the current user query.
                # If the current user message (just saved) is in all_session_messages, we filter it out if it's the very last one.
                
                history_to_consider = all_session_messages
                if history_to_consider and user_message_id and history_to_consider[-1]['message_id'] == user_message_id:
                    history_to_consider = history_to_consider[:-1]

                num_messages_for_buffer = config.CHAT_CONTEXT_BUFFER_SIZE * 2
                relevant_messages = history_to_consider[-num_messages_for_buffer:]


                if relevant_messages:
                    formatted_history_parts = []
                    for msg in relevant_messages:
                        sender_label = "User" if msg['sender'] == 'user' else "AI"
                        message_text_for_buffer = msg['message_text']
                        
                        if msg['sender'] == 'bot':
                            # Strip potential <thinking> tags from historical bot messages
                            parsed_answer, _ = utils.parse_llm_response(message_text_for_buffer)
                            message_text_for_buffer = parsed_answer
                        
                        formatted_history_parts.append(f"{sender_label}: {message_text_for_buffer}")
                    
                    chat_history_buffer_str = "\n".join(formatted_history_parts)
                    logger.info(f"Prepared chat history buffer for session {session_id} with {len(relevant_messages)//2} Q/A pairs (approx {len(chat_history_buffer_str)} chars).")
                    logger.debug(f"Chat history buffer content (first 200 chars):\n{chat_history_buffer_str[:200]}...")
                else:
                    logger.debug(f"No relevant messages found to build chat history buffer for session {session_id}.")
            else:
                logger.debug(f"No messages found in history for session {session_id} to build buffer.")
        elif config.CHAT_CONTEXT_BUFFER_SIZE <= 0:
            logger.debug("Chat context buffer is disabled (CHAT_CONTEXT_BUFFER_SIZE <= 0).")
        # --- END: Prepare Chat History Buffer ---

        context_text = "No specific document context was retrieved or used for this response." 
        context_docs_map = {} 
        if app_vector_store_ready and config.RAG_CHUNK_K > 0:
            logger.debug(f"Performing RAG search (session: {session_id})...")
            context_docs, context_text, context_docs_map = ai_core.perform_rag_search(query)
            if context_docs:
                 logger.info(f"RAG search completed. Found {len(context_docs)} unique context chunks for session {session_id}.")
            else:
                 logger.info(f"RAG search completed but found no relevant chunks for session {session_id}.")
                 context_text = "No relevant document sections found for your query." 
        elif not app_vector_store_ready and config.RAG_CHUNK_K > 0:
             logger.warning(f"Skipping RAG search for session {session_id}: Vector store not ready.")
             context_text = "Knowledge base access is currently unavailable; providing general answer."
        else: 
             logger.debug(f"Skipping RAG search for session {session_id}: RAG is disabled (RAG_CHUNK_K <= 0).")
             context_text = "Document search is disabled; providing general answer."

        logger.debug(f"Synthesizing chat response (session: {session_id})...")
        bot_answer, thinking_content = ai_core.synthesize_chat_response(query, context_text, chat_history_buffer_str) # MODIFIED
        if bot_answer.startswith("Error:") or "encountered an error" in bot_answer:
             logger.error(f"LLM Synthesis failed for session {session_id}. Response: {bot_answer}")

        if context_docs_map and not (bot_answer.startswith("Error:") or "[AI Response Processing Error:" in bot_answer or "encountered an error" in bot_answer.lower()):
            logger.debug(f"Extracting references from bot answer (session: {session_id})...")
            references = utils.extract_references(bot_answer, context_docs_map)
            if references:
                logger.info(f"Extracted {len(references)} unique references for session {session_id}.")
        else:
             logger.debug(f"Skipping reference extraction for session {session_id}: No context map provided or bot answer indicates an error.")

        bot_message_id = None
        try:
            bot_message_id = database.save_message(
                session_id, 'bot', bot_answer, references, thinking_content 
            )
            if not bot_message_id:
                 logger.error(f"Failed to save bot response to database for session {session_id}.")
        except Exception as db_err:
             logger.error(f"Database error occurred while saving bot response for session {session_id}: {db_err}", exc_info=True)

        response_payload = {
            "answer": bot_answer,
            "session_id": session_id, 
            "references": references, 
            "thinking": thinking_content 
        }
        return jsonify(response_payload), 200 

    except Exception as e:
        logger.error(f"Unexpected error during chat processing pipeline for session {session_id}: {e}", exc_info=True)
        error_message = f"Sorry, an unexpected server error occurred ({type(e).__name__}). Please try again or contact support if the issue persists."
        try:
            error_thinking = f"Unexpected error in /chat route: {type(e).__name__}: {str(e)}"
            database.save_message(session_id, 'bot', error_message, None, error_thinking)
        except Exception as db_log_err:
            logger.error(f"Failed even to save the error message to DB for session {session_id}: {db_log_err}")

        return jsonify({
            "error": "Unexpected server error.",
            "answer": error_message,
            "session_id": session_id, 
            "thinking": f"Error in /chat: {type(e).__name__}", 
            "references": []
        }), 500


@app.route('/history', methods=['GET'])
def get_history():
    session_id = request.args.get('session_id')
    if not app_db_ready:
         logger.error("History request failed: Database not initialized.")
         return jsonify({"error": "History unavailable: Database connection failed."}), 503

    if not session_id:
        logger.warning("History request missing 'session_id' parameter.")
        return jsonify({"error": "Missing 'session_id' parameter"}), 400

    try:
        uuid.UUID(session_id, version=4)
    except (ValueError, TypeError, AttributeError):
        logger.warning(f"History request with invalid session_id format: {session_id}")
        return jsonify({"error": "Invalid session_id format."}), 400

    try:
        messages = database.get_messages_by_session(session_id)
        if messages is None:
            return jsonify({"error": "Could not retrieve history due to a database error. Check server logs."}), 500
        else:
            logger.info(f"Retrieved {len(messages)} messages for session {session_id}.")
            return jsonify(messages) 

    except Exception as e:
         logger.error(f"Unexpected error in /history route for session {session_id}: {e}", exc_info=True)
         return jsonify({"error": f"Unexpected server error retrieving history: {type(e).__name__}. Check logs."}), 500

if __name__ == '__main__':
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()
    try:
        port = int(os.getenv('FLASK_RUN_PORT', 5000))
        if not (1024 <= port <= 65535):
             logger.warning(f"Port {port} is outside the typical range (1024-65535). Using default 5000.")
             port = 5000
    except ValueError:
        port = 5000
        logger.warning(f"Invalid FLASK_RUN_PORT environment variable. Using default port {port}.")

    host = '0.0.0.0'
    logger.info(f"--- Starting Waitress WSGI Server ---")
    logger.info(f"Serving Flask app '{app.name}'")
    logger.info(f"Configuration:")
    logger.info(f"  - Host: {host}")
    logger.info(f"  - Port: {port}")
    logger.info(f"  - Ollama URL: {config.OLLAMA_BASE_URL}")
    logger.info(f"  - LLM Model: {config.OLLAMA_MODEL}")
    logger.info(f"  - Embedding Model: {config.OLLAMA_EMBED_MODEL}")
    logger.info(f"  - Chat Context Buffer Size: {config.CHAT_CONTEXT_BUFFER_SIZE} pairs")
    logger.info(f"Access URLs:")
    logger.info(f"  - Local: http://127.0.0.1:{port} or http://localhost:{port}")
    logger.info(f"  - Network: http://<YOUR_MACHINE_IP>:{port} (Find your IP using 'ip addr' or 'ifconfig')")

    db_status = 'Ready' if app_db_ready else 'Failed/Unavailable'
    ai_status = 'Ready' if app_ai_ready else 'Failed/Unavailable'
    index_status = 'Loaded/Ready' if app_vector_store_ready else ('Not Found/Empty' if app_ai_ready else 'Not Loaded (AI Failed)')
    cache_status = f"{len(ai_core.document_texts_cache)} docs" if app_doc_cache_loaded else "Failed/Empty"
    logger.info(f"Component Status: DB={db_status} | AI={ai_status} | Index={index_status} | DocCache={cache_status}")
    logger.info("Press Ctrl+C to stop the server.")

    serve(app, host=host, port=port, threads=8) 
# --- END OF FILE app.py ---