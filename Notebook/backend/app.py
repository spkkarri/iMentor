import os
import sys
import logging # Import logging at the very top

# --- Basic Logger for Initial Path Setup (if needed before unified_config is loaded) ---
# This allows us to log path setup issues even if importing unified_config fails.
# It will be reconfigured by unified_config.setup_logging() later if successful.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - [NotebookApp:%(filename)s:%(lineno)d] - %(message)s')
logger_init = logging.getLogger(__name__ + "_init") # Use a distinct name for this initial logger

# --- Path Setup to find 'rag_service' package ---
path_to_rag_service_parent = None # Initialize for robust error message in except block
try:
    # The current script is in Notebook/backend. We want to get to the project root.
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    notebook_dir = os.path.dirname(current_script_dir)
    project_root_dir = os.path.dirname(notebook_dir) # This is now the main project root

    # The rag_service is now in server/rag_service relative to the root
    path_to_server_dir = os.path.join(project_root_dir, 'server')

    if path_to_server_dir not in sys.path:
        sys.path.insert(0, path_to_server_dir)
        logger_init.debug(f"Added to sys.path for rag_service package: {path_to_server_dir}")
    else:
        logger_init.debug(f"Path for rag_service package already in sys.path: {path_to_server_dir}")

except Exception as e_path:
    logger_init.critical(f"CRITICAL ERROR during initial sys.path setup: {e_path}", exc_info=True)
    sys.exit(1)
# --- End Path Setup ---

# --- Import shared config and other utilities from rag_service ---
try:
    from rag_service import config as unified_config
    # If this app needs other shared utilities from rag_service (less likely for the Notebook app)
    # from rag_service import file_parser # Example
    logger_init.info(f"Successfully imported 'unified_config' from 'rag_service'.")
except ImportError as e_import_rag:
    logger_init.critical(f"FATAL ERROR: Could not import modules from 'rag_service'.")
    logger_init.critical(f"  Attempted to import from parent directory: '{path_to_rag_service_parent}'")
    logger_init.critical(f"  Ensure this path is correct and it contains the 'rag_service' package folder,")
    logger_init.critical(f"  that 'rag_service' has an '__init__.py' file, and 'config.py' (etc.) exist within 'rag_service'.")
    logger_init.critical(f"  Current Python sys.path: {sys.path}")
    logger_init.critical(f"  ImportError details: {e_import_rag}")
    sys.exit(1)

# --- Proper Logging Setup using unified_config ---
if hasattr(unified_config, 'setup_logging') and callable(unified_config.setup_logging):
    unified_config.setup_logging() # This will configure logging for all modules
    logger = logging.getLogger(__name__) # Get a logger specific to this app.py module
    logger.info("Logging for Notebook/app.py re-configured by unified_config.setup_logging().")
else:
    logger = logging.getLogger(__name__) # Use the already basicConfig'd logger
    logger.warning("FALLBACK basic logging used for Notebook/app.py; unified_config.setup_logging() was not found or callable in the imported config.")

# --- Other Standard Imports for THIS Notebook/backend/app.py ---
import json
import uuid # Keep if used by other routes like /chat
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename # Keep if this app has any of its own upload routes
from waitress import serve
from datetime import datetime, timezone

# --- Import LOCAL Modules for THIS Notebook/backend/app.py ---
# These are assumed to be in the same directory (Notebook/backend/) or a subdirectory
try:
    import database  # e.g., Notebook/backend/database.py
    import ai_core   # e.g., Notebook/backend/ai_core.py (This needs the new function)
    import utils     # e.g., Notebook/backend/utils.py
    logger.info("Successfully imported local application modules: database, ai_core, utils.")
except ImportError as e_local_import:
    logger.error(f"Error importing local application modules (database, ai_core, utils) for Notebook app: {e_local_import}.", exc_info=True)
    sys.exit(1)


# --- Global Flask App Setup ---
backend_dir = os.path.dirname(os.path.abspath(__file__))
template_folder = os.path.join(backend_dir, 'templates')
static_folder = os.path.join(backend_dir, 'static')

