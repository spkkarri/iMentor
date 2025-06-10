import os
import logging
import pickle # For saving/loading FAISS metadata (ids, sources)
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings # For Sentence Transformers
from langchain_core.documents import Document # Import Document
from typing import List, Dict, Union

from rag_service import config

logger = logging.getLogger(__name__)

# Cache for loaded FAISS indices to prevent re-loading repeatedly
# Format: {user_id: {"index": FAISS_instance, "doc_ids": {str_doc_id: List[str_chunk_ids]}}}
loaded_indices = {}

def get_embedding_model():
    """
    Initializes and returns the Sentence Transformer embedding model.
    """
    if config.EMBEDDING_TYPE == 'sentence-transformer':
        try:
            logger.info(f"Loading Sentence Transformer model: {config.EMBEDDING_MODEL_NAME}")
            # Ensure model is downloaded/cached
            embeddings = HuggingFaceEmbeddings(
                model_name=config.EMBEDDING_MODEL_NAME,
                cache_folder=os.path.join(config.PROJECT_ROOT_DIR, 'model_cache') # Optional: specify cache dir
            )
            logger.info("Sentence Transformer embedding model initialized successfully.")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to load Sentence Transformer model '{config.EMBEDDING_MODEL_NAME}': {e}", exc_info=True)
            return None
    else:
        logger.error(f"Unsupported embedding type: {config.EMBEDDING_TYPE}")
        return None

def get_user_index_path(user_id: str) -> str:
    """Returns the directory path for a user's FAISS index."""
    return os.path.join(config.FAISS_INDEX_DIR, f"faiss_index_{user_id}")

def get_index_file_paths(user_id: str) -> tuple[str, str]:
    """Returns the .faiss and .pkl file paths for a user's index."""
    user_index_dir = get_user_index_path(user_id)
    return os.path.join(user_index_dir, "index.faiss"), \
           os.path.join(user_index_dir, "index.pkl")

def ensure_faiss_dir():
    """Ensures the base FAISS index directory exists."""
    os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
    logger.info(f"Ensured FAISS base directory exists: {config.FAISS_INDEX_DIR}")


def load_or_create_index(user_id: str) -> FAISS:
    """
    Loads an existing FAISS index for a user, or creates a new empty one if not found.
    Caches the loaded index.
    """
    if user_id in loaded_indices:
        logger.info(f"FAISS index for user '{user_id}' found in cache.")
        return loaded_indices[user_id]["index"]

    user_index_dir = get_user_index_path(user_id)
    faiss_file, pkl_file = get_index_file_paths(user_id)
    embeddings = get_embedding_model()

    if embeddings is None:
        raise RuntimeError("Embedding model could not be initialized. Cannot load or create index.")

    if os.path.exists(faiss_file) and os.path.exists(pkl_file):
        try:
            logger.info(f"Loading existing FAISS index for user '{user_id}' from {user_index_dir}")
            vector_store = FAISS.load_local(user_index_dir, embeddings, allow_dangerous_deserialization=True)
            with open(pkl_file, 'rb') as f:
                doc_to_chunk_map = pickle.load(f)
            loaded_indices[user_id] = {"index": vector_store, "doc_ids": doc_to_chunk_map}
            logger.info(f"Successfully loaded FAISS index for user '{user_id}'.")
            return vector_store
        except Exception as e:
            logger.warning(f"Failed to load existing FAISS index for user '{user_id}': {e}. Creating a new one.", exc_info=True)
            # Fall through to create new index
    else:
        logger.info(f"No existing FAISS index found for user '{user_id}' at {user_index_dir}. Creating a new empty one.")

    # Create new empty index if not found or failed to load
    os.makedirs(user_index_dir, exist_ok=True)
    # FAISS.from_documents needs at least one document to infer embedding dimension
    # Create a dummy document if no real documents are being added to initialize correctly.
    # A cleaner way might be to get the dimension from the embedding model directly.
    # For now, we'll ensure an empty index is properly initialized if no documents are provided initially.
    # The `add_documents_to_index` function will handle the actual `from_documents` call.
    # For now, just ensure the cache entry exists, an empty FAISS object can't be saved/loaded easily.
    # The FAISS object is only created and saved when the first document is added.
    
    # Initialize the cache entry for the user even if index files don't exist yet
    if user_id not in loaded_indices:
        # Placeholder: the FAISS object will be created/updated when documents are added.
        # We need to ensure the doc_ids map is initialized.
        loaded_indices[user_id] = {"index": None, "doc_ids": {}}
        # The FAISS instance will be populated by `add_documents_to_index`

    return loaded_indices[user_id]["index"] # This will be None until documents are added


