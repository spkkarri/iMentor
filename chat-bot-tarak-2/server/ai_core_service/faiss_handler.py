# server/rag_service/faiss_handler.py

import os
import faiss
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.embeddings import Embeddings as LangchainEmbeddings
from langchain_core.documents import Document as LangchainDocument
from langchain_community.docstore import InMemoryDocstore
from . import config
import numpy as np
import time
import logging
import pickle
import uuid
import shutil
from datetime import datetime

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')
handler.setFormatter(formatter)
if not logger.hasHandlers():
    logger.addHandler(handler)

_INDEX_CACHE = {}
embedding_model: LangchainEmbeddings | None = None
_embedding_dimension = None # Cache the dimension

def get_embedding_dimension(embedder: LangchainEmbeddings) -> int:
    """Gets and caches the embedding dimension."""
    global _embedding_dimension
    if _embedding_dimension is None:
        try:
            logger.info("Determining embedding dimension...")
            dummy_embedding = embedder.embed_query("dimension_check")
            dimension = len(dummy_embedding)
            if not isinstance(dimension, int) or dimension <= 0:
                raise ValueError(f"Invalid embedding dimension obtained: {dimension}")
            _embedding_dimension = dimension
            logger.info(f"Detected embedding dimension: {_embedding_dimension}")
        except Exception as e:
            logger.error(f"CRITICAL ERROR determining embedding dimension: {e}", exc_info=True)
            raise RuntimeError(f"Failed to determine embedding dimension: {e}")
    return _embedding_dimension

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        if config.EMBEDDING_TYPE == 'sentence-transformer':
            logger.info(f"Initializing HuggingFace Embeddings (Model: {config.EMBEDDING_MODEL_NAME})")
            cache_dir = os.path.join(os.path.dirname(__file__), '.cache')
            os.makedirs(cache_dir, exist_ok=True)
            logger.info(f"Embedding model cache directory set to: {cache_dir}")
            try:
                device = 'cuda' if faiss.get_num_gpus() > 0 else 'cpu'
                if device == 'cpu': logger.warning("CUDA not available. Using CPU for embeddings. This will be slow.")

                embedding_model = HuggingFaceEmbeddings(
                    model_name=config.EMBEDDING_MODEL_NAME,
                    model_kwargs={'device': device},
                    encode_kwargs={'normalize_embeddings': True},
                    cache_folder=cache_dir
                )
                get_embedding_dimension(embedding_model)
                embedding_model.embed_query("test query") # Test run
                logger.info("Embedding model loaded and tested successfully.")
            except Exception as e:
                logger.error(f"Error loading HuggingFace Embeddings: {e}", exc_info=True)
                embedding_model = None
                raise RuntimeError(f"Failed to load embedding model: {e}")
        else:
            raise ValueError(f"Unsupported embedding type: {config.EMBEDDING_TYPE}")
    return embedding_model

def get_user_index_path(user_id):
    safe_user_id = str(user_id).replace('.', '_').replace('/', '_').replace('\\', '_')
    user_dir = os.path.join(config.FAISS_INDEX_DIR, f"user_{safe_user_id}")
    return user_dir

# Add this function after get_user_index_path
def get_podcast_index_path(podcast_id):
    """Returns the specific directory path for a podcast's FAISS index."""
    safe_podcast_id = str(podcast_id).replace('-', '') # Sanitize
    return os.path.join(config.FAISS_INDEX_DIR, "podcasts", safe_podcast_id)

def _delete_index_files(index_path, user_id):
    """Safely deletes index files for a user."""
    logger.warning(f"Deleting potentially incompatible index files for user '{user_id}' at {index_path}")
    try:
        if os.path.isdir(index_path):
            shutil.rmtree(index_path)
            logger.info(f"Successfully deleted directory: {index_path}")
    except OSError as e:
        logger.error(f"Error deleting index directory for user '{user_id}' at {index_path}: {e}", exc_info=True)

