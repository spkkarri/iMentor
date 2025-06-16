# server/config.py
# SINGLE configuration file for the Qdrant-based RAG application.
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
print(f"[config.py] Base Directory (server): {BASE_DIR}")

# === Document Processing & Embedding (for rag_service.ai_core.py) ===
DEFAULT_DOC_EMBED_MODEL = 'mixedbread-ai/mxbai-embed-large-v1'
DOCUMENT_EMBEDDING_MODEL_NAME = os.getenv('DOCUMENT_EMBEDDING_MODEL_NAME', DEFAULT_DOC_EMBED_MODEL)
print(f"[Config] Document Embedding Model (ai_core): {DOCUMENT_EMBEDDING_MODEL_NAME}")

_MODEL_TO_DIM_MAPPING = {
    'mixedbread-ai/mxbai-embed-large-v1': 1024,
    'BAAI/bge-large-en-v1.5': 1024,
    'all-MiniLM-L6-v2': 384,
    'sentence-transformers/all-mpnet-base-v2': 768,
}
_FALLBACK_DIM = 768
DOCUMENT_VECTOR_DIMENSION = int(os.getenv(
    "DOCUMENT_VECTOR_DIMENSION",
    _MODEL_TO_DIM_MAPPING.get(DOCUMENT_EMBEDDING_MODEL_NAME, _FALLBACK_DIM)
))
print(f"[Config] Document Embedding Dimension (ai_core output): {DOCUMENT_VECTOR_DIMENSION}")

AI_CORE_CHUNK_SIZE = int(os.getenv("AI_CORE_CHUNK_SIZE", 512))
AI_CORE_CHUNK_OVERLAP = int(os.getenv("AI_CORE_CHUNK_OVERLAP", 100))
print(f"[Config] AI Core Chunk Size: {AI_CORE_CHUNK_SIZE}, Overlap: {AI_CORE_CHUNK_OVERLAP}")

SPACY_MODEL_NAME = os.getenv('SPACY_MODEL_NAME', 'en_core_web_sm')
print(f"[Config] SpaCy Model (ai_core): {SPACY_MODEL_NAME}")

# === Qdrant Configuration (for vector_db_service.py) ===
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "my_qdrant_rag_collection")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
QDRANT_URL = os.getenv("QDRANT_URL", None)

QDRANT_COLLECTION_VECTOR_DIM = DOCUMENT_VECTOR_DIMENSION # Must match document embeddings
print(f"[Config] Qdrant Collection Vector Dimension: {QDRANT_COLLECTION_VECTOR_DIM}")

DEFAULT_QUERY_EMBED_MODEL = DOCUMENT_EMBEDDING_MODEL_NAME
QUERY_EMBEDDING_MODEL_NAME = os.getenv("QUERY_EMBEDDING_MODEL_NAME", DEFAULT_QUERY_EMBED_MODEL)
QUERY_VECTOR_DIMENSION = int(os.getenv(
    "QUERY_VECTOR_DIMENSION",
    _MODEL_TO_DIM_MAPPING.get(QUERY_EMBEDDING_MODEL_NAME, _FALLBACK_DIM)
))

if QUERY_VECTOR_DIMENSION != QDRANT_COLLECTION_VECTOR_DIM:
    print(f"[CRITICAL CONFIG WARNING] Query vector dim ({QUERY_VECTOR_DIMENSION} from '{QUERY_EMBEDDING_MODEL_NAME}') "
          f"!= Qdrant collection dim ({QDRANT_COLLECTION_VECTOR_DIM} from '{DOCUMENT_EMBEDDING_MODEL_NAME}'). This will fail.")
    # raise ValueError("Query and Document embedding dimensions mismatch!")
else:
    print(f"[Config] Query Embedding Model (vector_db_service): {QUERY_EMBEDDING_MODEL_NAME}")
    print(f"[Config] Query Embedding Dimension: {QUERY_VECTOR_DIMENSION}")

QDRANT_DEFAULT_SEARCH_K = int(os.getenv("QDRANT_DEFAULT_SEARCH_K", 5))
QDRANT_SEARCH_MIN_RELEVANCE_SCORE = float(os.getenv("QDRANT_SEARCH_MIN_RELEVANCE_SCORE", 0.1))

# === API Configuration ===
API_PORT = int(os.getenv('API_PORT', 5000))
print(f"[Config] Main Qdrant RAG API Port: {API_PORT}")

# For Tesseract/OCR, if ai_core uses it
# TESSERACT_CMD = os.getenv('TESSERACT_CMD', None) # e.g., '/usr/bin/tesseract' or 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'
# if TESSERACT_CMD:
#     pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
#     print(f"[Config] Tesseract CMD set to: {TESSERACT_CMD}")