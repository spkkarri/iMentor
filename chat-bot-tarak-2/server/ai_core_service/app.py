# FusedChatbot/server/ai_core_service/app.py

import os
import sys
import logging
import uuid # <-- Ensures uuid is imported for generating unique IDs
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv # <-- MODIFICATION: Add this import
import redis
import hashlib
import json
from datetime import datetime

# --- MODIFICATION: Add this block to explicitly load the .env file ---
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    print(f"INFO: Loading environment variables from {dotenv_path}")
    load_dotenv(dotenv_path=dotenv_path)


# <<< MERGED LOGIC: All necessary imports from both branches >>>
try:
    # Added podcast_service and ppt_service to the imports
    from . import config, file_parser, faiss_handler, llm_handler, llm_router, agent, podcast_service, ppt_service
    # Import the web_search module and alias it to avoid name conflicts with the agent tool
    from .tools import web_search as web_search_module
    from .tools.document_search_tool import smart_search
    from .tools.web_search_tool import web_search
    from .tools.quiz_generator_tool import quiz_generator_tool
    from .kg_service import KnowledgeGraphService
except ImportError:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path: sys.path.insert(0, parent_dir)
    # Added podcast_service and ppt_service to the imports
    import config, file_parser, faiss_handler, llm_handler, llm_router, agent, podcast_service, ppt_service
    from tools import web_search as web_search_module
    from tools.document_search_tool import smart_search
    from tools.web_search_tool import web_search
    from tools.quiz_generator_tool import quiz_generator_tool
    from kg_service import KnowledgeGraphService

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

try:
    redis_client = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=int(os.getenv('REDIS_PORT', 6379)), db=0, decode_responses=True)
    redis_client.ping()
    logger.info("Successfully connected to Redis. Caching is enabled.")
except redis.exceptions.ConnectionError as e:
    logger.error(f"Could not connect to Redis: {e}. Caching will be DISABLED.")
    redis_client = None

kg_service = KnowledgeGraphService()

# This is the correct, original function definition
def create_error_response(message, status_code=500):
    import traceback
    tb = traceback.format_exc()
    logger.error(f"API Error Response ({status_code}): {message}\n{tb}")
    return jsonify({"error": message, "status": "error"}), status_code

def extract_final_answer(agent_response: dict) -> str:
    logging.info(f"Extracting final answer from agent response object: {agent_response}")
    if 'output' in agent_response and agent_response['output']:
        logging.info("Found final answer in 'output' key.")
        return agent_response['output']
    if 'intermediate_steps' in agent_response and agent_response['intermediate_steps']:
        try:
            last_action, last_observation = agent_response['intermediate_steps'][-1]
            logging.info("Falling back to the last observation from intermediate steps.")
            return str(last_observation)
        except Exception: pass
    logging.warning("Could not determine a definitive final answer from the agent's response.")
    return "Agent process completed, but the final output could not be parsed."


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

# ROUTE 1: FOR FILE UPLOADS (multipart/form-data)
@app.route('/podcast/generate/file', methods=['POST'])
def podcast_generate_file_route():
    logger.info("\n--- Received request at /podcast/generate/file ---")
    try:
        file_data = request.files.get('file')
        title = request.form.get('title', 'AI Generated Podcast')
        
        # Retrieve and parse the api_keys from the form data
        api_keys_str = request.form.get('api_keys', '{}')
        api_keys = json.loads(api_keys_str)

        if not file_data:
            return create_error_response("No 'file' part in the form-data request.", 400)

        temp_dir = os.path.join(config.UPLOAD_DIR, 'temp_uploads')
        os.makedirs(temp_dir, exist_ok=True)
        file_path = os.path.join(temp_dir, file_data.filename)
        file_data.save(file_path)
        text_content = file_parser.extract_text_from_input(input_data=file_path, input_type='file', temp_file_path=file_path)
        if file_path and os.path.exists(file_path): os.remove(file_path)

        if not text_content or not text_content.strip():
            return create_error_response("Could not extract any text from the uploaded file.", 400)

        podcast_id = str(uuid.uuid4())
        
        # Pass the api_keys to the service function
        audio_file_path = podcast_service.create_podcast_from_text(
            text=text_content, 
            podcast_id=podcast_id, 
            title=title,
            api_keys=api_keys
        )
        
        audio_url = os.path.join('podcasts', os.path.basename(audio_file_path))
        return jsonify({"status": "success", "podcastId": podcast_id, "audioUrl": audio_url}), 200
    except Exception as e:
        return create_error_response(f"Failed to generate podcast: {e}", 500)

