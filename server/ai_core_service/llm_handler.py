# FusedChatbot/server/ai_core_service/llm_handler.py
import os
import logging
from click import prompt
from dotenv import load_dotenv

# --- SDK Imports with Graceful Fallbacks ---
try:
    import google.generativeai as genai
except ImportError:
    genai = None
    logging.warning("SDK not found: 'google.generativeai'. Gemini features will be unavailable.")

try:
    from groq import Groq
except ImportError:
    Groq = None
    logging.warning("SDK not found: 'groq'. Groq features will be unavailable.")

try:
    from langchain_ollama import ChatOllama
except ImportError:
    ChatOllama = None
    logging.warning("SDK not found: 'langchain_ollama'. Ollama features will be unavailable.")
try:
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
except ImportError:
    HumanMessage, SystemMessage, AIMessage = None, None, None
    logging.warning("Langchain core messages not found. Ollama functionality may be affected.")
try:
    from langchain.prompts import PromptTemplate
except ImportError:
    PromptTemplate = None
    logging.warning("Langchain PromptTemplate not found; analysis prompts will use string formatting.")

# --- Service Configuration ---
try:
    from . import config as service_config
except ImportError:
    import config as service_config

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

logger = logging.getLogger(__name__)


# --- Prompt Templates ---
# Analysis prompts are unchanged.
_ANALYSIS_THINKING_PREFIX_STR = """**STEP 1: THINKING PROCESS (Recommended):**
*   Briefly outline your plan in `<thinking>` tags.
*   Place the final analysis *after* the `</thinking>` tag.

**STEP 2: ANALYSIS OUTPUT:**
*   Generate the requested analysis based **strictly** on the text provided below.

--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
"""
if PromptTemplate:
    ANALYSIS_PROMPTS = {
        "faq": PromptTemplate(
            input_variables=["doc_text_for_llm", "num_items"],
            template="""You are a data processing machine. Your only function is to extract questions and answers from the provided text.
**CRITICAL RULES:**
1.  **FORMAT:** Your output MUST strictly follow the `Q: [Question]\nA: [Answer]` format for each item.
2.  **NO PREAMBLE:** Your entire response MUST begin directly with `Q:`. Do not output any other text, conversation, or explanation.
3.  **DATA SOURCE:** Base all questions and answers ONLY on the provided document text. Do not invent information.
4.  **QUANTITY:** Generate approximately {num_items} questions.
--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
EXECUTE NOW.
"""
        ),
        "topics": PromptTemplate(
            input_variables=["doc_text_for_llm", "num_items"],
            template=_ANALYSIS_THINKING_PREFIX_STR + """
**TASK:** Identify approximately {num_items} most important topics.
**OUTPUT FORMAT (Strict):**
*   Start directly with the first topic. Do NOT include preamble.
*   Format as a Markdown bulleted list: `*   **Topic Name:** Brief explanation (1-2 sentences).`
**BEGIN OUTPUT:**
"""
        ),
# ... inside the ANALYSIS_PROMPTS dictionary
        "mindmap": PromptTemplate(
            input_variables=["doc_text_for_llm", "num_items"],
            template="""You are an expert text-to-Mermaid-syntax converter. Your only job is to create a valid Mermaid.js mind map from the provided text.

                **CRITICAL SYNTAX RULES:**
                1.  **MANDATORY START:** The entire response MUST begin with the word `mindmap` on the very first line.
                2.  **HIERARCHY VIA INDENTATION:** The structure of the mind map is defined ONLY by indentation. Each level of sub-topic MUST be indented more than its parent. Use two spaces for each level of indentation.
                3.  **SINGLE ROOT:** There can only be ONE top-level (unindented or minimally indented) node after the `mindmap` keyword. All other nodes must be children of this single root, indicated by increased indentation.
                4.  **NO INVALID KEYWORDS:** Do NOT use keywords like `child()`. The hierarchy is implicit from indentation.
                5.  **NO CONVERSATION:** Your output MUST NOT contain any explanations, introductions, apologies, or markdown fences (```). The output must be PURE Mermaid syntax.
                6.  **QUANTITY:** Generate a mind map with approximately {num_items} nodes.

                **EXAMPLE OF PERFECT SYNTAX:**
                mindmap
                root((Main Topic))
                    Sub-Topic A
                    Detail 1
                    Detail 2
                    Sub-Topic B
                    Sub-Topic C
                    Detail 3

                --- START DOCUMENT TEXT ---
                {doc_text_for_llm}
                --- END DOCUMENT TEXT ---

                EXECUTE NOW. CREATE THE MERMAID MIND MAP.
                """
                        ),
    }
    logger.info("ANALYSIS_PROMPTS initialized using Langchain PromptTemplate objects.")
