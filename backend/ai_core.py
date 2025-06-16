import os
import logging
import ollama
# import fitz  # PyMuPDF - REMOVED as pdfplumber is used for text extraction
import re
import json # Needed for json.dumps for references_json
import uuid # Needed for session ID generation if not passed in
import torch
import tempfile # Not explicitly used in current version, but good to keep if needed later
import numpy as np
import albumentations as alb
from albumentations.pytorch import ToTensorV2
from PIL import Image
from typing import Callable, Optional, List, Dict, Any # For type hints
from gtts import gTTS # For Text-to-Speech

# --- Nougat Imports ---
try:
    from nougat import NougatModel
    from nougat.utils.dataset import LazyDataset
    from nougat.utils.checkpoint import get_checkpoint as nougat_get_checkpoint # Renamed to avoid conflict
    # from nougat.dataset.rasterize import rasterize_paper # LazyDataset handles this
    # from nougat.transforms import test_transform # Replaced by custom albumentations pipeline
    NOUGAT_AVAILABLE = True
    nougat_model_instance = None
    from timm.data.constants import IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD
except ImportError:
    NOUGAT_AVAILABLE = False
    NougatModel = None
    LazyDataset = None
    nougat_get_checkpoint = None
    nougat_model_instance = None
    IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
    logging.getLogger(__name__).warning(
        "Failed to import Nougat components (NougatModel, LazyDataset, etc.), PyTorch, or Timm. "
        "PDF-to-MMD conversion for mindmaps will use a basic text extraction fallback."
    )
# --- End Nougat Imports ---
# Near the top of ai_core.py
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from langchain.chains import LLMChain # Still useful for simple prompt/LLM interaction
from langchain.prompts import PromptTemplate # Import PromptTemplate if needed directly here
# Import memory components
from langchain.memory import ConversationSummaryBufferMemory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import HumanMessage, AIMessage # To format messages for memory
from protocols import ModelContextProtocol, AgenticContextProtocol # Import new protocols
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder # For dynamic prompt construction

from config import (
    OLLAMA_BASE_URLS, OLLAMA_MODEL, OLLAMA_EMBED_MODEL, FAISS_FOLDER, # Modified: OLLAMA_BASE_URL -> OLLAMA_BASE_URLS
    UPLOAD_FOLDER, RAG_CHUNK_K, MULTI_QUERY_COUNT,
    ANALYSIS_MAX_CONTEXT_LENGTH, OLLAMA_REQUEST_TIMEOUT, RAG_SEARCH_K_PER_QUERY,
    SUB_QUERY_PROMPT_TEMPLATE, SYNTHESIS_PROMPT_TEMPLATE, ANALYSIS_PROMPTS,
    SUMMARY_BUFFER_TOKEN_LIMIT ,# Import summary buffer limit
    LATEX_SUMMARIZATION_PROMPT_TEMPLATE, # Kept in case it's used elsewhere or future
    NOUGAT_CHECKPOINT_PATH, NOUGAT_MODEL_TAG,
    PODCAST_AUDIO_FOLDER, PODCAST_GENERATION_PROMPT_TEMPLATE # New podcast configs
)
from utils import parse_llm_response, extract_references, escape_html # Added escape_html for potential use
import database # Import database module to interact with chat history/sessions
import pdfplumber

logger = logging.getLogger(__name__)

# --- Global State (managed within functions) ---
document_texts_cache: dict[str, dict[str, str]] = {} # {user_id: {filename: text}}
vector_store = None
embeddings: OllamaEmbeddings | None = None
llm: ChatOllama | None = None
_last_used_ollama_url_index: int = -1 # Global state for round-robin load balancing
# We don't store memory or specific session state globally anymore,
# it's managed per chat request using the database.

def get_next_ollama_base_url() -> str | None:
    """
    Implements a round-robin load balancing strategy for Ollama base URLs.
    Skips unavailable URLs and rotates through the list.
    """
    global _last_used_ollama_url_index
    
    if not OLLAMA_BASE_URLS:
        logger.error("OLLAMA_BASE_URLS is empty. No Ollama servers configured.")
        return None

    num_urls = len(OLLAMA_BASE_URLS)
    
    # Try up to `num_urls` times to find an available server
    for _ in range(num_urls):
        _last_used_ollama_url_index = (_last_used_ollama_url_index + 1) % num_urls
        next_url = OLLAMA_BASE_URLS[_last_used_ollama_url_index]
        
        # Basic check for availability (can be expanded with actual health checks)
        # For now, we assume the URL is "available" until a request fails.
        # The actual error handling will happen at the point of LLM invocation.
        logger.debug(f"Attempting to use Ollama URL: {next_url} (index: {_last_used_ollama_url_index})")
        return next_url
        
    logger.error("No active Ollama base URLs found after attempting all configured URLs.")
    return None


def initialize_nougat_model():
    """Initializes the Nougat model if available."""
    global nougat_model_instance

    if not NOUGAT_AVAILABLE:
        logger.info("Nougat is not available. Skipping Nougat model initialization.")
        return

    if nougat_model_instance is not None:
        logger.info("Nougat model already initialized.")
        return

    try:
        logger.info("Initializing Nougat model (this may take a moment)...")
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Nougat: Using {device} for processing.")

        checkpoint_to_load = NOUGAT_CHECKPOINT_PATH # From config.py, can be manual path
        model_tag_for_download = NOUGAT_MODEL_TAG    # From config.py, e.g., "0.1.0-small"

        if checkpoint_to_load and os.path.exists(checkpoint_to_load):
            logger.info(f"Nougat: Attempting to load model from configured NOUGAT_CHECKPOINT_PATH: {checkpoint_to_load}")
            # Check for essential files if it's a directory
            if os.path.isdir(checkpoint_to_load):
                required_files_present = True
                essential_files = ["pytorch_model.bin", "config.json", "tokenizer.json"] # Common essential files
                for f_name in essential_files:
                    if not os.path.exists(os.path.join(checkpoint_to_load, f_name)):
                        logger.error(f"CRITICAL: Essential file '{f_name}' NOT FOUND in NOUGAT_CHECKPOINT_PATH directory: {checkpoint_to_load}.")
                        required_files_present = False
                if not required_files_present:
                    logger.error("Essential model files missing from NOUGAT_CHECKPOINT_PATH directory. Nougat cannot load. Attempting download fallback if tag available.")
                    checkpoint_to_load = None # Force fallback to download
            # If it's a file (e.g. .ckpt), we assume it's correct. from_pretrained should handle it.
        elif checkpoint_to_load and not os.path.exists(checkpoint_to_load):
             logger.warning(f"Configured NOUGAT_CHECKPOINT_PATH '{checkpoint_to_load}' not found. Attempting download if tag available.")
             checkpoint_to_load = None # Force fallback to download

        if not checkpoint_to_load and nougat_get_checkpoint and model_tag_for_download:
            logger.info(f"Nougat: Attempting to download/use cached model for tag: {model_tag_for_download}")
            try:
                # This will download to Hugging Face cache or use existing if available
                checkpoint_to_load = nougat_get_checkpoint(model_tag=model_tag_for_download, download=True) # Explicitly allow download
                logger.info(f"Nougat: Using checkpoint (downloaded/cached): {checkpoint_to_load}")
                # After download, re-check essential files if it's a directory
                if os.path.isdir(checkpoint_to_load):
                    required_files_present = True
                    essential_files = ["pytorch_model.bin", "config.json", "tokenizer.json"]
                    for f_name in essential_files:
                        if not os.path.exists(os.path.join(checkpoint_to_load, f_name)):
                            logger.error(f"CRITICAL: Essential file '{f_name}' NOT FOUND in downloaded checkpoint directory {checkpoint_to_load}.")
                            required_files_present = False
                    if not required_files_present:
                        logger.error("Essential model files missing from downloaded checkpoint directory. Nougat cannot load.")
                        nougat_model_instance = None
                        return
            except Exception as e_download:
                logger.error(f"Nougat: Failed to download/get checkpoint for tag '{model_tag_for_download}': {e_download}", exc_info=True)
                nougat_model_instance = None
                return
        elif not checkpoint_to_load: # If still no checkpoint_to_load (e.g. path was bad and no tag)
            logger.error("Nougat: NOUGAT_CHECKPOINT_PATH is invalid/not found and NOUGAT_MODEL_TAG is missing or download failed. Cannot load model.")
            nougat_model_instance = None
            return

        from transformers import logging as hf_logging
        hf_logging.set_verbosity_warning() # Reduce verbosity unless debugging transformers

        nougat_model_instance = NougatModel.from_pretrained(checkpoint_to_load).to(device)
        nougat_model_instance.eval()

        model_name_for_log = getattr(nougat_model_instance.config, "_name_or_path", checkpoint_to_load)
        logger.info(f"Nougat model ('{model_name_for_log}') initialized successfully on {device}.")

    except Exception as e:
        logger.error(f"Failed to initialize Nougat model: {e}", exc_info=True)
        nougat_model_instance = None

# --- Initialization Functions ---

