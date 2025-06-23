# FusedChatbot/server/ai_core_service/app.py
import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    from . import config, file_parser, faiss_handler, llm_handler
except ImportError:
    # Adjust path for local execution if needed
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    import config, file_parser, faiss_handler, llm_handler

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def create_error_response(message, status_code=500):
    logger.error(f"API Error Response ({status_code}): {message}")
    return jsonify({"error": message, "status": "error"}), status_code

@app.route('/health', methods=['GET'])
def health_check():
    # ... (code is unchanged) ...
    logger.info("\n--- Received request at /health ---")
    status_details = { "status": "error", "embedding_model_type": config.EMBEDDING_TYPE, "embedding_model_name": config.EMBEDDING_MODEL_NAME, "embedding_dimension": None, "sentence_transformer_load": "Unknown", "default_index_loaded": False, "gemini_sdk_installed": bool(llm_handler.genai), "ollama_available": bool(llm_handler.ollama_available), "groq_sdk_installed": bool(llm_handler.Groq), "message": "" }
    http_status_code = 503
    try:
        model = faiss_handler.embedding_model
        if model is None: raise RuntimeError("Embedding model could not be initialized.")
        status_details["sentence_transformer_load"] = "OK"
        status_details["embedding_dimension"] = faiss_handler.get_embedding_dimension(model)
        if config.DEFAULT_INDEX_USER_ID in faiss_handler.loaded_indices: status_details["default_index_loaded"] = True
        else: status_details["default_index_loaded"] = False; status_details["message"] = "Default index is not loaded. It will be loaded on first use."
        if status_details["sentence_transformer_load"] == "OK": status_details["status"] = "ok"; status_details["message"] = "AI Core service is running. Embeddings OK."; http_status_code = 200
        else: http_status_code = 503
    except Exception as e:
        logger.error(f"--- Health Check Critical Error ---", exc_info=True)
        status_details["message"] = f"Health check failed critically: {str(e)}"
    return jsonify(status_details), http_status_code