else:
    ANALYSIS_PROMPTS = { "faq": "...", "topics": "...", "mindmap": "..." }

# ==================================================================
#  START OF MODIFICATION
# ==================================================================
_SYNTHESIS_PROMPT_TEMPLATE_STR = """You are a highly intelligent and helpful AI assistant. Your primary goal is to provide comprehensive, direct answers. Your entire response MUST follow a strict two-step process.

**STEP 1: THINKING PROCESS (MANDATORY, ALWAYS FIRST)**
*   Your response MUST BEGIN with a `<thinking>` block. No exceptions.
*   Inside this block, you will analyze the user's query and formulate a plan.
*   **RULE 1:** If the user's query is broad or vague (e.g., "Tell me about engineering"), your plan is to PROVIDE a general, helpful overview FIRST. Do not just ask for clarification.
*   **RULE 2:** If the user provides a simple greeting (e.g., "Hi"), your plan is to greet them back warmly and briefly introduce yourself and your purpose.

**STEP 2: FINAL ANSWER (MANDATORY, ALWAYS AFTER `</thinking>`)**
*   After the closing `</thinking>` tag, you MUST provide the final response to the user.
*   This response must execute the plan from your thinking block.
*   If using context from provided documents, cite your sources like [1], [2], etc.

---
**USER QUERY:**
"{query}"

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---

**YOUR RESPONSE (Must start with `<thinking>`):**
"""
# ==================================================================
#  END OF MODIFICATION
# ==================================================================

_SUB_QUERY_TEMPLATE_STR = """You are an AI assistant skilled at decomposing user questions...""" # Unchanged for brevity


# --- LLM Provider Configurations ---
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")
DEFAULT_GEMINI_GENERATION_CONFIG = {"temperature": 0.7, "max_output_tokens": 4096}
DEFAULT_GEMINI_SAFETY_SETTINGS = [ {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"}, {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"}, {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"}, {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"}, ]
logger.info("LLM Handler initialized. API clients will be created per-request.")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
ollama_available = bool(ChatOllama and HumanMessage)
DEFAULT_GROQ_LLAMA3_MODEL = os.getenv("GROQ_LLAMA3_MODEL", "llama3-8b-8192")


# --- Helper Functions ---
def _parse_thinking_and_answer(full_llm_response: str) -> tuple[str, str | None]:
    # This function is now only used for document analysis.
    response_text = full_llm_response.strip()
    think_start_tag, think_end_tag = "<thinking>", "</thinking>"
    start_index = response_text.find(think_start_tag)
    end_index = response_text.find(think_end_tag, start_index)
    if start_index != -1:
        if end_index != -1:
            thinking_content = response_text[start_index + len(think_start_tag):end_index].strip()
            answer = response_text[end_index + len(think_end_tag):].strip()
        else:
            logger.warning("Found '<thinking>' tag but no closing tag.")
            thinking_content = response_text[start_index + len(think_start_tag):].strip()
            answer = "[AI response seems to be a thinking process only or was truncated.]"
        if not answer and thinking_content:
            answer = "[AI response primarily contained reasoning. See thinking process for details.]"
        return answer, thinking_content
    if not response_text:
        return "[AI provided an empty response.]", None
    return response_text, None

def is_ollama_host_available(host_url: str) -> bool:
    """
    Checks if the Ollama host is available by sending a GET to /api/tags.
    """
    import requests
    try:
        resp = requests.get(f"{host_url.rstrip('/')}/api/tags", timeout=2)
        return resp.status_code == 200
    except Exception:
        return False