def initialize_ai_components() -> tuple[OllamaEmbeddings | None, ChatOllama | None]:
    """Initializes Ollama Embeddings and LLM instances globally.

    Returns:
        tuple[OllamaEmbeddings | None, ChatOllama | None]: The initialized embeddings and llm objects,
                                                          or (None, None) if initialization fails.
    """
    global embeddings, llm
    if embeddings and llm:
        logger.info("AI components already initialized.")
        return embeddings, llm

    try:
        # Use the load balancer for initial setup as well
        current_ollama_base_url = get_next_ollama_base_url()
        if not current_ollama_base_url:
            logger.critical("No active Ollama base URLs available for initialization.")
            return None, None

        logger.info(f"Initializing Ollama Embeddings: model={OLLAMA_EMBED_MODEL}, base_url={current_ollama_base_url}, timeout={OLLAMA_REQUEST_TIMEOUT}s")
        embeddings = OllamaEmbeddings(
            model=OLLAMA_EMBED_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
        )
        _ = embeddings.embed_query("Test embedding query")
        logger.info("Ollama Embeddings initialized successfully.")

        logger.info(f"Initializing Ollama LLM: model={OLLAMA_MODEL}, base_url={current_ollama_base_url}, timeout={OLLAMA_REQUEST_TIMEOUT}s")
        llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
        )
        _ = llm.invoke("Respond briefly with 'AI Check OK'")
        logger.info("Ollama LLM initialized successfully.")

        return embeddings, llm
    except ImportError as e:
        logger.critical(f"Import error during AI initialization: {e}. Ensure correct langchain packages are installed.", exc_info=True)
        embeddings = None
        llm = None
        return None, None
    except Exception as e:
        logger.error(f"Failed to initialize AI components (check Ollama server status, model name '{OLLAMA_MODEL}' / '{OLLAMA_EMBED_MODEL}', base URL '{current_ollama_base_url if 'current_ollama_base_url' in locals() else 'N/A'}', timeout {OLLAMA_REQUEST_TIMEOUT}s): {e}", exc_info=True)
        logger.error(f"Error Type: {type(e).__name__}")
        if "pydantic" in str(type(e)).lower():
             logger.error(f"Pydantic Validation Error Details: {e}")
        embeddings = None
        llm = None
        return None, None

def load_vector_store() -> bool:
    """Loads the FAISS index from disk into the global `vector_store`.

    Requires `embeddings` to be initialized first.

    Returns:
        bool: True if the index was loaded successfully, False otherwise (or if not found).
    """
    global vector_store, embeddings
    if vector_store:
        logger.info("Vector store already loaded.")
        return True
    if not embeddings:
        logger.error("Embeddings not initialized. Cannot load vector store.")
        return False

    faiss_index_path = os.path.join(FAISS_FOLDER, "index.faiss")
    faiss_pkl_path = os.path.join(FAISS_FOLDER, "index.pkl")

    if os.path.exists(faiss_index_path) and os.path.exists(faiss_pkl_path):
        try:
            logger.info(f"Loading FAISS index from folder: {FAISS_FOLDER}")
            vector_store = FAISS.load_local(
                folder_path=FAISS_FOLDER,
                embeddings=embeddings,
                allow_dangerous_deserialization=True
            )
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            if index_size > 0:
                logger.info(f"FAISS index loaded successfully. Contains {index_size} vectors.")
                return True
            else:
                logger.warning(f"FAISS index loaded from {FAISS_FOLDER}, but it appears to be empty.")
                return True
        except FileNotFoundError:
            logger.warning(f"FAISS index files not found in {FAISS_FOLDER}, although directory exists. Proceeding without loaded index.")
            vector_store = None
            return False
        except EOFError:
            logger.error(f"EOFError loading FAISS index from {FAISS_FOLDER}. Index file might be corrupted or incomplete. This could be due to an incomplete save.", exc_info=True)
            vector_store = None
            return False
        except Exception as e:
            logger.error(f"Error loading FAISS index from {FAISS_FOLDER}: {e}", exc_info=True)
            vector_store = None
            return False
    else:
        logger.warning(f"FAISS index files (index.faiss, index.pkl) not found at {FAISS_FOLDER}. Will be created on first user upload.")
        vector_store = None
        return False


def save_vector_store() -> bool:
    """Saves the current global `vector_store` (FAISS index) to disk.

    Returns:
        bool: True if saving was successful, False otherwise (or if store is None).
    """
    global vector_store
    if not vector_store:
        logger.warning("Attempted to save vector store, but it's not loaded or initialized.")
        return False
    if not os.path.exists(FAISS_FOLDER):
        try:
            os.makedirs(FAISS_FOLDER)
            logger.info(f"Created FAISS store directory: {FAISS_FOLDER}")
        except OSError as e:
            logger.error(f"Failed to create FAISS store directory {FAISS_FOLDER}: {e}", exc_info=True)
            return False

    try:
        index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Saving FAISS index ({index_size} vectors) to {FAISS_FOLDER}...")
        vector_store.save_local(FAISS_FOLDER)
        logger.info(f"FAISS index saved successfully.")
        return True
    except Exception as e:
        logger.error(f"Error saving FAISS index to {FAISS_FOLDER}: {e}", exc_info=True)
        return False


# --- Document Text Caching ---

def cache_document_text(user_id: str, filename: str, text: str):
    """Caches text for a specific user's document."""
    global document_texts_cache
    if user_id not in document_texts_cache:
        document_texts_cache[user_id] = {}
    document_texts_cache[user_id][filename] = text
    logger.debug(f"Cached text for user '{user_id}', file '{filename}'. Cache size for user: {len(document_texts_cache[user_id])}")


def get_document_text_from_cache_or_load(user_id: str, filename: str) -> str | None:
    """
    Retrieves document text for a specific user's document.
    Attempts cache first, then loads from disk if not found.
    Args:
        user_id (str): The ID of the user who owns the document.
        filename (str): The (secured) filename of the document.
    """
    global document_texts_cache

    cached_text = document_texts_cache.get(user_id, {}).get(filename)
    if cached_text:
        logger.debug(f"Found text for '{filename}' (user: {user_id}) in cache.")
        return cached_text

    logger.debug(f"Text for '{filename}' (user: {user_id}) not in cache. Attempting load from disk...") # Changed to debug

    user_specific_upload_folder = os.path.join(UPLOAD_FOLDER, user_id)
    file_path = os.path.join(user_specific_upload_folder, filename)

    if not os.path.exists(file_path):
        logger.error(f"Document file '{filename}' not found at {file_path} for user '{user_id}'.")
        return None

    doc_text = extract_text_from_pdf(file_path)
    if doc_text:
        if user_id not in document_texts_cache: document_texts_cache[user_id] = {}
        document_texts_cache[user_id][filename] = doc_text
        logger.info(f"Loaded and cached text for '{filename}' (user: {user_id}) from {file_path}.")
        return doc_text
    else:
        logger.error(f"Failed to extract text from '{filename}' at {file_path} for user '{user_id}'.")
        return None


# --- PDF Processing Functions ---

def extract_text_from_pdf(pdf_path: str) -> str | None:
    """Extracts text from a single PDF file using pdfplumber.

    Args:
        pdf_path (str): The full path to the PDF file.

    Returns:
        str | None: The extracted text content, or None if an error occurred or text is empty.
    """
    text = ""
    if not os.path.exists(pdf_path):
        logger.error(f"PDF file not found for extraction: {pdf_path}")
        return None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                try:
                    page_text = page.extract_text() or ""
                    page_text = re.sub(r'\s+', ' ', page_text).strip()
                    if page_text:
                         text += page_text + "\n\n"
                except Exception as page_err:
                    logger.warning(f"Error processing page {page_num+1} of {os.path.basename(pdf_path)}: {page_err}")
                    continue
        cleaned_text = text.strip()
        if cleaned_text:
            logger.info(f"Successfully extracted text from {os.path.basename(pdf_path)} (approx {len(cleaned_text)} chars).")
            return cleaned_text
        else:
            logger.warning(f"Extracted text was empty for {os.path.basename(pdf_path)}.")
            return None # Return None for empty, not ""
    except pdfplumber.pdfminer.pdfdocument.PDFPasswordIncorrect:
        logger.error(f"Cannot extract text from PDF {os.path.basename(pdf_path)}: Password protected.")
        return "[Error: PDF is password protected and text cannot be extracted.]" # Special string for frontend
    except Exception as e:
        logger.error(f"Error extracting text from PDF {os.path.basename(pdf_path)}: {e}", exc_info=True)
        return None

# --- Document Chunking and Vector Store Functions ---
def create_chunks_from_text(text: str, filename: str, source_metadata: dict) -> list[Document]:
    """
    Splits text into chunks. source_metadata MUST include 'source' (filename)
    and 'user_id'.
    """
    if not text or not text.strip():
        logger.warning(f"Cannot create chunks for '{filename}': Provided text is empty or whitespace only.")
        return []
    if "[Error: PDF is password protected" in text: # Check for password error string
        logger.warning(f"Cannot create chunks for '{filename}': Text indicates PDF is password protected.")
        return []
    if not source_metadata or 'source' not in source_metadata or 'user_id' not in source_metadata:
        logger.error(f"Missing 'source' or 'user_id' in source_metadata for '{filename}'. Cannot create chunks.")
        return []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=150, length_function=len,
        add_start_index=True, separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""]
    )
    try:
        documents = text_splitter.create_documents([text], metadatas=[source_metadata])
        for i, doc in enumerate(documents):
            doc.metadata["chunk_index"] = i
        logger.info(f"Created {len(documents)} LangChain Document chunks for '{filename}' (User: {source_metadata.get('user_id')}).")
        return documents
    except Exception as e:
        logger.error(f"Error creating chunks for '{filename}': {e}", exc_info=True)
        return []


