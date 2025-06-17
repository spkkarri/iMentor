# --- START OF FILE app.py ---

import os
import logging
import json
import uuid
from flask import request
import requests
from bs4 import BeautifulSoup
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from waitress import serve
from datetime import datetime, timezone # Correct import
from duckduckgo_search import DDGS
import re


# --- Initialize Logging and Configuration First ---
import config
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
# Allowing all origins for campus IP access as requested. REMEMBER THE SECURITY IMPLICATIONS.
CORS(app, resources={r"/*": {"origins": "*"}})
logger.info("CORS configured to allow all origins ('*'). This is suitable for development/campus LAN but insecure for public deployment.")

# --- Configure Uploads ---
app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024 # 64MB limit
logger.info(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
logger.info(f"Max upload size: {app.config['MAX_CONTENT_LENGTH'] / (1024*1024)} MB")

# Ensure upload directory exists
try:
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    logger.info(f"Upload directory ensured: {app.config['UPLOAD_FOLDER']}")
except OSError as e:
    logger.error(f"Could not create upload directory {app.config['UPLOAD_FOLDER']}: {e}", exc_info=True)
    # Decide if critical? App can run without uploads. Log and continue for now.

# --- Application Initialization ---
# Flags to track initialization status
app_db_ready = False
app_ai_ready = False
app_vector_store_ready = False
app_doc_cache_loaded = False # Flag for document text cache

def initialize_app():
    """Initializes database, AI components, loads index and document texts."""
    global app_db_ready, app_ai_ready, app_vector_store_ready, app_doc_cache_loaded
    # Prevent re-initialization if called multiple times
    if hasattr(app, 'initialized') and app.initialized:
        # logger.debug("Application already initialized.")
        return

    logger.info("--- Starting Application Initialization ---")
    initialization_successful = True

    # 1. Initialize Database
    try:
        database.init_db() # This now returns nothing, just logs errors/success
        # Check connection after init attempt (optional, assumes init_db raises on critical failure)
        # conn = database.get_db_connection()
        # conn.close()
        app_db_ready = True
        logger.info("Database initialization successful.")
    except Exception as e:
        logger.critical(f"Database initialization failed: {e}. Chat history will be unavailable.", exc_info=True)
        app_db_ready = False
        initialization_successful = False # DB is critical

    # 2. Initialize AI Components (Embeddings + LLM)
    logger.info("Initializing AI components...")
    embed_instance, llm_instance = ai_core.initialize_ai_components()
    if not embed_instance or not llm_instance:
         logger.warning("AI components (LLM/Embeddings) failed to initialize. Check Ollama connection and model names. Chat/Analysis/Upload features relying on AI will be unavailable.")
         app_ai_ready = False
         # Let initialization proceed, but AI features won't work
         # initialization_successful = False # Only fail if AI is absolutely essential for startup
    else:
         app_ai_ready = True
         # Set globals in ai_core if initialize_ai_components doesn't do it anymore
         # ai_core.embeddings = embed_instance # Assuming initialize sets globals
         # ai_core.llm = llm_instance
         logger.info("AI components initialized successfully.")

    # 3. Load FAISS Vector Store (requires embeddings)
    if app_ai_ready:
        logger.info("Loading FAISS vector store...")
        if ai_core.load_vector_store():
            app_vector_store_ready = True
            index_size = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"FAISS vector store loaded successfully (or is empty). Index size: {index_size}")
        else:
            app_vector_store_ready = False
            logger.warning("Failed to load existing FAISS vector store or it wasn't found. RAG will start with an empty index until uploads or default.py runs.")
            # Not necessarily a failure for the app to start
    else:
         app_vector_store_ready = False
         logger.warning("Skipping vector store loading because AI components failed to initialize.")

    # 4. Load Document Texts into Cache (for analysis) - Best effort
    logger.info("Loading document texts into cache...")
    try:
         ai_core.load_all_document_texts()
         app_doc_cache_loaded = True
         logger.info(f"Document text cache loading complete. Cached {len(ai_core.document_texts_cache)} documents.")
    except Exception as e:
         logger.error(f"Error loading document texts into cache: {e}. Analysis of uncached docs may require on-the-fly extraction.", exc_info=True)
         app_doc_cache_loaded = False
         # Not a critical failure

    app.initialized = True # Set flag after first run
    logger.info("--- Application Initialization Complete ---")
    if not initialization_successful:
         logger.critical("Initialization failed (Database Error). Application may not function correctly.")
    elif not app_ai_ready:
         logger.warning("Initialization complete, but AI components failed. Some features unavailable.")


