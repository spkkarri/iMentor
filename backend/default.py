# backend/default.py
import os
import logging
import sys
import requests
from config import (
    FAISS_FOLDER, setup_logging,
    OLLAMA_BASE_URL
)
from ai_core import (
    initialize_ai_components, load_vector_store,
    vector_store # embeddings, llm are initialized by initialize_ai_components
)

setup_logging()
logger = logging.getLogger(__name__)

def check_ollama_connection(base_url: str, timeout: int = 5) -> bool:
    check_url = base_url.rstrip('/') + "/api/tags"
    logger.info(f"Checking Ollama connection at {check_url} (timeout: {timeout}s)...")
    try:
        response = requests.get(check_url, timeout=timeout)
        response.raise_for_status()
        response.json()
        logger.info(f"Ollama server responded successfully (Status: {response.status_code}).")
        return True
    except requests.exceptions.Timeout:
        logger.error(f"Ollama connection timed out after {timeout} seconds connecting to {check_url}.")
        return False
    except requests.exceptions.ConnectionError:
        logger.error(f"Ollama connection refused at {check_url}. Is the Ollama server running and accessible?")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama connection failed for {check_url}: {e}")
        return False
    except ValueError: # Catches json.JSONDecodeError
        logger.error(f"Ollama server at {check_url} did not return valid JSON. Unexpected response content: {response.text[:200] if response else 'No response'}")
        return False

def perform_initial_checks_and_setup():
    """
    Performs essential pre-flight checks for the application:
    1. Checks Ollama server connectivity.
    2. Initializes AI components (Embeddings/LLM).
    3. Ensures FAISS_FOLDER exists.
    4. Attempts to load any existing FAISS index (from previous user uploads).
    This script no longer processes any default PDF documents.
    """
    logger.info("--- Performing Initial Application Checks and Setup ---")

    # 1. Pre-check Ollama Connection
    logger.info("Checking Ollama server accessibility...")
    if not check_ollama_connection(OLLAMA_BASE_URL):
        logger.critical(f"Ollama server is not reachable at {OLLAMA_BASE_URL}. This is essential for AI features.")
        logger.critical("Please ensure the Ollama server is running, accessible, and models are pulled.")
        return False
    logger.info("Ollama connection check successful.")

    # 2. Initialize AI components
    logger.info("Initializing AI components (Embeddings/LLM)...")
    embeddings_instance, llm_instance = initialize_ai_components()
    if not embeddings_instance or not llm_instance:
        logger.critical("Failed to initialize AI Embeddings/LLM components. Check Ollama connection, model names in .env, and logs.")
        return False
    logger.info("AI Embeddings and LLM components initialized successfully.")

    # 3. Ensure FAISS_FOLDER exists
    if not os.path.exists(FAISS_FOLDER):
        try:
            os.makedirs(FAISS_FOLDER)
            logger.info(f"Created FAISS store directory: {FAISS_FOLDER} (will be populated by user uploads)")
        except OSError as e:
            logger.error(f"Failed to create FAISS store directory {FAISS_FOLDER}: {e}", exc_info=True)
            return False # Critical for saving vector stores
    else:
        logger.info(f"FAISS store directory already exists: {FAISS_FOLDER}")

    # 4. Attempt to load existing FAISS index (from user uploads)
    logger.info("Attempting to load existing FAISS index (if any, from user uploads)...")
    if load_vector_store():
        index_size = getattr(getattr(vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Existing FAISS index loaded. Contains {index_size} vectors.")
    else:
        logger.info("No existing FAISS index found or loaded. A new index will be created upon first user upload if necessary.")

    logger.info("--- Initial checks and setup completed successfully. ---")
    return True

if __name__ == "__main__":
    logger.info("Running pre-application setup script...")
    try:
        if perform_initial_checks_and_setup():
            logger.info("--- Pre-application setup successful. ---")
            sys.exit(0)
        else:
            logger.error("--- Pre-application setup failed. Please review logs for details. ---")
            sys.exit(1)
    except Exception as e:
        logger.critical(f"--- An unexpected critical error occurred during the setup script: {e} ---", exc_info=True)
        sys.exit(2)