def add_documents_to_vector_store(documents: list[Document]) -> bool:
    """Adds LangChain Documents to the global FAISS index.
    Creates the index if it doesn't exist. Saves the index afterwards.

    Args:
        documents (list[Document]): The list of documents to add.

    Returns:
        bool: True if documents were added and the index saved successfully, False otherwise.
    """
    global vector_store, embeddings
    if not documents:
        logger.warning("No documents provided to add to vector store.")
        return False
    if not embeddings:
        logger.error("Embeddings model not initialized. Cannot add documents to vector store.")
        return False
    try:
        logger.info(f"Adding {len(documents)} document chunks to vector store. Example user_id in metadata: {documents[0].metadata.get('user_id', 'N/A')}")
        if vector_store:
            logger.info(f"Adding {len(documents)} document chunks to existing FAISS index...")
            vector_store.add_documents(documents)
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"FAISS index now contains {index_size} vectors after adding new documents.")
        else:
            logger.info(f"No FAISS index loaded. Creating new index from {len(documents)} document chunks...")
            if not os.path.exists(FAISS_FOLDER):
                os.makedirs(FAISS_FOLDER, exist_ok=True)
                logger.info(f"Created FAISS store directory: {FAISS_FOLDER}")

            vector_store = FAISS.from_documents(documents, embeddings)
            index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
            if vector_store and index_size > 0:
                logger.info(f"New FAISS index created with {index_size} vectors.")
            else:
                logger.error("Failed to create new FAISS index or index is empty after creation.")
                vector_store = None
                return False

        return save_vector_store()

    except Exception as e:
        logger.error(f"Error adding documents to FAISS index or saving: {e}", exc_info=True)
        return False

# --- RAG and LLM Interaction ---

def generate_sub_queries(query: str) -> list[str]:
    """
    Uses the LLM to generate sub-queries for RAG. Includes the original query.
    Uses SUB_QUERY_PROMPT_TEMPLATE from config.
    """
    global llm
    if not llm:
        logger.error("LLM not initialized, cannot generate sub-queries. Using original query only.")
        return [query]
    if MULTI_QUERY_COUNT <= 0:
        logger.debug("MULTI_QUERY_COUNT is <= 0, skipping sub-query generation.")
        return [query]

    if set(SUB_QUERY_PROMPT_TEMPLATE.input_variables) != {"query", "num_queries"}:
         logger.error(f"SUB_QUERY_PROMPT_TEMPLATE has incorrect input variables: {SUB_QUERY_PROMPT_TEMPLATE.input_variables}. Expected {{'query', 'num_queries'}}.")
         return [query]

    chain = LLMChain(llm=llm, prompt=SUB_QUERY_PROMPT_TEMPLATE)

    try:
        logger.info(f"Generating {MULTI_QUERY_COUNT} sub-queries for: '{query[:100]}...'")
        response = chain.invoke({"query": query, "num_queries": MULTI_QUERY_COUNT})
        raw_response_text = response.get('text', '') if isinstance(response, dict) else getattr(response, 'content', str(response))
        logger.debug(f"Sub-query Raw Response (Start):\n{raw_response_text[:150]}...")

        sub_queries = [q.strip() for q in raw_response_text.strip().split('\n') if q.strip()]

        if sub_queries:
            logger.info(f"Generated {len(sub_queries)} potential sub-queries.")
            final_queries = [query] + sub_queries
            final_queries_dedup = list(dict.fromkeys(final_queries))
            final_queries_dedup = final_queries_dedup[:MULTI_QUERY_COUNT + 1]
            logger.debug(f"Final search queries: {final_queries_dedup}")
            return final_queries_dedup
        else:
            logger.warning("LLM did not generate any valid sub-queries. Falling back to original query only.")
            return [query]

    except Exception as e:
        logger.error(f"Error generating sub-queries: {e}", exc_info=True)
        return [query]


def perform_rag_search(query: str, user_id_for_filter: str, document_filter: Optional[str] = None) -> tuple[list[Document], str, dict[int, dict]]:
    """
    Performs RAG. Filters retrieved documents to include only those belonging
    to user_id_for_filter and optionally to a specific document_filter.
    """
    global vector_store
    if not vector_store or not query or not query.strip() or getattr(getattr(vector_store, 'index', None), 'ntotal', 0) == 0:
        logger.warning("RAG search prerequisites not met (no store, empty query, or empty index).")
        return [], "No relevant context was found in your accessible documents.", {}
    context_docs = []
    formatted_context_text = "No relevant context was found in your accessible documents."
    context_docs_map = {}
    try:
        logger.info(f"RAG search for user_id_for_filter={user_id_for_filter}, document_filter={document_filter}, query='{query[:100]}...'")
        search_queries = generate_sub_queries(query)
        all_retrieved_docs_with_scores = []
        fetch_k_multiplier = 3
        k_per_query = max(RAG_SEARCH_K_PER_QUERY, 1) * fetch_k_multiplier
        logger.info(f"Performing RAG search for {len(search_queries)} query(ies), fetching up to {k_per_query} docs per query...")
        for q_idx, q_text in enumerate(search_queries):
            logger.debug(f"Sub-query {q_idx+1}: {q_text}")
            try:
                retrieved = vector_store.similarity_search_with_score(q_text, k=k_per_query)
                all_retrieved_docs_with_scores.extend(retrieved)
                logger.debug(f"Query '{q_text[:50]}...': Retrieved {len(retrieved)} candidates.")
            except Exception as search_err:
                logger.error(f"Error during similarity search for query '{q_text[:50]}...': {search_err}")

        if not all_retrieved_docs_with_scores:
            logger.warning("No documents retrieved from vector store for any sub-query.")
            return [], formatted_context_text, context_docs_map

        unique_docs_dict = {}
        initial_retrieved_count = len(all_retrieved_docs_with_scores)

        for doc, score in all_retrieved_docs_with_scores:
            if not hasattr(doc, 'metadata') or not isinstance(doc.metadata, dict):
                logger.warning(f"Retrieved document missing valid metadata. Skipping. Content start: {doc.page_content[:50]}...")
                continue

            doc_user_id = doc.metadata.get('user_id')
            source = doc.metadata.get('source', 'Unknown')
            chunk_idx = doc.metadata.get('chunk_index', doc.metadata.get('start_index', -1))

            # Apply user_id filter
            if doc_user_id != user_id_for_filter:
                continue

            # Apply document_filter if provided
            if document_filter and source != document_filter:
                logger.debug(f"Skipping document '{source}' as it does not match filter '{document_filter}'.")
                continue

            doc_key = (source, chunk_idx, doc_user_id)
            if doc_key not in unique_docs_dict or score < unique_docs_dict[doc_key][1]:
                unique_docs_dict[doc_key] = (doc, score)

        logger.info(f"RAG search: {initial_retrieved_count} candidates retrieved -> {len(unique_docs_dict)} accessible & unique candidates for user '{user_id_for_filter}' (filtered by document: {document_filter}).")

        if not unique_docs_dict:
            if document_filter:
                logger.warning(f"No accessible document chunks found for user_id {user_id_for_filter} within document '{document_filter}'.")
                return [], f"The document '{document_filter}' does not contain enough information to answer your question.", context_docs_map
            else:
                logger.warning(f"No accessible document chunks found after filtering for user_id {user_id_for_filter}.")
                return [], formatted_context_text, context_docs_map

        sorted_unique_docs = sorted(unique_docs_dict.values(), key=lambda item: item[1])
        final_context_docs_with_scores = sorted_unique_docs[:RAG_CHUNK_K]
        context_docs = [doc for doc, score in final_context_docs_with_scores]
        logger.info(f"Selected {len(context_docs)} unique chunks for context for user '{user_id_for_filter}'.")

        formatted_context_parts = []
        temp_map = {}
        for i, doc in enumerate(context_docs):
            citation_index = i + 1
            source = doc.metadata.get('source', 'Unknown Source')
            chunk_idx = doc.metadata.get('chunk_index', doc.metadata.get('start_index', 'N/A'))
            content = doc.page_content
            context_str = f"[{citation_index}] Source: {source} | Chunk Index: {chunk_idx}\n{content}"
            formatted_context_parts.append(context_str)
            temp_map[citation_index] = {"source": source, "chunk_index": chunk_idx, "content": content}

        formatted_context_text = "\n\n---\n\n".join(formatted_context_parts) if formatted_context_parts else formatted_context_text
        context_docs_map = temp_map

    except Exception as e:
        logger.error(f"Error during RAG search process for query '{query[:50]}...': {e}", exc_info=True)
        context_docs = []
        formatted_context_text = "Error retrieving context due to an internal server error."
        context_docs_map = {}

    return context_docs, formatted_context_text, context_docs_map

# --- Chat Processing with History and RAG ---

def format_chat_history_for_prompt(messages: list[dict]) -> str:
    """
    Formats a list of historical messages into a string suitable for the LLM prompt.
    Expects messages from database.get_messages_by_session format.
    """
    formatted_history = []
    if not messages:
        return "No previous conversation."

    for msg in messages:
        sender = msg.get('sender', 'unknown')
        text = msg.get('message_text', '')
        if sender == 'user':
            formatted_history.append(f"Human: {text}")
        elif sender == 'bot':
            formatted_history.append(f"AI: {text}")

    history_string = "\n".join(formatted_history)
    return history_string