# ROUTE 2: FOR JSON (text/url)
@app.route('/podcast/generate/json', methods=['POST'])
def podcast_generate_json_route():
    logger.info("\n--- Received request at /podcast/generate/json ---")
    try:
        data = request.get_json()
        input_type = data.get('inputType')
        input_data = data.get('inputData')
        title = data.get('title', 'AI Generated Podcast')
        
        # Retrieve api_keys from the JSON body
        api_keys = data.get('api_keys', {})

        if not all([input_type, input_data]):
            return create_error_response("Missing 'inputType' or 'inputData'.", 400)
        
        text_content = file_parser.extract_text_from_input(input_data=input_data, input_type=input_type)

        if not text_content or not text_content.strip():
            return create_error_response("Could not extract any text from the provided input.", 400)
        
        podcast_id = str(uuid.uuid4())
        
        # Pass the api_keys to the service function
        audio_file_path = podcast_service.create_podcast_from_text(
            text=text_content, 
            podcast_id=podcast_id, 
            title=title,
            api_keys=api_keys
        )
        
        audio_url = os.path.join('podcasts', os.path.basename(audio_file_path))
        return jsonify({"status": "success", "podcastId": podcast_id, "audioUrl": audio_url}), 200
    except Exception as e:
        return create_error_response(f"Failed to generate podcast: {e}", 500)

# The ASK route handles Q&A for generated podcasts
@app.route('/podcast/ask', methods=['POST'])
def podcast_ask_route():
    logger.info("\n--- Received request at /podcast/ask ---")
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)
        
    data = request.get_json()
    podcast_id = data.get('podcastId')
    question = data.get('question')
    api_keys = data.get('api_keys', {}) # API keys passed from Node.js

    if not all([podcast_id, question]):
        return create_error_response("Missing 'podcastId' or 'question'.", 400)

    try:
        # Call the main Q&A service function
        answer = podcast_service.answer_podcast_question(
            podcast_id=podcast_id,
            question=question,
            api_keys=api_keys
        )
        
        return jsonify({
            "status": "success",
            "answer": answer
        }), 200

    except Exception as e:
        return create_error_response(f"Failed to get answer: {e}", 500)

