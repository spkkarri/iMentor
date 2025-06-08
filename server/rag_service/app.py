# server/rag_service/app.py

import os
import sys
from flask import Flask, request, jsonify # Ensure jsonify is imported

# --- Path Setup ---
# This assumes app.py is directly in rag_service.
# If app.py is in 'Notebook' and 'rag_service' is a subfolder of 'server' in a sibling project,
# the path logic needs to be different.
# Let's assume for now app.py is inside the rag_service package folder,
# or that rag_service has been correctly added to PYTHONPATH or installed.

# If app.py is in: C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Notebook\app.py
# And rag_service is in: C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Chatbot-geminiV3\server\rag_service\
# You need to add 'C:\Users\kurma\Downloads\Chatbot-main\Chatbot-main\Chatbot-geminiV3\server' to sys.path
# For example:
# current_script_dir = os.path.dirname(os.path.abspath(__file__)) # .../Notebook
# project_root_parent = os.path.abspath(os.path.join(current_script_dir, '..')) # .../Chatbot-main/Chatbot-main
# server_module_path = os.path.join(project_root_parent, 'Chatbot-geminiV3', 'server')
# sys.path.insert(0, server_module_path)

# If app.py is inside the rag_service directory:
from . import config
from . import file_parser
from . import faiss_handler # This now holds the global embedding_model


# from rag_service import config
# import rag_service.file_parser as file_parser
# import rag_service.faiss_handler as faiss_handler # This now holds the global embedding_model


import logging

# --- Logging Setup ---
if hasattr(config, 'setup_logging') and callable(config.setup_logging):
    config.setup_logging()
else:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Initialize Embedding Model (ONCE on startup) ---
# This is critical. The faiss_handler should manage the global embedding_model instance.
try:
    logger.info("Attempting to initialize embedding model on RAG service startup...")
    # faiss_handler.get_embedding_model() should initialize and store it,
    # e.g., faiss_handler.embedding_model = TheInitializedModel()
    faiss_handler.get_embedding_model() # This call should ensure faiss_handler.embedding_model is set
    if faiss_handler.embedding_model is None:
        raise RuntimeError("faiss_handler.embedding_model is None after get_embedding_model() call.")
    logger.info("Embedding model initialized successfully via faiss_handler.")
except Exception as e:
    logger.critical(f"CRITICAL: Embedding model failed to initialize on startup: {e}", exc_info=True)
    # Not setting faiss_handler.embedding_model to None here as it should be handled by the handler itself
    # Consider if the app should exit if the model is critical for all operations.
    # For now, endpoints will check faiss_handler.embedding_model

def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message}), status_code


# ... (after logger = logging.getLogger(__name__) and app = Flask(__name__))

# --- Global Initialization Function (Call ONCE before app.run) ---
def initialize_global_components():
    logger.info("--- Initializing Global RAG Service Components ---")
    # 1. Initialize Embedding Model (via faiss_handler)
    try:
        logger.info("Attempting to initialize embedding model on RAG service startup...")
        faiss_handler.get_embedding_model() 
        if faiss_handler.embedding_model is None:
            raise RuntimeError("faiss_handler.embedding_model is None after get_embedding_model() call.")
        logger.info("Embedding model initialized successfully via faiss_handler.")
        try:
            dim = faiss_handler.get_embedding_dimension(faiss_handler.embedding_model)
            logger.info(f"Embedding Dimension: {dim}")
        except Exception as e_dim:
            logger.error(f"Could not get embedding dimension on startup: {e_dim}")
    except Exception as e_embed:
        logger.critical(f"CRITICAL: Embedding model failed to initialize on startup: {e_embed}", exc_info=True)
        raise RuntimeError(f"CRITICAL: Embedding model failed to initialize: {e_embed}")

    # 2. Ensure FAISS base directory exists
    try:
        faiss_handler.ensure_faiss_dir() 
        logger.info(f"Ensured FAISS base directory exists: {config.FAISS_INDEX_DIR}")
    except Exception as e_dir:
        logger.critical(f"CRITICAL: Could not create/ensure FAISS base directory '{config.FAISS_INDEX_DIR}'. Error: {e_dir}", exc_info=True)
        raise RuntimeError(f"CRITICAL: FAISS directory setup failed: {e_dir}")

    # 3. Pre-load Default FAISS Index
    try:
        default_index_id = config.DEFAULT_INDEX_USER_ID
        logger.info(f"Attempting to pre-load default FAISS index: '{default_index_id}' on startup...")
        faiss_handler.load_or_create_index(default_index_id) 
        if default_index_id in faiss_handler.loaded_indices:
            default_idx_instance = faiss_handler.loaded_indices[default_index_id]
            logger.info(f"Default index '{default_index_id}' confirmed loaded successfully.")
            if hasattr(default_idx_instance, 'index') and default_idx_instance.index is not None:
                logger.info(f"Default index contains {default_idx_instance.index.ntotal} vectors.")
            else:
                logger.warning(f"Default index '{default_index_id}' loaded but appears to be invalid or empty.") # Corrected variable name
        else:
            logger.warning(f"Default index '{default_index_id}' not found in loaded_indices after load attempt. Ensure default.py has run and paths are correct.")
    except Exception as e_default_idx:
        logger.error(f"Error during default FAISS index pre-load for '{config.DEFAULT_INDEX_USER_ID}': {e_default_idx}", exc_info=True)
        logger.warning("The RAG service will run, but queries might not include the default knowledge base if it failed to load.")
    logger.info("--- Global RAG Service Components Initialized ---")
