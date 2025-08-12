# server/rag_service/config.py
import os
import logging
from dotenv import load_dotenv
from pythonjsonlogger import jsonlogger
from datetime import datetime, timezone

# --- Load .env from the parent 'server' directory ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)


class JsonFormatterWithMilliseconds(jsonlogger.JsonFormatter):
    """
    A custom JSON formatter that correctly formats timestamps with milliseconds and a 'Z' for UTC.
    This overrides the default formatTime method which uses a function that doesn't support %f.
    """
    def formatTime(self, record, datefmt=None):
        # Use the record's creation time and make it timezone-aware (UTC)
        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        
        # Format it to ISO 8601 with milliseconds, then replace the timezone info with 'Z'
        # Example: 2024-01-01T12:34:56.123456+00:00 -> 2024-01-01T12:34:56.123Z
        return dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def setup_logging():
    """Configure logging to output structured, standardized JSON to a dedicated log file."""
    root_logger = logging.getLogger()
    if root_logger.handlers:
        for handler in root_logger.handlers:
            root_logger.removeHandler(handler)

    log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
    os.makedirs(log_dir, exist_ok=True)
    # --- CHANGE 1: Dedicated log file ---
    log_file_path = os.path.join(log_dir, 'python-rag.log')
    
    formatter = JsonFormatterWithMilliseconds(
        '%(asctime)s %(levelname)s %(name)s %(lineno)d %(message)s %(service)s',
        rename_fields={
            'asctime': '@timestamp',
            'levelname': 'log.level',
            'name': 'log.logger',
            'lineno': 'log.origin.file.line',
            'service': 'service.name'
        }
    )
    
    class ServiceContextFilter(logging.Filter):
        def filter(self, record):
            # Standardize log level to lowercase
            record.levelname = record.levelname.lower()
            record.service = "ai-tutor-python-rag"
            return True

    service_filter = ServiceContextFilter()
    
    file_handler = logging.FileHandler(log_file_path, mode='a')
    file_handler.setFormatter(formatter)
    file_handler.addFilter(service_filter)
    root_logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.addFilter(service_filter)
    root_logger.addHandler(console_handler)
    
    LOGGING_LEVEL = os.getenv('LOGGING_LEVEL', 'INFO').upper()
    root_logger.setLevel(LOGGING_LEVEL)
    
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    init_logger = logging.getLogger(__name__)
    init_logger.info(f"Python logging initialized and standardized. Appending to: {log_file_path}")

setup_logging()


# ─── Logging Configuration ───────────────────────────
logger = logging.getLogger(__name__)
LOGGING_LEVEL_NAME = os.getenv('LOGGING_LEVEL', 'INFO').upper()
LOGGING_LEVEL      = getattr(logging, LOGGING_LEVEL_NAME, logging.INFO)
LOGGING_FORMAT     = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'


# --- API Keys and Service URLs ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL_NAME = "gemini-1.5-flash-latest" # Or your preferred Gemini model
SENTRY_DSN = os.getenv('SENTRY_DSN')
TURNITIN_API_URL = os.getenv('TURNITIN_API_URL')
TURNITIN_API_KEY = os.getenv('TURNITIN_API_KEY')
TURNITIN_API_SECRET = os.getenv('TURNITIN_API_SECRET')

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 7000))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "my_qdrant_rag_collection")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
QDRANT_URL = os.getenv("QDRANT_URL", None)

# --- Embedding Model Configuration ---
DEFAULT_DOC_EMBED_MODEL = 'mixedbread-ai/mxbai-embed-large-v1'
DOCUMENT_EMBEDDING_MODEL_NAME = os.getenv('DOCUMENT_EMBEDDING_MODEL_NAME', DEFAULT_DOC_EMBED_MODEL)

_MODEL_TO_DIM_MAPPING = {
    'mixedbread-ai/mxbai-embed-large-v1': 1024,
    'BAAI/bge-large-en-v1.5': 1024,
    'all-MiniLM-L6-v2': 384,
    'sentence-transformers/all-mpnet-base-v2': 768,
}
_FALLBACK_DIM = 768
DOCUMENT_VECTOR_DIMENSION = int(os.getenv("DOCUMENT_VECTOR_DIMENSION", _MODEL_TO_DIM_MAPPING.get(DOCUMENT_EMBEDDING_MODEL_NAME, _FALLBACK_DIM)))
QDRANT_COLLECTION_VECTOR_DIM = DOCUMENT_VECTOR_DIMENSION

QUERY_EMBEDDING_MODEL_NAME = os.getenv("QUERY_EMBEDDING_MODEL_NAME", DOCUMENT_EMBEDDING_MODEL_NAME)
QUERY_VECTOR_DIMENSION = int(os.getenv("QUERY_VECTOR_DIMENSION", _MODEL_TO_DIM_MAPPING.get(QUERY_EMBEDDING_MODEL_NAME, _FALLBACK_DIM)))

