    # Notebook/backend/ai_core.py
import os
import sys
import logging
import fitz  # PyMuPDF
import re

try:
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    notebook_project_dir = os.path.dirname(current_script_dir)
    chatbot_main_project_dir = os.path.dirname(notebook_project_dir)
    path_to_rag_service_parent = os.path.join(chatbot_main_project_dir, 'Chatbot-geminiV3', 'server')
    if path_to_rag_service_parent not in sys.path:
        sys.path.insert(0, path_to_rag_service_parent)

    from rag_service import config as unified_config
    print(f"DEBUG: [ai_core.py] Successfully imported 'unified_config'.")
except ImportError as e:
    print(f"CRITICAL: [ai_core.py] Could not import 'unified_config'. Error: {e}")
    # Define essential fallbacks if import fails, so the rest of the module can load for inspection
    class FallbackConfig:
        OLLAMA_MODEL = "mistral:7b-instruct" # default
        ANALYSIS_MAX_CONTEXT_LENGTH = 30000
        # Add other critical configs this file might reference if unified_config fails
    unified_config = FallbackConfig()
    print("CRITICAL: [ai_core.py] Using fallback configurations.")


from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage

# --- Now define constants using unified_config ---
OLLAMA_BASE_URL = unified_config.OLLAMA_BASE_URL
OLLAMA_MODEL = unified_config.OLLAMA_MODEL # LLM for analysis in this app
OLLAMA_EMBED_MODEL = unified_config.EMBEDDING_MODEL_NAME # Shared embedding model name

# Paths for the OLD document loading methods (if you keep them)
# These now point to the unified locations defined in rag_service/config.py
DEFAULT_PDFS_FOLDER = unified_config.DEFAULT_PDFS_FOLDER 
UPLOAD_FOLDER = unified_config.UPLOAD_FOLDER 

ANALYSIS_MAX_CONTEXT_LENGTH = getattr(unified_config, 'ANALYSIS_MAX_CONTEXT_LENGTH', 30000)

# Prompts for this Notebook app's internal RAG/chat if it uses them directly
# ANALYSIS_PROMPTS is used by app.py to get the template string.
# SUB_QUERY_PROMPT_TEMPLATE / SYNTHESIS_PROMPT_TEMPLATE are used if this app has its own RAG chat.
SUB_QUERY_PROMPT_TEMPLATE_STR = getattr(unified_config, 'SUB_QUERY_PROMPT_TEMPLATE', "Default sub query prompt if needed")
SYNTHESIS_PROMPT_TEMPLATE_STR = getattr(unified_config, 'SYNTHESIS_PROMPT_TEMPLATE', "Default synthesis prompt if needed")

SUB_QUERY_PROMPT_TEMPLATE = PromptTemplate.from_template(SUB_QUERY_PROMPT_TEMPLATE_STR)
SYNTHESIS_PROMPT_TEMPLATE = PromptTemplate.from_template(SYNTHESIS_PROMPT_TEMPLATE_STR)
# FAISS_FOLDER definition - this app might have its own local FAISS for its own /chat RAG
FAISS_FOLDER = getattr(unified_config, 'NOTEBOOK_APP_FAISS_FOLDER', os.path.join(os.path.dirname(__file__), 'local_notebook_faiss_store'))

from config import (
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_EMBED_MODEL, FAISS_FOLDER,
    DEFAULT_PDFS_FOLDER, UPLOAD_FOLDER, RAG_CHUNK_K, MULTI_QUERY_COUNT,
    ANALYSIS_MAX_CONTEXT_LENGTH, OLLAMA_REQUEST_TIMEOUT, RAG_SEARCH_K_PER_QUERY,
    SUB_QUERY_PROMPT_TEMPLATE, SYNTHESIS_PROMPT_TEMPLATE, ANALYSIS_PROMPTS
)
from utils import parse_llm_response

logger = logging.getLogger(__name__)