# --- End Global Initialization Function ---



# --- Health Check Route (Your existing code) ---
@app.route('/health', methods=['GET'])
def health_check():
    logger.info("\n--- Received request at /health ---")
    status_details = {
        "status": "error",
        "embedding_model_type": config.EMBEDDING_TYPE,
        "embedding_model_name": config.EMBEDDING_MODEL_NAME,
        "embedding_dimension": None,
        "sentence_transformer_load": None,
        "default_index_loaded": False,
        "default_index_vectors": 0,
        "default_index_dim": None,
        "message": ""
    }
    http_status_code = 503
    try:
        # Access the model through faiss_handler
        model = faiss_handler.embedding_model
        if model is None:
            status_details["message"] = "Embedding model (faiss_handler.embedding_model) is not initialized."
            status_details["sentence_transformer_load"] = "Failed"
            raise RuntimeError(status_details["message"])
        else:
            status_details["sentence_transformer_load"] = "OK"
            try:
                 status_details["embedding_dimension"] = faiss_handler.get_embedding_dimension(model)
            except Exception as dim_err:
                 status_details["embedding_dimension"] = f"Error: {dim_err}"

        # Check default index
        default_index_user_id = config.DEFAULT_INDEX_USER_ID
        # Default index path
        default_index_path = os.path.join(faiss_handler.get_user_index_path(default_index_user_id), "index.faiss")

        if not os.path.exists(default_index_path):
            status_details["message"] = f"Default index file missing at {default_index_path}. Run default.py."
            status_details["default_index_loaded"] = False
        else:
            # Attempt to load it if not already in cache, or check cache
            if default_index_user_id in faiss_handler.loaded_indices:
                default_index = faiss_handler.loaded_indices[default_index_user_id]
                logger.info("Default index found in cache for health check.")
            else:
                logger.info("Attempting to load default index for health check (not in cache)...")
                # load_or_create_index will use faiss_handler.embedding_model
                default_index = faiss_handler.load_or_create_index(default_index_user_id)
            
            if default_index and hasattr(default_index, 'index') and default_index.index:
                status_details["default_index_loaded"] = True
                status_details["default_index_vectors"] = default_index.index.ntotal
                status_details["default_index_dim"] = default_index.index.d
                logger.info("Default index details populated for health check.")
            else:
                status_details["message"] = "Default index loaded but seems invalid or empty."
                status_details["default_index_loaded"] = False # Or True, but with 0 vectors

        if status_details["sentence_transformer_load"] == "OK" and status_details["default_index_loaded"]:
            status_details["status"] = "ok"
            status_details["message"] = "RAG service is running, embedding model accessible, default index seems OK."
            http_status_code = 200
        else: # if any check failed, ensure overall status is error
            status_details["status"] = "error"
            if not status_details["message"]: # Generic message if not set by specific failure
                status_details["message"] = "One or more health checks failed."
        
        logger.info(f"Health check result: {status_details['status']}")

    except Exception as e:
        logger.error(f"--- Health Check Error ---", exc_info=True)
        status_details["status"] = "error"
        if not status_details["message"]:
            status_details["message"] = f"Health check failed with an exception: {str(e)}"
        http_status_code = 503 # Ensure error code
    return jsonify(status_details), http_status_code

