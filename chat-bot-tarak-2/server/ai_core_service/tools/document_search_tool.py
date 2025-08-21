# server/ai_core_service/tools/document_search_tool.py

import logging
# --- CORRECTED IMPORT ---
# The @tool decorator should now be imported from langchain_core
from langchain_core.tools import tool
from pydantic.v1 import BaseModel, Field

from .. import faiss_handler, config
from langchain_community.tools import DuckDuckGoSearchRun

logger = logging.getLogger(__name__)

web_search_tool = DuckDuckGoSearchRun()

def create_smart_search_tool_for_user(user_id: str):
    """
    Factory function that creates a customized smart_search tool for a specific user.
    """
    if not user_id:
        raise ValueError("user_id must be provided to create a user-specific search tool.")

    class SmartSearchInput(BaseModel):
        query: str = Field(description="The question or topic to search for.")

    # --- CORRECTED DECORATOR ---
    # The 'name' argument is removed. The tool's name is now automatically
    # taken from the function's name ("smart_search"). The 'args_schema'
    # argument is still valid and is the correct way to define the input.
    @tool(args_schema=SmartSearchInput)
    def smart_search(query: str) -> str:
        """
        Use this single tool to find information on any topic. It will first search a private knowledge base of documents for the current user. If no relevant information is found there, it will automatically perform a web search. This is the primary tool for answering any user question that requires looking up information.
        """
        logger.info(f"--- Smart Search Tool Called for user '{user_id}' with query: '{query}' ---")
        
        # --- Stage 1: Search User's Local Documents ---
        logger.info(f"--> Stage 1: Searching local documents for user '{user_id}'...")
        try:
            search_results = faiss_handler.query_index(
                user_id=user_id, 
                query_text=query, 
                k=config.DEFAULT_RAG_K_PER_SUBQUERY_CONFIG
            )

            if search_results:
                logger.info(f"--> Found {len(search_results)} relevant results in local documents for user '{user_id}'.")
                context_str = "Found the following relevant information from the user's private documents:\n\n"
                for doc, score in search_results:
                    source = doc.metadata.get("documentName", "Unknown Source")
                    content_preview = doc.page_content.strip()
                    context_str += f"--- Source: {source} (Relevance Score: {score:.4f}) ---\n"
                    context_str += f"{content_preview}\n\n"
                return context_str
            else:
                logger.info(f"--> No relevant information found in local documents for user '{user_id}'.")

        except Exception as e:
            logger.error(f"Error during local document search for user '{user_id}': {e}. Proceeding to web search.")

        # --- Stage 2: Fallback to Web Search ---
        logger.info("--> Stage 2: Performing web search fallback...")
        try:
            web_result = web_search_tool.run(query)
            return f"No information was found in private documents. According to a web search:\n\n{web_result}"
        except Exception as e:
            logger.error(f"Error during web search fallback: {e}")
            return "An error occurred while attempting to search the web."

    return smart_search

smart_search = create_smart_search_tool_for_user(user_id="default_system_user")