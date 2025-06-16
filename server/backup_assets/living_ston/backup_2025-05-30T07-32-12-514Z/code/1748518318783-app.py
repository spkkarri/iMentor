# app.py
from flask import Flask, request, jsonify, current_app
from qdrant_client import models # For filter conditions
import logging

import config # Import your config
from vector_db_service import VectorDBService, Document # Import your service

# Configure basic logging for Flask app as well
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# You might want to get Flask's own logger if you prefer its formatting/handlers
# logger = logging.getLogger('flask.app') # or current_app.logger once app is created

app = Flask(__name__)
app.logger.setLevel(logging.INFO) # Ensure Flask's logger also respects INFO level

# Initialize the service globally
try:
    vector_service = VectorDBService()
    vector_service.setup_collection() # Setup collection on startup
except Exception as e:
    app.logger.error(f"Failed to initialize VectorDBService: {e}", exc_info=True)
    vector_service = None
    # Consider exiting if the service is critical:
    # raise SystemExit(f"Failed to initialize VectorDBService: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    if vector_service and vector_service.client:
        try:
            vector_service.client.get_collection(collection_name=vector_service.collection_name)
            return jsonify({"status": "UP", "qdrant_collection": vector_service.collection_name}), 200
        except Exception as e:
            app.logger.warning(f"Health check degraded for Qdrant: {str(e)}")
            return jsonify({"status": "DEGRADED", "reason": f"Qdrant connection issue: {str(e)}"}), 503
    app.logger.error("Health check failed: VectorDBService not initialized.")
    return jsonify({"status": "DOWN", "reason": "VectorDBService not initialized"}), 500

@app.route('/upload-document', methods=['POST'])
def upload_document_endpoint(): # Renamed to avoid conflict if `upload_document` name is used elsewhere
    if not vector_service:
        app.logger.error("Upload attempt failed: Service not available.")
        return jsonify({"error": "Service not available"}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    # Expecting 'user_id' and 'document_name'
    required_keys = ['text', 'user_id', 'document_name']
    missing_keys = [key for key in required_keys if key not in data]
    if missing_keys:
        return jsonify({"error": f"Missing keys: {', '.join(missing_keys)}"}), 400

    try:
        count = vector_service.add_document(
            text=data['text'],
            user_id=data['user_id'],
            document_name=data['document_name']
            # No 'subject' passed here as it's removed from add_document signature
        )
        app.logger.info(f"Document '{data['document_name']}' uploaded, {count} chunks.")
        return jsonify({"message": f"{count} chunks inserted into Qdrant for document_name '{data['document_name']}'."}), 201
    except Exception as e:
        app.logger.error(f"Error uploading document '{data.get('document_name', 'N/A')}': {e}", exc_info=True)
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/search', methods=['POST'])
def search_documents_api():
    if not vector_service:
        app.logger.error("Search attempt failed: Service not available.")
        return jsonify({"error": "Service not available"}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    query = data.get('query')
    if not query:
        return jsonify({"error": "Missing 'query' in request body"}), 400

    k = data.get('k', config.DEFAULT_SEARCH_K)
    try:
        k = int(k)
    except ValueError:
        return jsonify({"error": "'k' must be an integer"}), 400

    filter_payload = data.get('filter')
    qdrant_filter = None
    if filter_payload and isinstance(filter_payload, dict):
        conditions = []
        # Keys here are direct payload keys, e.g., "user_id", "document_name"
        if "user_id" in filter_payload:
            conditions.append(
                models.FieldCondition(
                    key="user_id", # Direct payload key
                    match=models.MatchValue(value=filter_payload["user_id"])
                )
            )
        if "document_name" in filter_payload:
            conditions.append(
                models.FieldCondition(
                    key="document_name", # Direct payload key
                    match=models.MatchValue(value=filter_payload["document_name"])
                )
            )
        # If you ever add subject back to payload and want to filter by it:
        if "subject" in filter_payload:
             conditions.append(
                 models.FieldCondition(
                     key="subject", # Direct payload key
                     match=models.MatchValue(value=filter_payload["subject"])
                 )
             )

        if conditions:
            qdrant_filter = models.Filter(must=conditions)

    try:
        docs, formatted_context, docs_map = vector_service.search_documents(query, k, filter_conditions=qdrant_filter)
        return jsonify({
            "query": query,
            "applied_filter": filter_payload, # Show what filter was attempted
            "results_count": len(docs),
            "formatted_context": formatted_context,
            "retrieved_documents_map": docs_map,
            "retrieved_documents_list": [doc.to_dict() for doc in docs]
        })
    except Exception as e:
        app.logger.error(f"Error during search for query '{query}': {e}", exc_info=True)
        return jsonify({"error": f"Internal server error during search: {str(e)}"}), 500

if __name__ == '__main__':
    import atexit
    if vector_service:
        atexit.register(vector_service.close)
    app.run(debug=True, host='0.0.0.0', port=5000)