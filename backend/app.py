import re
import os
import logging
import json
import uuid
import asyncio
from flask import Flask, request, jsonify, render_template, Response, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt # For password hashing
import jwt # For JWT handling
from werkzeug.utils import secure_filename
from waitress import serve
from datetime import datetime, timezone, timedelta
from functools import wraps # For decorators

# --- Initialize Logging and Configuration First ---
import config # Ensure this is first
config.setup_logging() # Configure logging based on config
logger = logging.getLogger(__name__) # Get logger for this module

# --- Import Core Modules ---
import database
import ai_core
import utils
from protocols import ModelContextProtocol, AgenticContextProtocol

  # --- Helper to collect all items from an async generator
async def collect_async_gen(async_gen):
    return [item async for item in async_gen]

# --- Global Flask App Setup ---
backend_dir = os.path.dirname(__file__)
template_folder = os.path.join(backend_dir, 'templates')
static_folder = os.path.join(backend_dir, 'static')

if not os.path.exists(template_folder): logger.error(f"Template folder not found: {template_folder}")
if not os.path.exists(static_folder): logger.error(f"Static folder not found: {static_folder}")

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

CORS(app, resources={r"/*": {"origins": "*"}})
bcrypt = Bcrypt(app)
logger.info("CORS configured to allow all origins ('*'). This is suitable for development/campus LAN but insecure for public deployment.")

app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024 # 64MB limit
logger.info(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
logger.info(f"Max upload size: {app.config['MAX_CONTENT_LENGTH'] / (1024*1024)} MB")

try:
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    logger.info(f"Upload directory ensured: {app.config['UPLOAD_FOLDER']}")
except OSError as e:
    logger.error(f"Could not create upload directory {app.config['UPLOAD_FOLDER']}: {e}", exc_info=True)

app_db_ready = False
app_ai_ready = False
app_vector_store_ready = False


def initialize_app():
    global app_db_ready, app_ai_ready, app_vector_store_ready
    if hasattr(app, 'initialized') and app.initialized:
        return

    logger.info("--- Starting Application Initialization ---")

    logger.info("Initializing Database (MongoDB)...")
    app_db_ready = database.init_db()
    if app_db_ready:
        logger.info("Database (MongoDB) initialization successful.")
    else:
        logger.critical("Database (MongoDB) initialization failed. Auth and data persistence will be unavailable.")

    logger.info("Initializing AI components...")
    embed_instance, llm_instance = ai_core.initialize_ai_components()
    if not embed_instance or not llm_instance:
         logger.warning("AI components (LLM/Embeddings) failed to initialize. Check Ollama connection and model names. Chat/Analysis/Upload features relying on AI will be unavailable.")
         app_ai_ready = False
    else:
         app_ai_ready = True
         logger.info("AI components initialized successfully.")

    if ai_core.NOUGAT_AVAILABLE:
        logger.info("Attempting to initialize Nougat PDF processor...")
        ai_core.initialize_nougat_model()
        if ai_core.nougat_model_instance:
            logger.info("Nougat PDF processor initialized.")
        else:
            logger.warning("Nougat PDF processor FAILED to initialize. Mindmap quality for complex PDFs may be affected, fallback will be used.")
    else:
        logger.warning("Nougat PDF processor is not available. Mindmap quality for complex PDFs may be affected, fallback will be used.")

    if app_ai_ready:
        logger.info("Loading FAISS vector store...")
        if ai_core.load_vector_store():
            app_vector_store_ready = True
            index_size = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"FAISS vector store loaded successfully (or is empty). Index size: {index_size}")
        else:
            app_vector_store_ready = False
            logger.warning("Failed to load existing FAISS vector store or it wasn't found. RAG will start with an empty index until uploads.")
    else:
         app_vector_store_ready = False
         logger.warning("Skipping vector store loading because AI components failed to initialize.")

    # Ensure podcast audio folder exists
    podcast_audio_dir = config.PODCAST_AUDIO_FOLDER
    if not os.path.exists(podcast_audio_dir):
        try:
            os.makedirs(podcast_audio_dir)
            logger.info(f"Created podcast audio directory: {podcast_audio_dir}")
        except OSError as e:
            logger.error(f"Could not create podcast audio directory {podcast_audio_dir}: {e}")
    # Also ensure user-specific subfolders can be created by ai_core.text_to_speech_gtts

    app.initialized = True
    logger.info("--- Application Initialization Complete ---")
    if not app_db_ready:
         logger.critical("Initialization completed with Database errors. Core functionality will be unavailable.")
    elif not app_ai_ready:
         logger.warning("Initialization completed, but AI components failed. Some features unavailable.")


