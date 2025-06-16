# --- START OF FILE app.py ---

import warnings
warnings.filterwarnings("ignore")

import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import logging
# import whisper
import json
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from waitress import serve
from datetime import datetime, timezone
# if want to use backend for text to speech use whisper
# import whisper
import tempfile
from werkzeug.security import generate_password_hash, check_password_hash

# --- Initialize Logging and Configuration First ---
import config
import tempfile
config.setup_logging() # Configure logging based on config
logger = logging.getLogger(__name__) # Get logger for this module

# Import LoadBalancer and define models list for load balancing
from load_balancer.balancer import LoadBalancer
from phi.tools.duckduckgo import DuckDuckGo

OLLAMA_MODELS = [
    "r1-1776:70b",
    "phi4-reasoning:latest",
    "qwen2.5vl:32b",
    "devstral:24b",
    "qwen3:32b",
    "llama4:16x17b",
    "llama4:scout",
    "deepseek-r1:latest",
    "qwen2.5:14b-instruct",
    "deepseek-coder-v2:latest",
    "llama3.1:latest"
]

load_balancer = LoadBalancer(OLLAMA_MODELS)

from flask import Flask, request, jsonify, render_template, redirect, url_for
from config import users_collection, JWT_SECRET
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from datetime import datetime, timedelta

#user uploads
import gridfs
from config import db
fs = gridfs.GridFS(db)


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
from config import UPLOAD_FOLDER

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure the uploads folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

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

# Google OAuth Setup
from flask import Flask, redirect, url_for
from flask_dance.contrib.google import make_google_blueprint, google
from dotenv import load_dotenv
load_dotenv()
app.secret_key = os.environ.get("FLASK_SECRET_KEY")
google_bp = make_google_blueprint(
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    redirect_to="google_login_callback",

    # scope=["profile", "email"]
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email"
    ]
)
app.register_blueprint(google_bp, url_prefix="/login")


def create_token(email):
    payload = {
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token

def decode_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
#redirections
from functools import wraps
from flask import session, redirect, url_for
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for token in session or cookie (adjust as per your auth logic)
        if not session.get('user_email'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


# @app.route('/signup', methods=['GET', 'POST'])
# def signup():
#     if request.method == 'POST':
#         email = request.form['email']
#         password = generate_password_hash(request.form['password'])

#         if users_collection.find_one({"email": email}):
#             return "Email already exists!"

#         users_collection.insert_one({"email": email, "password": password})
#         return redirect(url_for('login'))

#     return render_template('signup.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form['email']
        password = generate_password_hash(request.form['password'])

        if users_collection.find_one({"email": email}):
            return "Email already exists!"

        users_collection.insert_one({"email": email, "password": password})
        session['user_email'] = email 
        return redirect(url_for('index'))

    return render_template('signup.html')

@app.route("/google_signup")
def google_signup():
    if not google.authorized:
        return redirect(url_for("google.login"))
    return redirect(url_for("google_signup_callback"))

@app.route("/google_signup/callback")
def google_signup_callback():
    if not google.authorized:
        return redirect(url_for("signup"))

    resp = google.get("/oauth2/v2/userinfo")
    if not resp.ok:
        return jsonify({"error": "Failed to fetch user info from Google"}), 500

    info = resp.json()
    email = info["email"]

    # Check if user already exists
    user = users_collection.find_one({"email": email})
    if not user:
        users_collection.insert_one({
            "email": email,
            "name": info.get("name", ""),
            "google_id": info.get("id", ""),
            "profile_pic": info.get("picture", ""),
            "password": ""  # no password needed for Google users
        })

    session['user_email'] = email  # Store login state in session
    return redirect(url_for('index'))  # Redirect to "/"

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = users_collection.find_one({"email": email})
        if user and check_password_hash(user['password'], password):
            session['user_email'] = email  # Store login state in session
            return redirect(url_for('index'))  # Redirect to "/"

        return render_template('login.html', error="Invalid credentials")

    return render_template('login.html')



@app.route("/google_login")
def google_login():
    if not google.authorized:
        return redirect(url_for("google.login"))
    return redirect(url_for("google_login_callback"))

@app.route("/google_login/callback")
def google_login_callback():
    if not google.authorized:
        return redirect(url_for("login"))

    resp = google.get("/oauth2/v2/userinfo")
    if not resp.ok:
        return jsonify({"error": "Failed to fetch user info from Google"}), 500

    info = resp.json()
    email = info["email"]

    # Check if user exists, otherwise create new user
    user = users_collection.find_one({"email": email})
    if not user:
        users_collection.insert_one({
            "email": email,
            "name": info.get("name", ""),
            "google_id": info.get("id", ""),
            "profile_pic": info.get("picture", ""),
            "password": ""  # no password for google-auth users
        })

    session['user_email'] = email  # Store login state in session
    return redirect(url_for('index'))  # Redirect to "/"

# --- Logout Route ---
@app.route('/logout')
def logout():
    session.pop('user_email', None)
    return redirect(url_for('login'))


@app.route('/protected')
def protected():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Authorization header missing"}), 401

    token = auth_header.split(" ")[1] if " " in auth_header else auth_header
    payload = decode_token(token)

    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401

    return jsonify({"message": f"Hello, {payload['email']}!"})


@app.route('/')
def index():
    user_email = session.get('user_email', '')
    return render_template('index.html', user_email=user_email)

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
    """Returns lists of default and user-uploaded PDF filenames from MongoDB."""
    from flask import session
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"default_files": [], "uploaded_files": [], "errors": ["User not authenticated."]})

    # Default files (still from folder, if you want to keep them)
    def _list_pdfs(folder_path):
        if not os.path.exists(folder_path):
            return []
        return sorted([
            f for f in os.listdir(folder_path)
            if os.path.isfile(os.path.join(folder_path, f)) and f.lower().endswith('.pdf')
        ])

    default_files = _list_pdfs(config.DEFAULT_PDFS_FOLDER)

    # Uploaded files from MongoDB GridFS for this user
    uploaded_files = []
    for f in fs.find({"metadata.user_email": user_email}):
        uploaded_files.append(f.filename)

    return jsonify({
        "default_files": default_files,
        "uploaded_files": uploaded_files,
        "errors": None
    })


