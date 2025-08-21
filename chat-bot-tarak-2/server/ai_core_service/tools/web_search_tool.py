# server/ai_core_service/tools/web_search_tool.py
import logging
import requests
from bs4 import BeautifulSoup
from langchain.tools import BaseTool
from typing import Type
from pydantic.v1 import BaseModel, Field
from duckduckgo_search import DDGS

# Configure a logger for this tool
logger = logging.getLogger(__name__)

class WebSearchInput(BaseModel):
    query: str = Field(description="The search query string.")

class AdvancedWebSearchTool(BaseTool):
    """An advanced web search tool that finds relevant URLs and then scrapes their content."""
    name: str = "web_search"
    description: str = (
        "Use this to find in-depth, up-to-date information on any topic. "
        "It finds the best web pages and returns their full content."
    )
    args_schema: Type[BaseModel] = WebSearchInput

    def _scrape_page(self, url: str) -> str:
        """Scrapes the main text content from a single URL."""
        try:
            headers = {'User-Agent': 'Mozilla/5.0'}
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status() # Raise an exception for bad status codes
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the main content area (often in <article> or <main> tags)
            main_content = soup.find('main') or soup.find('article') or soup.body
            
            # Remove script and style elements
            for script_or_style in main_content(['script', 'style']):
                script_or_style.decompose()

            # Get text and clean it up
            text = main_content.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return text[:4000] # Return the first 4000 characters to keep it manageable
        except Exception as e:
            logger.error(f"Error scraping URL {url}: {e}")
            return f"Could not scrape content from {url}."

    def _run(self, query: str) -> str:
        """Use the tool."""
        logging.info(f"--- AdvancedWebSearchTool called with query: '{query}' ---")
        full_content = []
        try:
            with DDGS(headers={'User-Agent': 'Mozilla/5.0'}, timeout=20) as ddgs:
                # 1. First, find the most relevant URLs
                search_results = [r for r in ddgs.text(query, max_results=3)]
                
                if not search_results:
                    return "No web search results found for that query."

                # 2. Then, scrape the content of the top 2 results
                for i, result in enumerate(search_results[:2]):
                    url = result['href']
                    logging.info(f"Scraping content from URL #{i+1}: {url}")
                    content = self._scrape_page(url)
                    full_content.append(f"--- Source {i+1} ({url}) ---\n{content}")

            return "\n\n".join(full_content)

        except Exception as e:
            logging.error(f"Error during advanced web search: {e}", exc_info=True)
            return f"An error occurred during the web search: {e}"

# Create the single instance that the rest of our application will import
web_search = AdvancedWebSearchTool()