async def process_chat_query_with_rag_and_history(
    user_id: str,
    thread_id: str, # Changed from session_id to thread_id
    query: str,
    model_context: Optional[ModelContextProtocol] = None,
    agentic_context: Optional[AgenticContextProtocol] = None,
    document_filter: Optional[str] = None,
    async_callback: Optional[Callable[[str], None]] = None
) -> tuple[str, str, list[dict], str | None]: # Changed return type for thinking_content

    """
    Orchestrates the chat process: loads history/summary, performs RAG,
    formats the prompt, calls the LLM, saves message and updated summary.
    Ensures assistant responses are short and concise by default,
    but capable of deeper Chain of Thought (CoT) reasoning when the prompt requires it.
    Collects data for fine-tuning.
    """
    global llm, _last_used_ollama_url_index

    if not llm:
        error_msg = "AI model is not initialized. Cannot process chat query."
        logger.error(error_msg)
        return error_msg, thread_id, [], "AI components not ready."

    # Determine if CoT is required based on the query
    # Keywords indicating CoT: "step-by-step", "explain your reasoning", "detailed explanation", "walk me through"
    # This can be made more sophisticated with a small classification model if needed.
    requires_cot = any(keyword in query.lower() for keyword in [
        "step-by-step", "explain your reasoning", "detailed explanation", "walk me through", "how does this work"
    ])
    
    # Save user message at the beginning of processing
    # For the user message, raw_prompt is the query itself, raw_response is None, is_cot is False
    database.save_message(user_id, thread_id, 'user', query, raw_prompt=query, raw_response=None, is_cot=False)
    logger.info(f"Processing chat query for user '{user_id}', thread '{thread_id}' (CoT required: {requires_cot}).")
    logger.info(f"[AI-THINKING] Starting chat processing for user '{user_id}', thread '{thread_id}'.")
    if async_callback:
        await async_callback("Starting AI processing...")
    if model_context:
        logger.debug(f"[AI-THINKING] Model Context Received: Mode={model_context.current_mode}, Tools={model_context.available_tools}")
    if agentic_context:
        logger.debug(f"[AI-THINKING] Agentic Context Received: Role={agentic_context.agent_role}, Objectives={agentic_context.agent_objectives}")

    # Load message history for the specific thread
    raw_message_history = database.get_messages_by_thread(user_id, thread_id) # Changed to get_messages_by_thread
    if raw_message_history is None:
        logger.error(f"[AI-THINKING] Failed to load message history for thread {thread_id}.")
        raw_message_history = []

    langchain_messages = []
    for msg in raw_message_history:
        if msg.get('sender') == 'user':
            langchain_messages.append(HumanMessage(content=msg.get('message_text', '')))
        elif msg.get('sender') == 'bot':
            langchain_messages.append(AIMessage(content=msg.get('message_text', '')))

    # Initialize ConversationSummaryBufferMemory for the specific thread
    # The summary is loaded from the database at the start of the thread's interaction
    # and saved back after each interaction.
    thread_summary = database.get_thread_summary(user_id, thread_id) # Get existing summary
    if thread_summary:
        # Prepend the summary to the chat history for the memory buffer
        langchain_messages.insert(0, AIMessage(content=f"Current conversation summary: {thread_summary}"))
        logger.debug(f"Loaded existing thread summary for thread {thread_id}: {thread_summary[:100]}...")

    memory = ConversationSummaryBufferMemory(
        llm=llm,
        max_token_limit=SUMMARY_BUFFER_TOKEN_LIMIT,
        chat_memory=InMemoryChatMessageHistory(messages=langchain_messages),
        return_messages=False, # We want the string format for the prompt
        memory_key="chat_history",
        output_key="answer"
    )

    chat_history_for_prompt = memory.load_memory_variables({})['chat_history']
    logger.debug(f"[AI-THINKING] Memory buffer/history string for prompt (length: {len(chat_history_for_prompt)}):\n{chat_history_for_prompt[:200]}...")
    if async_callback:
        await async_callback("Searching relevant documents...")
    logger.info(f"[AI-THINKING] Searching relevant documents for query: '{query[:50]}...'")

    _, context_text, context_docs_map = perform_rag_search(query, user_id_for_filter=user_id, document_filter=document_filter)
    logger.debug(f"[AI-THINKING] RAG search returned {len(context_docs_map)} potential references for user '{user_id}'.")
    
    # If a document filter was specified but no context was found, inform the user.
    if document_filter and not context_docs_map:
        response_message = f"The document '{document_filter}' does not contain enough information to answer your question."
        # Save bot message with raw data
        database.save_message(user_id, thread_id, 'bot', response_message, raw_prompt=query, raw_response=response_message, is_cot=False)
        await memory.asave_context({'input': query}, {'answer': response_message})
        new_summary = memory.load_memory_variables({})['chat_history']
        database.save_thread_summary(user_id, thread_id, new_summary)
        logger.info(f"[AI-THINKING] No RAG context found in {document_filter}. Informing user.")
        return response_message, thread_id, [], f"No RAG context found in {document_filter}."
    
    # If no document filter was specified AND no context was found, ask the user to specify a document.
    elif not document_filter and not context_docs_map:
        logger.info(f"[AI-THINKING] No document specified and no RAG context found. Falling back to general Ollama response.")
        response_message = await get_general_response_from_ollama(query, chat_history_for_prompt, async_callback)
        # Save bot message with raw data
        database.save_message(user_id, thread_id, 'bot', response_message, raw_prompt=query, raw_response=response_message, is_cot=False)
        await memory.asave_context({'input': query}, {'answer': response_message})
        new_summary = memory.load_memory_variables({})['chat_history']
        database.save_thread_summary(user_id, thread_id, new_summary)
        return response_message, thread_id, [], "No document specified, falling back to general LLM."
    
    # If context_docs_map is NOT empty (meaning relevant documents were found, either with or without a filter)
    else:
        try:
            if async_callback:
                await async_callback("Synthesizing answer with retrieved context...")
            logger.info("[AI-THINKING] Synthesizing answer with retrieved context.")

            # Construct the prompt based on whether CoT is required
            if requires_cot:
                # For CoT, we want the LLM to explicitly think step-by-step
                synthesis_template_cot = ChatPromptTemplate.from_messages([
                    ("system", """You are a Faculty for engineering students with in-depth knowledge across all engineering subjects, supporting an academic audience from undergraduates to PhD scholars.
Your main goal is to answer the user's query based on the provided context chunks. If the context is empty or unrelated, or does not contain enough information to answer the query, you MUST state: "I could not find this information in the uploaded document." Do NOT use general knowledge.

**CONVERSATION HISTORY:**
{chat_history}

**MODEL CONTEXT:**
{model_context_protocol}

**AGENTIC CONTEXT:**
{agentic_context_protocol}

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---

**INSTRUCTIONS:**
**STEP 1: THINKING PROCESS (MANDATORY):**
<thinking>
The user query is about "{query}". This query requires a detailed, step-by-step explanation. I will first analyze the provided context for relevant information. If the context is empty or unrelated, I will explicitly state that the information is not found in the document. If relevant context is found, I will use it to formulate a comprehensive, academic response, ensuring to cite sources.
</thinking>

**STEP 2: FINAL ANSWER:**
*   Provide a **highly comprehensive, extensively detailed, and exceptionally helpful** answer to the user query.
*   **CRITICAL: Prioritize Context & Extract ALL Relevant Details:** Base your answer **EXCLUSIVELY and primarily** on information within the `PROVIDED CONTEXT`. When relevant context is available, **extract and elaborate on EVERY SINGLE RELEVANT DETAIL, CONCEPT, AND EXPLANATION** found within those chunks. Do NOT omit any pertinent information. Your goal is to re-explain the relevant parts of the PDF as comprehensively as possible, as if you are teaching it word-for-word from the provided text. Do NOT be brief or concise when context is provided. Expand on every relevant point.
*   **Cite Sources:** When using information *directly* from a context chunk, **you MUST cite** its number like [1], [2], [1][3]. Cite all relevant sources for each piece of information derived from the context.
*   **If Answer Not in PDF:** If the answer to the query is **not present** in the `PROVIDED CONTEXT`, you **MUST** state: "I could not find this information in the uploaded document." Do not guess or use external knowledge in this scenario.
*   **Be a Tutor:** Explain concepts clearly and deeply. Be helpful, accurate, and conversational. Use extensive Markdown formatting (headings, nested lists, bolding, code blocks, tables if applicable) for maximum readability and structure.
*   **Accuracy:** Do not invent information not present in the context. If unsure, state that.
*   Be academic, organized, and use markdown formatting (headings, bullet points, equations if needed).
"""),
                    ("human", "{query}")
                ])
                final_prompt = synthesis_template_cot.format_messages(
                    query=query,
                    context=context_text,
                    chat_history=chat_history_for_prompt,
                    model_context_protocol=model_context,
                    agentic_context_protocol=agentic_context
                )
            else:
                # For concise responses, use a simpler prompt without explicit thinking instructions
                synthesis_template_concise = ChatPromptTemplate.from_messages([
                    ("system", """You are a concise and helpful AI tutor in engineering. Answer the user's query directly and briefly based on the provided context. If the context is insufficient or unrelated, you MUST state: "I could not find this information in the uploaded document." Do NOT use general knowledge. Do not include any thinking process.

**CONVERSATION HISTORY:**
{chat_history}

**MODEL CONTEXT:**
{model_context_protocol}

**AGENTIC CONTEXT:**
{agentic_context_protocol}

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---

**INSTRUCTIONS:**
*   Answer the user's query concisely.
*   Prioritize information from the `PROVIDED CONTEXT` and cite sources [1], [2], etc.
*   **If Answer Not in PDF:** If the answer to the query is **not present** in the `PROVIDED CONTEXT`, you **MUST** state: "I could not find this information in the uploaded document." Do not guess or use external knowledge in this scenario.
*   Do NOT include any "thinking process" or `<thinking>` tags.
*   Be direct and to the point.
"""),
                    ("human", "{query}")
                ])
                final_prompt = synthesis_template_concise.format_messages(
                    query=query,
                    context=context_text,
                    chat_history=chat_history_for_prompt,
                    model_context_protocol=model_context,
                    agentic_context_protocol=agentic_context
                )

            logger.info(f"[AI-THINKING] Sending synthesis prompt to LLM (model: {OLLAMA_MODEL}, CoT: {requires_cot})...")
            logger.debug(f"[AI-THINKING] Synthesis Prompt (Start):\n{final_prompt[0].content[:500]}...") # Access content of system message
            if len(final_prompt) > 1:
                logger.debug(f"[AI-THINKING] Human Prompt (Start):\n{final_prompt[1].content[:500]}...")

        except KeyError as e:
            logger.error(f"[AI-THINKING] Error formatting SYNTHESIS_PROMPT_TEMPLATE: Missing key {e}. Check config.py.")
            bot_answer = f"Error: Internal prompt configuration issue ({e})."
            # Save bot message with raw data
            database.save_message(user_id, thread_id, 'bot', bot_answer, raw_prompt=query, raw_response=bot_answer, is_cot=requires_cot)
            return bot_answer, thread_id, [], "Prompt formatting failed."
        except Exception as e:
            logger.error(f"[AI-THINKING] Error creating synthesis prompt: {e}", exc_info=True)
            bot_answer = f"Error: Could not prepare the request for the AI model ({type(e).__name__})."
            # Save bot message with raw data
            database.save_message(user_id, thread_id, 'bot', bot_answer, raw_prompt=query, raw_response=bot_answer, is_cot=requires_cot)
            return bot_answer, thread_id, [], "Prompt creation failed."

    try:
        current_ollama_base_url = get_next_ollama_base_url()
        if not current_ollama_base_url:
            error_msg = "No active Ollama base URLs available for LLM invocation."
            logger.error(f"[AI-THINKING] {error_msg}")
            # Save bot message with raw data
            database.save_message(user_id, thread_id, 'bot', error_msg, raw_prompt=query, raw_response=error_msg, is_cot=requires_cot)
            return error_msg, thread_id, [], "No active Ollama URLs."

        temp_llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
        )
        if async_callback:
            await async_callback("Invoking LLM...")
        logger.info(f"[AI-THINKING] Invoking LLM for synthesis using {current_ollama_base_url}...")
        
        # Invoke the LLM with the constructed prompt (which is now a list of messages)
        response_object = await temp_llm.ainvoke(final_prompt)
        full_llm_response = getattr(response_object, 'content', str(response_object))

        logger.info(f"[AI-THINKING] LLM synthesis response received (length: {len(full_llm_response)}).")
        logger.debug(f"[AI-THINKING] Synthesis Raw Response (Start):\n{full_llm_response[:500]}...")

        if async_callback:
            await async_callback("Parsing LLM response...")
        logger.info("[AI-THINKING] Parsing LLM response and extracting thinking content.")
        
        # Parse the LLM response to separate the final answer from thinking content
        bot_answer, thinking_content_list = parse_llm_response(full_llm_response)
        thinking_content = "\n".join(thinking_content_list) if thinking_content_list else None

        if not bot_answer and thinking_content:
             logger.warning("[AI-THINKING] Parsed user answer is empty after removing thinking block. The response might have only contained thinking.")
             bot_answer = "[AI response was empty. See reasoning process.]"
        elif not bot_answer and not thinking_content:
             logger.error("[AI-THINKING] LLM response parsing resulted in empty answer and no thinking content.")
             bot_answer = "[AI Response Processing Error: Empty result after parsing]"

        if bot_answer.strip().lower().startswith("error:") or "sorry, i encountered an error" in bot_answer.lower():
            logger.warning(f"[AI-THINKING] LLM synthesis seems to have resulted in an error message: '{bot_answer[:100]}...'")

        references = extract_references(bot_answer, context_docs_map)
        try:
            logger.info("[AI-THINKING] Saving chat messages and updating thread summary.")
            # Add the user's current query and the bot's answer to the memory buffer
            await memory.asave_context(
                {'input': query},
                {'answer': bot_answer}
            )
            
            # The ConversationSummaryBufferMemory stores its actual summary in moving_summary_buffer
            # This is the part that should be persisted for the next interaction's summary.
            new_summary_content = memory.moving_summary_buffer
            logger.debug(f"[AI-THINKING] New summary content from memory (length: {len(new_summary_content)}):\n{new_summary_content[:200]}...")

            # Save bot message with raw prompt, raw response, and CoT flag
            database.save_message(
                user_id, thread_id, 'bot', bot_answer,
                references=references,
                cot_reasoning=thinking_content,
                raw_prompt=query, # The original user query
                raw_response=full_llm_response, # The full raw response from LLM
                is_cot=requires_cot # Whether CoT was explicitly requested/used
            )
            # Save the updated thread summary (the actual summary, not the full buffer)
            database.save_thread_summary(user_id, thread_id, new_summary_content)

        except Exception as db_save_error:
            logger.error(f"[AI-THINKING] Failed to save chat messages or updated summary for user '{user_id}', thread '{thread_id}': {db_save_error}", exc_info=True)
            bot_answer += "\n\n_[Note: Failed to save chat history or update summary. See backend logs.]_"

        logger.info(f"[AI-THINKING] Chat processing complete for user '{user_id}', thread '{thread_id}'. Answer generated, history/summary saved.")
        if async_callback:
            await async_callback("Done.")
        return bot_answer.strip(), thread_id, references, thinking_content
    except Exception as e:
        logger.error(f"[AI-THINKING] LLM chat synthesis or processing failed for user '{user_id}', thread '{thread_id}': {e}", exc_info=True)
        error_message = f"Sorry, I encountered an error while processing your request ({type(e).__name__}). The AI model might be unavailable, timed out, or failed internally."
        # Save the error message as a bot response, including raw data for debugging/fine-tuning
        database.save_message(
            user_id, thread_id, 'bot', error_message,
            references=None,
            cot_reasoning=f"Error in ai_core processing: {type(e).__name__}: {str(e)}",
            raw_prompt=query,
            raw_response=error_message, # The error message itself as the raw response
            is_cot=requires_cot
        )
        return error_message, thread_id, [], f"Error: {type(e).__name__}"


