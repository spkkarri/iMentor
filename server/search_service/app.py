# server/search_service/app.py
from flask import Flask, request, jsonify
from duckduckgo_search import DDGS
from waitress import serve
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='[SearchService] %(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

@app.route('/search', methods=['POST'])
def search():
    """
    Receives a POST request with a JSON body like {"query": "some text"},
    searches DuckDuckGo, and returns the results.
    """
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'Request body must be JSON with a "query" key'}), 400

        query = data['query']
        logging.info(f"Received search request for query: '{query}'")

        # Perform DuckDuckGo search using the context manager
        with DDGS() as ddgs:
            # ddgs.text() returns a generator, so we convert it to a list
            search_results = list(ddgs.text(query, max_results=10))

        logging.info(f"Found {len(search_results)} results from DuckDuckGo.")
        # Return the results wrapped in a 'results' key for clear structure
        return jsonify({'results': search_results}), 200

    except Exception as e:
        logging.error(f"An error occurred during search: {str(e)}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred'}), 500

if __name__ == '__main__':
    port = 5003
    logging.info(f"--- Starting Python Search Service with duckduckgo-search ---")
    logging.info(f"Listening on: http://0.0.0.0:{port}")
    serve(app, host='0.0.0.0', port=port)