# Run initialization before the first request using Flask's mechanism
@app.before_request
def ensure_initialized():
    # This ensures initialization runs once before the first request handles.
    # The flag prevents it from running on every request.
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()


# --- Flask Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    logger.debug("Serving index.html")
    try:
        # Pass backend status flags to the template if needed for UI elements
        # status = get_status().get_json() # Get current status
        return render_template('index.html')#, backend_status=status)
    except Exception as e:
         logger.error(f"Error rendering index.html: {e}", exc_info=True)
         return "Error loading application interface. Check server logs.", 500

# Static files (CSS, JS) are handled automatically by Flask if static_folder is set correctly
@app.route('/web-search', methods=['POST'])
def web_search():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=5):
                title = r.get("title", "")
                snippet = r.get("body", "")
                if title or snippet:
                    results.append(f"**{title}**\n{snippet}")

        if not results:
            return jsonify({"answer": "No results found.", "source": "DuckDuckGo"})

        answer = "\n\n".join(results)
        return jsonify({"answer": answer, "source": "DuckDuckGo"})

    except Exception as e:
        return jsonify({"error": f"DuckDuckGo search failed: {str(e)}"}), 500
@app.route('/favicon.ico')
def favicon():
    """Handles browser requests for favicon.ico to avoid 404s."""
    # If you have a favicon.ico in your static folder:
    # return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')
    # If not, return 204 No Content:
    # logger.debug("Favicon request received, returning 204.")
    return Response(status=204)

@app.route('/status', methods=['GET'])
def get_status():
     """Endpoint to check backend status and component readiness."""
     # logger.debug("Status endpoint requested.") # Can be noisy
     vector_store_count = -1 # Indicate not checked or error initially
     if app_ai_ready and app_vector_store_ready: # Only check count if store should be ready
        if ai_core.vector_store and hasattr(ai_core.vector_store, 'index') and ai_core.vector_store.index:
            try:
                vector_store_count = ai_core.vector_store.index.ntotal
            except Exception as e:
                logger.warning(f"Could not get vector store count: {e}")
                vector_store_count = -2 # Indicate error getting count
        else:
             vector_store_count = 0 # Store loaded but might be empty

     status_data = {
         "status": "ok" if app_db_ready else "error", # Base status depends on DB
         "database_initialized": app_db_ready,
         "ai_components_loaded": app_ai_ready,
         "vector_store_loaded": app_vector_store_ready,
         "vector_store_entries": vector_store_count, # -1:NotChecked/AI down, -2:Error, 0+:Count
         "doc_cache_loaded": app_doc_cache_loaded,
         "cached_docs_count": len(ai_core.document_texts_cache) if app_doc_cache_loaded else 0,
         "ollama_model": config.OLLAMA_MODEL,
         "embedding_model": config.OLLAMA_EMBED_MODEL,
         "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z') # Standard ISO UTC
     }
     # logger.debug(f"Returning status: {status_data}")
     return jsonify(status_data)


