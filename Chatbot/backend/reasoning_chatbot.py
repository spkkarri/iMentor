import logging
from typing import Dict, List, Optional, Tuple

from langchain_community.llms.ollama import Ollama
from langchain_core.language_models.base import BaseLanguageModel
from duckduckgo_search import DDGS

# --- Basic Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ReasoningChatbot:
    """
    A chatbot that uses a multi-perspective reasoning framework to answer queries.
    It can optionally integrate with a web search for up-to-date information.
    """

    def __init__(
        self,
        llm: BaseLanguageModel,
        web_search_enabled: bool = True,
        search_result_count: int = 3,
    ):
        """
        Initializes the ReasoningChatbot.

        Args:
            llm (BaseLanguageModel): An instance of a LangChain compatible language model (e.g., ChatOllama).
            web_search_enabled (bool): If True, the bot will perform web searches.
            search_result_count (int): The number of search results to fetch and process.
        """
        if not isinstance(llm, BaseLanguageModel):
            raise TypeError("llm must be an instance of a LangChain BaseLanguageModel")

        self.llm = llm
        self.web_search_enabled = web_search_enabled
        self.search_result_count = search_result_count
        self.search_cache: Dict[str, str] = {}
        logger.info(
            f"ReasoningChatbot initialized. Web search is {'ENABLED' if web_search_enabled else 'DISABLED'}."
        )

    def _perform_web_search(self, query: str) -> str:
        """
        Performs a web search for the given query using DuckDuckGo.

        Args:
            query (str): The search query.

        Returns:
            str: A formatted string of search results, or a message indicating no results were found.
        """
        if query in self.search_cache:
            logger.info(f"Returning cached search results for query: '{query}'")
            return self.search_cache[query]

        logger.info(f"Performing web search for: '{query}'")
        context_parts: List[str] = []
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=self.search_result_count))

            if not results:
                return "Web search yielded no relevant results."

            for i, result in enumerate(results):
                context_parts.append(f"Source [{i+1}]: {result['href']}\nSnippet: {result['body']}")

            formatted_context = "\n\n".join(context_parts)
            self.search_cache[query] = formatted_context
            return formatted_context
        except Exception as e:
            logger.error(f"Web search failed for query '{query}': {e}", exc_info=True)
            return "Web search failed due to an error."

    def _generate_perspective(self, prompt: str) -> str:
        """
        Invokes the LLM with a given prompt and returns the response.

        Args:
            prompt (str): The complete prompt to send to the LLM.

        Returns:
            str: The LLM's generated text.
        """
        try:
            response = self.llm.invoke(prompt)
            return response.strip()
        except Exception as e:
            logger.error(f"LLM generation failed: {e}", exc_info=True)
            return f"[Error in LLM generation: {e}]"

    def ask(self, query: str, document_context: Optional[str] = None) -> str:
        """
        Processes a query through the multi-perspective framework.

        Args:
            query (str): The user's question.
            document_context (Optional[str]): Pre-existing context from documents.

        Returns:
            str: A structured, multi-perspective answer in Markdown format.
        """
        logger.info(f"Processing query: '{query}'")
        final_response_parts: List[str] = []
        
        # --- Context Gathering ---
        context = ""
        if document_context:
            context += f"DOCUMENT CONTEXT:\n{document_context}\n\n"
        
        if self.web_search_enabled:
            web_context = self._perform_web_search(query)
            context += f"WEB SEARCH RESULTS:\n{web_context}"
        else:
            context = document_context or "No context provided."


        # --- 1. Factual Perspective ---
        logger.info("Generating Factual Perspective...")
        factual_prompt = f"""
CONTEXT:
{context}
-----------
USER QUERY: "{query}"
-----------
TASK:
Analyze the user's query from a strictly factual perspective based ONLY on the provided CONTEXT.
1. Extract and list the key facts, definitions, and data points relevant to the query.
2. If the context includes sources, attribute the information (e.g., "According to Source [1]...").
3. If the context is insufficient, state that clearly. Do not invent information.
4. Present the output as a concise summary. Do not add interpretation.
"""
        factual_analysis = self._generate_perspective(factual_prompt)
        final_response_parts.append(f"### After deep consideration from the factual perspective:\n{factual_analysis}")
        logger.info("Factual Perspective generated.")


        # --- 2. Conceptual Perspective ---
        logger.info("Generating Conceptual Perspective...")
        conceptual_prompt = f"""
FACTUAL SUMMARY:
{factual_analysis}
-----------
USER QUERY: "{query}"
-----------
TASK:
Now, analyze the user's query from a conceptual and theoretical perspective, using the factual summary as a foundation.
1. Explain the underlying principles, theories, or core concepts.
2. Place the topic in a broader academic or theoretical framework. How does it relate to other ideas?
3. Focus on the 'why' and 'how' of the concept. Your analysis can draw upon general knowledge beyond the initial facts.
"""
        conceptual_analysis = self._generate_perspective(conceptual_prompt)
        final_response_parts.append(f"### After deep consideration from the conceptual perspective:\n{conceptual_analysis}")
        logger.info("Conceptual Perspective generated.")


        # --- 3. Practical Perspective ---
        logger.info("Generating Practical Perspective...")
        practical_prompt = f"""
FACTUAL & CONCEPTUAL ANALYSIS:
Factual: {factual_analysis}
Conceptual: {conceptual_analysis}
-----------
USER QUERY: "{query}"
-----------
TASK:
Analyze the user's query from a practical and applied perspective.
1. Describe real-world applications, use cases, and concrete examples.
2. Discuss the practical implications, benefits, or consequences.
3. Identify potential challenges, limitations, or ethical considerations in its application.
"""
        practical_analysis = self._generate_perspective(practical_prompt)
        final_response_parts.append(f"### After deep consideration from the practical perspective:\n{practical_analysis}")
        logger.info("Practical Perspective generated.")


        # --- 4. Final Synthesis ---
        logger.info("Synthesizing final answer...")
        synthesis_prompt = f"""
You have performed a multi-perspective analysis on a user's query. Now, synthesize these perspectives into a final, coherent answer.

Original Query: "{query}"

--- ANALYSIS GIVEN ---
Factual Perspective:
{factual_analysis}

Conceptual Perspective:
{conceptual_analysis}

Practical Perspective:
{practical_analysis}
--- END ANALYSIS ---

TASK:
Combine the key insights from all three perspectives into a single, well-structured, and comprehensive answer that flows logically. The answer should directly address the user's original query, integrating the different viewpoints seamlessly. Do not simply list the perspectives again.
"""
        final_answer = self._generate_perspective(synthesis_prompt)
        final_response_parts.append(f"### Final Synthesized Answer:\n{final_answer}")
        logger.info("Final answer synthesized.")

        # --- Confidence Disclaimer ---
        if "Web search yielded no relevant results" in context and not document_context:
            disclaimer = "\n\n*Disclaimer: This response is based on the model's pre-existing knowledge as a web search did not yield relevant results and no document context was provided. Information may not be current or fully verified.*"
            final_response_parts.append(disclaimer)

        return "\n\n".join(final_response_parts)