@app.route('/add_document', methods=['POST'])
def add_document():
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    user_id, file_path, document_name = data.get('user_id'), data.get('file_path'), data.get('document_name')
    if not all([user_id, file_path, document_name]): return create_error_response("Missing required fields: user_id, file_path, document_name", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text = file_parser.parse_file(file_path)
        if not text or not text.strip(): return jsonify({"message": f"No text content in '{document_name}'.", "status": "skipped"}), 200
        
        logger.info(f"Extracting entities from '{document_name}' for KG ingestion.")
        kg_data = kg_service.extract_entities_and_relations(text)
        if kg_data["entities"]:
            kg_service.add_to_kg(kg_data["entities"])
            logger.info(f"Ingested {len(kg_data['entities'])} entities from '{document_name}' into the KG.")
        
        docs = file_parser.chunk_text(text, document_name, user_id)
        faiss_handler.add_documents_to_index(user_id, docs)
        return jsonify({"message": f"'{document_name}' processed successfully.", "chunks_added": len(docs), "status": "added"}), 200
    except Exception as e:
        return create_error_response(f"Failed to process '{document_name}': {e}", 500)

@app.route('/analyze_document', methods=['POST'])
def analyze_document_route():
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if not all(field in data for field in ['file_path_for_analysis', 'analysis_type', 'llm_provider']):
        return create_error_response("Missing required fields", 400)
    if data['analysis_type'] not in ['faq', 'topics', 'mindmap', 'mcq', 'flashcards']:
        return create_error_response(f"Invalid analysis_type: {data['analysis_type']}", 400)
    try:
        document_text = file_parser.parse_file(data['file_path_for_analysis'])
        if not document_text or not document_text.strip():
            return create_error_response("Could not parse text from the document.", 400)
        
        analysis_result, thinking_content = llm_handler.perform_document_analysis(
            document_text=document_text, analysis_type=data['analysis_type'], llm_provider=data['llm_provider'],
            api_keys=data.get('api_keys', {}), model_name=data.get('llm_model_name'), ollama_host=data.get('ollama_host')
        )
        return jsonify({"analysis_result": analysis_result, "thinking_content": thinking_content, "status": "success"}), 200
    except (ValueError, ConnectionError) as e:
        return create_error_response(str(e), 400)
    except Exception as e:
        return create_error_response(f"Failed to perform analysis: {str(e)}", 500)


@app.route('/generate_report', methods=['POST'])
def generate_report_route():
    data = request.get_json()
    topic = data.get('topic')
    api_keys = data.get('apiKeys', {})
    preview = data.get('preview', False)

    if not topic:
        return create_error_response("Missing 'topic' field.", 400)

    try:
        mcp_client = web_search_module.get_mcp_client()
        
        if preview:
            report_content = mcp_client.generate_report(topic=topic, api_keys=api_keys, preview=True)
            if not report_content:
                logger.error("MCP server failed to generate the preview report.")
                return create_error_response("Could not generate a preview report for the topic.", 502)
            logger.info(f"Successfully received preview report for topic: '{topic}'.")
            return jsonify({"preview": True, "markdown": report_content})
        else:
            pdf_data = mcp_client.generate_report(topic=topic, api_keys=api_keys, preview=False)
            if not pdf_data:
                logger.error("MCP server failed to generate the PDF report.")
                return create_error_response("Could not generate a report for the topic.", 502)
            logger.info(f"Successfully received PDF data for topic: '{topic}'.")
            return Response(
                pdf_data,
                mimetype='application/pdf',
                headers={'Content-Disposition': f'attachment;filename={topic.replace(" ", "_")}_report.pdf'}
            )
    except Exception as e:
        logger.error(f"An unexpected error occurred during report generation: {e}", exc_info=True)
        return create_error_response(f"An internal error occurred: {e}", 500)

# In app.py, replace the whole function with this one.
@app.route('/generate-ppt', methods=['POST'])
def generate_ppt_route():
    logger.info("\n--- Received request at /generate-ppt ---")
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)
    
    data = request.get_json()
    topic = data.get('topic')
    context = data.get('context', '')  # Context is optional
    api_keys = data.get('api_keys', {})

    if not topic:
        return create_error_response("Missing 'topic' in request body", 400)

    try:
        # Step 1: Generate the structured content using the LLM handler
        logger.info("Calling LLM handler to generate PPT content...")
        ppt_structured_content = llm_handler.generate_ppt_content(
            topic=topic,
            context=context,
            api_keys=api_keys
        )

        # Step 2: Create the .pptx file using the ppt_service
        logger.info("Calling PPT service to create the .pptx file...")
        generated_filename = ppt_service.create_presentation(ppt_structured_content)

        logger.info(f"Successfully generated presentation: {generated_filename}")
        
        # THIS IS THE CORRECT RETURN STATEMENT IN THE CORRECT LOCATION
        return jsonify({
            "status": "success",
            "fileId": generated_filename,
            "content": ppt_structured_content # Include the content for the preview
        }), 200

    except ConnectionError as e:
        # This catches the specific error from llm_handler if all providers fail
        return create_error_response(str(e), 503) # 503 Service Unavailable is appropriate
    except Exception as e:
        # General catch-all for other unexpected errors
        return create_error_response(f"An internal error occurred during presentation generation: {e}", 500)