if QUERY_VECTOR_DIMENSION != QDRANT_COLLECTION_VECTOR_DIM:
    logger.warning(f"[Config Warning] Query vector dim ({QUERY_VECTOR_DIMENSION}) != Qdrant dim ({QDRANT_COLLECTION_VECTOR_DIM})")

# --- AI Core & Search Configuration ---
AI_CORE_CHUNK_SIZE = int(os.getenv("AI_CORE_CHUNK_SIZE", 512))
AI_CORE_CHUNK_OVERLAP = int(os.getenv("AI_CORE_CHUNK_OVERLAP", 100))
MAX_TEXT_LENGTH_FOR_NER = int(os.getenv("MAX_TEXT_LENGTH_FOR_NER", 500000))
QDRANT_DEFAULT_SEARCH_K = int(os.getenv("QDRANT_DEFAULT_SEARCH_K", 5))
QDRANT_SEARCH_MIN_RELEVANCE_SCORE = float(os.getenv("QDRANT_SEARCH_MIN_RELEVANCE_SCORE", 0.1))

# --- SpaCy Configuration ---
SPACY_MODEL_NAME = os.getenv('SPACY_MODEL_NAME', 'en_core_web_sm')

# --- API Port Configuration ---
API_PORT = int(os.getenv('API_PORT', 5000))

# --- Tesseract OCR Path ---
TESSERACT_CMD = os.getenv('TESSERACT_CMD', r'C:\Program Files\Tesseract-OCR\tesseract.exe')


# ─── Library Availability Flags & Dynamic Imports ──────────────────────
try:
    import pypdf
    PYPDF_AVAILABLE = True
    PYPDF_PDFREADERROR = pypdf.errors.PdfReadError
except ImportError: PYPDF_AVAILABLE, PYPDF_PDFREADERROR = False, Exception

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError: DOCX_AVAILABLE, DocxDocument = False, None

try:
    from pptx import Presentation
    PPTX_AVAILABLE = True
except ImportError: PPTX_AVAILABLE, Presentation = False, None

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError: PDFPLUMBER_AVAILABLE, pdfplumber = False, None

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError: PANDAS_AVAILABLE, pd = False, None

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError: PIL_AVAILABLE, Image = False, None

try:
    import fitz
    FITZ_AVAILABLE = True
except ImportError: FITZ_AVAILABLE, fitz = False, None

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
    TESSERACT_ERROR = pytesseract.TesseractNotFoundError
    if TESSERACT_CMD: pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
except ImportError: PYTESSERACT_AVAILABLE, pytesseract, TESSERACT_ERROR = False, None, Exception

try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError: PYPDF2_AVAILABLE, PyPDF2 = False, None

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    LANGCHAIN_SPLITTER_AVAILABLE = True
except ImportError: LANGCHAIN_SPLITTER_AVAILABLE, RecursiveCharacterTextSplitter = False, None



try:
    import yt_dlp
    YTDLP_AVAILABLE = True
except ImportError:
    YTDLP_AVAILABLE, yt_dlp = False, None
    
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE, whisper = False, None
    
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE, sync_playwright = False, None
    
try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE, BeautifulSoup = False, None
    
try:
    import ffmpeg
    FFMPEG_PYTHON_AVAILABLE = True
except ImportError:
    FFMPEG_PYTHON_AVAILABLE, ffmpeg = False, None


    
# ─── Optional: Preload SpaCy & Embedding Model ───────
nlp_spacy_core, SPACY_MODEL_LOADED = None, False
try:
    import spacy
    nlp_spacy_core = spacy.load(SPACY_MODEL_NAME)
    SPACY_MODEL_LOADED = True
except Exception as e:
    logger.warning(f"Failed to load SpaCy model '{SPACY_MODEL_NAME}': {e}")

document_embedding_model, EMBEDDING_MODEL_LOADED = None, False
try:
    from sentence_transformers import SentenceTransformer
    document_embedding_model = SentenceTransformer(DOCUMENT_EMBEDDING_MODEL_NAME)
    EMBEDDING_MODEL_LOADED = True
except Exception as e:
    logger.warning(f"Failed to load Sentence Transformer model '{DOCUMENT_EMBEDDING_MODEL_NAME}': {e}")

whisper_model, WHISPER_MODEL_LOADED = None, False
try:
    import whisper
    # Using 'base' model is a good balance. Could be configured via .env in the future.
    whisper_model = whisper.load_model("base")
    WHISPER_MODEL_LOADED = True
    logger.info("Successfully pre-loaded Whisper 'base' model.")
except Exception as e:
    logger.warning(f"Failed to pre-load Whisper model: {e}. Transcription will fail.")