@app.before_request
def ensure_initialized():
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"message": "Token is missing!", "error": "Unauthorized"}), 401

        if not app_db_ready:
             logger.error("Attempted access to protected route, but Database is not ready.")
             return jsonify({"message": "Service temporarily unavailable (Database error).", "error": "Service Unavailable"}), 503

        try:
            data = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
            current_user = database.get_user_by_id(data.get('user_id'))
            if not current_user:
                 logger.warning(f"Token contains invalid user_id: {data.get('user_id')}. User not found.")
                 return jsonify({"message": "Invalid token (User not found)!", "error": "Unauthorized"}), 401
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired.")
            return jsonify({"message": "Token has expired!", "error": "Unauthorized"}), 401
        except jwt.InvalidTokenError:
            logger.warning("Token is invalid.")
            return jsonify({"message": "Token is invalid!", "error": "Unauthorized"}), 401
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {e}", exc_info=True)
            return jsonify({"message": "Error processing token", "error": "Unauthorized"}), 401

        return f(current_user, *args, **kwargs)
    return decorated

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
    return send_from_directory(app.static_folder, 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/register', methods=['POST'])
def register():
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable for registration."}), 503
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    gender = data.get('gender')
    mobile = data.get('mobile')
    organization = data.get('organization')

    if not all([username, password, email, firstname, lastname]):
        return jsonify({"error": "Required fields: First name, Last name, Username, Email, Password."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    if database.get_user_by_username(username) is not None:
        logger.warning(f"Registration attempt with existing username: {username}")
        return jsonify({"error": "Username already exists."}), 409
    if database.get_user_by_email(email) is not None:
         logger.warning(f"Registration attempt with existing email: {email}")
         return jsonify({"error": "Email already registered."}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_id = database.create_user(
        username=username, hashed_password=hashed_password, email=email,
        firstname=firstname, lastname=lastname, gender=gender, mobile=mobile, organization=organization
    )

    if user_id:
        user_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
        try:
            os.makedirs(user_upload_folder, exist_ok=True)
            logger.info(f"Created upload directory for new user {user_id}: {user_upload_folder}")
        except OSError as e:
            logger.error(f"Could not create upload directory for new user {user_id}: {e}")
        
        # Also create user-specific podcast audio folder
        user_podcast_folder = os.path.join(config.PODCAST_AUDIO_FOLDER, str(user_id))
        try:
            os.makedirs(user_podcast_folder, exist_ok=True)
            logger.info(f"Created podcast audio directory for new user {user_id}: {user_podcast_folder}")
        except OSError as e:
            logger.error(f"Could not create podcast audio directory for new user {user_id}: {e}")

        return jsonify({"message": "User registered successfully. Please login.", "user_id": user_id}), 201
    else:
        return jsonify({"error": "Failed to register user due to a server error."}), 500


@app.route('/login', methods=['POST'])
def login():
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable for login."}), 503
    data = request.get_json()
    identifier = data.get('username')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({"error": "Username/Email and password are required."}), 400

    user = database.get_user_by_username(identifier)
    if user is None:
        user = database.get_user_by_email(identifier)

    if user and bcrypt.check_password_hash(user['password_hash'], password):
        token_payload = {
            'user_id': user['_id'],
            'username': user['username'],
            'exp': datetime.now(timezone.utc) + config.JWT_ACCESS_TOKEN_EXPIRES
        }
        token = jwt.encode(token_payload, config.JWT_SECRET_KEY, algorithm=config.JWT_ALGORITHM)
        return jsonify({"message": "Login successful.", "token": token, "username": user['username']}), 200
    else:
        logger.warning(f"Invalid login attempt for identifier: {identifier}")
        return jsonify({"error": "Invalid username/email or password."}), 401

@app.route('/status', methods=['GET'])
def get_status():
     vector_store_count = -1
     if app_ai_ready and app_vector_store_ready and ai_core.vector_store and hasattr(ai_core.vector_store, 'index') and ai_core.vector_store.index:
        try: vector_store_count = ai_core.vector_store.index.ntotal
        except: vector_store_count = -2 # Error fetching count
     elif app_vector_store_ready: # Vector store might be loaded but empty
         try: vector_store_count = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
         except: vector_store_count = -2

     status_data = {
         "status": "ok" if app_db_ready and app_ai_ready else ("error_db" if not app_db_ready else "error_ai"),
         "database_initialized": app_db_ready,
         "ai_components_loaded": app_ai_ready,
         "vector_store_loaded": app_vector_store_ready,
         "vector_store_entries": vector_store_count,
         "ollama_model": config.OLLAMA_MODEL if app_ai_ready else "N/A",
         "embedding_model": config.OLLAMA_EMBED_MODEL if app_ai_ready else "N/A",
         "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
     }
     return jsonify(status_data)

@app.route('/documents', methods=['GET'])
@token_required
def get_documents(current_user):
    user_id = current_user['_id']
    uploaded_files = []
    error_messages = []

    if app_db_ready:
        user_docs_from_db = database.get_user_documents(user_id)
        uploaded_files = sorted([doc["filename"] for doc in user_docs_from_db])
    else:
        error_messages.append("Cannot retrieve user documents: Database unavailable.")

    response_data = {
        "uploaded_files": uploaded_files,
        "errors": error_messages if error_messages else None
    }
    return jsonify(response_data)


@app.route('/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    user_id = current_user['_id']
    logger.info(f"File upload request received from user: {user_id}")

    if not app_db_ready:
        return jsonify({"error": "Cannot process upload: Database service unavailable."}), 503
    if not app_ai_ready:
         return jsonify({"error": "Cannot process upload: AI components are not ready."}), 503
    if not ai_core.embeddings:
         return jsonify({"error": "Cannot process upload: AI embeddings model is not loaded."}), 503

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({"error": "No file selected"}), 400

    original_filename = file.filename
    if not utils.allowed_file(original_filename):
        return jsonify({"error": "Invalid file type. Only PDF files are allowed."}), 400

    filename_uuid = f"{uuid.uuid4()}_{secure_filename(original_filename)}"
    logger.debug(f"Generated secured filename with UUID: {filename_uuid}")

    user_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_id)
    try:
        os.makedirs(user_upload_folder, exist_ok=True)
    except OSError as e:
        logger.error(f"Could not create user upload directory {user_upload_folder}: {e}")
        return jsonify({"error": "Server error creating storage for your file."}), 500

    filepath = os.path.join(user_upload_folder, filename_uuid)

    try:
        file.save(filepath)
        logger.info(f"File '{original_filename}' saved to {filepath} (secured as '{filename_uuid}') for user {user_id}")

        doc_record_id = database.add_user_document_record(user_id, filename_uuid, original_filename, filepath)
        if doc_record_id is None:
            logger.error(f"Failed to save document record for user {user_id}, file {original_filename} ('{filename_uuid}').")
            if os.path.exists(filepath):
                 try: os.remove(filepath)
                 except OSError: pass
            return jsonify({"error": "Failed to record document information in database. File not processed."}), 500

        text = ai_core.extract_text_from_pdf(filepath)
        if not text or not text.strip() or text.startswith("[Error: PDF is password protected"):
            # Attempt to remove the uploaded file if text extraction fails critically
            if os.path.exists(filepath):
                 try: os.remove(filepath)
                 except OSError as e_remove: logger.error(f"Error removing file {filepath} after failed text extraction: {e_remove}")
            # Attempt to remove the database record
            if doc_record_id:
                # You would need a function like `database.remove_document_record_by_id(doc_record_id)`
                # For now, we'll just log it.
                logger.info(f"Document record {doc_record_id} should be removed due to text extraction failure.")
            
            err_msg = "Could not read text from PDF (possibly password protected or empty)." if text and text.startswith("[Error: PDF is password protected") else f"Could not extract text from '{original_filename}'."
            logger.error(f"{err_msg} File: {original_filename} ('{filename_uuid}') for user {user_id}. Removing file and record.")
            return jsonify({"error": f"{err_msg} File was not added to knowledge base."}), 400


        ai_core.cache_document_text(user_id, filename_uuid, text)
        logger.info(f"Text extracted and cached for user {user_id}, file {filename_uuid}.")

        source_metadata = {
             "source": filename_uuid,
             "user_id": user_id,
             "doc_db_id": doc_record_id # Storing MongoDB ObjectId as string
        }
        documents = ai_core.create_chunks_from_text(text, filename_uuid, source_metadata=source_metadata)
        if not documents:
             logger.error(f"Could not create document chunks for {filename_uuid} (user {user_id}).")
             # Consider removing file and DB record here
             database.mark_document_indexed(str(doc_record_id), indexed=False, error_message="Chunk creation failed")
             return jsonify({"error": f"Could not process '{original_filename}' into searchable chunks. File uploaded but not added to knowledge base."}), 500

        if not ai_core.add_documents_to_vector_store(documents):
            logger.error(f"Failed to add document chunks for '{filename_uuid}' (user {user_id}) to vector store.")
            database.mark_document_indexed(str(doc_record_id), indexed=False, error_message="Vector store addition failed")
            return jsonify({"error": f"File '{original_filename}' processed, but failed to update knowledge base index."}), 500

        database.mark_document_indexed(str(doc_record_id), indexed=True)
        vector_count = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Successfully uploaded, processed, and indexed file '{original_filename}' ('{filename_uuid}') for user {user_id}.")

        return jsonify({
            "message": f"File '{original_filename}' uploaded and added to knowledge base successfully.",
            "filename": filename_uuid,
            "original_filename": original_filename,
            "vector_count": vector_count
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error processing upload for user {user_id}, filename '{original_filename}' ('{filename_uuid}'): {e}", exc_info=True)
        if 'filepath' in locals() and os.path.exists(filepath): # type: ignore
             try: os.remove(filepath) # type: ignore
             except OSError: pass
        return jsonify({"error": f"An unexpected server error occurred: {type(e).__name__}. File processing failed."}), 500


@app.route('/analyze', methods=['POST'])
@token_required
def analyze_document(current_user):
    user_id = current_user['_id']

    if not app_ai_ready or not ai_core.llm:
         return jsonify({"error": "Analysis unavailable: AI model is not ready."}), 503

    data = request.get_json()
    filename = data.get('filename')
    analysis_type = data.get('analysis_type') # This will include 'podcast' now

    if not filename or not analysis_type:
        return jsonify({"error": "Filename and analysis_type required."}), 400

    # For existing analyses, check against ANALYSIS_PROMPTS
    # For podcast, it's a different flow
    if analysis_type != "podcast" and analysis_type not in config.ANALYSIS_PROMPTS:
         return jsonify({"error": f"Invalid analysis type: {analysis_type}"}), 400

    async def send_thinking_message(message: str):
        logger.info(f"[AI-THINKING-{analysis_type.upper()}] {message}")

    if analysis_type == "podcast":
        # Handle podcast generation separately
        try:
            script, audio_path_part, error = asyncio.run(
                ai_core.generate_podcast_from_document(user_id, filename, async_callback=send_thinking_message)
            )
            if error:
                return jsonify({"error": error, "script": script or ""}), 500
            
            if not script or not audio_path_part:
                 return jsonify({"error": "Failed to generate podcast content or audio.", "script": script or ""}), 500

            audio_url = f"{request.host_url.rstrip('/')}/serve_podcast_audio/{audio_path_part}"
            doc_record = database.get_document_by_filename(user_id, filename) # To get original_filename
            original_filename_display = doc_record.get("original_filename", filename) if doc_record else filename

            return jsonify({
                "message": "Podcast generated successfully.",
                "script": script,
                "audio_url": audio_url,
                "original_filename": original_filename_display
            })
        except Exception as e:
            logger.error(f"Unexpected error in /analyze (podcast) endpoint for {filename}, user {user_id}: {e}", exc_info=True)
            return jsonify({"error": f"Internal server error during podcast generation: {type(e).__name__}"}), 500
    else:
        # Existing analysis logic
        analysis_content, thinking_content, latex_source = asyncio.run(
            ai_core.generate_document_analysis(
                filename,
                analysis_type,
                user_id=user_id,
                async_callback=send_thinking_message
            )
        )
        response_data = {
            "content": analysis_content,
            "thinking": thinking_content,
            "latex_source": latex_source
        }
        if analysis_content is None:
            logger.error(f"Unexpected None result from generate_document_analysis for '{filename}' type '{analysis_type}'.")
            response_data["error"] = f"Could not generate analysis for '{filename}' due to an internal issue."
            return jsonify(response_data), 500

        if isinstance(analysis_content, str) and analysis_content.startswith("Error:"):
            status_code = 503 if "AI model" in analysis_content else (404 if "retrieve text content" in analysis_content or "not found" in analysis_content else 500)
            response_data["error"] = analysis_content
            response_data["content"] = None
            return jsonify(response_data), status_code
        else:
            return jsonify(response_data)


# --- Chat Endpoints ---

@app.route('/chat/thread', methods=['POST'])
@token_required
def create_new_chat_thread(current_user):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Cannot create chat thread: Database service unavailable."}), 503
    
    data = request.get_json()
    title = data.get('title', "New Chat") # Get title from request or use default

    thread_id = database.create_chat_thread(user_id, title=title)
    if thread_id:
        logger.info(f"API: New chat thread created with ID '{thread_id}' for user '{user_id}'.")
        return jsonify({"message": "New chat thread created.", "thread_id": thread_id, "title": title}), 201
    else:
        logger.error(f"API: Failed to create new chat thread for user '{user_id}'.")
        return jsonify({"error": "Failed to create new chat thread due to a server error."}), 500

@app.route('/threads', methods=['GET'])
@token_required
def get_threads(current_user):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Thread list unavailable: Database connection failed."}), 503
    threads = database.get_user_threads(user_id)
    if threads is None:
        return jsonify({"error": "Could not retrieve threads due to a database error."}), 500
    else:
        # Augment with titles from localStorage if available (this is a bit of a hack, ideally titles are fully backend managed)
        # For now, the title is already in the thread object from DB
        return jsonify(threads), 200

@app.route('/thread_history', methods=['GET'])
@token_required
def get_thread_history(current_user):
    user_id = current_user['_id']
    thread_id = request.args.get('thread_id')
    if not app_db_ready:
        return jsonify({"error": "History unavailable: Database connection failed."}), 503
    if not thread_id:
        return jsonify({"error": "Missing 'thread_id' parameter"}), 400
    messages = database.get_messages_by_thread(user_id, thread_id)
    if messages is None:
        return jsonify({"error": "Could not retrieve history due to a database error."}), 500
    else:
        return jsonify(messages), 200

@app.route('/chat', methods=['POST'])
@token_required
def chat(current_user):
    import asyncio
    user_id = current_user['_id']
    logger.debug(f"Chat request received from user: {user_id}")

    if not app_db_ready or not app_ai_ready:
        logger.error("Chat prerequisites not met: DB or AI components not ready.")
        error_msg = "Chat service unavailable. Backend initializing or encountered an error."
        return jsonify({"error": error_msg, "answer": "Service temporarily down.", "thread_id": request.get_json().get('thread_id')}), 503

    data = request.get_json()
    query = data.get('query')
    thread_id = data.get('thread_id')

    if not query or not query.strip():
        return jsonify({"error": "Query cannot be empty", "answer": "Please enter a question.", "thread_id": thread_id}), 400
    query = query.strip()

    document_filter = None
    original_query_starts_with_at = query.startswith('@')
    if original_query_starts_with_at:
        import re
        # Updated regex to better match filenames that might include dots, hyphens, underscores
        doc_match = re.match(r'^@([a-zA-Z0-9_.-]+\.pdf)\s*(.*)$', query, re.IGNORECASE)
        if doc_match:
            document_filter = doc_match.group(1)
            query = doc_match.group(2).strip()
            logger.info(f"Detected document filter: {document_filter} for query: {query[:50]}...")
        else:
            # If it starts with @ but doesn't match the file pattern, treat it as a general query without the @
            # query = query[1:].strip() # This behavior might be confusing, consider if it's desired
            logger.info(f"Query starts with '@' but no specific document filter matched. Query: {query[:50]}...")


    if not thread_id:
        logger.info(f"No thread_id provided in chat request from user '{user_id}'. Creating a new thread.")
        # Try to generate a title from the first query
        # This is a simplified approach. A more robust way would be to call a small LLM prompt.
        first_query_words = query.split()
        potential_title = " ".join(first_query_words[:5])
        if len(first_query_words) > 5:
            potential_title += "..."
        
        thread_id = database.create_chat_thread(user_id, title=potential_title)
        if not thread_id:
            logger.error(f"Failed to create new thread for user '{user_id}' during initial chat message.")
            error_msg = "Failed to start new chat thread due to a server error."
            # Avoid saving message to "temp_error_thread" as it might not exist or be intended
            # database.save_message(user_id, "temp_error_thread", 'user', query) 
            return jsonify({"error": error_msg, "answer": error_msg}), 500
        logger.info(f"New thread ID '{thread_id}' created for user '{user_id}' for this chat with title '{potential_title}'.")


    logger.info(f"Processing chat query for user '{user_id}', thread '{thread_id}': '{query[:100]}...'")

    def format_sse(data: dict) -> str:
        json_data = json.dumps(data)
        return f"data: {json_data}\n\n"

    def stream():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        thinking_messages_for_stream = [] # Renamed to avoid conflict with JS variable
        
        async def send_thinking_message_for_stream(msg): # Renamed
            thinking_messages_for_stream.append(msg)
        
        async def run_query():
            try:
                bot_answer, returned_thread_id, references, thinking_content = await ai_core.process_chat_query_with_rag_and_history(
                    user_id=user_id,
                    thread_id=thread_id, # Use the determined thread_id
                    query=query,
                    model_context=None, # Pass actual context if available/needed
                    agentic_context=None, # Pass actual context if available/needed
                    document_filter=document_filter,
                    async_callback=send_thinking_message_for_stream # Pass the renamed callback
                )
                # Stream thinking messages first
                for tmsg in thinking_messages_for_stream:
                    yield format_sse({"type": "thinking", "message": tmsg})
                
                # Stream chunks of the bot_answer if it's long (conceptual, actual chunking needs more logic)
                # For now, sending the whole answer as "final" after thinking.
                # If you want to stream chunks of the answer itself, ai_core.process_chat_query_with_rag_and_history
                # would need to yield chunks.
                # For simplicity, we send the full answer in one "final" event.
                
                yield format_sse({
                    "type": "final", # This indicates the final answer payload
                    "answer": bot_answer,
                    "thread_id": returned_thread_id, # Ensure this is the correct thread_id
                    "references": references,
                    "thinking": thinking_content # This is the CoT reasoning block
                })
            except Exception as e_stream:
                logger.critical(f"Critical unexpected error in /chat SSE stream for user '{user_id}', thread '{thread_id}': {e_stream}", exc_info=True)
                error_message = f"A critical unexpected server error occurred: {type(e_stream).__name__}. See backend logs."
                yield format_sse({
                    "type": "error",
                    "error": error_message,
                    "answer": error_message, # Send error as answer
                    "thread_id": thread_id, # Use the initial thread_id
                    "thinking": [f"Critical Error in stream: {type(e_stream).__name__}"], # Send error as thinking
                    "references": []
                })
        try:
            # Use the helper to collect items from the async generator
            # This is necessary because Flask route handlers are typically synchronous.
            # The `stream_with_context` decorator or manually managing the event loop
            # is needed for true async streaming in Flask.
            # For this structure, we collect all generated SSE messages and then yield them.
            sse_events = loop.run_until_complete(collect_async_gen(run_query()))
            for event_data in sse_events:
                yield event_data
        finally:
            loop.close()

    return Response(stream(), mimetype='text/event-stream')


@app.route('/history', methods=['GET'])
@token_required
def get_history(current_user):
    user_id = current_user['_id']
    session_id = request.args.get('session_id') # This is legacy, should be thread_id

    if not app_db_ready:
        return jsonify({"error": "History unavailable: Database connection failed."}), 503
    
    thread_id_param = request.args.get('thread_id', session_id) # Prioritize 'thread_id'
    if not thread_id_param:
        return jsonify({"error": "Missing 'thread_id' (or 'session_id') parameter"}), 400

    messages = database.get_messages_by_thread(user_id, thread_id_param) # Use get_messages_by_thread
    if messages is None:
        return jsonify({"error": "Could not retrieve history due to a database error."}), 500
    else:
        return jsonify(messages), 200

@app.route('/sessions', methods=['GET'])
@token_required
def get_sessions(current_user): # This endpoint is now for threads
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Thread list unavailable: Database connection failed."}), 503
    
    threads = database.get_user_threads(user_id) # Use get_user_threads
    if threads is None:
        return jsonify({"error": "Could not retrieve threads due to a database error."}), 500
    else:
        return jsonify(threads), 200


# New endpoint to serve podcast audio files
@app.route('/serve_podcast_audio/<path:user_file_path>')
# Add @token_required if you want to protect audio files.
# This makes it harder for <audio src="..."> to work directly without workarounds.
# For now, keeping it open but relying on obscurity of user_id and file_uuid.
def serve_podcast_audio(user_file_path):
    # user_file_path is expected to be "user_id_string/actual_audio_filename.mp3"
    # This path is relative to config.PODCAST_AUDIO_FOLDER
    
    # Basic security check to prevent directory traversal
    if ".." in user_file_path or user_file_path.startswith("/"):
        logger.warning(f"Invalid podcast audio path requested: {user_file_path}")
        return "Invalid path", 400
        
    # The directory for send_from_directory should be the absolute path to PODCAST_AUDIO_FOLDER
    # send_from_directory will then append user_file_path to it.
    base_podcast_dir = os.path.abspath(config.PODCAST_AUDIO_FOLDER)
    
    # Construct the full path to the file
    full_file_path = os.path.join(base_podcast_dir, user_file_path)

    if not os.path.exists(full_file_path) or not os.path.isfile(full_file_path):
        logger.warning(f"Podcast audio file not found at: {full_file_path}")
        return "Audio file not found.", 404
        
    # Ensure the requested path is actually within the intended podcast audio directory
    if not full_file_path.startswith(base_podcast_dir):
        logger.error(f"Attempt to access file outside podcast audio directory: {user_file_path}")
        return "Access denied.", 403

    logger.debug(f"Serving podcast audio: {user_file_path} from {base_podcast_dir}")
    try:
        # send_from_directory takes the directory and then the filename (which can include subdirs)
        return send_from_directory(base_podcast_dir, user_file_path, as_attachment=False)
    except Exception as e:
        logger.error(f"Error serving podcast audio file {user_file_path} from {base_podcast_dir}: {e}", exc_info=True)
        return "Error serving audio file.", 500


# --- Main Execution ---
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
    logger.info(f"--- Starting Flask Server ---")
    logger.info(f"Serving Flask app '{app.name}'")
    logger.info(f"Configuration:")
    logger.info(f"  - Host: {host}")
    logger.info(f"  - Port: {port}")
    logger.info(f"  - Ollama URL(s): {config.OLLAMA_BASE_URLS}") # Corrected variable name
    logger.info(f"  - LLM Model: {config.OLLAMA_MODEL}")
    logger.info(f"  - Embedding Model: {config.OLLAMA_EMBED_MODEL}")
    logger.info(f"  - Summary Buffer Limit: {config.SUMMARY_BUFFER_TOKEN_LIMIT}")
    logger.info(f"Access URLs:")
    logger.info(f"  - Local: http://127.0.0.1:{port} or http://localhost:{port}")
    logger.info(f"  - Network: http://<YOUR_MACHINE_IP>:{port} (Find your IP using 'ip addr' or 'ifconfig')")

    db_status = 'Ready' if app_db_ready else 'Failed/Unavailable'
    ai_status = 'Ready' if app_ai_ready else 'Failed/Unavailable'
    index_status = 'Loaded/Ready' if app_vector_store_ready else ('Not Found/Empty' if app_ai_ready else 'Not Loaded (AI Failed)')
    logger.info(f"Component Status: DB={db_status} | AI={ai_status} | Index={index_status}")
    logger.info("Press Ctrl+C to stop the server.")

    # For development, Flask's built-in server is fine with debug=True and threaded=True
    # For production, Waitress is a better choice.
    # serve(app, host=host, port=port, threads=8) # Production
    app.run(host=host, port=port, threaded=True, debug=True) # Development

# --- END OF FILE app.py ---