@app.route('/chat/refine-prompt', methods=['POST'])
def refine_prompt_route():
    logger.info("\n--- Received request at /chat/refine-prompt ---")
    if not request.is_json:
        return create_error_response("Request must be JSON", 400)
    
    data = request.get_json()
    raw_prompt = data.get('raw_prompt')
    api_keys = data.get('api_keys', {})

    if not raw_prompt:
        return create_error_response("Missing 'raw_prompt' in request body", 400)

    try:
        refined_prompt = llm_handler.refine_user_prompt(
            raw_query=raw_prompt,
            api_keys=api_keys
        )
        
        if not refined_prompt or refined_prompt == raw_prompt:
            logger.warning("Prompt refinement failed or returned the original prompt.")
            return jsonify({
                "status": "success_no_change",
                "refined_prompt": raw_prompt
            })

        logger.info(f"Successfully refined prompt: '{raw_prompt}' -> '{refined_prompt}'")
        return jsonify({
            "status": "success",
            "refined_prompt": refined_prompt
        })

    except Exception as e:
        logger.error(f"An error occurred during prompt refinement: {e}", exc_info=True)
        return create_error_response(f"An internal error occurred during prompt refinement: {e}", 500)

@app.route('/generate_chat_response', methods=['POST'])
def generate_chat_response_route():
    logger.info("\n--- Received request at /generate_chat_response ---")
    data = request.get_json()
    
    user_id = data.get('user_id')
    current_user_query = data.get('query')
    active_file = data.get('active_file')
    session_id = data.get('session_id', 'default_session')

    sanitized_active_file = os.path.basename(active_file) if active_file else None

    if not user_id or not current_user_query:
        return create_error_response("Missing user_id or query in request", 400)

    routing_decision = llm_router.route_query(current_user_query, data.get('llm_provider', config.DEFAULT_LLM_PROVIDER), data.get('llm_model_name'))
    final_provider = routing_decision['provider']
    final_model = routing_decision['model']
    logger.info(f"Router decision: Provider='{final_provider}', Model='{final_model}'")
    
    original_system_prompt = data.get('system_prompt', 'You are a helpful AI assistant.')
    history_summary = data.get('user_history_summary', '')
    kg_facts_str = ""
    if os.getenv('ENABLE_KG_SERVICE', 'false').lower() == 'true':
        kg_facts = kg_service.query_kg(current_user_query).get("results", [])
        if kg_facts:
            kg_facts_str = "\n".join(f"- {fact}" for fact in kg_facts)
    
    final_system_prompt = llm_handler.build_system_prompt(
        original_prompt=original_system_prompt,
        history_summary=history_summary,
        kg_facts=kg_facts_str
    )

    handler_kwargs = {
        'api_keys': data.get('api_keys', {}), 'model_name': final_model,
        'chat_history': data.get('chat_history', []), 'system_prompt': final_system_prompt,
        'ollama_host': data.get('ollama_host')
    }

    context_text_for_llm = ""
    rag_references_for_client = []
    context_source = "None"

    if data.get('perform_rag', True):
        logger.info("Attempting RAG search on local documents...")
        queries_to_search = [current_user_query]
        if data.get('enable_multi_query', True):
            try:
                sub_queries = llm_handler.generate_sub_queries(original_query=current_user_query, llm_provider=final_provider, **handler_kwargs)
                if sub_queries: queries_to_search.extend(sub_queries)
            except Exception as e:
                logger.warning(f"Sub-query generation failed: {e}. Proceeding with original query.")
        
        all_results = []
        unique_content = set()
        for q in queries_to_search:
            results = faiss_handler.query_index(user_id, q, k=config.DEFAULT_RAG_K_PER_SUBQUERY_CONFIG, active_file=sanitized_active_file)
            for doc, score in results:
                if doc.page_content not in unique_content:
                    unique_content.add(doc.page_content)
                    all_results.append((doc, score))
        
        if all_results:
            temp_context = "\n\n".join([doc.page_content for doc, score in all_results])
            is_relevant = llm_handler.check_context_relevance(current_user_query, temp_context, **handler_kwargs)
            if is_relevant:
                logger.info(f"Found {len(all_results)} RELEVANT document chunks. Using them for context.")
                context_parts = [f"[{i+1}] Source: {d.metadata.get('documentName')}\n{d.page_content}" for i, (d, s) in enumerate(all_results)]
                context_text_for_llm = "\n\n---\n\n".join(context_parts)
                rag_references_for_client = [{"documentName": d.metadata.get("documentName"), "score": float(s)} for d, s in all_results]
                context_source = "Local Documents"
            else:
                logger.info("Local documents found, but deemed NOT RELEVANT to the query.")
        else:
            logger.info("No local documents found for this query.")
    
        if not context_text_for_llm:
            logger.info("RAG context is empty. Attempting web search fallback...")
            try:
                web_context = web_search_module.perform_search(query=current_user_query, api_keys=data.get('api_keys', {}))
                if web_context:
                    logger.info("Web search successful. Using web results for context.")
                    context_text_for_llm = web_context
                    context_source = "Web Search"
                else:
                    logger.info("Web search did not find any relevant context.")
            except Exception as e:
                logger.error(f"Web search failed: {e}", exc_info=True)
    
    if context_text_for_llm:
        logger.info(f"Generating response using context from: {context_source}")
        final_answer, thinking_content = llm_handler.generate_response(
            llm_provider=final_provider, query=current_user_query, context_text=context_text_for_llm, **handler_kwargs
        )
    else:
        logger.info("No RAG/Web context. Generating conversational response with KG/History context.")
        final_answer, thinking_content = llm_handler.generate_chat_response(
            llm_provider=final_provider, query=current_user_query, **handler_kwargs
        )

    if active_file and context_source not in ["Local Documents", "Web Search"] and not final_answer:
         final_answer = "[No content found for the selected PDF. Please check if the file was indexed correctly or try re-uploading.]"

    return jsonify({
        "llm_response": final_answer, "references": rag_references_for_client,
        "thinking_content": thinking_content, "status": "success",
        "provider_used": final_provider, "model_used": final_model,
        "context_source": context_source
    }), 200