def load_or_create_index(user_id: str):
    """
    Loads a user's FAISS index, using an in-memory cache and performing rigorous dimension checks.
    """
    global _INDEX_CACHE
    embedder = get_embedding_model()
    current_dim = get_embedding_dimension(embedder)

    if user_id in _INDEX_CACHE:
        index = _INDEX_CACHE[user_id]
        if hasattr(index, 'index') and index.index is not None and index.index.d != current_dim:
            logger.warning(f"Cached index for user '{user_id}' has dimension {index.index.d}, but current model has {current_dim}. Discarding cache.")
            del _INDEX_CACHE[user_id]
        else:
            logger.info(f"FAISS index for user '{user_id}' found in cache and is valid.")
            return index

    index_path = get_user_index_path(user_id)
    if os.path.exists(os.path.join(index_path, "index.faiss")):
        logger.info(f"Attempting to load existing FAISS index for user '{user_id}' from {index_path}")
        try:
            index = FAISS.load_local(
                folder_path=index_path,
                embeddings=embedder,
                allow_dangerous_deserialization=True
            )
            if not hasattr(index, 'index') or index.index is None:
                 raise ValueError("Loaded index object is invalid.")
            if index.index.d != current_dim:
                logger.warning(f"DIMENSION MISMATCH! On-disk index for '{user_id}' (dim={index.index.d}) is incompatible with current model (dim={current_dim}). Recreating.")
                _delete_index_files(index_path, user_id)
            else:
                logger.info(f"Index for user '{user_id}' loaded from disk. Contains {index.index.ntotal} vectors.")
                _INDEX_CACHE[user_id] = index
                return index
        except Exception as e:
            logger.error(f"Failed to load index for '{user_id}', it might be corrupted: {e}. Deleting and recreating.")
            _delete_index_files(index_path, user_id)
    
    logger.info(f"Creating new FAISS index for user '{user_id}' with dimension {current_dim}")
    try:
        os.makedirs(index_path, exist_ok=True)
        faiss_index = faiss.IndexIDMap(faiss.IndexFlatIP(current_dim))
        index = FAISS(
            embedding_function=embedder,
            index=faiss_index,
            docstore=InMemoryDocstore({}),
            index_to_docstore_id={},
            normalize_L2=False
        )
        logger.info(f"New empty index created for user '{user_id}'. Caching and saving.")
        _INDEX_CACHE[user_id] = index
        save_index(user_id)
        return index
    except Exception as e:
        logger.error(f"CRITICAL ERROR creating new index for user '{user_id}': {e}", exc_info=True)
        raise RuntimeError(f"Failed to initialize FAISS index for user '{user_id}'")

def add_documents_to_index(user_id: str, docs: list[LangchainDocument]):
    """
    Adds documents to a user's FAISS index and updates the in-memory cache.
    """
    if not docs:
        logger.info(f"No documents to add for user '{user_id}'.")
        return

    try:
        index = load_or_create_index(user_id)
        embedder = get_embedding_model()

        current_dim = get_embedding_dimension(embedder)
        if not hasattr(index, 'index') or index.index is None:
             logger.error(f"Index object for user '{user_id}' is invalid after load/create. Cannot add documents.")
             raise RuntimeError("Failed to get valid index structure.")
        if index.index.d != current_dim:
             logger.error(f"FATAL: Dimension mismatch just before adding documents for user '{user_id}'. Index: {index.index.d}, Model: {current_dim}. This shouldn't happen if load_or_create_index worked.")
             _delete_index_files(get_user_index_path(user_id), user_id)
             if user_id in _INDEX_CACHE: del _INDEX_CACHE[user_id]
             raise RuntimeError(f"Inconsistent index dimension detected for user '{user_id}'. Please retry.")

        logger.info(f"Adding {len(docs)} documents to index for user '{user_id}' (Index dim: {index.index.d})...")
        start_time = time.time()

        texts = [doc.page_content for doc in docs]
        
        embeddings = embedder.embed_documents(texts)
        if not embeddings or len(embeddings) != len(texts):
             logger.error(f"Embedding generation failed or returned unexpected number of vectors for user '{user_id}'.")
             raise ValueError("Embedding generation failed.")
        if len(embeddings[0]) != current_dim:
             logger.error(f"Generated embeddings have incorrect dimension ({len(embeddings[0])}) for user '{user_id}', expected {current_dim}.")
             raise ValueError("Generated embedding dimension mismatch.")

        embeddings_np = np.array(embeddings, dtype=np.float32)
        ids = [str(uuid.uuid4()) for _ in texts]
        ids_np = np.array([uuid.UUID(id_).int & (2**63 - 1) for id_ in ids], dtype=np.int64)

        index.index.add_with_ids(embeddings_np, ids_np)

        docstore_additions = {doc_id: doc for doc_id, doc in zip(ids, docs)}
        index.docstore.add(docstore_additions)
        for i, faiss_id in enumerate(ids_np):
            index.index_to_docstore_id[int(faiss_id)] = ids[i]

        end_time = time.time()
        logger.info(f"Successfully added {len(docs)} vectors/documents for user '{user_id}' in {end_time - start_time:.2f} seconds. Total vectors: {index.index.ntotal}")
        
        _INDEX_CACHE[user_id] = index
        
        save_index(user_id)
    except Exception as e:
        logger.error(f"Error adding documents for user '{user_id}': {e}", exc_info=True)
        raise

def add_chat_message_to_index(user_id, message, role, session_id, timestamp=None):
    """Stores a chat message as an embedding in a dedicated chat FAISS index."""
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat()
    doc = LangchainDocument(
        page_content=message,
        metadata={"user_id": user_id, "role": role, "session_id": session_id, "timestamp": timestamp}
    )
    add_documents_to_index(f"{user_id}_chat", [doc])