# --- Add Document Route (Your existing code, ensure faiss_handler.embedding_model is used) ---
@app.route('/add_document', methods=['POST'])
def add_document():
    logger.info("\n--- Received request at /add_document ---")
    if faiss_handler.embedding_model is None:
        return create_error_response("Service not ready: Embedding model not initialized.", 503)
    # ... (rest of your existing add_document code)
    # Ensure that faiss_handler.add_documents_to_index internally uses
    # the globally initialized faiss_handler.embedding_model
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    user_id = data.get('user_id')
    file_path = data.get('file_path') # This is path on the server where Node.js saved the file
    original_name = data.get('original_name')

    if not all([user_id, file_path, original_name]):
        return create_error_response("Missing required fields: user_id, file_path, original_name", 400)
    
    logger.info(f"Processing file: {original_name} for user: {user_id} from path: {file_path}")

    if not os.path.exists(file_path):
        # This check assumes Node.js has already placed the file on a shared volume or local path
        # accessible to this Python service.
        return create_error_response(f"File not found at path: {file_path} (as reported by Node.js)", 404)

    try:
        text_content = file_parser.parse_file(file_path)
        if text_content is None or not text_content.strip():
            msg = f"File '{original_name}' unsupported or no text extracted."
            logger.warning(msg)
            # It's important to clean up the temporary file if Node.js isn't doing it
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Cleaned up temporary file: {file_path}")
                except OSError as e_rm:
                    logger.error(f"Error cleaning up temporary file {file_path}: {e_rm}")
            return jsonify({"message": msg, "filename": original_name, "status": "skipped"}), 200

        documents = file_parser.chunk_text(text_content, original_name, user_id)
        if not documents:
            msg = f"No text chunks generated for '{original_name}'."
            logger.warning(msg)
            if os.path.exists(file_path): os.remove(file_path) # Cleanup
            return jsonify({"message": msg, "filename": original_name, "status": "skipped"}), 200

        # add_documents_to_index should use the global faiss_handler.embedding_model
        faiss_handler.add_documents_to_index(user_id, documents)
        logger.info(f"Successfully processed and added document: {original_name} for user: {user_id}")
        
        if os.path.exists(file_path): os.remove(file_path) # Cleanup successful processing

        return jsonify({
            "message": f"Document '{original_name}' processed and added to index.",
            "filename": original_name,
            "chunks_added": len(documents),
            "status": "added"
        }), 200
    except Exception as e:
        logger.error(f"--- Add Document Error for file '{original_name}' ---", exc_info=True)
        if os.path.exists(file_path): os.remove(file_path) # Cleanup on error too
        return create_error_response(f"Failed to process document '{original_name}': {str(e)}", 500)


# --- NEW /api/rag_query ROUTE (replaces your old /query) ---
# In server/rag_service/app.py

# ... (imports, app = Flask(__name__), initialize_global_components(), health_check, add_document routes are above this) ...