import tempfile
import os

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handles file uploads, processing, caching, and adding to FAISS."""
    logger.info("File upload request received.")

    # --- Check AI readiness ---
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
        return jsonify({"error": "Invalid file type. Supported types are: PDF, DOCX, PPTX, TXT."}), 400

    filename = secure_filename(file.filename)
    if not filename:
        logger.warning(f"Could not secure filename from: {file.filename}. Using generic name.")
        filename = f"upload_{uuid.uuid4()}.pdf"

    # --- Process the file ---
    ext = os.path.splitext(filename)[1].lower()
    markdown_text = None
    try:
        # Save the uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            file.save(tmp)
            tmp_path = tmp.name

        # Save the original file to GridFS for the user
        user_email = session.get('user_email')
        with open(tmp_path, 'rb') as f:
            fs.put(f, filename=filename, content_type=file.content_type, metadata={"user_email": user_email})

        try:
            if ext == '.pdf':
                markdown_text = ai_core.convert_pdf_to_markdown(tmp_path)
            elif ext == '.docx':
                markdown_text = ai_core.convert_docx_to_markdown(tmp_path)
            elif ext == '.pptx':
                markdown_text = ai_core.convert_pptx_to_markdown(tmp_path)
            elif ext == '.txt':
                markdown_text = ai_core.convert_txt_to_markdown(tmp_path)
            else:
                logger.warning(f"Unsupported file type for Markdown conversion: {ext}")
                return jsonify({"error": "Unsupported file type for processing."}), 400
        finally:
            os.remove(tmp_path)
    except Exception as e:
        logger.error(f"Error processing file {filename}: {e}", exc_info=True)
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500

    # Add Markdown data to FAISS vector store
    if markdown_text:
        # Remove user_email argument as ai_core.add_markdown_to_vector_store does not accept it
        success = ai_core.add_markdown_to_vector_store(markdown_text, filename)
        if not success:
            logger.error(f"Failed to add Markdown data to vector store for file: {filename}")
            return jsonify({"error": "Failed to add file to knowledge base."}), 500

    return jsonify({
        "message": f"File '{filename}' uploaded and added to knowledge base successfully.",
        "filename": filename
    }), 200
    
@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    logger.info(f"Received /chat payload: {data}")
    query = data.get('query', '').strip()
    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    session_id = data.get('session_id', None)
    model = data.get('model', 'ollama')
    user_email = session.get('user_email')

    selected_model = None  # <-- Add this line

    # --- Session Management ---
    is_new_session = False
    if session_id:
        try:
            # Validate UUID format
            uuid.UUID(session_id, version=4)
        except (ValueError, TypeError, AttributeError):
            logger.warning(f"Received invalid session_id format: '{session_id}'. Generating a new session ID.")
            session_id = str(uuid.uuid4()) # Generate new valid ID
            is_new_session = True
    else:
        # No session ID provided, generate a new one
        session_id = str(uuid.uuid4())
        is_new_session = True
        logger.info(f"New chat session started. ID: {session_id}")

    # Log entry with session info
    logger.info(f"Processing chat query (Session: {session_id}, New: {is_new_session}): '{query[:150]}...'")

    # --- Log User Message ---
    user_message_id = None
    try:
        # Pass None for references and thinking for user messages
        user_message_id = database.save_message(session_id, 'user', query, None, None)
        if not user_message_id:
             # Log error but proceed with generating response if possible
             logger.error(f"Failed to save user message to database for session {session_id}. Continuing with response generation.")
    except Exception as db_err:
         # If saving user message fails critically, maybe return error? Or proceed?
         # Proceeding might lead to incomplete history. Let's log and proceed.
         logger.error(f"Database error occurred while saving user message for session {session_id}: {db_err}", exc_info=True)
         # Optionally return 500 here if saving user message is critical
         # return jsonify({"error": "Database error saving your message.", "answer": "Failed to record your message due to a database issue.", "thinking": None, "references": [], "session_id": session_id}), 500

    # Add the user message to the session's messages array
    now = datetime.now(timezone.utc)
    user_message = {"role": "user", "content": query, "timestamp": now}
    sessions_collection.update_one(
        {"session_id": session_id, "user_email": user_email},
        {
            "$push": {"messages": user_message},
            "$set": {"updated_at": now}
        }
    )
    s = sessions_collection.find_one({"session_id": session_id, "user_email": user_email})
    if s:
        user_messages = [m for m in s.get("messages", []) if m["role"] == "user"]
        if len(user_messages) == 1:
            # Take the first user message, remove line breaks, and truncate to 50 chars
            first_prompt = user_messages[0]["content"].replace('\n', ' ').replace('\r', ' ').strip()
            if len(first_prompt) > 40:
                first_prompt = first_prompt[:37] + "..."
            sessions_collection.update_one(
                {"_id": s["_id"]},
                {"$set": {"title": first_prompt}}
            )


    # --- RAG + Synthesis Pipeline ---
    bot_answer = "Sorry, I encountered an issue processing your request." # Default error response
    references = []
    thinking_content = None  # Initialize thinking content

    try:
        if model == 'gemini':
            selected_model = 'gemini'  # <-- Set here
            # Use Gemini for general chat (no RAG, just LLM)
            logger.info(f"Using Gemini model for chat (Session: {session_id})")
            bot_answer, thinking_content = ai_core.synthesize_gemini_response(query)
            references = []
            # Save user and bot messages as usual
            try:
                database.save_message(session_id, 'user', query, None, None)
                database.save_message(session_id, 'bot', bot_answer, references, thinking_content)
            except Exception as db_err:
                logger.error(f"Database error while saving messages for session {session_id}: {db_err}", exc_info=True)
        elif model == 'ollama':
            logger.info(f"Using LoadBalancer for Ollama+RAG chat (Session: {session_id})")
            context_text = "No specific document context was retrieved or used for this response."
            context_docs_map = {}
            if app_vector_store_ready and config.RAG_CHUNK_K > 0:
                logger.debug(f"Performing RAG search (session: {session_id})...")
                context_docs, context_text, context_docs_map = ai_core.perform_rag_search(query, user_email=user_email)
                if context_docs:
                    logger.info(f"RAG search completed. Found {len(context_docs)} unique context chunks for session {session_id}.")
                else:
                    logger.info(f"RAG search completed but found no relevant chunks.")
                    context_text = "No relevant document sections found for your query."
            elif not app_vector_store_ready and config.RAG_CHUNK_K > 0:
                logger.warning(f"Skipping RAG search: Vector store not ready.")
                context_text = "Knowledge base access is currently unavailable; providing general answer."
            else:  # RAG disabled
                context_text = "Document search is disabled; providing general answer."

            # Compose prompt with optional context
            full_prompt = (
    "You are an AI assistant. Use ONLY the provided context below to answer the user's question. "
    "If the answer is not in the context, reply: 'The answer is not found in the provided documents.'\n\n"
    f"Context:\n{context_text}\n\n"
    f"User Question: {query}\n\n"
    "Instructions:\n"
    "1. Carefully read the entire context and extract ALL relevant information, not just the first match.\n"
    "2. If the context lists multiple items , list them ALL in your answer.\n"
    "3. Quote or paraphrase directly from the context when possible.\n"
    "4. Do NOT use outside knowledge or make up information.\n"
    "5. If the answer is not in the context, say so explicitly.\n"
    "Format your response as:\n"
    "Final Answer: <your answer here>\n\nReasoning: <explain how you found the answer in the context>"
)

            selected_model, bot_answer = load_balancer.get_prediction(full_prompt)
            if not bot_answer:
                bot_answer = "Sorry, all models are currently unavailable. Please try again later."
                references = []
                thinking_content = None
            else:
                # Extract reasoning if present
                main_answer, reasoning = utils.extract_final_answer_and_reasoning(bot_answer)
                bot_answer = main_answer
                thinking_content = reasoning
                references = []

            # Save user and bot messages as usual
            try:
                database.save_message(session_id, 'user', query, None, None)
                database.save_message(session_id, 'bot', bot_answer, references, thinking_content)
            except Exception as db_err:
                logger.error(f"Database error while saving messages for session {session_id}: {db_err}", exc_info=True)

            response_payload = {
                "answer": bot_answer,
                "session_id": session_id,
                "references": references,
                "thinking": thinking_content,
                "model": selected_model  # Add this for transparency
            }
            return jsonify(response_payload), 200
        elif model == 'websearch':
            # Use Web Search for general queries (no RAG, just LLM)
            logger.info(f"Using Web Search model for chat (Session: {session_id})")
            df = DuckDuckGo(
                search=True,
                news=False,
                fixed_max_results=5,
                headers=None,
                proxy=None,
                proxies=None,
                timeout=10,
                verify_ssl=True
            )

            bot_answer, thinking_content = ai_core.synthesize_web_search_response(query, df)
            references = []         
        
            # Save user and bot messages as usual
            try:
                database.save_message(session_id, 'user', query, None, None)
                database.save_message(session_id, 'bot', bot_answer, references, thinking_content)
            except Exception as db_err:
                logger.error(f"Database error while saving messages for session {session_id}: {db_err}", exc_info=True)

        else:
            selected_model = model  # <-- Set to whatever model is used in 'else'
            # Use Ollama + RAG as before for other models or default
            logger.info(f"Using Ollama + RAG for chat (Session: {session_id})")
            # 1. Perform RAG Search (if vector store ready and RAG enabled)
            context_text = "No specific document context was retrieved or used for this response." # Default if RAG skipped/failed
            context_docs_map = {} # Map for citation details {1: {'source':.., 'chunk_index':.., 'content':...}}
            if app_vector_store_ready and config.RAG_CHUNK_K > 0:
                logger.debug(f"Performing RAG search (session: {session_id})...")
                # ai_core.perform_rag_search returns: context_docs, formatted_context_text, context_docs_map
                context_docs, context_text, context_docs_map = ai_core.perform_rag_search(query, user_email=user_email)
                if context_docs:
                     logger.info(f"RAG search completed. Found {len(context_docs)} unique context chunks for session {session_id}.")
                else:
                     logger.info(f"RAG search completed but found no relevant chunks for session {session_id}.")
                     context_text = "No relevant document sections found for your query." # More specific message
            elif not app_vector_store_ready and config.RAG_CHUNK_K > 0:
                 logger.warning(f"Skipping RAG search for session {session_id}: Vector store not ready.")
                 context_text = "Knowledge base access is currently unavailable; providing general answer."
            else: # RAG_CHUNK_K <= 0
                 logger.debug(f"Skipping RAG search for session {session_id}: RAG is disabled (RAG_CHUNK_K <= 0).")
                 context_text = "Document search is disabled; providing general answer."


            # 2. Synthesize Response using LLM (ai_core function now returns answer, thinking)
            logger.debug(f"Synthesizing chat response (session: {session_id})...")
            bot_answer, thinking_content = ai_core.synthesize_chat_response(query, context_text)
            # Log if synthesis itself failed (returned error message)
            if bot_answer.startswith("Error:") or "encountered an error" in bot_answer:
                 logger.error(f"LLM Synthesis failed for session {session_id}. Response: {bot_answer}")


            # 3. Extract References (only if RAG provided context and answer is not an error message)
            # Check if context_docs_map has items and bot_answer doesn't indicate a primary error
            if context_docs_map and not (bot_answer.startswith("Error:") or "[AI Response Processing Error:" in bot_answer or "encountered an error" in bot_answer.lower()):
                logger.debug(f"Extracting references from bot answer (session: {session_id})...")
                references = utils.extract_references(bot_answer, context_docs_map)
                if references:
                    logger.info(f"Extracted {len(references)} unique references for session {session_id}.")
                # else: logger.debug("No citation markers found in the bot answer.")
            else:
                 logger.debug(f"Skipping reference extraction for session {session_id}: No context map provided or bot answer indicates an error.")


        # --- Log Bot Response (including thinking and references) ---
        bot_message_id = None
        try:
            # Save the final answer, parsed references (JSON), and thinking content
            bot_message_id = database.save_message(
                session_id, 'bot', bot_answer, references, thinking_content # Pass thinking here
            )
            if not bot_message_id:
                 logger.error(f"Failed to save bot response to database for session {session_id}.")
        except Exception as db_err:
             # Log error but don't fail the user request if only DB saving fails
             logger.error(f"Database error occurred while saving bot response for session {session_id}: {db_err}", exc_info=True)


        # --- Return Response Payload ---
        response_payload = {
            "answer": bot_answer,
            "session_id": session_id,
            "references": references,
            "thinking": thinking_content,
            "model": selected_model  # Now always defined
        }
        # logger.debug(f"Returning chat response payload for session {session_id}: {response_payload}")
        return jsonify(response_payload), 200  # OK

    except Exception as e:
        # Catch unexpected errors during the RAG/Synthesis pipeline
        logger.error(f"Unexpected error during chat processing pipeline for session {session_id}: {e}", exc_info=True)
        # Construct a user-friendly error message
        error_message = f"Sorry, an unexpected server error occurred ({type(e).__name__}). Please try again or contact support if the issue persists."
        # Attempt to log this severe error to the chat history as well
        try:
            # Include error details in thinking for debugging via history
            error_thinking = f"Unexpected error in /chat route: {type(e).__name__}: {str(e)}"
            database.save_message(session_id, 'bot', error_message, None, error_thinking)
        except Exception as db_log_err:
            logger.error(f"Failed even to save the error message to DB for session {session_id}: {db_log_err}")

        # Return a 500 Internal Server Error response
        return jsonify({
            "error": "Unexpected server error.",
            "answer": error_message,
            "session_id": session_id,  # Return session ID even on error
            "thinking": f"Error in /chat: {type(e).__name__}",  # Simplified error thinking
            "references": []
        }), 500


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

    # Validate filename
    if not filename or not isinstance(filename, str) or not filename.strip():
        logger.warning(f"Invalid filename received for analysis: {filename}")
        return jsonify({"error": "Missing or invalid 'filename'.", "thinking": None}), 400

    allowed_types = list(config.ANALYSIS_PROMPTS.keys())
    if not analysis_type or analysis_type not in allowed_types:
        logger.warning(f"Invalid analysis_type received: {analysis_type}")
        return jsonify({"error": f"Invalid 'analysis_type'. Must be one of: {', '.join(allowed_types)}", "thinking": None}), 400

    # --- Perform Analysis using ai_core function ---
    try:
        user_email = session.get('user_email')
        analysis_content, thinking_content = ai_core.generate_document_analysis(filename, analysis_type, user_email=user_email)

        if analysis_content is None:
            error_msg = f"Analysis failed: Could not retrieve or process document '{filename}'."
            logger.error(error_msg)
            return jsonify({"error": error_msg, "thinking": thinking_content}), 404

        elif analysis_content.startswith("Error:"):
            error_message = analysis_content
            logger.error(f"Analysis failed for '{filename}' ({analysis_type}): {error_message}")
            return jsonify({"error": error_message, "thinking": thinking_content}), 500

        else:
            logger.info(f"Analysis successful for '{filename}' ({analysis_type}). Content length: {len(analysis_content)}")
            return jsonify({
                "content": analysis_content,
                "thinking": thinking_content
            })

    except Exception as e:
        logger.error(f"Unexpected error in /analyze route for '{filename}' ({analysis_type}): {e}", exc_info=True)
        return jsonify({"error": f"Unexpected server error during analysis: {type(e).__name__}. Check logs.", "thinking": None}), 500
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




# # --- Whisper Speech-to-Text Endpoint ---
# @app.route('/transcribe', methods=['POST'])
# def transcribe_audio():
#     """
#     Accepts an audio file (webm/wav/mp3/etc) and returns the Whisper transcript.
#     """
#     if 'audio' not in request.files:
#         return jsonify({'error': 'No audio file provided'}), 400
#     audio_file = request.files['audio']
#     if not audio_file:
#         return jsonify({'error': 'No audio file received'}), 400