def _call_llm_for_task(
    prompt,
    llm_provider,
    llm_model_name=None,
    user_gemini_api_key=None,
    user_grok_api_key=None,
    api_keys=None,
    ollama_host=None
) -> str:
    """
    Internal helper to dispatch a simple, single-prompt task to an LLM.
    It prioritizes keys from the `api_keys` dictionary if provided.
    """
    if llm_provider.startswith("gemini"):
        if not genai:
            raise ConnectionError("Gemini SDK not installed.")
        gemini_key = (api_keys.get('gemini') if api_keys else None) or user_gemini_api_key
        if not gemini_key:
            raise ConnectionError("Gemini API key is required but was not provided.")
        genai.configure(api_key=gemini_key)
        analysis_safety_settings = [{"category": c, "threshold": "BLOCK_NONE"} for c in [
            "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"
        ]]
        model = genai.GenerativeModel(
            llm_model_name or os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash"),
            safety_settings=analysis_safety_settings
        )
        response = model.generate_content(prompt)
        if not response.parts:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini response was empty, blocked by safety filters. Reason: {block_reason}")
            return f"Analysis failed: The request was blocked by the AI provider's content safety policy (Reason: {block_reason})."
        return response.text

    elif llm_provider.startswith("groq"):
        if not Groq:
            raise ConnectionError("Groq SDK not installed.")
        grok_key = (api_keys.get('grok') if api_keys else None) or user_grok_api_key
        if not grok_key:
            raise ConnectionError("Groq API key is required but was not provided.")
        local_groq_client = Groq(api_key=grok_key)
        completion = local_groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=llm_model_name or os.getenv("DEFAULT_GROQ_LLAMA3_MODEL", "llama3-8b-8192")
        )
        return completion.choices[0].message.content

    elif llm_provider == "ollama":
        logger.info(f"[DEBUG] ollama_host argument in _call_llm_for_task: {ollama_host}")
        logger.info(f"[DEBUG] api_keys in _call_llm_for_task: {api_keys}")
        hosts_to_try = []
        user_host = ollama_host or (api_keys.get("ollama_host") if api_keys else None)
        logger.info(f"[DEBUG] user_host resolved to: {user_host}")
        if user_host and isinstance(user_host, str) and user_host.strip():
            hosts_to_try.append(user_host.strip())
        if OLLAMA_BASE_URL not in hosts_to_try:
            hosts_to_try.append(OLLAMA_BASE_URL)
        logger.info(f"[DEBUG] hosts_to_try: {hosts_to_try}")
        last_exception = None
        for host in hosts_to_try:
            try:
                logger.info(f"Trying Ollama host: {host}")
                ollama_llm = ChatOllama(base_url=host, model=llm_model_name or DEFAULT_OLLAMA_MODEL)
                response = ollama_llm.invoke([HumanMessage(content=prompt)])
                logger.info(f"Successful response from Ollama host: {host}")
                return response.content
            except Exception as e:
                logger.warning(f"Ollama request to {host} failed: {e}")
                last_exception = e
        logger.error("All Ollama hosts failed.")
        raise ConnectionError(f"All Ollama hosts failed. Last error: {last_exception}")

    else:
        raise ValueError(f"Unsupported LLM provider: {llm_provider}")


