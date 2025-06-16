import os
from dotenv import load_dotenv
import logging
from langchain.prompts import PromptTemplate # Import PromptTemplate
from datetime import timedelta # For JWT expiration
from protocols import ModelContextProtocol, AgenticContextProtocol
# This configuration file sets up environment variables, logging, and prompt templates for the application.

# Load environment variables from .env file in the same directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- Environment Variables & Defaults ---

# Ollama Configuration
# Define multiple Ollama base URLs for load balancing
# OLLAMA_BASE_URLS = [
#     'https://c678-61-0-228-101.ngrok-free.app/'
    #'http://172.180.9.187:11434',
    #'http://172.180.9.187:11435',
    #'http://172.180.9.187:11436',
    #'http://172.180.9.187:11437'
# ]
OLLAMA_BASE_URLS = [
    'http://localhost:11434',
    'http://localhost:11434',
    'http://localhost:11434',
    'http://localhost:11434'
]

#OLLAMA_BASE_URLS = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral:7b-instruct')
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large:latest')
OLLAMA_REQUEST_TIMEOUT = int(os.getenv('OLLAMA_REQUEST_TIMEOUT', 180))

# Application Configuration Paths (relative to backend directory)
backend_dir = os.path.dirname(__file__)
FAISS_FOLDER = os.path.join(backend_dir, os.getenv('FAISS_FOLDER', 'faiss_store'))
UPLOAD_FOLDER = os.path.join(backend_dir, os.getenv('UPLOAD_FOLDER', 'uploads'))
DATABASE_NAME = os.getenv('DATABASE_NAME', 'chat_history.db') # For previous SQLite, kept for ref
DATABASE_PATH = os.path.join(backend_dir, DATABASE_NAME) # For previous SQLite, kept for ref
# DEFAULT_PDFS_FOLDER removed
PODCAST_AUDIO_FOLDER = os.path.join(backend_dir, os.getenv('PODCAST_AUDIO_FOLDER', 'podcast_audio_files'))


# --- MongoDB Configuration ---
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'ai_tutor_db')
MONGO_USERS_COLLECTION = "users"
MONGO_DOCUMENTS_COLLECTION = "documents"
MONGO_CHAT_THREADS_COLLECTION = "chat_threads"
MONGO_THREAD_MESSAGES_COLLECTION = "thread_messages"


# --- Whisper AI Configuration ---
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') # Optional, for OpenAI's Whisper API
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base') # For local Whisper, e.g., 'base', 'small', 'medium', 'large'
WHISPER_DEVICE = os.getenv('WHISPER_DEVICE', 'cpu') # 'cpu' or 'cuda'

# --- JWT Configuration ---
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '0376a14d75ebca84120a8c73f0fe6886ea2cd790ec0fd6bac71362fc10e4025564730b6fe1901c2dde03bc27c3864aa96979c8ea93bb6e48db2accda38f9d430')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_MINUTES = int(os.getenv('JWT_EXPIRATION_MINUTES', 1440))
JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=JWT_EXPIRATION_MINUTES)

# GLOBAL_DOC_USER_ID_MARKER removed

# File Handling
ALLOWED_EXTENSIONS = {'pdf'}

# RAG Configuration
RAG_CHUNK_K = int(os.getenv('RAG_CHUNK_K', 15))
RAG_SEARCH_K_PER_QUERY = int(os.getenv('RAG_SEARCH_K_PER_QUERY', 3))
MULTI_QUERY_COUNT = int(os.getenv('MULTI_QUERY_COUNT', 3))

# Analysis Configuration
ANALYSIS_MAX_CONTEXT_LENGTH = int(os.getenv('ANALYSIS_MAX_CONTEXT_LENGTH', 10000)) # Also used for podcast script generation for now

# Chat & History Configuration
SUMMARY_BUFFER_TOKEN_LIMIT = int(os.getenv('SUMMARY_BUFFER_TOKEN_LIMIT', 800))


# Logging Configuration
LOGGING_LEVEL_NAME = os.getenv('LOGGING_LEVEL', 'INFO').upper()
LOGGING_LEVEL = getattr(logging, LOGGING_LEVEL_NAME, logging.INFO)
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'
NOUGAT_MODEL_TAG = os.getenv('NOUGAT_MODEL_TAG', '0.1.0-small')
NOUGAT_CHECKPOINT_PATH = os.getenv('NOUGAT_CHECKPOINT_PATH','')


# --- Prompt Templates ---