#     # Save to a temporary file
#     with tempfile.NamedTemporaryFile(suffix=".webm") as temp:
#         audio_file.save(temp.name)
#         try:
#             # You can use "base", "small", "medium", or "large" for the model
#             model = whisper.load_model("base")
#             result = model.transcribe(temp.name)
#             transcript = result.get("text", "")
#             return jsonify({'transcript': transcript})
#         except Exception as e:
#             logger.error(f"Whisper transcription failed: {e}", exc_info=True)
#             return jsonify({'error': f"Transcription failed: {str(e)}"}), 500

@app.route('/user_files', methods=['GET'])
def user_files():
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"error": "User not authenticated."}), 401
    files = fs.find({"metadata.user_email": user_email})
    file_list = [{"filename": f.filename, "file_id": str(f._id)} for f in files]
    return jsonify(file_list)

@app.route('/download/<file_id>', methods=['GET'])
def download_file(file_id):
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"error": "User not authenticated."}), 401
    try:
        file = fs.get(ObjectId(file_id))
        if file.metadata.get("user_email") != user_email:
            return jsonify({"error": "Unauthorized"}), 403
        return Response(file.read(), mimetype=file.content_type,
                        headers={"Content-Disposition": f"attachment;filename={file.filename}"})
    except Exception as e:
        return jsonify({"error": "File not found"}), 404

