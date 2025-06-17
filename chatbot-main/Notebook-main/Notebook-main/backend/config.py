import os
from dotenv import load_dotenv
import logging
from langchain.prompts import PromptTemplate  # Import PromptTemplate

# Load environment variables from .env file in the same directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- Environment Variables & Defaults ---

# Ollama Configuration
OLLAMA_BASE_URL = 'http://localhost:11434'
OLLAMA_MODEL = 'llama3:8b'
OLLAMA_EMBED_MODEL = 'mxbai-embed-large:latest'

# Optional: Increase Ollama request timeout (in seconds) if needed for long operations
OLLAMA_REQUEST_TIMEOUT = int(os.getenv('OLLAMA_REQUEST_TIMEOUT', 180))
# Application Configuration Paths (relative to backend directory)
backend_dir = os.path.dirname(__file__)
FAISS_FOLDER = os.path.join(backend_dir, os.getenv('FAISS_FOLDER', 'faiss_store'))
UPLOAD_FOLDER = os.path.join(backend_dir, os.getenv('UPLOAD_FOLDER', 'uploads'))
DATABASE_NAME = os.getenv('DATABASE_NAME', 'chat_history.db')
DATABASE_PATH = os.path.join(backend_dir, DATABASE_NAME)
DEFAULT_PDFS_FOLDER = os.path.join(backend_dir, os.getenv('DEFAULT_PDFS_FOLDER', 'default_pdfs'))

# File Handling
ALLOWED_EXTENSIONS = {'pdf'}

# RAG Configuration
RAG_CHUNK_K = int(os.getenv('RAG_CHUNK_K', 5))
RAG_SEARCH_K_PER_QUERY = int(os.getenv('RAG_SEARCH_K_PER_QUERY', 3))
MULTI_QUERY_COUNT = int(os.getenv('MULTI_QUERY_COUNT', 3))

# Analysis Configuration
ANALYSIS_MAX_CONTEXT_LENGTH = int(os.getenv('ANALYSIS_MAX_CONTEXT_LENGTH', 8000))

# Logging Configuration
LOGGING_LEVEL_NAME = os.getenv('LOGGING_LEVEL', 'INFO').upper()
LOGGING_LEVEL = getattr(logging, LOGGING_LEVEL_NAME, logging.INFO)
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'

# --- Prompt Templates ---
SUB_QUERY_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "num_queries"],
    template="""
You are an AI assistant skilled at decomposing user questions into effective search queries for a vector database containing engineering text chunks.

Given the user's question, generate {num_queries} distinct search queries targeting different aspects of the question.

**Instructions:**
- Each query should focus on a specific keyword or concept.
- Do not number the queries or include any explanation.
- Output only the queries, each on a new line.

User Question: "{query}"

Search Queries:
"""
)

SYNTHESIS_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "context"],
    template="""
You are an expert AI tutor helping students understand technical concepts. You answer clearly, in proper Markdown, and adjust your structure depending on the type of question.

---

### 🧠 TASK

Use your general knowledge and the provided context (if any) to answer the user’s question.  
Always **adapt the structure and formatting** based on the query type:

#### 👇 Formatting Rules:
- For **definitions**: Use `###` for headings and `-` bullets for core traits.
- For **comparisons**: Use a Markdown table.
- For **how-to/code questions**: Include step-by-step bullet lists or code blocks.
- For **broad concepts**: Expand moderately, include examples or use subheadings.
- Do **not cite sources or PDFs** unless context is explicitly provided.

---

### 📥 USER QUERY:
"{query}"

### 📚 PROVIDED CONTEXT:
{context}

---

### 🧩 FINAL INSTRUCTIONS
- Format your answer in clean, structured **Markdown**.
- Avoid repetition or generic filler.
- Do **not** use made-up citations like "[1] Stanford.pdf" unless context includes it.
- Write with the tone of a helpful professor.
- Slightly expand answers when needed for depth or clarity.

---

### ✍️ BEGIN RESPONSE BELOW:
"""
)


# --- Logging Setup ---
def setup_logging():
    """
    Configures application-wide logging.
    """
    logging.basicConfig(level=LOGGING_LEVEL, format=LOGGING_FORMAT)

    # Suppress excessive logging from noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("faiss.loader").setLevel(logging.WARNING)

    # Main app logger
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level: {LOGGING_LEVEL_NAME}")
    logger.debug(f"OLLAMA_BASE_URL = {OLLAMA_BASE_URL}")
    logger.debug(f"OLLAMA_MODEL = {OLLAMA_MODEL}")
    logger.debug(f"OLLAMA_EMBED_MODEL = {OLLAMA_EMBED_MODEL}")
    logger.debug(f"FAISS_FOLDER = {FAISS_FOLDER}")
    logger.debug(f"UPLOAD_FOLDER = {UPLOAD_FOLDER}")
    logger.debug(f"DATABASE_PATH = {DATABASE_PATH}")
    logger.debug(f"RAG_CHUNK_K = {RAG_CHUNK_K}")
    logger.debug(f"RAG_SEARCH_K_PER_QUERY = {RAG_SEARCH_K_PER_QUERY}")
    logger.debug(f"MULTI_QUERY_COUNT = {MULTI_QUERY_COUNT}")
    logger.debug(f"ANALYSIS_MAX_CONTEXT_LENGTH = {ANALYSIS_MAX_CONTEXT_LENGTH}")

# --- Analysis Prompt Templates ---
ANALYSIS_PROMPTS = {
    "faq": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template="""
You are an AI tutor specializing in technical comprehension. Based on the document provided, generate a list of frequently asked questions (FAQs) along with concise and clear answers.

**DOCUMENT:**
{doc_text_for_llm}

**INSTRUCTIONS:**
- Create 5–10 high-quality FAQs relevant to the document.
- Provide concise, technically accurate answers.
- Format the output in Markdown:

**Q:** question  
**A:** answer
"""
    ),
    "topics": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template="""
You are an expert summarizer for engineering documents. Based on the content below, identify the main topics and subtopics it covers.

**DOCUMENT:**
{doc_text_for_llm}

**INSTRUCTIONS:**
- List the key topics with short descriptions.
- Use bullet points or hierarchy where appropriate.
- Format in Markdown for easy reading.
"""
    ),
    "mindmap": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template="""
You are a visual thinker. From the document provided, construct a hierarchical mind map showing key concepts and how they relate.

**DOCUMENT:**
{doc_text_for_llm}

**INSTRUCTIONS:**
- Output a Markdown list representing a mind map.
- Use indentation to represent branches/subtopics.
- Keep it concise and structured.

Example:
- Main Topic
  - Subtopic A
    - Detail 1
    - Detail 2
  - Subtopic B
    - Detail 3
"""
    )
}
