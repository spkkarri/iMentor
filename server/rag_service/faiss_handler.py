# server/rag_service/faiss_handler.py
import os
import logging
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from rag_service import config

logger = logging.getLogger(__name__)

def ensure_faiss_dir():
    os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)

def get_faiss_index_path(user_id):
    return os.path.join(config.FAISS_INDEX_DIR, f"faiss_index_{user_id}")

def create_and_save_faiss_index(user_id, text_content):
    if not text_content:
        logger.warning("Cannot create index from empty text content.")
        return
    try:
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        texts = text_splitter.split_text(text_content)
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        logger.info(f"Creating FAISS index for user {user_id} with {len(texts)} chunks.")
        vector_store = FAISS.from_texts(texts, embeddings)
        index_path = get_faiss_index_path(user_id)
        vector_store.save_local(index_path)
        logger.info(f"Successfully saved FAISS index to {index_path}")
    except Exception as e:
        logger.error(f"Failed to create FAISS index for user {user_id}: {e}", exc_info=True)
        raise

def search_faiss_index(user_id, query, k=3):
    index_path = get_faiss_index_path(user_id)
    if not os.path.exists(index_path):
        logger.warning(f"No FAISS index found for user {user_id} at {index_path}")
        return []
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        # LangChain requires this flag for security with local FAISS indexes
        vector_store = FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
        logger.info(f"Searching index for user {user_id} with query: '{query[:50]}...'")
        return vector_store.similarity_search(query, k=k)
    except Exception as e:
        logger.error(f"Failed to search FAISS index for user {user_id}: {e}", exc_info=True)
        return []