SUB_QUERY_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "num_queries"],
    template="""You are an AI assistant skilled at decomposing user questions into effective search queries for a vector database containing chunks of engineering documents.
Given the user's query, generate {num_queries} distinct search queries targeting different specific aspects, keywords, or concepts within the original query.
Focus on creating queries that are likely to retrieve relevant text chunks individually.
Output ONLY the generated search queries, each on a new line. Do not include numbering, labels, explanations, or any other text.

User Query: "{query}"

Generated Search Queries:"""
)

SYNTHESIS_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "context", "chat_history", "model_context_protocol", "agentic_context_protocol"],
    template="""You are a Faculty for engineering students with in-depth knowledge across all engineering subjects, supporting an academic audience from undergraduates to PhD scholars.

Your main goal is to answer the user's query based on the provided context chunks. If the context is empty or unrelated, fall back on your general knowledge to produce a helpful, technically detailed answer. Do **not** say "I don't know" or "no information found" — instead, provide the best academic response you can.

**CONVERSATION HISTORY:**
{chat_history}

**MODEL CONTEXT:**
{model_context_protocol}

**AGENTIC CONTEXT:**
{agentic_context_protocol}

**USER QUERY:**
"{query}"

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---

**INSTRUCTIONS:**

**STEP 1: THINKING PROCESS (MANDATORY):**
<thinking>
The user query is about "{query}". First, I'll examine the context. If context contains relevant information, I’ll use it directly. If the context is empty or unrelated, I’ll rely on general engineering knowledge to formulate a clear, structured, and informative academic response.
</thinking>

**STEP 2: FINAL ANSWER:**



**STEP 2: FINAL ANSWER (After the `</thinking>` tag):**
*   Provide a comprehensive and helpful answer to the user query.
*   **Prioritize Context:** Base your answer **primarily** on information within the `PROVIDED CONTEXT`.
*   **Cite Sources:** When using information *directly* from a context chunk, **you MUST cite** its number like [1], [2], [1][3]. Cite all relevant sources for each piece of information derived from the context.
*   **Insufficient Context:** If the context does not contain information needed for a full answer, explicitly state what is missing (e.g., "The provided documents don't detail the specific algorithm used...").
*   **Integrate General Knowledge:** *Seamlessly integrate* your general knowledge to fill gaps, provide background, or offer broader explanations **after** utilizing the context. Clearly signal when you are using general knowledge (e.g., "Generally speaking...", "From external knowledge...", "While the documents focus on X, it's also important to know Y...").
*   **Be a Tutor:** Explain concepts clearly. Be helpful, accurate, and conversational. Use Markdown formatting (lists, bolding, code blocks) for readability.
*   **Accuracy:** Do not invent information not present in the context or verifiable general knowledge. If unsure, state that.
* If context exists and is relevant: Use it and cite [1], [2], etc.
* If context is missing/irrelevant: Say so briefly, then proceed with a general expert-level explanation.
* Be academic, organized, and use markdown formatting (headings, bullet points, equations if needed).
* Use general knowledge **only when** context is missing or insufficient.

**BEGIN RESPONSE (Start *immediately* with the `<thinking>` tag):**
<thinking>"""
)

_ANALYSIS_THINKING_PREFIX = """**STEP 1: THINKING PROCESS (Recommended):**
*   Before generating the analysis, briefly outline your plan in `<thinking>` tags. Example: `<thinking>Analyzing for Mindmap. Will identify the central theme, main branches, and sub-topics from the text to structure a Mermaid mindmap.</thinking>`
*   If you include thinking, place the final analysis *after* the `</thinking>` tag.

**STEP 2: ANALYSIS OUTPUT:**
*   Generate the requested analysis based **strictly** on the text provided below.
*   Follow the specific OUTPUT FORMAT instructions carefully.

--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
"""

ANALYSIS_PROMPTS = {
    "faq": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate 5-7 Frequently Asked Questions (FAQs) with concise answers based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first FAQ (after thinking, if used). Do **NOT** include preamble.
*   Format each FAQ as:
    Q: [Question derived ONLY from the text]
    A: [Answer derived ONLY from the text, concise]
*   If the text doesn't support an answer, don't invent one. Use Markdown for formatting if appropriate (e.g., lists within an answer).

**BEGIN OUTPUT (Start with 'Q:' or `<thinking>`):**
"""
    ),
    "topics": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Identify the 5-8 most important topics discussed. Provide a 1-2 sentence explanation per topic based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first topic (after thinking, if used). Do **NOT** include preamble.
*   Format as a Markdown bulleted list:
    *   **Topic Name:** Brief explanation derived ONLY from the text content (1-2 sentences max).

**BEGIN OUTPUT (Start with '*   **' or `<thinking>`):**
"""
    ),
    "mindmap": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate a **DETAILED, WELL-STRUCTURED, HIERARCHICAL** mind map diagram using **Mermaid.js MINDMAP syntax**.