# --- Analysis Functions ---

# This function is not directly used in the main chat flow, but it's good practice to update it
# to reflect the new prompt template structure if it were to be used with ChatPromptTemplate.
# For now, I'll leave it as is, assuming SYNTHESIS_PROMPT_TEMPLATE is still a PromptTemplate.
# If it were to be used with ChatPromptTemplate, it would need to be updated similar to process_chat_query_with_rag_and_history.
def synthesize_chat_response(query: str, context_text: str, chat_history: str) -> tuple[str, list[str] | None]:
     """
     Generates the final chat response using the LLM, query, context, and chat history.
     This function now formats the prompt and calls the LLM. Parsing is done externally.

     Returns:
         tuple[str, list[str] | None]: (full_llm_response, list_of_thinking_steps_or_None)
     """
     global llm, _last_used_ollama_url_index
     if not llm:
         logger.error("LLM not initialized, cannot synthesize response.")
         return "Error: The AI model is currently unavailable.", None

     # The SYNTHESIS_PROMPT_TEMPLATE is now a PromptTemplate, not a ChatPromptTemplate.
     # The input variables check should reflect this.
     # This function is a remnant and might be removed or refactored if not used.
     if set(SYNTHESIS_PROMPT_TEMPLATE.input_variables) != {"query", "context", "chat_history", "model_context_protocol", "agentic_context_protocol"}:
          error_msg = f"SYNTHESIS_PROMPT_TEMPLATE has incorrect input variables: {SYNTHESIS_PROMPT_TEMPLATE.input_variables}. Expected {{'query', 'context', 'chat_history', 'model_context_protocol', 'agentic_context_protocol'}}."
          logger.error(error_msg)
          return None, [error_msg]

     try:
         # Assuming SYNTHESIS_PROMPT_TEMPLATE is still a PromptTemplate as per config.py
         # This function might be deprecated or refactored later if its usage changes.
         final_prompt = SYNTHESIS_PROMPT_TEMPLATE.format(
             query=query,
             context=context_text,
             chat_history=chat_history,
             model_context_protocol=ModelContextProtocol(), # Placeholder, as this function doesn't receive it
             agentic_context_protocol=AgenticContextProtocol() # Placeholder
         )
         logger.info(f"Sending synthesis prompt to LLM (model: {OLLAMA_MODEL})...")
         logger.debug(f"Synthesis Prompt (Start):\n{final_prompt[:500]}...")

     except KeyError as e:
         error_msg = f"Error formatting SYNTHESIS_PROMPT_TEMPLATE: Missing key {e}. Check config.py."
         logger.error(error_msg)
         return None, [error_msg]
     except Exception as e:
          error_msg = f"Error creating synthesis prompt: {e}"
          logger.error(error_msg, exc_info=True)
          return None, [error_msg]

     try:
        current_ollama_base_url = get_next_ollama_base_url()
        if not current_ollama_base_url:
            error_msg = "No active Ollama base URLs available for LLM invocation."
            logger.error(error_msg)
            return None, [error_msg]

        # Re-initialize LLM with the selected base_url for this specific request
        temp_llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
        )
        response_object = temp_llm.invoke(final_prompt)
        full_llm_response = getattr(response_object, 'content', str(response_object))
        logger.debug(f"Raw LLM response generated successfully for synthesis.")
        return full_llm_response, None

     except Exception as e:
         error_message = f"LLM chat synthesis failed: {e}"
         logger.error(error_message, exc_info=True)
         return None, [error_message]