@app.route('/documents', methods=['GET'])
def get_documents():
    """Returns sorted lists of default and uploaded PDF filenames."""
    # logger.debug("Documents list endpoint requested.")
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
            # List, filter for PDFs, ensure they are files, sort
            files = sorted([
                f for f in os.listdir(folder_path)
                if os.path.isfile(os.path.join(folder_path, f)) and
                   f.lower().endswith('.pdf') and
                   not f.startswith('~') # Ignore temp files
            ])
        except OSError as e:
            logger.error(f"Error listing files in {folder_path}: {e}", exc_info=True)
            error_messages.append(f"Could not read folder: {folder_name_for_error}")
        return files

    default_files = _list_pdfs(config.DEFAULT_PDFS_FOLDER, "Default PDFs")
    uploaded_files = _list_pdfs(config.UPLOAD_FOLDER, "Uploaded PDFs")

    # Combine and deduplicate for the dropdown if needed, or return separately
    # For separate lists as requested:
    response_data = {
        "default_files": default_files,
        "uploaded_files": uploaded_files,
        "errors": error_messages if error_messages else None
    }
    logger.debug(f"Returning document lists: {len(default_files)} default, {len(uploaded_files)} uploaded.")
    return jsonify(response_data)


@app.route('/upload', methods=['POST'])
def upload_file():
    """Handles PDF uploads, processing, caching, and adding to FAISS."""
    logger.info("File upload request received.")

    # --- Check AI readiness (needed for embedding) ---
    if not app_ai_ready or not ai_core.embeddings:
         logger.error("Upload failed: AI Embeddings component not initialized.")
         # 503 Service Unavailable is appropriate
         return jsonify({"error": "Cannot process upload: AI processing components are not ready. Check server status."}), 503

    # --- File Handling ---
    if 'file' not in request.files:
        logger.warning("Upload request missing 'file' part.")
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if not file or not file.filename: # Check if filename is empty string
        logger.warning("Upload request received with no selected file name.")
        return jsonify({"error": "No file selected"}), 400

    if not utils.allowed_file(file.filename):
         logger.warning(f"Upload attempt with disallowed file type: {file.filename}")
         return jsonify({"error": "Invalid file type. Only PDF files (.pdf) are allowed."}), 400

    # Sanitize filename
    filename = secure_filename(file.filename)
    if not filename: # secure_filename might return empty if input is weird
         logger.warning(f"Could not secure filename from: {file.filename}. Using generic name.")
         filename = f"upload_{uuid.uuid4()}.pdf" # Fallback name


    # Prevent overwriting existing files? Or allow? Allow for simplicity, user manages uploads.
    # Consider adding a check if filename exists and maybe renaming or rejecting?
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    logger.debug(f"Attempting to save uploaded file to: {filepath}")

    # --- Save and Process ---
    try:
        # Ensure upload dir exists (double check)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(filepath)
        logger.info(f"File '{filename}' saved successfully to {filepath}")

        # 1. Extract text
        logger.info(f"Processing uploaded file: {filename}...")
        text = ai_core.extract_text_from_pdf(filepath)
        if not text:
            # Extraction failed, remove the saved file
            try:
                os.remove(filepath)
                logger.info(f"Removed file {filepath} because text extraction failed.")
            except OSError as rm_err:
                logger.error(f"Error removing problematic file {filepath} after failed text extraction: {rm_err}")
            logger.error(f"Could not extract text from uploaded file: {filename}. It might be empty, corrupted, or password-protected.")
            # Return 400 Bad Request as the file is unusable
            return jsonify({"error": f"Could not read text from '{filename}'. Please check if the PDF is valid and not password-protected."}), 400

        # 2. Add extracted text to cache (overwrite if filename exists)
        ai_core.document_texts_cache[filename] = text
        logger.info(f"Text extracted ({len(text)} chars) and cached for {filename}.")

        # 3. Create chunks/documents
        logger.debug(f"Creating document chunks for {filename}...")
        documents = ai_core.create_chunks_from_text(text, filename)
        if not documents:
             # Text extracted but chunking failed. Keep file & cache, but RAG won't work.
             logger.error(f"Could not create document chunks for {filename}, although text was extracted. File kept and cached, but cannot add to knowledge base for chat.")
             # Return 500 Internal Server Error as processing failed partially
             return jsonify({"error": f"Could not process the structure of '{filename}' into searchable chunks. Analysis might work, but chat context cannot be added for this file."}), 500

        # 4. Add to vector store (this handles index creation/saving internally)
        logger.debug(f"Adding {len(documents)} chunks for {filename} to vector store...")
        if not ai_core.add_documents_to_vector_store(documents):
            logger.error(f"Failed to add document chunks for '{filename}' to the vector store or save the index. Check logs.")
            # Keep file/cache, but report index failure.
            return jsonify({"error": f"File '{filename}' processed, but failed to update the knowledge base index. Consult server logs."}), 500

        # --- Success ---
        vector_count = -1
        if ai_core.vector_store and hasattr(ai_core.vector_store, 'index'):
             vector_count = getattr(ai_core.vector_store.index, 'ntotal', 0)
        logger.info(f"Successfully processed, cached, and indexed '{filename}'. New vector count: {vector_count}")
        # Return success message, filename, and maybe new count
        return jsonify({
            "message": f"File '{filename}' uploaded and added to knowledge base successfully.",
            "filename": filename,
            "vector_count": vector_count
        }), 200 # 200 OK for successful upload and processing

    except Exception as e:
        logger.error(f"Unexpected error processing upload for filename '{filename}': {e}", exc_info=True)
        # Clean up potentially saved file if an error occurred mid-process
        if 'filepath' in locals() and os.path.exists(filepath):
             try:
                 os.remove(filepath)
                 logger.info(f"Cleaned up file {filepath} after upload processing error.")
             except OSError as rm_err:
                 logger.error(f"Error attempting to clean up file {filepath} after error: {rm_err}")
        return jsonify({"error": f"An unexpected server error occurred while processing the file: {type(e).__name__}. Please check server logs."}), 500