document_texts_cache = {}
vector_store = None
embeddings: OllamaEmbeddings | None = None
llm: ChatOllama | None = None


# In Notebook/backend/ai_core.py
def initialize_ai_components() -> tuple[OllamaEmbeddings | None, ChatOllama | None]:
    global embeddings, llm
    if embeddings and llm:
        logger.info("AI components already initialized.")
        return embeddings, llm
    try:
        logger.info(f"Initializing Ollama Embeddings: model={OLLAMA_EMBED_MODEL}, base_url={OLLAMA_BASE_URL}") # Removed timeout from log
        current_embeddings = OllamaEmbeddings(
            model=OLLAMA_EMBED_MODEL,
            base_url=OLLAMA_BASE_URL
            # request_timeout=OLLAMA_REQUEST_TIMEOUT # <--- REMOVE THIS LINE
        )
        _ = current_embeddings.embed_query("Test embedding query")
        embeddings = current_embeddings
        logger.info("Ollama Embeddings initialized successfully.")

        logger.info(f"Initializing Ollama LLM: model={OLLAMA_MODEL}, base_url={OLLAMA_BASE_URL}") # Removed timeout from log
        current_llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL
            # request_timeout=OLLAMA_REQUEST_TIMEOUT # <--- REMOVE THIS LINE
        )
        _ = current_llm.invoke("Respond briefly with 'AI Check OK'")
        llm = current_llm
        logger.info("Ollama LLM initialized successfully.")
        return embeddings, llm
    except Exception as e:
        logger.error(f"Failed to initialize AI components: {e}", exc_info=True)
        embeddings = None
        llm = None
        return None, None

def load_vector_store() -> bool:
    global vector_store, embeddings
    if vector_store: return True
    if not embeddings: logger.error("Embeddings not initialized."); return False
    faiss_index_path = os.path.join(FAISS_FOLDER, "index.faiss")
    if os.path.exists(faiss_index_path): # Simplified check, original had pkl too
        try:
            vector_store = FAISS.load_local(FAISS_FOLDER, embeddings, allow_dangerous_deserialization=True)
            logger.info(f"FAISS index loaded. Vectors: {getattr(getattr(vector_store, 'index', None), 'ntotal', 0)}")
            return True
        except Exception as e: logger.error(f"Error loading FAISS: {e}"); vector_store = None; return False
    else: logger.warning(f"FAISS index not found at {FAISS_FOLDER}"); vector_store = None; return False

def save_vector_store() -> bool:
    global vector_store
    if not vector_store: logger.warning("No vector store to save."); return False
    try:
        if not os.path.exists(FAISS_FOLDER): os.makedirs(FAISS_FOLDER)
        vector_store.save_local(FAISS_FOLDER)
        logger.info(f"FAISS index saved to {FAISS_FOLDER}")
        return True
    except Exception as e: logger.error(f"Error saving FAISS: {e}"); return False

# --- THIS IS YOUR ORIGINAL, MORE DETAILED extract_text_from_pdf FUNCTION ---
def extract_text_from_pdf(pdf_path: str) -> str | None:
    """Extracts text from a single PDF file using PyMuPDF (fitz)."""
    text = ""
    if not os.path.exists(pdf_path):
        logger.error(f"PDF file not found for extraction: {pdf_path}")
        return None
    try:
        doc = fitz.open(pdf_path)
        num_pages = len(doc)
        logger.debug(f"Starting text extraction from {os.path.basename(pdf_path)} ({num_pages} pages)...")
        for page_num in range(num_pages):
            try:
                page = doc.load_page(page_num)
                page_text = page.get_text("text", sort=True, flags=0).strip()
                page_text = re.sub(r'[ \t\f\v]+', ' ', page_text)
                page_text = re.sub(r'\n+', '\n', page_text)
                if page_text:
                    text += page_text + "\n\n"
            except Exception as page_err:
                logger.warning(f"Error processing page {page_num+1} of {os.path.basename(pdf_path)}: {page_err}")
                continue
        doc.close()
        cleaned_text = text.strip()
        if cleaned_text:
            logger.info(f"Successfully extracted text from {os.path.basename(pdf_path)} (approx {len(cleaned_text)} chars).")
            return cleaned_text
        else:
            logger.warning(f"Extracted text was empty for {os.path.basename(pdf_path)}.")
            return None # Important to return None if empty for later checks
    except fitz.fitz.PasswordError: # More specific error for PyMuPDF
        logger.error(f"Error extracting text from PDF {os.path.basename(pdf_path)}: File is password-protected.")
        return None
    except Exception as e:
        logger.error(f"Error extracting text from PDF {os.path.basename(pdf_path)}: {e}", exc_info=True)
        return None