async def generate_document_analysis(filename: str, analysis_type: str, user_id: str, async_callback: Optional[Callable[[str], None]] = None) -> tuple[str | None, list[str] | None, str | None]:
    """
    Generates analysis (FAQ, Topics, Mindmap) for a specific user's document, optionally including thinking.
    Uses ANALYSIS_PROMPTS from config. Retrieves text from cache or disk.
    For 'mindmap' type, if Nougat is available and successful, it uses MMD content. Otherwise, plain text.

    Args:
        filename (str): The (secured) filename of the document.
        analysis_type (str): The type of analysis to perform (e.g., "faq", "topics", "mindmap").
        user_id (str): The ID of the user who owns the document.

    Returns:
        tuple[str | None, list[str] | None, str | None]: (analysis_content, thinking_content_list, latex_source_for_mindmap)
                                    Returns (error_message, thinking_content_list, None) on failure.
                                    Returns (None, None, None) if document text cannot be found/loaded.
    """
    global llm, _last_used_ollama_url_index # Add _last_used_ollama_url_index to global
    logger.info(f"Starting analysis for user '{user_id}': type='{analysis_type}', file='{filename}'")
    latex_source_for_mindmap = None # Initialize

    if not llm:
        logger.error("LLM not initialized, cannot perform analysis.")
        return "Error: AI model is not available for analysis.", None, None

    doc_text_for_llm = None
    if analysis_type == "mindmap":
        user_specific_upload_folder = os.path.join(UPLOAD_FOLDER, user_id)
        pdf_path = os.path.join(user_specific_upload_folder, filename)
        if not os.path.exists(pdf_path):
            logger.error(f"Mindmap analysis failed: PDF file '{filename}' not found at {pdf_path} for user '{user_id}'.")
            return f"Error: PDF file '{filename}' not found.", None, None
        
        if async_callback:
            await async_callback(f"Preparing document for {analysis_type} analysis...")
        
        logger.info(f"Mindmap analysis requested for '{filename}'. Attempting Nougat PDF to MMD conversion.")
        mmd_content = await convert_pdf_to_latex(pdf_path, async_callback) # This function returns MMD or fallback text

        if mmd_content and not mmd_content.startswith("[Nougat Error:") and not mmd_content.startswith("# Fallback"):
            logger.info(f"Successfully used Nougat MMD output for mindmap analysis of '{filename}'.")
            doc_text_for_llm = mmd_content
            latex_source_for_mindmap = mmd_content # Store the MMD (original source for mindmap)
        elif mmd_content and (mmd_content.startswith("[Nougat Error:") or mmd_content.startswith("# Fallback")):
            logger.warning(f"Nougat failed or used fallback for '{filename}'. Mindmap will use extracted plain text. Nougat output: {mmd_content[:100]}...")
            # Fallback to plain text extraction
            plain_text_content = get_document_text_from_cache_or_load(user_id, filename)
            if plain_text_content:
                doc_text_for_llm = plain_text_content
                latex_source_for_mindmap = f"# Plain Text Fallback for {filename}\n\n{plain_text_content[:500]}..." # Indicate fallback
            else:
                logger.error(f"Mindmap analysis failed: Nougat failed and plain text extraction also failed for '{filename}'.")
                return f"Error: Could not process '{filename}' for mindmap (Nougat and text extraction failed).", None, None
        else: # MMD content is None or empty string from convert_pdf_to_latex
             logger.error(f"Mindmap analysis failed: convert_pdf_to_latex returned None or empty for '{filename}'. Attempting plain text extraction.")
             plain_text_content = get_document_text_from_cache_or_load(user_id, filename)
             if plain_text_content:
                 doc_text_for_llm = plain_text_content
                 latex_source_for_mindmap = f"# Plain Text Fallback for {filename}\n\n{plain_text_content[:500]}..."
             else:
                logger.error(f"Mindmap analysis failed: Nougat and plain text extraction failed for '{filename}'.")
                return f"Error: Could not process '{filename}' for mindmap.", None, None
    else: # For FAQ, Topics, or other analyses
        doc_text_for_llm = get_document_text_from_cache_or_load(user_id, filename)

    if not doc_text_for_llm or not doc_text_for_llm.strip():
        logger.error(f"Analysis failed: doc_text_for_llm is empty for '{filename}' (user: {user_id}, type: {analysis_type}).")
        return f"Error: Failed to retrieve or process text content for '{filename}'.", None, latex_source_for_mindmap


    original_length = len(doc_text_for_llm)
    if original_length > ANALYSIS_MAX_CONTEXT_LENGTH:
        logger.warning(f"Document '{filename}' (user: {user_id}) text too long ({original_length} chars), truncating to {ANALYSIS_MAX_CONTEXT_LENGTH} for '{analysis_type}' analysis.")
        doc_text_for_llm = doc_text_for_llm[:ANALYSIS_MAX_CONTEXT_LENGTH]
        doc_text_for_llm += "\n\n... [CONTENT TRUNCATED DUE TO LENGTH LIMIT]"
    else:
        logger.debug(f"Using full document text ({original_length} chars) for analysis '{analysis_type}' (user: {user_id}).")

    prompt_template = ANALYSIS_PROMPTS.get(analysis_type)
    if not prompt_template or not isinstance(prompt_template, PromptTemplate):
        logger.error(f"Invalid or missing analysis prompt template for type: {analysis_type} in config.py")
        return f"Error: Invalid analysis type '{analysis_type}' or misconfigured prompt.", None, latex_source_for_mindmap

    if set(prompt_template.input_variables) != {"doc_text_for_llm"}:
         error_msg = f"ANALYSIS_PROMPTS['{analysis_type}'] has incorrect input variables: {prompt_template.input_variables}. Expected {{'doc_text_for_llm'}}."
         logger.error(error_msg)
         return error_msg, [error_msg], latex_source_for_mindmap

    try:
        final_prompt = prompt_template.format(doc_text_for_llm=doc_text_for_llm)
        logger.info(f"Sending analysis prompt to LLM (type: {analysis_type}, file: {filename}, user: {user_id}, model: {OLLAMA_MODEL})...")
        logger.debug(f"Analysis Prompt (Start):\n{final_prompt[:500]}...")
        if async_callback:
            await async_callback(f"Invoking LLM for {analysis_type}...")

    except KeyError as e:
        error_msg = f"Error formatting ANALYSIS_PROMPTS[{analysis_type}]: Missing key {e}. Check config.py."
        logger.error(error_msg)
        return error_msg, [error_msg], latex_source_for_mindmap
    except Exception as e:
        error_msg = f"Error creating analysis prompt for {analysis_type}: {e}"
        logger.error(error_msg, exc_info=True)
        return error_msg, None, latex_source_for_mindmap

    try:
        # Use the load balancer for the actual LLM invocation
        current_ollama_base_url = get_next_ollama_base_url()
        if not current_ollama_base_url:
            error_msg = "No active Ollama base URLs available for LLM invocation."
            logger.error(error_msg)
            return error_msg, [error_msg], latex_source_for_mindmap

        # Re-initialize LLM with the selected base_url for this specific request
        temp_llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
        )
        response_object = temp_llm.invoke(final_prompt)
        full_analysis_response = getattr(response_object, 'content', str(response_object))
        logger.info(f"LLM analysis response received for '{filename}' ({analysis_type}, user: {user_id}). Length: {len(full_analysis_response)}")
        logger.debug(f"Analysis Raw Response (Start):\n{full_analysis_response[:500]}...")

        if async_callback:
            await async_callback(f"Parsing {analysis_type} response...")
        analysis_content, thinking_content_list = parse_llm_response(full_analysis_response)
        # thinking_content is now a list of strings or None
        thinking_content = "\n".join(thinking_content_list) if thinking_content_list else None

        if thinking_content:
            logger.info(f"Parsed thinking content from analysis response for '{filename}' (user: {user_id}).")

        if not analysis_content and thinking_content:
            logger.warning(f"Parsed analysis content is empty for '{filename}' ({analysis_type}, user: {user_id}). Response only contained thinking.")
            analysis_content = "[Analysis consisted only of reasoning. No final output provided. See thinking process.]"
        elif not analysis_content and not thinking_content:
            logger.error(f"LLM analysis response parsing resulted in empty content and no thinking for '{filename}' ({analysis_type}, user: {user_id}).")
            analysis_content = "[Analysis generation resulted in empty content after parsing.]"

        logger.info(f"Analysis successful for '{filename}' ({analysis_type}, user: {user_id}).")
        if async_callback:
            await async_callback("Analysis complete.")
        return analysis_content.strip(), thinking_content_list, latex_source_for_mindmap

    except Exception as e:
        logger.error(f"LLM analysis invocation error for {filename} ({analysis_type}, user: {user_id}): {e}", exc_info=True)
        return f"Error generating analysis: AI model failed ({type(e).__name__}). Check logs for details.", [f"Error: {type(e).__name__}"], latex_source_for_mindmap



