# FusedChatbot/server/ai_core_service/config.py
import os
import sys

# --- Determine Base Directory (ai_core_service) ---
# CURRENT_DIR is the directory where this config.py file is located (ai_core_service)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# SERVER_DIR is the parent of CURRENT_DIR (which should be 'server')
# This is useful if FAISS_INDEX_DIR or DEFAULT_ASSETS_DIR are outside ai_core_service
# and within the main 'server' directory.
SERVER_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))

# --- Embedding Model Configuration ---
EMBEDDING_TYPE = 'sentence-transformer'
EMBEDDING_MODEL_NAME_ST = os.getenv('SENTENCE_TRANSFORMER_MODEL', 'mixedbread-ai/mxbai-embed-large-v1')
EMBEDDING_MODEL_NAME = EMBEDDING_MODEL_NAME_ST

# --- FAISS Configuration ---
# Store FAISS indices within the main 'server' directory, not inside ai_core_service
FAISS_INDEX_DIR = os.path.join(SERVER_DIR, 'faiss_indices')
# Store default assets within the main 'server' directory
DEFAULT_ASSETS_DIR = os.path.join(SERVER_DIR, 'default_assets', 'engineering') # Or your chosen default path
DEFAULT_INDEX_USER_ID = '__DEFAULT__'

# --- Text Splitting Configuration ---
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', 512))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', 100))

# --- API Configuration ---
AI_CORE_SERVICE_PORT = int(os.getenv('AI_CORE_SERVICE_PORT', 9000))
# Kept RAG_SERVICE_PORT for backward compatibility if anything still uses it, but prefer AI_CORE_SERVICE_PORT
RAG_SERVICE_PORT = AI_CORE_SERVICE_PORT # Alias for consistency

# Analysis Configuration
ANALYSIS_MAX_CONTEXT_LENGTH = int(os.getenv('ANALYSIS_MAX_CONTEXT_LENGTH', 8000))

# --- LLM and RAG Defaults ---
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "ollama")  # 'ollama', 'gemini', or 'groq_llama3'
DEFAULT_RAG_K = int(os.getenv("DEFAULT_RAG_K", 3))                  # Default number of RAG documents for single query RAG
REFERENCE_SNIPPET_LENGTH = int(os.getenv("REFERENCE_SNIPPET_LENGTH", 200)) # For client display

# --- Multi-Query RAG Configuration (NEW - REQUIRED BY app.py) ---
MULTI_QUERY_COUNT_CONFIG = int(os.getenv("MULTI_QUERY_COUNT_CONFIG", 3)) # Default number of sub-queries to generate
DEFAULT_RAG_K_PER_SUBQUERY_CONFIG = int(os.getenv("DEFAULT_RAG_K_PER_SUBQUERY_CONFIG", 2)) # Default K for each sub-query search


# --- Optional: Default Model Names for LLM Providers (Can also be set in .env for llm_handler.py) ---
# These are fallback values if not set in the .env file that llm_handler.py reads
# OLLAMA_DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
# GEMINI_DEFAULT_MODEL = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")
# GROQ_LLAMA3_DEFAULT_MODEL = os.getenv("GROQ_LLAMA3_MODEL", "llama3-8b-8192")


# --- Print effective configuration (optional, for debugging during startup) ---
# To enable these prints, you might set an environment variable like DEBUG_CONFIG=true
if os.getenv('DEBUG_CONFIG', 'false').lower() == 'true':
    print("--- AI Core Service Configuration (config.py) ---")
    print(f"CURRENT_DIR (ai_core_service): {CURRENT_DIR}")
    print(f"SERVER_DIR (parent of ai_core_service): {SERVER_DIR}")
    print(f"Using Sentence Transformer model: {EMBEDDING_MODEL_NAME}")
    print(f"FAISS Index Directory: {FAISS_INDEX_DIR}")
    print(f"Default Assets Directory: {DEFAULT_ASSETS_DIR}")
    print(f"AI Core Service Port: {AI_CORE_SERVICE_PORT}")
    print(f"Default Index User ID: {DEFAULT_INDEX_USER_ID}")
    print(f"Chunk Size: {CHUNK_SIZE}, Chunk Overlap: {CHUNK_OVERLAP}")
    print(f"Default LLM Provider: {DEFAULT_LLM_PROVIDER}")
    print(f"Default RAG K (single query): {DEFAULT_RAG_K}")
    print(f"Reference Snippet Length: {REFERENCE_SNIPPET_LENGTH}")
    print(f"Multi-Query Count Config: {MULTI_QUERY_COUNT_CONFIG}")
    print(f"Default RAG K per Sub-Query Config: {DEFAULT_RAG_K_PER_SUBQUERY_CONFIG}")
    print("-------------------------------------------------")