def query_index(user_id, query_text, k=3, active_file=None):
    all_results_with_scores = []
    embedder = get_embedding_model()

    if embedder is None:
        logger.error("Embedding model is not available for query.")
        raise ConnectionError("Embedding model is not available for query.")

    try:
        start_time = time.time()
        user_index = None 
        default_index = None 

        try:
            user_index = load_or_create_index(user_id)
            if user_index.index.ntotal > 0:
                user_results = user_index.similarity_search_with_score(query_text, k=k)
                all_results_with_scores.extend(user_results)
        except Exception as e:
            logger.error(f"Could not query user index for '{user_id}': {e}", exc_info=True)

        if user_id != config.DEFAULT_INDEX_USER_ID:
            try:
                default_index = load_or_create_index(config.DEFAULT_INDEX_USER_ID)
                if default_index.index.ntotal > 0:
                    default_results = default_index.similarity_search_with_score(query_text, k=k)
                    all_results_with_scores.extend(default_results)
            except Exception as e:
                logger.error(f"Could not query default index: {e}", exc_info=True)
        
        query_time = time.time()
        logger.info(f"Completed all index queries in {query_time - start_time:.2f} seconds. Found {len(all_results_with_scores)} raw results.")

        unique_results = {}
        for doc, score in all_results_with_scores:
            if not doc or not hasattr(doc, 'metadata') or not hasattr(doc, 'page_content'):
                logger.warning(f"Skipping invalid document object in results: {doc}")
                continue
            
            content_key = f"{doc.metadata.get('documentName', 'Unknown')}_{doc.page_content[:200]}"
            unique_key = content_key 

            if unique_key not in unique_results or score < unique_results[unique_key][1]:
                unique_results[unique_key] = (doc, score)

        sorted_results = sorted(unique_results.values(), key=lambda item: item[1])
        final_results = sorted_results[:k] 

        logger.info(f"Returning {len(final_results)} unique results after filtering and sorting.")
        return final_results
    except Exception as e:
        logger.error(f"Error during query processing for user '{user_id}': {e}", exc_info=True)
        return []

def save_index(user_id):
    if user_id not in _INDEX_CACHE:
        logger.warning(f"Index for user '{user_id}' not in cache, cannot save.")
        return
    index = _INDEX_CACHE[user_id]
    index_path = get_user_index_path(user_id)
    try:
        os.makedirs(index_path, exist_ok=True)
        logger.info(f"Saving FAISS index for user '{user_id}' to {index_path}...")
        index.save_local(folder_path=index_path)
        logger.info(f"Index for user '{user_id}' saved successfully.")
    except Exception as e:
        logger.error(f"Error saving FAISS index for user '{user_id}': {e}", exc_info=True)

# Add this new function at the end of the file, before ensure_faiss_dir
def create_podcast_index(podcast_id: str, text_chunks: list[str]):
    """
    Creates and saves a new, self-contained FAISS index for a podcast's content.
    
    Args:
        podcast_id (str): The unique identifier for the podcast.
        text_chunks (list[str]): The list of text chunks from the podcast script.
    
    Returns:
        bool: True if the index was created successfully, False otherwise.
    """
    if not text_chunks:
        logger.warning(f"No text chunks provided for podcast_id: {podcast_id}. Skipping index creation.")
        return False

    index_path = get_podcast_index_path(podcast_id)
    if os.path.exists(index_path):
        logger.warning(f"Index for podcast_id {podcast_id} already exists. Deleting to recreate.")
        shutil.rmtree(index_path)

    os.makedirs(index_path, exist_ok=True)
    logger.info(f"Creating new FAISS index for podcast {podcast_id} at {index_path}")

    try:
        embedder = get_embedding_model()
        if not embedder:
            raise RuntimeError("Embedding model could not be initialized.")

        # Langchain's FAISS.from_texts handles embedding and index creation in one step
        vector_store = FAISS.from_texts(texts=text_chunks, embedding=embedder)
        
        # Save the newly created index to its specific folder
        vector_store.save_local(folder_path=index_path)
        
        logger.info(f"Successfully created and saved FAISS index for podcast {podcast_id} with {len(text_chunks)} vectors.")
        return True
    except Exception as e:
        logger.error(f"Failed to create FAISS index for podcast {podcast_id}: {e}", exc_info=True)
        # Clean up partial creations on failure
        if os.path.exists(index_path):
            shutil.rmtree(index_path)
        return False

def ensure_faiss_dir():
    """Ensures the base FAISS index directory exists."""
    try:
        os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
        logger.info(f"Ensured FAISS base directory exists: {config.FAISS_INDEX_DIR}")
    except OSError as e:
        logger.error(f"Could not create FAISS base directory {config.FAISS_INDEX_DIR}: {e}")
        raise