async def convert_pdf_to_latex(pdf_path: str, async_callback: Optional[Callable[[str], None]] = None) -> str | None:
    """
    Converts PDF to MMD (Markdown with LaTeX) using Nougat.
    Falls back to plain text extraction if Nougat fails or is unavailable.
    """
    global nougat_model_instance

    if not NOUGAT_AVAILABLE:
        logger.warning(f"Nougat library not available. Falling back to plain text for {pdf_path}.")
        text_content = extract_text_from_pdf(pdf_path)
        if text_content:
            return f"# Fallback (Nougat Library Missing): Plain Text from {os.path.basename(pdf_path)}\n\n{text_content}"
        logger.error(f"Fallback failed: Could not extract text from {pdf_path} when Nougat library was missing.")
        return f"[Nougat Error: Library not available and fallback text extraction failed for '{os.path.basename(pdf_path)}']"

    if nougat_model_instance is None:
        logger.warning(f"Nougat model not initialized. Falling back to plain text for {pdf_path}.")
        text_content = extract_text_from_pdf(pdf_path)
        if text_content:
            return f"# Fallback (Nougat Model Uninitialized): Plain Text from {os.path.basename(pdf_path)}\n\n{text_content}"
        logger.error(f"Fallback failed: Could not extract text from {pdf_path} when Nougat model was uninitialized.")
        return f"[Nougat Error: Model not initialized and fallback text extraction failed for '{os.path.basename(pdf_path)}']"

    logger.info(f"Processing PDF with Nougat: {pdf_path}")

    try:
        model_config_input_size = getattr(nougat_model_instance.config, 'input_size', 'N/A')
        logger.debug(f"Nougat model config.input_size from model: {model_config_input_size}") # Often (3, 896, 672)

        # For nougat-small, the typical target dimensions for the *preprocessed image tensor*
        # (before patch embedding) are H=896, W=672.
        pipeline_target_height = 896
        pipeline_target_width = 672

        logger.debug(f"Nougat: Pipeline target image size for preprocessing: height={pipeline_target_height}, width={pipeline_target_width}")

        custom_alb_pipeline = alb.Compose([
            alb.LongestMaxSize(max_size=max(pipeline_target_height, pipeline_target_width)),
            alb.PadIfNeeded(
                min_height=pipeline_target_height,
                min_width=pipeline_target_width,
                border_mode=0, # cv2.BORDER_CONSTANT
                value=[255, 255, 255] # Pad with white
            ),
            alb.Normalize(mean=IMAGENET_DEFAULT_MEAN, std=IMAGENET_DEFAULT_STD),
            ToTensorV2(),
        ])

        def nougat_prepare_function(pil_image: Image.Image):
            try:
                if not isinstance(pil_image, Image.Image):
                    logger.error(f"Nougat prepare: Expected PIL Image, got {type(pil_image)}. Returning None.")
                    return None # Will be handled by ignore_none_collate
                numpy_image = np.array(pil_image.convert("RGB"))
                # Ensure uint8
                if numpy_image.dtype != np.uint8:
                    if numpy_image.max() <= 1.0 and numpy_image.min() >=0.0 : # Check if float image in [0,1]
                        numpy_image = (numpy_image * 255).astype(np.uint8)
                    else: # Other types, just cast
                        numpy_image = numpy_image.astype(np.uint8)

                # Ensure 3 channels if grayscale
                if numpy_image.ndim == 2: numpy_image = np.stack((numpy_image,)*3, axis=-1)
                elif numpy_image.ndim == 3 and numpy_image.shape[2] == 1: numpy_image = np.concatenate([numpy_image]*3, axis=2)

                transformed_dict = custom_alb_pipeline(image=numpy_image)
                img_tensor = transformed_dict.get('image')
                if img_tensor is not None:
                    logger.debug(f"Nougat prepare: Output tensor shape after Albumentations: {img_tensor.shape}") # Should be C, H, W
                else:
                    logger.warning("Nougat prepare: Albumentations pipeline did not return an 'image' tensor.")
                return transformed_dict
            except Exception as e_prepare_inner:
                logger.error(f"CRITICAL ERROR in nougat_prepare_function: {e_prepare_inner}", exc_info=True)
                return None # Return None on error, to be handled by collate_fn

        dataset = LazyDataset(pdf=pdf_path, prepare=nougat_prepare_function)

        if not dataset or len(dataset) == 0:
            logger.error(f"Nougat: Failed to create LazyDataset or PDF is empty/unreadable: {pdf_path}.")
            # Fallback if dataset creation fails (e.g., PDF invalid for PyMuPDF used by LazyDataset)
            text_content = extract_text_from_pdf(pdf_path)
            if text_content:
                return f"# Fallback (Nougat Dataset Error): Plain Text from {os.path.basename(pdf_path)}\n\n{text_content}"
            return f"[Nougat Error: Failed to load PDF pages from {os.path.basename(pdf_path)} and fallback failed]"


        # Default batch size for nougat inference is 1
        # If using a larger model or GPU, this could be tuned, but 1 is safe.
        processing_batch_size = getattr(nougat_model_instance.config, "batch_size", 1) # Use model's config if available, else 1
        logger.info(f"Nougat: Using processing batch size: {processing_batch_size}")


        dataloader = torch.utils.data.DataLoader(
            dataset, batch_size=processing_batch_size, shuffle=False,
            collate_fn=LazyDataset.ignore_none_collate # Handles None from prepare_fn
        )

        all_predictions = []
        logger.info(f"Nougat: Starting inference for {len(dataset)} pages from '{os.path.basename(pdf_path)}'...")

        page_counter = 0
        total_pages = len(dataset)
        for i, batch_data_tuple in enumerate(dataloader):
            if async_callback:
                await async_callback(f"Processing page {page_counter + 1} of {total_pages} with Nougat...")
            if batch_data_tuple is None: # If ignore_none_collate returns None (all items in batch were None)
                logger.warning(f"Nougat: DataLoader batch {i+1}/{len(dataloader)} is None (all pages in batch failed preparation). Skipping.")
                continue
            # Unpack the tuple: (pixel_values_dict, is_last_page_flags)
            collated_image_data_dict, _ = batch_data_tuple # Second item is_last_page is not directly used here

            if not isinstance(collated_image_data_dict, dict) or 'image' not in collated_image_data_dict:
                logger.warning(f"Nougat: Batch {i+1} - invalid collated_image_data_dict format or missing 'image' key. Skipping. Data: {collated_image_data_dict}")
                continue
            image_tensors_for_model = collated_image_data_dict.get('image')

            if image_tensors_for_model is None or image_tensors_for_model.nelement() == 0:
                logger.warning(f"Nougat: Batch {i+1} - image tensor is None or empty after collation. Skipping.")
                continue

            logger.debug(f"Nougat: Batch {i+1}/{len(dataloader)} - Tensor shape for model: {image_tensors_for_model.shape}") # Expected: B, C, H, W
            if image_tensors_for_model.shape[2] != pipeline_target_height or image_tensors_for_model.shape[3] != pipeline_target_width:
                 logger.error(f"CRITICAL NOUGAT SHAPE MISMATCH: Tensor shape {image_tensors_for_model.shape} does not match expected H={pipeline_target_height}, W={pipeline_target_width}. Skipping batch.")
                 continue # Skip this problematic batch

            image_tensors_for_model = image_tensors_for_model.to(nougat_model_instance.device)

            try:
                with torch.no_grad():
                    # Nougat's inference expects `image_tensors` as kwarg
                    model_output = nougat_model_instance.inference(image_tensors=image_tensors_for_model)
            except AssertionError as ae:
                logger.error(f"Nougat: AssertionError during model.inference for batch {i+1} (pages {page_counter+1}-{page_counter+image_tensors_for_model.size(0)}): {ae}", exc_info=True)
                logger.error(f"Tensor shape that caused assertion: {image_tensors_for_model.shape}, dtype: {image_tensors_for_model.dtype}, device: {image_tensors_for_model.device}")
                continue
            except Exception as inference_err:
                logger.error(f"Nougat: Error during model.inference for batch {i+1}: {inference_err}", exc_info=True)
                continue

            if "predictions" in model_output and model_output["predictions"]:
                all_predictions.extend(model_output["predictions"])
                current_batch_page_count = image_tensors_for_model.size(0)
                page_counter += current_batch_page_count
                logger.debug(f"Nougat: Processed batch {i+1}/{len(dataloader)} ({current_batch_page_count} pages), {page_counter} total pages processed so far.")
            else:
                logger.warning(f"Nougat: Batch {i+1} produced no predictions or 'predictions' key missing. Output: {str(model_output)[:200]}")

        if not all_predictions:
            logger.warning(f"Nougat processed '{pdf_path}' but returned no predictions overall. Falling back to plain text.")
            text_content = extract_text_from_pdf(pdf_path)
            if text_content:
                return f"# Fallback (Nougat No Predictions): Plain Text from {os.path.basename(pdf_path)}\n\n{text_content}"
            else:
                logger.error(f"Fallback failed: Could not extract text from {pdf_path} after Nougat had no predictions.")
                return f"[Nougat Error: No predictions and fallback text extraction failed for '{os.path.basename(pdf_path)}']"

        mmd_content = "".join(all_predictions).strip()

        if mmd_content:
            logger.info(f"Nougat successfully processed '{pdf_path}'. MMD length: {len(mmd_content)}")
            logger.debug(f"NOUGAT MMD OUTPUT for {os.path.basename(pdf_path)} (first 1000 chars):\n{mmd_content[:1000]}")
            return mmd_content
        else:
            logger.warning(f"Nougat processed '{pdf_path}' but MMD content is empty after joining. Falling back to plain text.")
            text_content = extract_text_from_pdf(pdf_path)
            if text_content:
                return f"# Fallback (Nougat Empty MMD): Plain Text from {os.path.basename(pdf_path)}\n\n{text_content}"
            else:
                logger.error(f"Fallback failed: Could not extract text from {pdf_path} after Nougat produced empty MMD.")
                return f"[Nougat Error: Empty MMD and fallback text extraction failed for '{os.path.basename(pdf_path)}']"

    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            logger.error(f"Nougat OOM processing {pdf_path}: {e}", exc_info=False) # No need for full stack trace for OOM
            return f"[Nougat Error: Out of memory processing PDF '{os.path.basename(pdf_path)}'. Try reducing batch size or using a smaller model.]"
        elif "Input image width" in str(e) and "doesn't match model" in str(e): # Catch specific Swin IR error
            logger.error(f"Nougat image dimension mismatch error for {pdf_path}: {e}", exc_info=True)
            return f"[Nougat Error: Image dimension mismatch for model processing '{os.path.basename(pdf_path)}'. Details: {str(e)}]"
        logger.error(f"Nougat runtime error processing {pdf_path}: {e}", exc_info=True)
        return f"[Nougat Error: Runtime error processing '{os.path.basename(pdf_path)}': {str(e)}]"
    except Exception as e:
        logger.error(f"Unexpected error during Nougat PDF processing for {pdf_path}: {e}", exc_info=True)
        return f"[Nougat Error: Unexpected error ({type(e).__name__}) processing '{os.path.basename(pdf_path)}']"
    
    