# --- Session Management Endpoints ---
from flask import session, jsonify, request
from bson.objectid import ObjectId
import uuid
from datetime import datetime
sessions_collection = db.sessions



# Assume you have a MongoDB collection called 'sessions_collection'

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    user_email = session.get('user_email')
    if not user_email:
        return jsonify([]), 200
    sessions = list(sessions_collection.find({"user_email": user_email}).sort("updated_at", -1))
    result = []
    for s in sessions:
        # Truncate title and last_message to 40 chars, single line
        title = s.get("title", "New Chat").replace('\n', ' ').replace('\r', ' ').strip()
        if len(title) > 40:
            title = title[:37] + "..."
        last_msg = s["messages"][-1]["content"].replace('\n', ' ').replace('\r', ' ').strip() if s.get("messages") else ""
        if len(last_msg) > 40:
            last_msg = last_msg[:37] + "..."
        updated_at = s.get("updated_at", s.get("created_at"))
        updated_at_str = updated_at.isoformat() if updated_at else ""
        result.append({
            "session_id": s["session_id"],
            "title": title,
            "last_message": last_msg,
            "updated_at": updated_at_str
        })
    return jsonify(result)

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    user_email = session.get('user_email')
    s = sessions_collection.find_one({"user_email": user_email, "session_id": session_id})
    if not s:
        return jsonify({"messages": []})
    return jsonify({"messages": s.get("messages", []), "title": s.get("title", "Untitled")})

