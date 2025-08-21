# FusedChatbot/server/ai_core_service/llm_router.py

import logging
# <<< MERGED LOGIC >>> Import necessary components for the new class.
try:
    from .llm_handler import get_handler, BaseLLMHandler
except ImportError:
    # This allows the file to be run directly for testing.
    from llm_handler import get_handler, BaseLLMHandler

logger = logging.getLogger(__name__)

# <<< MERGED LOGIC >>> The new, powerful task-based router class is kept.
class LLMRouter:
    """
    A router to select the best LLM provider based on a predefined task type.
    This is used by agentic tools that already know their function.
    """
    def __init__(self, api_keys: dict):
        if not api_keys:
            raise ValueError("API keys must be provided to the LLMRouter.")
        self.api_keys = api_keys
        
        # --- Task-Based Routing Strategy ---
        # This table defines the best provider for a specific, known task.
        self.task_routing_table = {
            "default": "groq",           # Fast and cheap for general/unknown tasks
            "reasoning": "gemini",       # Powerful model for complex agent reasoning
            "quiz_generation": "gemini", # High-quality output needed
            "summarization": "groq",     # Fast and efficient for summarization
            "personalized_qa": "ollama", # Route to a fine-tuned local model
        }

        # Maps providers to specific model names, especially for local models.
        self.provider_model_map = {
            "ollama": "llama3", # Default to a powerful local model
            "groq": "llama3-8b-8192",
            "gemini": "gemini-1.5-flash"
        }
        logger.info(f"Task-based LLMRouter initialized with routing table: {self.task_routing_table}")

    def get_llm_for_task(self, task_type: str = "default") -> BaseLLMHandler:
        """
        Gets the appropriate LLM handler for a given pre-defined task.
        """
        provider = self.task_routing_table.get(task_type, self.task_routing_table["default"])
        logger.info(f"Routing task '{task_type}' to LLM provider: '{provider}'")

        try:
            model_name = self.provider_model_map.get(provider)
            handler = get_handler(provider_name=provider, api_keys=self.api_keys, model_name=model_name)
            return handler
        except Exception as e:
            logger.error(f"Failed to get handler for provider '{provider}'. Error: {e}")
            # Fallback to the default provider if the selected one fails
            if provider != self.task_routing_table["default"]:
                logger.warning(f"Falling back to default provider.")
                default_provider = self.task_routing_table["default"]
                model_name = self.provider_model_map.get(default_provider)
                return get_handler(provider_name=default_provider, api_keys=self.api_keys, model_name=model_name)
            raise e

# <<< MERGED LOGIC >>> The simpler, keyword-based router function is also kept.
# It serves as the "front door" for initial user queries.

# Define model mappings for the keyword router.
INTENT_TO_MODEL_MAP = {
    "coding_assistance": {
        "provider": "ollama",
        "model": "deepseek-coder"
    },
    "technical_explanation": {
        "provider": "ollama",
        "model": "qwen:7b"
    },
    "general_chat": {
        "provider": "groq",
        "model": "llama3-8b-8192"
    },
    "default": {
        "provider": "groq",
        "model": "llama3-8b-8192"
    }
}

# Map keywords to intents for the initial query analysis.
KEYWORD_TO_INTENT_MAP = [
    ({"code", "python", "javascript", "script", "function", "debug", "error"}, "coding_assistance"),
    ({"explain", "what is", "how does", "technical", "architecture", "database"}, "technical_explanation"),
    ({"hi", "hello", "how are you"}, "general_chat"),
]

def route_query(query: str, default_provider: str, default_model: str) -> dict:
    """
    Analyzes an initial user query via keywords and routes it to the best LLM.
    """
    logger.info(f"Routing query via keywords: '{query[:50]}...'")
    query_lower = query.lower()
    query_words = set(query_lower.split())

    for keywords, intent in KEYWORD_TO_INTENT_MAP:
        if not keywords.isdisjoint(query_words):
            logger.info(f"Keyword intent matched: '{intent}'. Routing to configured model.")
            return INTENT_TO_MODEL_MAP[intent]

    logger.info("No specific intent matched. Using provider from UI or system default.")
    if default_provider:
        # If a provider is passed from the UI, use it, but select a default model if none is specified.
        return {
            "provider": default_provider,
            "model": default_model or INTENT_TO_MODEL_MAP["default"]["model"]
        }
    
    # Fallback to the absolute default if no other rule applies.
    return INTENT_TO_MODEL_MAP["default"]

# <<< MERGED LOGIC >>> The test block from branch B is kept to ensure the new class works.
if __name__ == '__main__':
    print("--- Running LLMRouter Unit Test ---")
    # This block requires a .env file in the project root with API keys to run successfully.
    # It tests the LLMRouter class, not the route_query function.
    from dotenv import load_dotenv
    import os

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    dotenv_path = os.path.join(project_root, '.env')
    
    if not os.path.exists(dotenv_path):
        dotenv_path = os.path.join(os.getcwd(), '.env')

    print(f"Loading .env from: {dotenv_path}")
    load_dotenv(dotenv_path=dotenv_path)

    test_api_keys = {
        "gemini": os.getenv("ADMIN_GEMINI_API_KEY"),
        "groq": os.getenv("ADMIN_GROQ_API_KEY")
    }

    if not all(test_api_keys.values()):
        print("\nWARNING: API keys not found in .env file for router test.")
        print("Skipping tests that require API keys.")
    else:
        try:
            router = LLMRouter(api_keys=test_api_keys)

            print("\n--- Testing Task: 'quiz_generation' ---")
            handler = router.get_llm_for_task(task_type="quiz_generation")
            print(f"Selected Handler: {handler.__class__.__name__}, Model: {handler.model_name}")
            assert "GeminiHandler" in str(type(handler))
            print("✅ Test PASSED")

            print("\n--- Testing Task: 'summarization' ---")
            handler = router.get_llm_for_task(task_type="summarization")
            print(f"Selected Handler: {handler.__class__.__name__}, Model: {handler.model_name}")
            assert "GroqHandler" in str(type(handler))
            print("✅ Test PASSED")
            
            print("\n--- Testing Task: 'default' ---")
            handler = router.get_llm_for_task()
            print(f"Selected Handler: {handler.__class__.__name__}, Model: {handler.model_name}")
            assert "GroqHandler" in str(type(handler))
            print("✅ Test PASSED")

            print("\n--- Testing Task: 'personalized_qa' ---")
            handler = router.get_llm_for_task(task_type="personalized_qa")
            print(f"Selected Handler: {handler.__class__.__name__}, Model: {handler.model_name}")
            assert "OllamaHandler" in str(type(handler))
            print("✅ Test PASSED")

        except Exception as e:
            print(f"❌ Test FAILED: {e}")
            import traceback
            traceback.print_exc()