async def get_general_response_from_ollama(query: str, chat_history: str = "", async_callback: Optional[Callable[[str], None]] = None) -> str:
   """
   Fallback general response using Ollama if no relevant context is found.
   Uses the initialized global LLM instance.
   """
   global llm, _last_used_ollama_url_index # Add _last_used_ollama_url_index to global
   if not llm:
       logger.error("[AI-THINKING] LLM not initialized, cannot get general Ollama response.")
       return "Error: AI model is not available for general response."

   general_prompt = f"""
You are a highly skilled AI tutor in engineering. A student has asked the following question:

User Query: "{query}"

Chat History: {chat_history}

Please provide a technically detailed, structured, and academically sound explanation. Use clear formatting and accurate terminology.
"""
   try:
       # Use the load balancer for the actual LLM invocation
       current_ollama_base_url = get_next_ollama_base_url()
       if not current_ollama_base_url:
           error_msg = "No active Ollama base URLs available for general response."
           logger.error(f"[AI-THINKING] {error_msg}")
           return error_msg

       # Re-initialize LLM with the selected base_url for this specific request
       temp_llm = ChatOllama(
           model=OLLAMA_MODEL,
           base_url=current_ollama_base_url,
           client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT} if OLLAMA_REQUEST_TIMEOUT else {}
       )
       logger.info(f"[AI-THINKING] Getting general response from Ollama for query: '{query[:100]}...' using URL: {current_ollama_base_url}")
       if async_callback:
           await async_callback("Generating general response...")
       response_object = await temp_llm.ainvoke(general_prompt)
       full_llm_response = getattr(response_object, 'content', str(response_object))
       logger.debug(f"[AI-THINKING] General LLM response received (length: {len(full_llm_response)}).")
       if async_callback:
           await async_callback("General response complete.")
       return full_llm_response
   except Exception as e:
       logger.error(f"[AI-THINKING] Error getting general response from Ollama using URL {current_ollama_base_url}: {e}", exc_info=True)
       return f"Sorry, I encountered an error while generating a general response ({type(e).__name__})."

# --- Podcast Generation ---
def text_to_speech_gtts(text: str, output_filename: str, user_id: str, lang: str = 'en') -> str | None:
    """
    Converts text to speech using gTTS and saves it to a user-specific podcast folder.
    Returns the relative path part for serving the audio file (e.g., "user_id/podcast_filename.mp3").
    Note: gTTS requires an internet connection. For fully local TTS, consider libraries like Coqui TTS.
    """
    try:
        # Ensure user-specific podcast audio directory exists
        # PODCAST_AUDIO_FOLDER is the base, e.g., 'backend/podcast_audio_files'
        # user_podcast_folder will be 'backend/podcast_audio_files/user_id_xyz'
        user_podcast_folder = os.path.join(PODCAST_AUDIO_FOLDER, user_id)
        os.makedirs(user_podcast_folder, exist_ok=True)
        
        # output_path will be 'backend/podcast_audio_files/user_id_xyz/some_podcast.mp3'
        output_path = os.path.join(user_podcast_folder, output_filename)

        logger.info(f"Generating speech (gTTS) for text (length: {len(text)}) to {output_path}...")
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(output_path)
        logger.info(f"Speech generated successfully (gTTS): {output_path}")
        
        # Return a path part relative to PODCAST_AUDIO_FOLDER for serving,
        # e.g., "user_id_xyz/some_podcast.mp3"
        return os.path.join(user_id, output_filename)
    except Exception as e:
        logger.error(f"Error during gTTS text-to-speech conversion: {e}", exc_info=True)
        return None

async def generate_podcast_from_document(
    user_id: str,
    filename: str, # Secured filename
    async_callback: Optional[Callable[[str], None]] = None
) -> tuple[str | None, str | None, str | None]: # (script, audio_url_path_part, error_message)
    """
    Generates a podcast script and audio from a document.
    Returns:
        - script (str | None): The generated podcast script.
        - audio_url_path_part (str | None): The relative path part for the audio URL (e.g., "user_id/audio.mp3").
        - error_message (str | None): An error message if generation fails.
    """
    global llm
    logger.info(f"Starting podcast generation for user '{user_id}', file '{filename}'")

    if not llm:
        logger.error("LLM not initialized, cannot generate podcast script.")
        return None, None, "Error: AI model for script generation is not available."

    if async_callback: await async_callback("Retrieving document text...")
    doc_text = get_document_text_from_cache_or_load(user_id, filename)

    if not doc_text or not doc_text.strip() or doc_text.startswith("[Error: PDF is password protected"):
        err_msg = f"Error: Failed to retrieve text content for '{filename}'."
        if doc_text and doc_text.startswith("[Error: PDF is password protected"):
            err_msg = "Error: Cannot generate podcast from a password-protected PDF."
        logger.error(f"Podcast generation failed: {err_msg} (user: {user_id}).")
        return None, None, err_msg

    # Truncate if too long for the LLM, similar to analysis
    original_length = len(doc_text)
    max_podcast_context_length = ANALYSIS_MAX_CONTEXT_LENGTH # Reuse analysis length limit for now
    if original_length > max_podcast_context_length:
        logger.warning(f"Document '{filename}' text too long ({original_length} chars), truncating to {max_podcast_context_length} for podcast script generation.")
        doc_text_for_llm = doc_text[:max_podcast_context_length]
        doc_text_for_llm += "\n\n... [DOCUMENT CONTENT TRUNCATED FOR PODCAST SCRIPT]"
    else:
        doc_text_for_llm = doc_text
    
    if async_callback: await async_callback("Generating podcast script with LLM...")
    script_text = None
    try:
        if set(PODCAST_GENERATION_PROMPT_TEMPLATE.input_variables) != {"document_text"}:
            error_msg = f"PODCAST_GENERATION_PROMPT_TEMPLATE has incorrect input variables. Expected {{'document_text'}}."
            logger.error(error_msg)
            return None, None, error_msg

        podcast_prompt_str = PODCAST_GENERATION_PROMPT_TEMPLATE.format(document_text=doc_text_for_llm)
        
        current_ollama_base_url = get_next_ollama_base_url()
        if not current_ollama_base_url:
            return None, None, "Error: No active Ollama URLs available for LLM."

        temp_llm_instance = ChatOllama( # Use a temporary instance for this call
            model=OLLAMA_MODEL,
            base_url=current_ollama_base_url,
            client_kwargs={'timeout': OLLAMA_REQUEST_TIMEOUT * 2} # Potentially longer timeout for script generation
        )
        
        response_object = await temp_llm_instance.ainvoke(podcast_prompt_str)
        full_llm_response = getattr(response_object, 'content', str(response_object))

        parsed_script, thinking_content = parse_llm_response(full_llm_response)

        if not parsed_script or not parsed_script.strip():
            logger.error(f"LLM generated an empty script for '{filename}'. Thinking: {thinking_content}")
            return None, None, "Error: AI failed to generate a podcast script from the document."
        
        script_text = parsed_script # Assign to script_text
        logger.info(f"Podcast script generated for '{filename}'. Length: {len(script_text)}")
        if thinking_content:
            logger.debug(f"Podcast generation thinking: {thinking_content}")

    except Exception as e:
        logger.error(f"Error generating podcast script for '{filename}': {e}", exc_info=True)
        return None, None, f"Error during script generation: {type(e).__name__}."

    if not script_text: # Should be caught above, but as a safeguard
        return None, None, "Error: Script generation resulted in no content."

    if async_callback: await async_callback("Converting script to speech (this may take a moment)...")
    
    audio_file_name = f"podcast_{uuid.uuid4()}.mp3"
    audio_path_part = text_to_speech_gtts(script_text, audio_file_name, user_id)

    if not audio_path_part:
        logger.error(f"Failed to convert script to speech for '{filename}'.")
        # Return the script even if audio fails, so user can see it
        return script_text, None, "Error: Failed to generate audio for the podcast. Script is available."

    if async_callback: await async_callback("Podcast generation complete.")
    return script_text, audio_path_part, None