# --- CORRECTED AND SIMPLIFIED /query ROUTE ---
@app.route('/query', methods=['POST']) # Or use '/api/rag_query' if that's what Node.js calls
def query_route():
    logger.info("\n--- Received request at /query ---")
    if faiss_handler.embedding_model is None: # Check if model loaded on startup
        return create_error_response("Service not ready: Embedding model not initialized.", 503)

    if not request.is_json:
        return create_error_response("Request must be JSON", 400)

    data = request.get_json()
    query_text = data.get('query')
    user_id_from_request = data.get('user_id') # This is the actual user ID from Node.js (can be None)
    
    # Use k from request, or RAG_CHUNK_K from config, or default
    k_from_config = getattr(config, 'RAG_CHUNK_K', 3) # Ensure RAG_CHUNK_K is in your config.py
    k = data.get('k', k_from_config)
    try: 
        k = int(k)
        if k <= 0: k = k_from_config 
    except (ValueError, TypeError):
        k = k_from_config

    if not query_text:
        return create_error_response("Missing required field: query", 400)

    logger.info(f"Query: '{query_text[:100]}...', User ID from request: {user_id_from_request}, k: {k}")

    try:
        # faiss_handler.query_index is expected to:
        # 1. Query the default index (config.DEFAULT_INDEX_USER_ID).
        # 2. If user_id_from_request is provided and different from default, query that user's index.
        # 3. Combine, de-duplicate, and rank the results.
        # 4. Return a list of (LangchainDocument, score) tuples.
        retrieved_docs_with_scores = faiss_handler.query_index(
            user_id_from_request, 
            query_text,
            k=k  # This 'k' might be interpreted by faiss_handler as k per index, or total k after combining.
                 # Your faiss_handler.query_index currently does k for user and k for default.
        )

        final_context_string = getattr(config, 'NO_CONTEXT_MESSAGE', "No relevant information was found in the knowledge base for your query.")
        references_for_node = []
        
        # Determine info about which indexes were effectively queried for the response
        effective_index_info = "default index"
        if user_id_from_request and user_id_from_request != config.DEFAULT_INDEX_USER_ID:
            # Check if user index actually exists and was likely queried by faiss_handler
            user_index_path = os.path.join(faiss_handler.get_user_index_path(user_id_from_request), "index.faiss")
            if os.path.exists(user_index_path):
                effective_index_info = f"user '{user_id_from_request}' and default index"
            else:
                effective_index_info = f"default index (user index for '{user_id_from_request}' not found)"
        
        if retrieved_docs_with_scores:
            context_chunks_for_llm = []
            for i, (doc_object, score) in enumerate(retrieved_docs_with_scores):
                if not hasattr(doc_object, 'page_content') or not hasattr(doc_object, 'metadata'):
                    logger.warning(f"Skipping retrieved document due to missing attributes: {doc_object}")
                    continue
                
                doc_name = doc_object.metadata.get("documentName", "Unknown Document")
                chunk_content = doc_object.page_content
                source_index_type = doc_object.metadata.get('retrieved_from', 'unknown_index') # from faiss_handler
                
                context_chunks_for_llm.append(
                    # Example: f"Source: {doc_name} (From: {source_index_type})\nContent: {chunk_content}\n---"
                    f"Source: {doc_name}\nContent: {chunk_content}\n---"
                )
                references_for_node.append({
                    "source": doc_name,
                    "score": float(score), 
                    "content_preview": chunk_content[:250] + "..." if len(chunk_content) > 250 else chunk_content,
                    "index_type": source_index_type # Added this based on faiss_handler modification
                })
            
            if context_chunks_for_llm:
                 final_context_string = "\n\n".join(context_chunks_for_llm)
        
        logger.info(f"Query processed for user '{user_id_from_request}'. Returning {len(references_for_node)} references. Queried: {effective_index_info}.")
        
        return jsonify({
            "context": final_context_string,
            "references": references_for_node,
            "index_used_info": effective_index_info 
        }), 200

    except Exception as e:
        logger.error(f"--- Query Error for user '{user_id_from_request}' ---", exc_info=True)
        return jsonify({
            "context": "An error occurred while trying to retrieve relevant documents from the RAG service.",
            "references": [],
            "error": f"RAG service query failed: {str(e)}"
        }), 500

# # # --- Main Execution Block (Keep your corrected version from previous message) ---
# # if __name__ == '__main__':
# #     # ... (your corrected startup logic that calls initialize_global_components()) ...

#     # Determine which user_id to target for the FAISS index
#     target_user_id_for_faiss = None
#     effective_index_name = "" # For logging/response

#     if user_id_from_request:
#         # Node.js sent a specific user_id, so we try to use that index.
#         # Check if this user-specific index actually exists.
#         user_specific_index_dir = faiss_handler.get_user_index_path(user_id_from_request)
#         user_specific_index_file = os.path.join(user_specific_index_dir, "index.faiss")
#         if os.path.exists(user_specific_index_file):
#             target_user_id_for_faiss = user_id_from_request
#             effective_index_name = user_id_from_request
#             logger.info(f"Querying user-specific index: '{target_user_id_for_faiss}' with k={k}")
#         else:
#             logger.warning(f"User-specific index for ID '{user_id_from_request}' not found. Falling back to default index.")
#             target_user_id_for_faiss = config.DEFAULT_INDEX_USER_ID
#             effective_index_name = f"default ({config.DEFAULT_INDEX_USER_ID})" # For clarity
#     else:
#         # No user_id_from_request means Node.js wants to use the default RAG.
#         target_user_id_for_faiss = config.DEFAULT_INDEX_USER_ID
#         effective_index_name = f"default ({config.DEFAULT_INDEX_USER_ID})"
#         logger.info(f"Querying default index: '{target_user_id_for_faiss}' with k={k}")

#     logger.debug(f"Query text: '{query[:100]}...'")

#     try:
#         # Check if the target FAISS index (default or user's) physically exists
#         # This is a safeguard. load_or_create_index might also do this.
#         target_index_dir = faiss_handler.get_user_index_path(target_user_id_for_faiss)
#         target_index_file = os.path.join(target_index_dir, "index.faiss")
#         if not os.path.exists(target_index_file):
#             err_msg = f"Knowledge base index ('{effective_index_name}') not found on server. It may need to be created."
#             logger.error(err_msg + f" Path checked: {target_index_file}")
#             # If it's the default, this is more critical.
#             if target_user_id_for_faiss == config.DEFAULT_INDEX_USER_ID:
#                 err_msg = f"CRITICAL: Default knowledge base ('{config.DEFAULT_INDEX_USER_ID}') not found. Please ensure default.py has run successfully."
#             return create_error_response(err_msg, 404) # 404 if index not found