@app.route('/generate_chat_response_stream', methods=['POST'])
def generate_chat_response_stream_route():
    logger.info("\n--- Received request at /generate_chat_response_stream ---")
    data = request.get_json()
    user_id = data.get('user_id')
    current_user_query = data.get('query')
    if not user_id or not current_user_query:
        logger.error("Streaming request missing user_id or query.")
        return Response("Error: Missing user_id or query in request.", status=400)

    routing_decision = llm_router.route_query(
        current_user_query,
        data.get('llm_provider', config.DEFAULT_LLM_PROVIDER),
        data.get('llm_model_name')
    )
    final_provider = routing_decision['provider']
    final_model = routing_decision['model']
    logger.info(f"Streaming with: Provider='{final_provider}', Model='{final_model}'")

    handler_kwargs = {
        'api_keys': data.get('api_keys', {}),
        'model_name': final_model,
        'chat_history': data.get('chat_history', []),
        'system_prompt': data.get('system_prompt', 'You are a helpful AI assistant.'),
        'ollama_host': data.get('ollama_host')
    }

    def stream_response_generator():
        try:
            for chunk in llm_handler.generate_chat_response_stream(
                llm_provider=final_provider,
                query=current_user_query,
                **handler_kwargs
            ):
                if chunk:
                    yield chunk
        except Exception as e:
            logger.error(f"!!! EXCEPTION DURING STREAMING: {e}", exc_info=True)
            yield "Sorry, an error occurred during the response generation."

    return Response(stream_with_context(stream_response_generator()), mimetype='text/plain')


