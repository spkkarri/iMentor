# FusedChatbot/server/ai_core_service/tools/web_search.py

# --- Merged Imports ---
import requests
import json
import logging
import time
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin

# Imports for Smart Search functionality
from duckduckgo_search import DDGS
from newspaper import Article, ArticleException

# Import for the 'smart search' LLM triage
try:
    from .. import llm_handler
except ImportError:
    # This block allows the script to be run directly for testing if needed
    import sys
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    import llm_handler

logger = logging.getLogger(__name__)


# ==============================================================================
# SECTION 1: MCP Client for Report Generation and Basic Search
# This section contains the client to interact with the external MCP service,
# primarily used for generating detailed PDF/Markdown reports.
# ==============================================================================

class MCPRagWebBrowserClient:
    """
    Client for interacting with the MCP RAG Web Browser server.
    This client handles tasks delegated to the microservice, like report
    generation and its own search implementation.
    """

    def __init__(self, base_url: str = "http://localhost:3002", timeout: int = 60):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()

    def health_check(self) -> bool:
        """Checks if the MCP server is healthy and responsive."""
        try:
            response = self.session.get(urljoin(self.base_url, '/health'), timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"MCP Health check failed: {e}")
            return False

    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Gets information about the available endpoints on the MCP server."""
        try:
            response = self.session.get(urljoin(self.base_url, '/info'), timeout=self.timeout)
            response.raise_for_status()
            return response.json().get('endpoints', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get MCP tools/info: {e}")
            return []

    def web_search(self, query: str, max_results: int = 10) -> Optional[Dict[str, Any]]:
        """Calls the /search endpoint on the MCP server."""
        try:
            payload = {'query': query, 'count': max_results}
            response = self.session.post(
                urljoin(self.base_url, '/search'),
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"MCP search request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"An unexpected error occurred during MCP search: {e}")
            return None

    def search_with_fallback(self, query: str, max_results: int = 1, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Wrapper for MCP's web_search with retry logic. The MCP server
        handles its own scraping logic.
        """
        for attempt in range(max_retries):
            try:
                logger.info(f"MCP Search attempt {attempt + 1}/{max_retries} for query: {query}")
                result = self.web_search(query=query, max_results=max_results)
                if result and result.get('results'):
                    logger.info(f"MCP Search successful on attempt {attempt + 1}")
                    return result
                else:
                    logger.warning(f"MCP Search attempt {attempt+1} returned no results.")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
            except Exception as e:
                logger.error(f"MCP Search attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
        logger.error(f"All MCP search attempts failed for query: {query}")
        return None

    def generate_report(self, topic: str, api_keys: dict, preview: bool = False) -> Optional[Any]:
        """
        Generates a full report or preview by calling the MCP server's /generate-report endpoint.
        Returns the raw bytes of the PDF file if preview=False,
        or the Markdown string if preview=True.
        """
        try:
            logger.info(f"Requesting report generation from MCP for topic: '{topic}', preview={preview}")
            payload = {'topic': topic, 'api_keys': api_keys, 'preview': preview}
            response = self.session.post(
                urljoin(self.base_url, '/generate-report'),
                json=payload,
                timeout=180  # 3 minutes, as this is a long task
            )
            response.raise_for_status()

            if preview:
                # Return Markdown string for preview
                return response.json().get('markdown')
            else:
                # Verify that the response is actually a PDF before returning it.
                content_type = response.headers.get('Content-Type', '').lower()
                if 'application/pdf' not in content_type:
                    error_content = response.text  # Read as text for logging
                    logger.error(
                        f"MCP server returned incorrect content type: '{content_type}'. "
                        f"Expected 'application/pdf'. Response body: {error_content[:500]}"
                    )
                    return None

                pdf_content = response.content
                if not pdf_content:
                    logger.error("MCP server returned an empty PDF response.")
                    return None
                return pdf_content

        except requests.exceptions.RequestException as e:
            logger.error(f"Report generation request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"An unexpected error occurred during report generation: {e}")
            return None

# --- Global MCP client instance and helpers ---
mcp_client: Optional[MCPRagWebBrowserClient] = None

def get_mcp_client() -> MCPRagWebBrowserClient:
    """Gets a singleton instance of the MCPRagWebBrowserClient."""
    global mcp_client
    if mcp_client is None:
        mcp_client = MCPRagWebBrowserClient()
    return mcp_client

def is_mcp_available() -> bool:
    """Checks if the MCP service is available and healthy."""
    try:
        client = get_mcp_client()
        return client.health_check()
    except Exception as e:
        logger.error(f"MCP availability check failed: {e}")
        return False


# ==============================================================================
# SECTION 2: Intelligent Agent Search
# This section contains the "smart search" functionality for the agent to use
# when it needs to solve a query by searching and reading web pages itself.
# It uses an LLM to triage results before scraping.
# ==============================================================================

def _fetch_and_parse_url(url: str) -> str:
    """
    Fetches content from a URL and parses it to get clean text.
    """
    try:
        article = Article(url)
        article.download()
        article.parse()
        return article.text
    except ArticleException as e:
        logger.warning(f"Could not process article at {url}: {e}")
        return ""
    except Exception as e:
        logger.error(f"An unexpected error occurred while fetching {url}: {e}", exc_info=True)
        return ""

def perform_search(query: str, api_keys: dict, max_urls_to_scrape: int = 4) -> str:
    """
    Performs an intelligent, multi-step web search to improve result quality.
    This is intended for direct use by an intelligent agent.

    Args:
        query (str): The search query.
        api_keys (dict): API keys for LLM providers (requires a fast LLM like 'groq').
        max_urls_to_scrape (int): The final number of URLs to scrape after LLM triage.

    Returns:
        str: A formatted string of search results, or an empty string if it fails.
    """
    logger.info(f"Performing LLM-powered smart search for query: '{query}'")
    try:
        # Step 1: Broad Search
        num_initial_results = 10
        logger.info(f"Fetching top {num_initial_results} results from DuckDuckGo...")
        with DDGS() as ddgs:
            search_results = list(ddgs.text(query, max_results=num_initial_results))

        if not search_results:
            logger.info("DuckDuckGo search returned no results.")
            return ""

        # Step 2: Prepare for Triage
        search_results_text = ""
        url_map = {}
        for i, result in enumerate(search_results):
            url, title, snippet = result.get('href'), result.get('title'), result.get('body')
            if url and title and snippet:
                search_results_text += f"Result {i+1}:\nURL: {url}\nTitle: {title}\nSnippet: {snippet}\n---\n"
                url_map[url] = result

        if not search_results_text:
            logger.warning("No valid results from DDGS to pass to LLM for triage.")
            return ""

        # Step 3: LLM-Powered Triage
        logger.info("Using Groq LLM to select the most relevant URLs for scraping...")
        try:
            triage_prompt = llm_handler._URL_SELECTION_PROMPT_TEMPLATE.format(
                num_to_select=max_urls_to_scrape,
                topic=query,
                search_results_text=search_results_text
            )
            handler = llm_handler.get_handler(provider_name="groq", api_keys=api_keys, model_name="llama3-8b-8192")
            raw_response = handler.generate_response(triage_prompt, is_chat=False)
            selected_urls = [url.strip() for url in raw_response.strip().split('\n') if url.strip().startswith('http')]

            if not selected_urls:
                raise ValueError("LLM triage did not return any valid URLs.")
            logger.info(f"LLM selected {len(selected_urls)} URLs for scraping: {selected_urls}")
        except Exception as llm_e:
            logger.error(f"LLM triage failed: {llm_e}. Aborting smart search.", exc_info=True)
            return ""

        # Step 4: Targeted Scraping
        logger.info("Performing targeted scraping of LLM-selected URLs...")
        formatted_results = []
        for i, url in enumerate(selected_urls):
            if url in url_map:
                logger.info(f"Scraping content from URL ({i+1}/{len(selected_urls)}): {url}")
                content = _fetch_and_parse_url(url)
                if content:
                    # Provide a larger chunk of content for the agent to reason with
                    formatted_results.append(f"[{i+1}] Source: {url}\nContent: {content[:2500]}...")

        if not formatted_results:
            logger.warning("Web search found and triaged URLs but failed to scrape any content.")
            return ""

        # Step 5: Consolidation & Return
        return "\n\n---\n\n".join(formatted_results)

    except Exception as e:
        logger.error(f"An unexpected error occurred during the smart search process: {e}", exc_info=True)
        return ""