# --- Core AI Functions ---
def perform_document_analysis(document_text: str, analysis_type: str, llm_provider: str, llm_model_name: str = None, api_keys: dict = None, ollama_host: str = None) -> tuple[str | None, str | None]:
    """
    Performs analysis on a document, using the provided api_keys dictionary.
    """
    logger.info(f"Performing '{analysis_type}' analysis with {llm_provider}.")
    if not document_text.strip(): return "Error: Document content is empty, cannot perform analysis.", None

    max_len = service_config.ANALYSIS_MAX_CONTEXT_LENGTH
    original_length = len(document_text)
    doc_text_for_llm = document_text[:max_len] if original_length > max_len else document_text
    if original_length > max_len:
        logger.warning(f"Document ({original_length} chars) was truncated to {max_len} chars.")
        doc_text_for_llm += "\n\n... [CONTENT TRUNCATED FOR ANALYSIS]"
    if original_length <= 500: num_items = 3
    else: base_items, max_items = 5, 20; additional_items = (original_length // 4000); num_items = min(base_items + additional_items, max_items)
    logger.info(f"Targeting ~{num_items} items for '{analysis_type}' based on document length.")
    
    prompt_obj = ANALYSIS_PROMPTS.get(analysis_type)
    if not prompt_obj: return f"Error: Analysis type '{analysis_type}' is not supported.", None

    logger.info(f"[DEBUG] ollama_host argument in perform_document_analysis: {ollama_host}")
    logger.info(f"[DEBUG] api_keys in perform_document_analysis: {api_keys}")

    try:
        format_args = {"doc_text_for_llm": doc_text_for_llm}
        if analysis_type in ["faq", "topics", "mindmap"]: format_args["num_items"] = num_items
        final_prompt_str = prompt_obj.format(**format_args)
        logger.info(f"[DEBUG] Passing ollama_host to _call_llm_for_task: {ollama_host}")
        raw_response = _call_llm_for_task(prompt=final_prompt_str, llm_provider=llm_provider, llm_model_name=llm_model_name, api_keys=api_keys, ollama_host=ollama_host)

        if not raw_response or not isinstance(raw_response, str):
             logger.error(f"LLM call failed or returned invalid response for analysis '{analysis_type}': {raw_response}")
             return "Error: LLM response was empty or invalid.", None

        if raw_response.startswith("Analysis failed:") or raw_response.startswith("Analysis blocked by"):
            logger.error(f"LLM call failed for analysis '{analysis_type}': {raw_response}")
            return raw_response, None

        
        if analysis_type == 'mindmap': return raw_response.strip(), None
        return _parse_thinking_and_answer(raw_response)
    except Exception as e:
        logger.error(f"Unhandled exception during '{analysis_type}' analysis with {llm_provider}: {e}", exc_info=True)
        return "Error performing document analysis: An unexpected system error occurred.", None

def generate_sub_queries_via_llm(original_query: str, llm_provider: str, llm_model_name: str = None, num_sub_queries: int = 3, user_gemini_api_key: str = None, user_grok_api_key: str = None, api_keys: dict = None) -> list[str]:
    # This function is unchanged.
    if num_sub_queries <= 0: return []
    prompt = _SUB_QUERY_TEMPLATE_STR.format(query=original_query, num_queries=num_sub_queries)
    logger.info(f"👉 Final Ollama Host in api_keys: {api_keys.get('ollama_host')}")
    try:
        raw_response = _call_llm_for_task(
            prompt=prompt,
            llm_provider=llm_provider,
            llm_model_name=llm_model_name,
            user_gemini_api_key=user_gemini_api_key,
            user_grok_api_key=user_grok_api_key,
            api_keys=api_keys,
            ollama_host=api_keys.get('ollama_host')
        )
        sub_queries = [q.strip() for q in raw_response.strip().split('\n') if q.strip()]
        return sub_queries[:num_sub_queries]
    except Exception as e:
        logger.error(f"Failed to generate sub-queries with {llm_provider}: {e}", exc_info=True)
        return []


# --- Main Response Synthesis Functions ---
def get_gemini_response(query: str, context_text: str, model_name: str = None, user_gemini_api_key: str = None, chat_history: list = None, system_prompt: str = None, **kwargs) -> tuple[str, str | None]:
    if not genai: raise ConnectionError("Gemini SDK not installed.")
    if not user_gemini_api_key: raise ConnectionError("User Gemini API key is required but was not provided.")
    genai.configure(api_key=user_gemini_api_key)
    final_user_prompt = _SYNTHESIS_PROMPT_TEMPLATE_STR.format(query=query, context=context_text)
    model_kwargs = { "generation_config": DEFAULT_GEMINI_GENERATION_CONFIG, "safety_settings": DEFAULT_GEMINI_SAFETY_SETTINGS }
    if system_prompt: model_kwargs["system_instruction"] = system_prompt
    model = genai.GenerativeModel(model_name or GEMINI_MODEL_NAME, **model_kwargs)
    history_for_api = []
    if chat_history:
        for message in chat_history:
            role = "user" if message.get("role") == "user" else "model"
            text_part = message.get("parts", [{}])[0].get("text", "")
            if text_part: history_for_api.append({'role': role, 'parts': [text_part]})
    chat_session = model.start_chat(history=history_for_api)
    logger.info(f"Calling Gemini for synthesis (Model: {model.model_name}) with {len(history_for_api)} history messages.")
    try:
        response = chat_session.send_message(final_user_prompt)
        if (candidate := response.candidates[0] if response.candidates else None) and (candidate.finish_reason.name not in ["STOP", "MAX_TOKENS"]): logger.warning(f"Gemini response terminated unexpectedly. Reason: {candidate.finish_reason.name}")
        # Return the raw text; Node.js server will parse it.
        return response.text, None
    except Exception as e:
        logger.error(f"Gemini API call failed during synthesis: {e}", exc_info=True)
        if 'API_KEY_INVALID' in str(e): raise ConnectionError("The provided Gemini API key is invalid.")
        raise ConnectionError("Failed to get response from Gemini.") from e

def get_ollama_response(query: str, context_text: str, model_name: str = None, chat_history: list = None, system_prompt: str = None, ollama_host: str = None, **kwargs) -> tuple[str, str | None]:
    if not ChatOllama:
        raise ConnectionError("Ollama dependencies (langchain_ollama) not available.")

    final_user_prompt = _SYNTHESIS_PROMPT_TEMPLATE_STR.format(query=query, context=context_text)

    messages_for_api = []
    if system_prompt:
        messages_for_api.append(SystemMessage(content=system_prompt))
    if chat_history:
        for message in chat_history:
            role, text_part = message.get("role"), message.get("parts", [{}])[0].get("text", "")
            if text_part:
                if role == "user":
                    messages_for_api.append(HumanMessage(content=text_part))
                else:
                    messages_for_api.append(AIMessage(content=text_part))
    messages_for_api.append(HumanMessage(content=final_user_prompt))

    # ============================
    # RISK-MANAGED HOST FALLBACK
    # ============================
    hosts_to_try = []
    if ollama_host:
        hosts_to_try.append(ollama_host)
    if OLLAMA_BASE_URL not in hosts_to_try:
        hosts_to_try.append(OLLAMA_BASE_URL)

    last_exception = None

    for host in hosts_to_try:
        try:
            logger.info(f"Attempting to connect to Ollama at: {host}")
            model = ChatOllama(base_url=host, model=model_name or DEFAULT_OLLAMA_MODEL)
            response = model.invoke(messages_for_api)
            logger.info(f"Successfully received response from Ollama at: {host}")
            return response.content, None
        except Exception as e:
            logger.warning(f"Ollama request failed at {host}: {e}")
            last_exception = e

    logger.error("All Ollama hosts failed.")
    raise ConnectionError(f"All Ollama hosts failed. Last error: {last_exception}")


def get_groq_llama3_response(query: str, context_text: str, model_name: str = None, user_grok_api_key: str = None, chat_history: list = None, system_prompt: str = None, **kwargs) -> tuple[str, str | None]:
    if not Groq: raise ConnectionError("Groq SDK not installed.")
    if not user_grok_api_key: raise ConnectionError("User Groq API key is required but was not provided.")
    local_groq_client = Groq(api_key=user_grok_api_key)
    final_user_prompt = _SYNTHESIS_PROMPT_TEMPLATE_STR.format(query=query, context=context_text)
    messages_for_api = []
    if system_prompt: messages_for_api.append({"role": "system", "content": system_prompt})
    if chat_history:
        for message in chat_history:
            role = "assistant" if message.get("role") == "model" else "user"
            text_part = message.get("parts", [{}])[0].get("text", "")
            if text_part: messages_for_api.append({"role": role, "content": text_part})
    messages_for_api.append({"role": "user", "content": final_user_prompt})
    model = model_name or DEFAULT_GROQ_LLAMA3_MODEL
    logger.info(f"Calling Groq for synthesis (Model: {model}) with {len(messages_for_api) -1} history messages.")
    try:
        completion = local_groq_client.chat.completions.create(messages=messages_for_api, model=model)
        # Return the raw content; Node.js server will parse it.
        return completion.choices[0].message.content, None
    except Exception as e:
        logger.error(f"Groq API call failed during synthesis: {e}", exc_info=True)
        raise ConnectionError("Failed to get response from Groq.") from e

def generate_response(llm_provider: str, query: str, context_text: str, **kwargs) -> tuple[str, str | None]:
    logger.info(f"Generating synthesized response with provider: {llm_provider}.")
    provider_map = {
        "gemini": get_gemini_response,
        "ollama": get_ollama_response,
        "groq_llama3": get_groq_llama3_response,
    }
    matched_provider_key = next((key for key in provider_map if llm_provider.startswith(key)), None)
    if not matched_provider_key:
        raise ValueError(f"Unsupported LLM provider: {llm_provider}")
    call_args = { "query": query, "context_text": context_text, **kwargs }
    # The provider functions now return the raw text and None, which is passed on.
    return provider_map[matched_provider_key](**call_args)