The mind map **MUST ONLY** represent the key topics, sub-topics, concepts, features, benefits, and any other distinct pieces of information as found **DIRECTLY in the provided document text**.
Extract as much relevant detail as possible to create a comprehensive mindmap with multiple levels of depth. Aim for approximately 20-40 nodes if the document content supports it, but prioritize accuracy and clear hierarchy.

**OUTPUT FORMAT (ABSOLUTELY CRITICAL - FOLLOW EXACTLY):**
1.  The output **MUST** start **IMMEDIATELY** with the Mermaid mindmap code block (after your thinking block, if you include one). **NO PREAMBLE, NO EXPLANATIONS, NO INTRODUCTORY TEXT BEFORE THE ```mermaid CODE BLOCK.**
2.  The entire mindmap diagram **MUST** be enclosed in a single ```mermaid ... ``` code block.
3.  **INSIDE THE ```mermaid ... ``` CODE BLOCK - STRICT SYNTAX RULES:**
    a.  The **VERY FIRST line MUST be `mindmap`** and nothing else.
    b.  The **SECOND line MUST be the main root topic** of the document. This root node's text should be concise and ideally enclosed in `(())`. Example: `  root((Document's Central Theme))`
    c.  **HIERARCHY & INDENTATION:**
        i.  **ALL** subsequent lines defining nodes **MUST** be indented to show their parent-child relationship.
        ii. Use **EXACTLY 2 spaces OR EXACTLY 4 spaces** for each level of indentation. Be consistent.
        iii. Every node (except the root) must be a child of a node at a lesser indentation level on a preceding line.
    d.  **NODE TEXT:**
        i.  Node text **MUST BE SHORT PHRASES OR KEYWORDS** taken directly from or very closely summarizing the document.
        ii. Node text can be plain (e.g., `  Topic A`) or enclosed in `()` for a standard box (e.g., `    (Subtopic A1)`), or `[]` for a rectangle, or `{{}}` for a cloud shape if appropriate for the content. Prefer `()` or plain text for simplicity unless another shape is clearly better.
    e.  **ABSOLUTELY FORBIDDEN INSIDE THE ```mermaid ... ``` BLOCK:**
        i.  **NO COMMENTS OF ANY KIND.** Do not use `%%`, `<!-- -->`, `//`, `#` (unless part of the node text itself), or any text like `<-- this is a comment -->`.
        ii. **NO ARROWS OR LINES:** Do not use `->`, `-->`, `---`, `~~~`, or any other graph/flowchart specific syntax. This is a MINDMAP.
        iii. **NO HTML TAGS.**
        iv. **NO PROGRAMMING CODE OR COMPLEX SYMBOLS** unless they are verbatim from the document text being summarized as a node.
        v.  **NO EXPLANATORY TEXT OR LABELS** other than the node text itself.
        vi. **NO BLANK LINES** between node definitions unless it's the very end of the block.
        vii. **NO TRAILING SPACES** on any line.
    f.  **SINGLE ROOT ONLY:** There can only be ONE unindented node (the root) immediately after the `mindmap` keyword. All other primary sections/topics from the document must be children of this single root.

**VERY STRICT EXAMPLE of CORRECT Mermaid Mindmap Syntax (Illustrating Hierarchy and Detail):**
    ```mermaid
    mindmap
      root((Core Concept of Document))
        Main Topic 1
          (Sub-Topic 1.1)
            Detail 1.1.A
            Detail 1.1.B
              [Specific Example 1.1.B.i]
          Feature 1.2
            Benefit 1.2.1
            Benefit 1.2.2
        Main Topic 2
          Process Step A
          Process Step B
            (Sub-step B.1)
          Key Finding C
        Main Topic 3
          (Important Aspect 3.1)
          Limitation 3.2
    ```

*   Ensure the mindmap structure is logical and strictly reflects the hierarchy and content of the document.
*   If the document is very short or has no clear hierarchy, generate a simpler mind map but still follow all syntax rules.
*   Prioritize extracting meaningful entities from the text.

**BEGIN OUTPUT (Start with '```mermaid' or `<thinking>`):**
"""
    )
}

PODCAST_GENERATION_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["document_text"],
    template="""You are an engaging podcast host. Your task is to transform the following document text into a conversational podcast script.
The script should sound natural, as if one or two people are discussing the key points of the document.
If creating a dialogue, use speaker tags like "Host:", "Expert:", "Speaker 1:", "Speaker 2:".
If creating a monologue, make it sound like a presenter directly addressing an audience with an engaging, explanatory tone.
Break down complex information into understandable segments. Use conversational language, ask rhetorical questions, and provide clear explanations.
The goal is to make the document's content accessible and interesting in an audio format.
Focus on the main ideas, important details, and any conclusions from the document.
The output should be ONLY the script, ready for text-to-speech. Do NOT include any preamble like "Here's the script:".

<thinking>
I need to read the document text and identify the core themes and information.
I will then structure this into a dialogue or an engaging monologue.
I should use simple language and a friendly, informative tone.
I will break the content into logical parts, perhaps with an introduction, main body discussion, and a conclusion.
The final output must be just the script text.
</thinking>

Document Text:
--- START DOCUMENT TEXT ---
{document_text}
--- END DOCUMENT TEXT ---

Podcast Script:
"""
)

# This template is present but not directly used by ai_core.py's main chat/analysis flows.
# It might be intended for a separate MMD processing step if needed.
LATEX_SUMMARIZATION_PROMPT_TEMPLATE = PromptTemplate(
     input_variables=["latex_content"],
    template="""You are an AI assistant highly proficient in understanding structured Markdown (MMD) from technical documents, which may include LaTeX for equations.
The following is the MMD content of a document. Your task is to provide a comprehensive, structured summary of this document.
Focus on extracting the main topics, key arguments, methodologies, findings, and conclusions.
Preserve the logical flow and hierarchy of the original document in your summary.
The summary should be detailed enough to be useful for generating a mind map later.
Output only the summary text.

<thinking>
The user has provided MMD content. I need to parse this (conceptually) and identify the core sections based on Markdown headings (#, ##, etc.), lists, and any embedded LaTeX for formulas.
I will then synthesize a summary that captures the essence of each major part and their relationships.
The summary should be in clear, concise prose.
</thinking>

MMD Content:
```markdown
{latex_content}
```

Comprehensive Summary:
"""
)

# --- Logging Setup ---
def setup_logging():
    """Configures application-wide logging."""
    logging.basicConfig(level=LOGGING_LEVEL, format=LOGGING_FORMAT)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("langchain.memory.buffer").setLevel(LOGGING_LEVEL + 10)
    logging.getLogger("langchain.chains").setLevel(LOGGING_LEVEL + 10)
    logging.getLogger("faiss.loader").setLevel(logging.WARNING)
    logging.getLogger("pdfminer").setLevel(logging.WARNING)
    # For Nougat/Transformers related logging:
    logging.getLogger("transformers.modeling_utils").setLevel(logging.WARNING)
    logging.getLogger("nougat").setLevel(LOGGING_LEVEL) # Nougat's own logger
    logging.getLogger("gtts").setLevel(logging.WARNING) # Set gTTS logger level


    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level {LOGGING_LEVEL_NAME}")
    logger.debug(f"OLLAMA_BASE_URLS={OLLAMA_BASE_URLS}")
    logger.debug(f"OLLAMA_MODEL={OLLAMA_MODEL}")
    logger.debug(f"OLLAMA_EMBED_MODEL={OLLAMA_EMBED_MODEL}")
    logger.debug(f"FAISS_FOLDER={FAISS_FOLDER}")
    logger.debug(f"UPLOAD_FOLDER={UPLOAD_FOLDER}")
    logger.debug(f"PODCAST_AUDIO_FOLDER={PODCAST_AUDIO_FOLDER}")
    logger.debug(f"RAG_CHUNK_K={RAG_CHUNK_K}, RAG_SEARCH_K_PER_QUERY={RAG_SEARCH_K_PER_QUERY}, MULTI_QUERY_COUNT={MULTI_QUERY_COUNT}")
    logger.debug(f"ANALYSIS_MAX_CONTEXT_LENGTH={ANALYSIS_MAX_CONTEXT_LENGTH}")
    logger.debug(f"SUMMARY_BUFFER_TOKEN_LIMIT={SUMMARY_BUFFER_TOKEN_LIMIT}")
    logger.debug(f"NOUGAT_MODEL_TAG={NOUGAT_MODEL_TAG}")
    logger.debug(f"NOUGAT_CHECKPOINT_PATH={NOUGAT_CHECKPOINT_PATH}")