@app.route('/analyze', methods=['POST'])
def analyze_document():
    """Generates analysis (FAQ, Topics, Mindmap) for a selected document."""
    # --- Check AI readiness ---
    if not app_ai_ready or not ai_core.llm:
         logger.error("Analysis request failed: LLM component not initialized.")
         return jsonify({"error": "Analysis unavailable: AI model is not ready.", "thinking": None}), 503

    # --- Request Parsing ---
    data = request.get_json()
    if not data:
        logger.warning("Analysis request received without JSON body.")
        return jsonify({"error": "Invalid request: JSON body required.", "thinking": None}), 400

    filename = data.get('filename')
    analysis_type = data.get('analysis_type')
    logger.info(f"Analysis request received: type='{analysis_type}', file='{filename}'")

    # Validate filename (basic check)
    if not filename or not isinstance(filename, str) or not filename.strip() or '/' in filename or '\\' in filename:
        logger.warning(f"Invalid filename received for analysis: {filename}")
        return jsonify({"error": "Missing or invalid 'filename'.", "thinking": None}), 400
    # Use the sanitized/validated filename
    # No need to call secure_filename here, assume it came from the /documents list
    filename = filename.strip()

    allowed_types = list(config.ANALYSIS_PROMPTS.keys()) # Get allowed types from config
    if not analysis_type or analysis_type not in allowed_types:
        logger.warning(f"Invalid analysis_type received: {analysis_type}")
        return jsonify({"error": f"Invalid 'analysis_type'. Must be one of: {', '.join(allowed_types)}", "thinking": None}), 400

    # --- Perform Analysis using ai_core function ---
    try:
        # ai_core.generate_document_analysis handles text retrieval (cache/disk) and LLM call
        # It now returns (analysis_content, thinking_content) or (error_message, thinking_content/None)
        analysis_content, thinking_content = ai_core.generate_document_analysis(filename, analysis_type)

        # Check the result from ai_core
        if analysis_content is None:
             # This implies a failure to get the document text (e.g., file not found)
             # generate_document_analysis should have logged the specific error
             # Return a 404 Not Found if the error message indicates that
             error_msg = f"Analysis failed: Could not retrieve or process document '{filename}'."
             status_code = 404 # Assume file not found or unreadable if content is None
             logger.error(error_msg)
             return jsonify({"error": error_msg, "thinking": thinking_content}), status_code

        elif analysis_content.startswith("Error:"):
            # The analysis function itself indicated an error (e.g., LLM failure, bad prompt)
            error_message = analysis_content # Use the error message returned
            status_code = 500 # Assume internal server error unless message suggests otherwise (e.g., 404)
            if "not found" in error_message.lower():
                 status_code = 404
            elif "AI model failed" in error_message or "AI model is not available" in error_message:
                 status_code = 503 # Service unavailable

            logger.error(f"Analysis failed for '{filename}' ({analysis_type}): {error_message}")
            # Return thinking content even if analysis failed, if it was generated
            return jsonify({"error": error_message, "thinking": thinking_content}), status_code
        else:
            # Success - we have valid analysis content
            logger.info(f"Analysis successful for '{filename}' ({analysis_type}). Content length: {len(analysis_content)}")
            # Return both content and thinking
            return jsonify({
                "content": analysis_content,
                "thinking": thinking_content # Include thinking content in success response
            })

    except Exception as e:
        # Catch unexpected errors in the route handler itself
        logger.error(f"Unexpected error in /analyze route for '{filename}' ({analysis_type}): {e}", exc_info=True)
        return jsonify({"error": f"Unexpected server error during analysis: {type(e).__name__}. Check logs.", "thinking": None}), 500