# --- END OF YOUR ORIGINAL extract_text_from_pdf FUNCTION ---


def load_all_document_texts():
    global document_texts_cache
    logger.info("(Old method) Loading/refreshing document texts cache from pre-defined folders...")
    document_texts_cache = {}
    loaded_count = 0 # This is for the total across all folders
    processed_files = set()

    def _load_from_folder(folder_path):
        nonlocal loaded_count # loaded_count is from the outer scope and IS modified
        # 'count' is specific to this call of _load_from_folder, so it's local
        count_for_this_folder = 0 # Use a different name or just make it local
        
        if not os.path.exists(folder_path):
            logger.warning(f"Doc text folder not found: {folder_path}. Skip.")
            return count_for_this_folder # Return the count for this folder (which is 0)
        try:
            for filename in os.listdir(folder_path):
                if filename.lower().endswith('.pdf') and not filename.startswith('~') and filename not in processed_files:
                    file_path = os.path.join(folder_path, filename)
                    doc_text_content = extract_text_from_pdf(file_path)
                    if doc_text_content:
                        document_texts_cache[filename] = doc_text_content
                        processed_files.add(filename)
                        count_for_this_folder += 1 # Increment local count for this folder
                    else:
                        logger.warning(f"Could not extract text from {filename} for cache.")
            logger.info(f"Cached text for {count_for_this_folder} PDFs from {folder_path}.")
            loaded_count += count_for_this_folder # Add this folder's count to the total
        except Exception as e:
            logger.error(f"Error processing files in {folder_path} for cache: {e}", exc_info=True)
        return count_for_this_folder # Return the count of files processed in this specific folder

    # Call _load_from_folder for each path
    _load_from_folder(DEFAULT_PDFS_FOLDER)
    _load_from_folder(UPLOAD_FOLDER)

    logger.info(f"(Old method) Text cache loaded. Total unique documents cached: {len(document_texts_cache)} (Accumulated from processed folders: {loaded_count})")

def create_chunks_from_text(text: str, filename: str) -> list[Document]: # Keep as is
    # ... (Your existing, good implementation) ...
    if not text: return []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150, length_function=len, add_start_index=True)
    documents = text_splitter.create_documents([text], metadatas=[{"source": filename}])
    for i, doc in enumerate(documents): doc.metadata["chunk_index"] = i
    logger.info(f"Created {len(documents)} chunks for '{filename}'.")
    return documents

def add_documents_to_vector_store(documents: list[Document]) -> bool: # Keep as is
    # ... (Your existing, good implementation) ...
    global vector_store, embeddings; # ... same logic ...
    if not documents: return True
    if not embeddings: logger.error("Embeddings not initialized for add_documents."); return False
    try:
        if vector_store: vector_store.add_documents(documents)
        else: vector_store = FAISS.from_documents(documents, embeddings)
        return save_vector_store()
    except Exception as e: logger.error(f"Error adding to FAISS: {e}"); return False