#         # faiss_handler.query_index should:
#         # 1. Call load_or_create_index(target_user_id_for_faiss) which uses faiss_handler.embedding_model
#         # 2. Perform similarity search
#         retrieved_docs_with_scores = faiss_handler.query_index(target_user_id_for_faiss, query, k=k)

#         context_chunks_for_llm = []
#         references_for_node = []
#         final_context_string = "No relevant information was found in the knowledge base for your query."

#         if retrieved_docs_with_scores:
#             for i, (doc_object, score) in enumerate(retrieved_docs_with_scores):
#                 if not hasattr(doc_object, 'page_content') or not hasattr(doc_object, 'metadata'):
#                     logger.warning(f"Skipping retrieved document due to missing attributes: {doc_object}")
#                     continue

#                 doc_name = doc_object.metadata.get("documentName", "Unknown Document")
#                 chunk_content = doc_object.page_content
#                 chunk_idx = doc_object.metadata.get("chunkIndex", i) # Get original chunk index

#                 context_chunks_for_llm.append(
#                     f"Source: {doc_name} (Chunk {chunk_idx + 1})\nContent: {chunk_content}\n---"
#                 )
#                 references_for_node.append({
#                     "source": doc_name,
#                     "score": float(score),
#                     "content_preview": chunk_content[:250] + "..." if len(chunk_content) > 250 else chunk_content,
#                     "original_chunk_index": chunk_idx
#                 })
            
#             if context_chunks_for_llm:
#                  final_context_string = "\n\n".join(context_chunks_for_llm)
        
#         logger.info(f"Query for '{effective_index_name}' successful. Returning {len(references_for_node)} references.")
        
#         return jsonify({
#             "context": final_context_string, # This goes to the LLM via Node.js
#             "references": references_for_node, # This can be displayed in the UI by Node.js/React
#             "index_used": effective_index_name # For Node.js/React to know which index was queried
#         }), 200

#     except Exception as e:
#         logger.error(f"--- Query Error for index '{effective_index_name}' ---", exc_info=True)
#         return jsonify({
#             "context": "An error occurred while trying to retrieve relevant documents from the RAG service.",
#             "references": [],
#             "error": f"RAG service query failed: {str(e)}",
#             "index_used": effective_index_name
#         }), 500

# --- Main Execution Block ---
if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        logger.info(f"Ensured FAISS base directory exists: {config.FAISS_INDEX_DIR}")
    except Exception as e:
        logger.critical(f"CRITICAL: Could not create FAISS base directory '{config.FAISS_INDEX_DIR}'. Exiting. Error: {e}", exc_info=True)
        sys.exit(1)

    # Embedding model initialization is now at the top of the script, outside __main__
    # So it's done once when the module is loaded.
    # We check if it was successful here.
    # if faiss_handler.embedding_model is None:
    #     logger.critical("CRITICAL: Embedding model (faiss_handler.embedding_model) was not initialized. Exiting.")
    #     sys.exit(1)
    # else:
    #     logger.info("Embedding model confirmed initialized on startup.")
    # --- Main Execution Block ---
if __name__ == '__main__':
    try:
        # Call initialization once
        initialize_global_components()
    except RuntimeError as e_init: # Catch critical errors from initialization
        logger.critical(f"Failed to initialize critical components during startup: {e_init}")
        sys.exit(1) # Exit if essential components like embedding model fail

    # Determine port and debug mode
    port = int(getattr(config, 'RAG_SERVICE_PORT', 5002)) # Use RAG_SERVICE_PORT from config or default to 5002
    debug_mode = os.getenv('FLASK_DEBUG', '0') == '1'

    logger.info(f"--- Starting Python RAG Service (app.py) ---")
    logger.info(f"Listening on: http://0.0.0.0:{port}")
    logger.info(f"Debug mode: {debug_mode}")
    logger.info(f"Using Embedding: {config.EMBEDDING_TYPE} ({config.EMBEDDING_MODEL_NAME})")
    logger.info(f"Default Index User ID: {config.DEFAULT_INDEX_USER_ID}")
    logger.info(f"FAISS Index Path: {config.FAISS_INDEX_DIR}")
    logger.info("-----------------------------------------")
    
    # Use waitress for production-like environment, flask dev server for debug
    if not debug_mode:
        from waitress import serve
        logger.info("Starting Waitress server...")
        serve(app, host='0.0.0.0', port=port, threads=getattr(config, 'WAITRESS_THREADS', 8))
    else:
        logger.info("Starting Flask development server...")
        app.run(host='0.0.0.0', port=port, debug=True)