def add_documents_to_index(user_id: str, new_documents: List[Document]):
    """
    Adds new documents to a user's FAISS index. Creates the index if it doesn't exist.
    Manages document IDs to chunk ID mapping for retrieval/deletion.
    """
    if not new_documents:
        logger.warning(f"No documents provided to add for user '{user_id}'.")
        return

    embeddings = get_embedding_model()
    if embeddings is None:
        raise RuntimeError("Embedding model could not be initialized. Cannot add documents.")

    user_index_dir = get_user_index_path(user_id)
    faiss_file, pkl_file = get_index_file_paths(user_id)

    # Load existing index or initialize for creation
    if user_id not in loaded_indices:
        load_or_create_index(user_id) # This will set up the initial cache entry for doc_ids
    
    current_doc_map = loaded_indices[user_id]["doc_ids"]

    # Separate new documents by their source (original_name/file_id)
    # Also assign unique LangChain IDs for each chunk for potential future granular deletion
    docs_to_add = []
    for doc in new_documents:
        source_id = doc.metadata.get("source") # This should be the original filename or similar unique ID
        chunk_id = doc.metadata.get("chunk_id", str(uuid.uuid4())) # Ensure each chunk has a unique ID
        
        doc.id = chunk_id # Assign LangChain ID to the chunk

        if source_id not in current_doc_map:
            current_doc_map[source_id] = []
        current_doc_map[source_id].append(chunk_id)
        docs_to_add.append(doc)


    if os.path.exists(faiss_file) and os.path.exists(pkl_file) and loaded_indices[user_id]["index"] is not None:
        # If index exists and is loaded, add documents
        logger.info(f"Adding {len(docs_to_add)} new documents to existing FAISS index for user '{user_id}'.")
        current_index = loaded_indices[user_id]["index"]
        current_index.add_documents(docs_to_add)
        vector_store = current_index
    else:
        # If index doesn't exist or failed to load, create a new one from these documents
        logger.info(f"Creating new FAISS index for user '{user_id}' with {len(docs_to_add)} documents.")
        vector_store = FAISS.from_documents(docs_to_add, embeddings)
        loaded_indices[user_id]["index"] = vector_store # Cache the newly created index

    # Save the updated index and the document ID map
    try:
        vector_store.save_local(user_index_dir)
        with open(pkl_file, 'wb') as f:
            pickle.dump(current_doc_map, f)
        logger.info(f"Successfully saved FAISS index and document map for user '{user_id}'.")
    except Exception as e:
        logger.error(f"Failed to save FAISS index or document map for user '{user_id}': {e}", exc_info=True)
        raise

def search_faiss_index(user_id: str, query: str, k: int = 3) -> List[Document]:
    """
    Searches the FAISS index for a user and returns relevant documents.
    """
    embeddings = get_embedding_model()
    if embeddings is None:
        logger.error("Embedding model could not be initialized. Cannot search index.")
        return []

    # Ensure the index is loaded (or created as empty if not exists)
    vector_store = load_or_create_index(user_id)
    if vector_store is None: # Means no index file existed and no documents were added yet
        logger.warning(f"No FAISS index available for user '{user_id}'. Cannot perform search.")
        return []

    try:
        logger.info(f"Searching index for user '{user_id}' with query: '{query[:50]}...' (k={k})")
        # Ensure that the embeddings used for search are the same as those used for indexing
        results = vector_store.similarity_search(query, k=k)
        logger.info(f"Found {len(results)} relevant documents for user '{user_id}'.")
        return results
    except Exception as e:
        logger.error(f"Failed to search FAISS index for user '{user_id}': {e}", exc_info=True)
        return []