def generate_sub_queries(query: str) -> list[str]: # Keep as is
    # ... (Your existing implementation, ensure global llm is used) ...
    global llm; # ... same logic ...
    if not llm: return [query]
    try:
        chain = LLMChain(llm=llm, prompt=SUB_QUERY_PROMPT_TEMPLATE)
        response = chain.invoke({"query": query, "num_queries": MULTI_QUERY_COUNT})
        raw_text = response.get('text', '') if isinstance(response, dict) else str(response)
        sub_queries = [q.strip() for q in raw_text.strip().split('\n') if q.strip()]
        return [query] + sub_queries[:MULTI_QUERY_COUNT] if sub_queries else [query]
    except Exception: return [query]


def perform_rag_search(query: str) -> tuple[list[Document], str, dict[int, dict]]: # Keep as is
    # ... (Your existing implementation, ensure global vector_store is used) ...
    global vector_store; # ... same logic ...
    if not vector_store: return [], "No vector store loaded.", {}
    # ... rest of your logic, seems fine ...
    return [], "Mock RAG context", {} # Placeholder until you paste full logic

def synthesize_chat_response(query: str, context_text: str) -> tuple[str, str | None]: # Keep as is
    # ... (Your existing implementation, ensure global llm is used) ...
    global llm; # ... same logic ...
    if not llm: return "AI model unavailable.", None
    try:
        final_prompt = SYNTHESIS_PROMPT_TEMPLATE.format(query=query, context=context_text)
        response_obj = llm.invoke(final_prompt)
        full_response = getattr(response_obj, 'content', str(response_obj))
        return parse_llm_response(full_response)
    except Exception as e: logger.error(f"LLM synthesis error: {e}"); return f"Error in synthesis: {e}", None

ANALYSIS_MAX_CONTEXT_LENGTH = getattr(unified_config, 'ANALYSIS_MAX_CONTEXT_LENGTH', 30000)

# --- DOCUMENT ANALYSIS FUNCTIONS ---

# Notebook/backend/ai_core.py

# --- ADD THIS IMPORT AT THE TOP OF THE FILE ---
import requests 

# ... (keep all other imports and existing code)

# --- FIND AND REPLACE THE ENTIRE 'generate_document_analysis_from_path' FUNCTION ---

def generate_document_analysis_from_path(document_full_path: str, 
                                         analysis_type_requested: str, 
                                         prompt_template_str: str) -> tuple[str | None, str | None]:
    global llm 

    original_filename = os.path.basename(document_full_path)
    logger.info(f"AI_CORE - Reverted: Starting analysis. Type='{analysis_type_requested}', File='{original_filename}'")

    if llm is None:
        return f"Error: AI model unavailable.", "LLM not initialized."

    if not os.path.exists(document_full_path):
        return f"Error: Document '{original_filename}' not found.", "File existence check failed."

    doc_text = extract_text_from_pdf(document_full_path)
    if doc_text is None or not doc_text.strip():
        return f"Error: Could not extract text from '{original_filename}'.", "Text extraction failed."
    
    # Original truncation logic
    if len(doc_text) > ANALYSIS_MAX_CONTEXT_LENGTH:
        doc_text = doc_text[:ANALYSIS_MAX_CONTEXT_LENGTH]

    try:
        final_prompt_content = prompt_template_str.format(document_text=doc_text)
    except Exception as e_prompt:
        return f"Error: Could not prepare request.", f"Prompt creation error: {e_prompt}"

    llm_model_name = getattr(llm, 'model', 'ollama_default') 
    thinking_process = f"Analysis Type: {analysis_type_requested}\nDocument: {original_filename}\nLLM Model: {llm_model_name}\nAction: Calling LLM..."
    
    try:
        response_object = llm.invoke(final_prompt_content) 
        full_analysis_response = getattr(response_object, 'content', str(response_object))
        analysis_content, _ = parse_llm_response(full_analysis_response)
        
        return analysis_content.strip(), thinking_process.strip()

    except Exception as e_llm_call:
        thinking_process += f"LLM Invocation Error: {str(e_llm_call)}"
        return f"Error: AI model failed during analysis of '{original_filename}'.", thinking_process.strip()