if not os.path.exists(template_folder): logger.warning(f"Template folder not found: {template_folder}") # Changed to warning
if not os.path.exists(static_folder): logger.warning(f"Static folder not found: {static_folder}")   # Changed to warning

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
CORS(app, resources={r"/*": {"origins": "*"}})
logger.info("CORS configured for Notebook/app.py to allow all origins.")

# --- Configure Uploads (This app likely doesn't need its own upload logic anymore for the analysis files) ---
# The unified_config.UPLOAD_FOLDER points to Chatbot-geminiV3/server/user_document_uploads
# This is good if this app needs to *read* from there, but it probably doesn't handle *new* uploads itself.
# The /analyze route will use full paths.
# If you have other routes in this app that *do* expect local uploads to Notebook/backend/uploads,
# you'll need a separate config for that specific local upload folder.
# For now, this config is harmless but might be unused by the /analyze route.
app.config['UPLOAD_FOLDER'] = unified_config.UPLOAD_FOLDER # Uses path from unified_config
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024
logger.info(f"Notebook App - UPLOAD_FOLDER (from unified_config): {app.config['UPLOAD_FOLDER']}")
try:
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    logger.info(f"Ensured UPLOAD_FOLDER (from unified_config) exists: {app.config['UPLOAD_FOLDER']}")
except OSError as e_upload_dir:
    logger.error(f"Could not create UPLOAD_FOLDER {app.config['UPLOAD_FOLDER']}: {e_upload_dir}")