@app.route('/add_document', methods=['POST'])
def add_document():
    # ... (code is unchanged) ...
    logger.info("\n--- Received request at /add_document ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)
    user_id = data.get('user_id'); file_path = data.get('file_path'); original_name = data.get('original_name')
    if not all([user_id, file_path, original_name]): return create_error_response("Missing required fields", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text = file_parser.parse_file(file_path)
        if not text or not text.strip(): return jsonify({"message": f"No text in '{original_name}'.", "status": "skipped"}), 200
        docs = file_parser.chunk_text(text, original_name, user_id)
        faiss_handler.add_documents_to_index(user_id, docs)
        return jsonify({"message": f"'{original_name}' added.", "chunks_added": len(docs), "status": "added"}), 200
    except Exception as e: return create_error_response(f"Failed to process '{original_name}': {e}", 500)

@app.route('/query_rag_documents', methods=['POST'])
def query_rag_documents_route():
    # ... (code is unchanged) ...
    logger.info("\n--- Received request at /query_rag_documents ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)
    user_id = data.get('user_id'); query_text = data.get('query'); k = data.get('k', 5)
    if not user_id or not query_text: return create_error_response("Missing user_id or query", 400)
    try:
        results = faiss_handler.query_index(user_id, query_text, k=k)
        formatted = [{"documentName": d.metadata.get("documentName"), "score": float(s), "content": d.page_content} for d, s in results]
        return jsonify({"relevantDocs": formatted, "status": "success"}), 200
    except Exception as e: return create_error_response(f"Failed to query index: {e}", 500)

@app.route('/analyze_document', methods=['POST'])
def analyze_document_route():
    logger.info("\n--- Received request at /analyze_document ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)

    # Standard fields
    user_id = data.get('user_id')
    document_name = data.get('document_name')
    analysis_type = data.get('analysis_type')
    file_path_for_analysis = data.get('file_path_for_analysis')
    llm_provider = data.get('llm_provider')
    llm_model_name = data.get('llm_model_name')
    
    # ==================================================================
    #  START OF MODIFICATION
    # ==================================================================
    # Capture the entire api_keys dictionary from the request
    api_keys = data.get('api_keys', {})
    ollama_host = data.get('ollama_host') or (api_keys.get('ollamaHost') if api_keys else None)

    logger.info(f"[DEBUG] Received ollama_host: {ollama_host}")
    logger.info(f"[DEBUG] Received api_keys: {api_keys}")
    # Normalize and inject user-defined Ollama host into the right key
    if ollama_host:
        api_keys['ollama_host'] = ollama_host.strip()
    logger.info(f"[DEBUG] Final api_keys after normalization: {api_keys}")

    # ==================================================================
    #  END OF MODIFICATION
    # ==================================================================

    if not all([user_id, document_name, analysis_type, file_path_for_analysis]):
         return create_error_response("Missing required fields", 400)
    if not os.path.exists(file_path_for_analysis):
        return create_error_response(f"Document not found at path: {file_path_for_analysis}", 404)

    try:
        document_text = file_parser.parse_file(file_path_for_analysis)
        
        if not document_text or not document_text.strip():
            logger.error(f"Failed to parse any text from document: {document_name} at path: {file_path_for_analysis}")
            return create_error_response("Could not parse text from the document. It may be empty, corrupted, or an unsupported format.", 400)
        
        logger.info(f"Successfully parsed {len(document_text)} characters from {document_name}. Sending to LLM for analysis.")

        # ==================================================================
        #  START OF MODIFICATION
        # ==================================================================
        logger.info(f"[DEBUG] Passing ollama_host to perform_document_analysis: {ollama_host}")
        # Pass the entire api_keys dictionary to the handler function
        analysis_result, thinking_content = llm_handler.perform_document_analysis(
            document_text=document_text, 
            analysis_type=analysis_type, 
            llm_provider=llm_provider,
            llm_model_name=llm_model_name, 
            api_keys=api_keys,  # Pass the whole dictionary
            ollama_host=ollama_host  # Pass the user-provided or blank host directly
        )
        # ==================================================================
        #  END OF MODIFICATION
        # ==================================================================

        if not analysis_result:
            logger.warning(f"LLM returned an empty result for analysis type '{analysis_type}' on document '{document_name}'. This might be due to content safety filters.")

        return jsonify({
            "document_name": document_name,
            "analysis_type": analysis_type,
            "analysis_result": analysis_result,
            "thinking_content": thinking_content,
            "status": "success"
        }), 200

    except Exception as e:
        return create_error_response(f"Failed to perform analysis: {str(e)}", 500)


@app.route('/generate_chat_response', methods=['POST'])
def generate_chat_response_route():
    logger.info("\n--- Received request at /generate_chat_response ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)

    # Standard fields
    user_id = data.get('user_id')
    current_user_query = data.get('query')
    chat_history = data.get('chat_history', [])
    system_prompt = data.get('system_prompt')
    llm_provider = data.get('llm_provider', config.DEFAULT_LLM_PROVIDER)
    llm_model_name = data.get('llm_model_name', None)
    perform_rag = data.get('perform_rag', True)
    enable_multi_query = data.get('enable_multi_query', True)

    api_keys_data = data.get('api_keys', {})
    user_gemini_api_key = api_keys_data.get('gemini')
    user_grok_api_key = api_keys_data.get('grok')
    
    ollama_host = data.get('ollama_host', None)
    active_file = data.get('active_file')  # ✅ New line

    if not user_id or not current_user_query:
        return create_error_response("Missing user_id or query in request", 400)

    context_text_for_llm = "No relevant context was found in the available documents."
    rag_references_for_client = []

    if perform_rag:
        # RAG logic is unchanged
        queries_to_search = [current_user_query]
        if enable_multi_query:
            try:
                sub_queries = llm_handler.generate_sub_queries_via_llm(original_query=current_user_query, llm_provider=llm_provider, llm_model_name=llm_model_name, user_gemini_api_key=user_gemini_api_key, user_grok_api_key=user_grok_api_key)
                if sub_queries:
                    queries_to_search.extend(sub_queries)
            except Exception as e: logger.error(f"Error during sub-query generation: {e}", exc_info=True)
        unique_chunks = set()
        docs_for_context = []
        for q in queries_to_search:
            results = faiss_handler.query_index(
                user_id,
                q,
                k=config.DEFAULT_RAG_K_PER_SUBQUERY_CONFIG,
                active_file=active_file  # ✅ Filter results by selected file
            )
            for doc, score in results:
                if doc.page_content not in unique_chunks:
                    unique_chunks.add(doc.page_content)
                    docs_for_context.append((doc, score))
        if docs_for_context:
            context_parts = [f"[{i+1}] Source: {d.metadata.get('documentName')}\n{d.page_content}" for i, (d, s) in enumerate(docs_for_context)]
            context_text_for_llm = "\n\n---\n\n".join(context_parts)
            rag_references_for_client = [{"documentName": d.metadata.get("documentName"), "score": float(s)} for d, s in docs_for_context]

    try:
        logger.info(f"Calling LLM provider: {llm_provider} for user: {user_id}")

        final_answer, thinking_content = llm_handler.generate_response(
            llm_provider=llm_provider,
            query=current_user_query,
            context_text=context_text_for_llm,
            chat_history=chat_history,
            system_prompt=system_prompt,
            llm_model_name=llm_model_name,
            user_gemini_api_key=user_gemini_api_key,
            user_grok_api_key=user_grok_api_key,
            ollama_host=ollama_host
        )

        return jsonify({
            "llm_response": final_answer,
            "references": rag_references_for_client,
            "thinking_content": thinking_content,
            "status": "success"
        }), 200

    except ConnectionError as e: return create_error_response(str(e), 502)
    except Exception as e: return create_error_response(f"Failed to generate chat response: {str(e)}", 500)


if __name__ == '__main__':
    # Startup logic is unchanged
    try:
        faiss_handler.ensure_faiss_dir()
        faiss_handler.get_embedding_model()
        faiss_handler.load_or_create_index(config.DEFAULT_INDEX_USER_ID)
    except Exception as e:
        logger.critical(f"CRITICAL STARTUP FAILURE: {e}", exc_info=True)
        sys.exit(1)
    port = config.AI_CORE_SERVICE_PORT
    host = '0.0.0.0'
    logger.info(f"--- Starting AI Core Service (Flask App) on http://{host}:{port} ---")
    logger.info(f"Gemini SDK Installed: {bool(llm_handler.genai)}")
    logger.info(f"Groq SDK Installed: {bool(llm_handler.Groq)}")
    logger.info(f"Ollama Available: {llm_handler.ollama_available}")
    logger.info("---------------------------------------------")
    app.run(host=host, port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')