# server/rag_service/config.py
# This is now the UNIFIED configuration file.

import os
import sys
import logging # Added for setup_logging

# --- Determine Server Directory (base for many paths) ---
# __file__ is server/rag_service/config.py
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# SERVER_DIR will be .../Chatbot-geminiV3/server/
SERVER_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
# PROJECT_ROOT_DIR could be useful for paths outside 'server' if needed later
# PROJECT_ROOT_DIR = os.path.abspath(os.path.join(SERVER_DIR, '..')) # .../Chatbot-geminiV3/

print(f"UNIFIED CONFIG [server/rag_service/config.py] SERVER_DIR: {SERVER_DIR}")

# --- Embedding Model Configuration (Used by default.py AND ai_core.py) ---
EMBEDDING_TYPE = 'sentence-transformer' # Crucial for ai_core.py to know how to init embeddings
EMBEDDING_MODEL_NAME_ST = os.getenv('SENTENCE_TRANSFORMER_MODEL', 'mixedbread-ai/mxbai-embed-large-v1')
EMBEDDING_MODEL_NAME = EMBEDDING_MODEL_NAME_ST # This will be used by ai_core.py
print(f"UNIFIED CONFIG: Using Sentence Transformer model for embeddings: {EMBEDDING_MODEL_NAME}")

# --- LLM Configuration (For Chat Generation - used by ai_core.py) ---
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral:7b-instruct') # For chat generation/analysis
OLLAMA_REQUEST_TIMEOUT = int(os.getenv('OLLAMA_REQUEST_TIMEOUT', 180)) # 3 minutes
print(f"UNIFIED CONFIG: Ollama LLM for generation: {OLLAMA_MODEL} at {OLLAMA_BASE_URL}")

# --- FAISS Configuration (Used by default.py AND ai_core.py) ---
# This is the central directory for ALL FAISS indexes (default and user-specific)
FAISS_INDEX_DIR = os.path.join(SERVER_DIR, 'faiss_indices')
# For default.py to find documents to create the default index
DEFAULT_ASSETS_DIR = os.path.join(SERVER_DIR, 'default_assets', 'engineering')
# Identifier for the default index
DEFAULT_INDEX_USER_ID = '__DEFAULT__'
print(f"UNIFIED CONFIG: FAISS Index Directory: {FAISS_INDEX_DIR}")
print(f"UNIFIED CONFIG: Default Assets Directory (for default.py indexing): {DEFAULT_ASSETS_DIR}")
print(f"UNIFIED CONFIG: Default Index User ID: {DEFAULT_INDEX_USER_ID}")

# --- Text Splitting Configuration (Used by default.py's file_parser AND ai_core.py if it chunks) ---
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', 512))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', 100))
print(f"UNIFIED CONFIG: Chunk Size: {CHUNK_SIZE}, Chunk Overlap: {CHUNK_OVERLAP}")

# --- RAG Configuration (Used by ai_core.py or app.py for querying) ---
RAG_CHUNK_K = int(os.getenv('RAG_CHUNK_K', 3)) # Number of chunks to retrieve for RAG context
print(f"UNIFIED CONFIG: RAG Chunks to retrieve (k): {RAG_CHUNK_K}")

# --- Application Paths (Used by Notebook/app.py) ---
# UPLOAD_FOLDER: For files uploaded by users via the Notebook/app.py UI
# Store it inside SERVER_DIR for this example. Adjust if it should be elsewhere.
UPLOAD_FOLDER_NAME = os.getenv('UPLOAD_FOLDER_NAME', 'user_document_uploads') # Name of the subdir
UPLOAD_FOLDER = os.path.join(SERVER_DIR, UPLOAD_FOLDER_NAME)
print(f"UNIFIED CONFIG: User Upload Folder: {UPLOAD_FOLDER}")

# DATABASE_PATH: For chat history, etc.
# Store it inside SERVER_DIR for this example.
DATABASE_FILE_NAME = os.getenv('DATABASE_NAME', 'chat_history.db')
DATABASE_PATH = os.path.join(SERVER_DIR, DATABASE_FILE_NAME)
print(f"UNIFIED CONFIG: Database Path: {DATABASE_PATH}")

# DEFAULT_PDFS_FOLDER: For displaying a list of "default" PDFs in the UI (if different from DEFAULT_ASSETS_DIR)
# This seems specific to your Notebook/app.py's /documents route.
# Store it inside SERVER_DIR for this example.
DEFAULT_PDFS_DISPLAY_FOLDER_NAME = os.getenv('DEFAULT_PDFS_FOLDER_NAME', 'default_pdfs_for_ui_display')
DEFAULT_PDFS_FOLDER = os.path.join(SERVER_DIR, DEFAULT_PDFS_DISPLAY_FOLDER_NAME)
print(f"UNIFIED CONFIG: Default PDFs (for UI display) Folder: {DEFAULT_PDFS_FOLDER}")


# --- Analysis Prompts (Used by Notebook/app.py's /analyze route) ---
ANALYSIS_PROMPTS = {
    "faq": "Based on the following document, generate a list of 5-7 frequently asked questions (FAQs) and their concise answers. Each FAQ should be a question that a user might realistically ask about the document's content. Each answer should be directly supported by the text.\n\nDocument:\n{document_text}\n\nFAQs:\n",
    "topics": "Identify the 5-8 main topics or key themes discussed in the following document. For each topic, provide a brief one-sentence description.\n\nDocument:\n{document_text}\n\nMain Topics:\n",
    "mindmap": "Create a hierarchical mindmap structure representing the key concepts, sub-concepts, and important details from the following document. Use markdown list format (e.g., - Concept\n  - SubConcept\n    - Detail).\n\nDocument:\n{document_text}\n\nMindmap:\n"
}
print(f"UNIFIED CONFIG: Analysis prompts configured: {list(ANALYSIS_PROMPTS.keys())}")

# --- API Configuration (If you still have a separate RAG service API, or for Notebook/app.py port) ---
# If Notebook/app.py is your main app, this port will be for it.
APP_SERVICE_PORT = int(os.getenv('APP_SERVICE_PORT', 5000)) # Changed from RAG_SERVICE_PORT
print(f"UNIFIED CONFIG: Application Service Port: {APP_SERVICE_PORT}")


# --- Logging Setup Function (To be called by app.py or other main scripts) ---
def setup_logging():
    """Configures basic logging for the application."""
    log_level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    # Ensure the log level is a valid attribute of logging
    log_level = getattr(logging, log_level_str, None)
    if not isinstance(log_level, int):
        print(f"WARNING: Invalid LOG_LEVEL '{log_level_str}'. Defaulting to INFO.")
        log_level = logging.INFO

    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(levelname)s - [%(name)s:%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        # Consider adding a FileHandler for persistent logs in production
        # handlers=[logging.StreamHandler(sys.stdout)] # Explicitly to stdout
    )
    # Quieten overly verbose libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers.SentenceTransformer").setLevel(logging.INFO) # Keep ST info, but not debug
    # Add more as needed: e.g., logging.getLogger("uvicorn").setLevel(logging.WARNING)

    logger_cfg = logging.getLogger(__name__) # Logger for this config.py module itself
    logger_cfg.info(f"Unified logging configured to level: {logging.getLevelName(log_level)} by server/rag_service/config.py")

# --- End of UNIFIED server/rag_service/config.py ---