# --- Application Initialization (flags and initialize_app function) ---
app_db_ready = False
app_ai_ready = False 


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
def analyze_document_route():
    if not app_ai_ready or not hasattr(ai_core, 'llm') or ai_core.llm is None:
         return jsonify({"error": "Analysis unavailable: AI model for this service is not ready."}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request: JSON body required."}), 400

    # --- The ORIGINAL, simple logic ---
    document_full_path = data.get('full_file_path')
    analysis_type = data.get('analysis_type')
    
    log_filename = os.path.basename(document_full_path) if document_full_path else "UnknownFile"
    logger.info(f"Notebook App - Reverted: /analyze request received: type='{analysis_type}', file='{log_filename}'")

    if not document_full_path or not os.path.isabs(document_full_path):
        return jsonify({"error": "Missing or invalid 'full_file_path'."}), 400
    
    allowed_types = list(unified_config.ANALYSIS_PROMPTS.keys())
    if not analysis_type or analysis_type not in allowed_types:
        return jsonify({"error": f"Invalid 'analysis_type'."}), 400
    
    prompt_template_str = unified_config.ANALYSIS_PROMPTS.get(analysis_type)

    try:
        # Call the original, simpler ai_core function
        analysis_content, thinking_content = ai_core.generate_document_analysis_from_path(
            document_full_path, 
            analysis_type,
            prompt_template_str
        )

        if analysis_content is None or analysis_content.startswith("Error:"):
            error_detail = analysis_content or "An unknown error occurred in the AI core."
            return jsonify({"error": error_detail, "thinking": thinking_content}), 500
        else:
            return jsonify({ "content": analysis_content, "thinking": thinking_content })

    except Exception as e:
        logger.error(f"Notebook App: Unexpected error in /analyze route for '{log_filename}': {e}", exc_info=True)
        return jsonify({"error": f"Unexpected server error during document analysis."}), 500

@app.route('/chat', methods=['POST'])
def chat():
    # ... (your existing checks for app_db_ready, app_ai_ready, etc.) ...

    data = request.get_json()
    if not data:
        logger.warning("Chat request received without JSON body.")
        return jsonify({"error": "Invalid request: JSON body required."}), 400

    query = data.get('query')
    session_id = data.get('session_id')
    # --- NEW: Get externally_provided_context from the request ---
    # This will be sent by your Node.js orchestrator
    externally_provided_context = data.get('context_text')

    if not query or not isinstance(query, str) or not query.strip():
        logger.warning("Chat request received with empty or invalid query.")
        return jsonify({"error": "Query cannot be empty"}), 400
    query = query.strip()

    # --- Session Management (your existing logic) ---
    # ... (ensure session_id is handled) ...
    is_new_session = not session_id # Simplified, add your UUID validation etc.
    if not session_id:
        session_id = str(uuid.uuid4())
    
    logger.info(f"Processing chat query (Session: {session_id}, ExternalContextProvided: {externally_provided_context is not None}): '{query[:150]}...'")


    # --- Log User Message (your existing logic) ---
    try:
        database.save_message(session_id, 'user', query, None, None) # No thinking/refs for user msg
    except Exception as db_err:
        logger.error(f"Database error occurred while saving user message for session {session_id}: {db_err}", exc_info=True)

    # --- Initialize variables for response ---
    bot_answer = "Sorry, I encountered an issue processing your request."
    references = []
    thinking_content = None
    context_to_send_to_llm = ""
    context_map_for_references = {} # Only populated if internal RAG is used

    try:
        # --- Determine context source ---
        if externally_provided_context is not None:
            logger.info(f"Using externally provided context for session {session_id}.")
            context_to_send_to_llm = externally_provided_context
            # References will be handled by the Node.js server if context is external
        elif app_vector_store_ready and config.RAG_CHUNK_K > 0: # Check if internal RAG should run
            logger.debug(f"No external context, performing internal RAG search for session {session_id}...")
            try:
                # Your existing internal RAG search
                _context_docs, formatted_context, _context_docs_map = ai_core.perform_rag_search(query)
                context_to_send_to_llm = formatted_context
                context_map_for_references = _context_docs_map # For internal reference extraction
                if not _context_docs:
                    context_to_send_to_llm = "No relevant document sections found by the internal search for your query."
            except Exception as e:
                logger.error(f"Error during internal RAG search for session {session_id}: {e}", exc_info=True)
                context_to_send_to_llm = "An error occurred while searching relevant documents internally."
        else: # RAG not ready or disabled
            logger.info(f"Skipping RAG for session {session_id} (not ready or disabled). LLM will use general knowledge.")
            context_to_send_to_llm = "No document context is available for this query."

        # --- Call the synthesis function with the determined context ---
        # The synthesize_chat_response function you provided already takes query and context_text
        bot_answer, thinking_content = ai_core.synthesize_chat_response(
            query,
            context_to_send_to_llm # Pass the determined context
        )

        if bot_answer.startswith("Error:") or "[AI Response Processing Error:" in bot_answer:
            logger.error(f"LLM Synthesis failed for session {session_id}. Response: {bot_answer}")
        
        # --- Extract References (ONLY if internal RAG was used by THIS app) ---
        if externally_provided_context is None and \
           context_map_for_references and \
           not (bot_answer.startswith("Error:") or "[AI Response Processing Error:" in bot_answer):
            logger.debug(f"Extracting references from bot answer (session: {session_id}, internal RAG)...")
            # Ensure utils.extract_references exists and works as expected
            references = utils.extract_references(bot_answer, context_map_for_references)
            if references:
                logger.info(f"Extracted {len(references)} unique references for session {session_id}.")
        else:
            logger.debug(f"Skipping reference extraction in Notebook app for session {session_id}: Context provided externally or error in LLM response.")
            references = [] # Ensure references are empty if context was external or error

        # --- Log Bot Response (your existing logic) ---
        try:
            database.save_message(session_id, 'bot', bot_answer, references, thinking_content)
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
        # ... (your existing general error handling for the route) ...
        logger.error(f"Unexpected error during chat processing pipeline for session {session_id}: {e}", exc_info=True)
        return jsonify({
            "error": "Unexpected server error.",
            "answer": f"Sorry, an unexpected server error occurred ({type(e).__name__}).",
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
    logger.info(f"  - Ollama URL: {unified_config.OLLAMA_BASE_URL}")
    logger.info(f"  - LLM Model: {unified_config.OLLAMA_MODEL}")
    logger.info(f"  - Shared Embedding Model (used by RAG service): {unified_config.EMBEDDING_MODEL_NAME}")
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