@app.route('/api/session', methods=['POST'])
def create_session():
    user_email = session.get('user_email')
    session_id = str(uuid.uuid4())
    now = datetime.utcnow()
    sessions_collection.insert_one({
        "user_email": user_email,
        "session_id": session_id,
        "title": "New Chat",
        "messages": [],
        "created_at": now,
        "updated_at": now
    })
    return jsonify({"session_id": session_id, "title": "New Chat", "messages": []})

@app.route('/api/session/<session_id>/message', methods=['POST'])
def add_message(session_id):
    user_email = session.get('user_email')
    data = request.json
    message = {"role": data["role"], "content": data["content"], "timestamp": datetime.utcnow()}
    s = sessions_collection.find_one({"user_email": user_email, "session_id": session_id})
    if not s:
        return jsonify({"error": "Session not found"}), 404

    # Add the message
    sessions_collection.update_one(
        {"_id": s["_id"]},
        {"$push": {"messages": message}}
    )

    # Re-fetch after update
    s = sessions_collection.find_one({"_id": s["_id"]})
    user_messages = [m for m in s.get("messages", []) if m["role"] == "user"]

    # If this is the first user message, update the title immediately!
    if len(user_messages) == 1:
        sessions_collection.update_one(
            {"_id": s["_id"]},
            {"$set": {"title": user_messages[0]["content"]}}
        )

    # Update updated_at
    sessions_collection.update_one(
        {"_id": s["_id"]},
        {"$set": {"updated_at": message["timestamp"]}}
    )

    return jsonify({"success": True})