@app.route('/chat', methods=['POST'])
def chat():
    """Handles general chat interactions using only LLM (no document context)."""
    if not app_db_ready:
        logger.error("Chat request failed: Database not initialized.")
        return jsonify({
            "error": "Chat unavailable: Database connection failed.",
            "answer": "Cannot process chat, the database is currently unavailable. Please try again later or contact support.",
            "thinking": None, "references": [], "session_id": None
        }), 503

    if not app_ai_ready or not ai_core.llm:
        logger.error("Chat request failed: AI components not initialized.")
        return jsonify({
            "error": "Chat unavailable: AI components not ready.",
            "answer": "Cannot process chat, the AI components are not ready. Please ensure Ollama is running and models are available.",
            "thinking": None, "references": [], "session_id": None
        }), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request: JSON body required."}), 400

    query = data.get('query')
    session_id = data.get('session_id')

    if not query or not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Query cannot be empty"}), 400
    query = query.strip()

    is_new_session = False
    if session_id:
        try:
            uuid.UUID(session_id, version=4)
        except (ValueError, TypeError, AttributeError):
            session_id = str(uuid.uuid4())
            is_new_session = True
    else:
        session_id = str(uuid.uuid4())
        is_new_session = True

    logger.info(f"Processing general chat query (Session: {session_id}, New: {is_new_session}): '{query[:150]}...'")

    # Save user message
    try:
        database.save_message(session_id, 'user', query, None, None)
    except Exception as db_err:
        logger.error(f"Error saving user message: {db_err}", exc_info=True)

    bot_answer = "Sorry, I encountered an issue processing your request."
    references = []
    thinking_content = None

    try:
        # 🔧 Use only general LLM — do not use RAG/document context
        context_text = ""  # This triggers pure LLM response
        bot_answer, thinking_content = ai_core.synthesize_chat_response(query, context_text)

        # Save bot message
        try:
            database.save_message(session_id, 'bot', bot_answer, references, thinking_content)
        except Exception as db_err:
            logger.error(f"Error saving bot response: {db_err}", exc_info=True)

        return jsonify({
            "answer": bot_answer,
            "session_id": session_id,
            "references": references,
            "thinking": thinking_content
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error during chat processing: {e}", exc_info=True)
        error_message = f"Sorry, an unexpected server error occurred ({type(e).__name__}). Please try again."

        try:
            database.save_message(session_id, 'bot', error_message, None, f"Error in /chat: {str(e)}")
        except Exception as db_log_err:
            logger.error(f"Failed to log error message to DB: {db_log_err}")

        return jsonify({
            "error": "Unexpected server error.",
            "answer": error_message,
            "session_id": session_id,
            "thinking": f"Error in /chat: {type(e).__name__}",
            "references": []
        }), 500


@app.route('/history', methods=['GET'])
def get_history():
    """Retrieves chat history for a given session ID."""
    session_id = request.args.get('session_id')
    # logger.debug(f"History request for session: {session_id}")

    # --- Prerequisite Checks ---
    if not app_db_ready:
         logger.error("History request failed: Database not initialized.")
         return jsonify({"error": "History unavailable: Database connection failed."}), 503

    # --- Validate Input ---
    if not session_id:
        logger.warning("History request missing 'session_id' parameter.")
        return jsonify({"error": "Missing 'session_id' parameter"}), 400

    try:
        # Validate UUID format
        uuid.UUID(session_id, version=4)
    except (ValueError, TypeError, AttributeError):
        logger.warning(f"History request with invalid session_id format: {session_id}")
        return jsonify({"error": "Invalid session_id format."}), 400

    # --- Retrieve from DB ---
    try:
        # get_messages_by_session should now return the formatted list including 'thinking' and 'references'
        messages = database.get_messages_by_session(session_id)

        if messages is None:
            # This indicates a database error occurred during retrieval (already logged by database module)
            return jsonify({"error": "Could not retrieve history due to a database error. Check server logs."}), 500
        else:
            # Returns potentially empty list [] if session exists but has no messages, or if session doesn't exist.
            logger.info(f"Retrieved {len(messages)} messages for session {session_id}.")
            # Return the list of message dicts
            return jsonify(messages) # Returns [] if no messages found, which is correct.

    except Exception as e:
         # Catch unexpected errors in the route handler itself
         logger.error(f"Unexpected error in /history route for session {session_id}: {e}", exc_info=True)
         return jsonify({"error": f"Unexpected server error retrieving history: {type(e).__name__}. Check logs."}), 500


# --- Main Execution ---
if __name__ == '__main__':
    # Ensure initialization runs when script is executed directly
    # (e.g., `python app.py`), not just before first request via WSGI
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

    try:
        # Read port from environment variable or default to 5000
        port = int(os.getenv('FLASK_RUN_PORT', 5000))
        if not (1024 <= port <= 65535):
             logger.warning(f"Port {port} is outside the typical range (1024-65535). Using default 5000.")
             port = 5000
    except ValueError:
        port = 5000
        logger.warning(f"Invalid FLASK_RUN_PORT environment variable. Using default port {port}.")

    # Listen on all network interfaces (0.0.0.0) to be accessible on the LAN
    host = '0.0.0.0'

    logger.info(f"--- Starting Waitress WSGI Server ---")
    logger.info(f"Serving Flask app '{app.name}'")
    logger.info(f"Configuration:")
    logger.info(f"  - Host: {host}")
    logger.info(f"  - Port: {port}")
    logger.info(f"  - Ollama URL: {config.OLLAMA_BASE_URL}")
    logger.info(f"  - LLM Model: {config.OLLAMA_MODEL}")
    logger.info(f"  - Embedding Model: {config.OLLAMA_EMBED_MODEL}")
    logger.info(f"Access URLs:")
    logger.info(f"  - Local: http://127.0.0.1:{port} or http://localhost:{port}")
    logger.info(f"  - Network: http://<YOUR_MACHINE_IP>:{port} (Find your IP using 'ip addr' or 'ifconfig')")

    # Log the final status after initialization attempt
    db_status = 'Ready' if app_db_ready else 'Failed/Unavailable'
    ai_status = 'Ready' if app_ai_ready else 'Failed/Unavailable'
    index_status = 'Loaded/Ready' if app_vector_store_ready else ('Not Found/Empty' if app_ai_ready else 'Not Loaded (AI Failed)')
    cache_status = f"{len(ai_core.document_texts_cache)} docs" if app_doc_cache_loaded else "Failed/Empty"
    logger.info(f"Component Status: DB={db_status} | AI={ai_status} | Index={index_status} | DocCache={cache_status}")
    logger.info("Press Ctrl+C to stop the server.")

    # Use Waitress for a production-grade WSGI server
    serve(app, host=host, port=port, threads=8) # Adjust threads based on expected load/cores

# --- END OF FILE app.py ---