def get_documents_by_source_id(user_id: str, source_id: str) -> List[Document]:
    """
    Retrieves all chunks associated with a specific original document (source_id).
    This function will be crucial for getting all text from a PPT/PDF for podcast generation.
    """
    vector_store = load_or_create_index(user_id)
    if vector_store is None:
        logger.warning(f"No FAISS index available for user '{user_id}'. Cannot retrieve documents by source ID.")
        return []
    
    if user_id not in loaded_indices or source_id not in loaded_indices[user_id]["doc_ids"]:
        logger.warning(f"Source ID '{source_id}' not found in index for user '{user_id}'.")
        return []

    # Get the chunk IDs associated with this source_id
    chunk_ids = loaded_indices[user_id]["doc_ids"][source_id]
    
    # LangChain's FAISS `vectorstore` doesn't directly support retrieval by `doc_id` easily
    # It's primarily for similarity search.
    # To get documents by ID, we'd typically need to store the actual documents in memory
    # or in another database alongside the FAISS index.
    # For now, a practical approach for retrieval by source_id for podcast generation
    # will be to re-parse the file and chunk it, or to make the RAG query itself broad
    # enough to pull all relevant chunks.
    # Given the problem of getting *all* content from a file for a podcast,
    # the best way for now is to:
    # 1. Parse the file again to get its full text.
    # 2. Re-chunk the text (this will generate new IDs but give all content).
    # This avoids storing the actual document content in the FAISS handler's cache.
    # However, if the file has *already* been parsed and indexed, we can try to
    # retrieve chunks that have the matching `source` metadata. This requires iterating
    # through potentially all documents in the index, which is inefficient for large indexes.

    # A more efficient way to get all documents for a specific source_id is if
    # FAISS stored the documents themselves along with the vectors, or if we had
    # a separate store for metadata lookup.
    # Langchain's FAISS `vectorstore` objects store `docstore` and `index_to_docstore_id`
    # attributes which *might* allow retrieval by ID. Let's try that.

    retrieved_docs = []
    # Loop through the internal docstore if it exists
    if hasattr(vector_store, 'docstore') and hasattr(vector_store, 'index_to_docstore_id'):
        for doc_store_id in vector_store.index_to_docstore_id.values():
            doc = vector_store.docstore.search(doc_store_id)
            if doc and doc.metadata.get("source") == source_id and doc.metadata.get("user_id") == user_id:
                retrieved_docs.append(doc)
    else:
        logger.warning("FAISS vector store does not have docstore/index_to_docstore_id. Cannot retrieve by source ID efficiently.")
        # Fallback: A very inefficient search for all chunks for this source_id
        # This is a placeholder and should be optimized if this becomes a bottleneck
        # For simplicity, if not available via docstore, we will rely on search_faiss_index
        # with a generic query like "content of {source_id}" to get relevant parts.
        # However, for a *full podcast*, we need all content.
        # The most robust approach for "get all content from a specific uploaded file"
        # remains re-parsing it or storing the full text somewhere else.

        # Given that we are now adding `source` metadata to every chunk,
        # we can potentially filter `search_faiss_index` results to only include
        # those from the desired source, but this still requires a search query.
        # For a full podcast, we want *all* content, not just similarity search.

        # Let's re-evaluate how `app.py` passes content to `generate_advanced_podcast_script`.
        # If `app.py` passes `file.path` directly, `app.py` will parse the file again.
        # This `get_documents_by_source_id` is more for a future RAG query refinement
        # where we want to limit search to a specific document.
        pass # This function might not be directly used for podcast if app.py re-parses.

    logger.info(f"Retrieved {len(retrieved_docs)} chunks for source ID '{source_id}'.")
    return retrieved_docs