@app.route('/api/session/<session_id>/rename', methods=['POST'])
def rename_session(session_id):
    user_email = session.get('user_email')
    data = request.get_json()
    new_title = data.get('new_title', '').strip()
    if not new_title:
        return jsonify({"error": "Missing new_title"}), 400
    result = sessions_collection.update_one(
        {"user_email": user_email, "session_id": session_id},
        {"$set": {"title": new_title}}
    )
    if result.modified_count == 1:
        return jsonify({"success": True})
    return jsonify({"error": "Session not found or not updated"}), 404

@app.route('/api/session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    user_email = session.get('user_email')
    result = sessions_collection.delete_one({"user_email": user_email, "session_id": session_id})
    if result.deleted_count == 1:
        return jsonify({"success": True})
    return jsonify({"error": "Session not found"}), 404
# # Example AI title generation function
# from config import OLLAMA_BASE_URL, OLLAMA_MODEL
# from langchain.llms import Ollama

# def generate_session_title(conversation_text):
#     prompt = (
#         "Summarize this chat as a short, descriptive session title (max 8 words):\n"
#         f"{conversation_text}\nTitle:"
#     )
#     llm = Ollama(
#         base_url=OLLAMA_BASE_URL,
#         model=OLLAMA_MODEL
#     )
#     result = llm(prompt)
#     return result.strip().replace('"', '').replace("Title:", "").strip()


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = users_collection.find_one({"email": email})
    if user and check_password_hash(user['password'], password):
        # Generate JWT token
        token = create_token(email)
        return jsonify({"token": token}), 200

    return jsonify({"error": "Invalid email or password"}), 401


# --- Main Execution ---
if __name__ == '__main__':
    # Ensure initialization runs when script is executed directly
    # (e.g., `python app.py`), not just before first request via WSGI
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

    try:
        # Read port from environment variable or default to 5000
        port = int(os.getenv('FLASK_RUN_PORT', 5001))
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
    serve(app, host="localhost", port=port, threads=8) # Adjust threads based on expected load/cores

# --- END OF FILE app.py ---