@app.route('/agent/invoke', methods=['POST'])
def agent_invoke_route():
    logger.info("\n--- Received request at /agent/invoke ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    
    data = request.get_json()
    user_id = data.get('user_id')
    query = data.get('query')
    api_keys = data.get('api_keys', {})
    ollama_host = data.get('ollama_host') # Get the user's custom Ollama host

    if not all([user_id, query]):
        return create_error_response("Missing required fields: user_id, query", 400)

    try:
        # --- THIS IS THE PRIMARY MODIFICATION ---
        # Instead of manually getting an LLM, we now call our new robust function.
        # It will intelligently select Gemini, Groq, or Ollama based on available keys.
        agent_executor = agent.create_agent_with_fallback(
            user_id=user_id,
            api_keys=api_keys,
            ollama_host=ollama_host
        )
        # --- END OF PRIMARY MODIFICATION ---
        
        logger.info(f"Invoking agent for user '{user_id}' with query: '{query}'")
        response = agent_executor.invoke({"input": query})
        
        final_answer = extract_final_answer(response)
        
        agent_trace = ""
        if 'intermediate_steps' in response and response['intermediate_steps']:
            steps_trace = []
            for action, observation in response['intermediate_steps']:
                tool_name = action.tool
                tool_input = str(action.tool_input) # Ensure tool_input is a string for logging
                observation_preview = (str(observation)[:250] + '...') if len(str(observation)) > 250 else str(observation)
                steps_trace.append(
                    f"1. Thought: The agent decided to use the '{tool_name}' tool.\n"
                    f"2. Action: Called '{tool_name}' with input: {tool_input}\n"
                    f"3. Observation: Received result: \"{observation_preview}\""
                )
            agent_trace = "\n---\n".join(steps_trace)

        logger.info(f"Agent finished. Returning final answer and trace.")
        return jsonify({
            "status": "success",
            "agent_response": final_answer,
            "agent_trace": agent_trace
        })
    
    # Catch the specific error if no LLMs can be initialized
    except ConnectionError as e:
        return create_error_response(str(e), 503) # 503 Service Unavailable
    except Exception as e:
        return create_error_response(f"An internal error occurred in the agent service: {e}", 500)

@app.route('/kg/extract', methods=['POST'])
def kg_extract():
    data = request.json
    text = data.get('text', '')
    if not text:
        return create_error_response('No text provided for KG extraction.', 400)
    result = kg_service.extract_entities_and_relations(text)
    return jsonify(result)

@app.route('/kg/query', methods=['POST'])
def kg_query():
    data = request.json
    query = data.get('query', '')
    if not query:
        return create_error_response('No query provided for KG search.', 400)
    result = kg_service.query_kg(query)
    return jsonify(result)


if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        faiss_handler.get_embedding_model()
        faiss_handler.load_or_create_index(config.DEFAULT_INDEX_USER_ID)
    except Exception as e:
        logger.critical(f"CRITICAL STARTUP FAILURE: {e}", exc_info=True)
        sys.exit(1)

    port = int(os.getenv("AI_CORE_SERVICE_PORT", 9000))
    host = '0.0.0.0'
    logger.info(f"--- Starting AI Core Service (Flask App) on http://{host}:{port} ---")
    logger.info("--- Checking Availability of LLM Providers ---")
    for provider, is_available in llm_handler.AVAILABLE_PROVIDERS.items():
        status = "Available" if is_available else "Not Available (SDK not installed)"
        logger.info(f"  -> Provider '{provider}': {status}")
    logger.info("---------------------------------------------")
    logger.info(f"Redis Connected: {redis_client is not None}")
    logger.info(f"MCP Web Browser Service Available: {web_search_module.is_mcp_available()}")
    logger.info("---------------------------------------------")
    app.run(host=host, port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')