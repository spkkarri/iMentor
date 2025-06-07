# server/rag_service/file_parser.py

import os
import logging
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader

# It's good practice to have a logger in helper files too
logger = logging.getLogger(__name__)

def parse_file(file_path: str) -> str:
    """
    Parses a file based on its extension and returns its text content as a single string.
    
    Args:
        file_path: The absolute path to the file.

    Returns:
        The extracted text content, or an empty string if parsing fails or the file type is unsupported.
    """
    # Check if the file exists first
    if not os.path.exists(file_path):
        logger.error(f"File not found at path: {file_path}")
        return ""

    # Get the file extension and convert to lowercase
    _, extension = os.path.splitext(file_path)
    extension = extension.lower()

    loader = None
    if extension == '.pdf':
        loader = PyPDFLoader(file_path)
    elif extension == '.txt':
        # Specify UTF-8 encoding for broad compatibility
        loader = TextLoader(file_path, encoding='utf-8')
    elif extension == '.docx':
        loader = Docx2txtLoader(file_path)
    else:
        logger.warning(f"Unsupported file type '{extension}' for file: {file_path}")
        return ""

    try:
        logger.info(f"Loading and parsing file: {file_path}")
        documents = loader.load()
        # Combine the page_content of all loaded documents into a single string
        full_text = "\n".join([doc.page_content for doc in documents])
        logger.info(f"Successfully parsed file. Extracted {len(full_text)} characters.")
        return full_text
    except Exception as e:
        logger.error(f"An error occurred while parsing file {file_path}: {e}", exc_info=True)
        return ""