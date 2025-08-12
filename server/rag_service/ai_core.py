# ./ai_core.py

# Standard Library Imports
import logging
import os
import io
import re
import copy
import uuid
from typing import Any, Callable, Dict, List, Optional, Union
from datetime import datetime # For improved date parsing in metadata

# --- Global Initializations ---
logger = logging.getLogger(__name__)

# --- Configuration Import ---
try:
    import config # This should import server/config.py
except ImportError as e:
    logger.critical(f"CRITICAL: Failed to import 'config' (expected server/config.py): {e}. ")
    # Depending on how critical config is, you might want to sys.exit(1)
    # For now, we'll let it proceed and other parts will fail if config isn't loaded.


# Local aliases for config flags, models, constants, and classes from config.py
# Ensure all these are actually defined in your config.py
PYPDF_AVAILABLE = getattr(config, 'PYPDF_AVAILABLE', False)
PDFPLUMBER_AVAILABLE = getattr(config, 'PDFPLUMBER_AVAILABLE', False)
PANDAS_AVAILABLE = getattr(config, 'PANDAS_AVAILABLE', False)
DOCX_AVAILABLE = getattr(config, 'DOCX_AVAILABLE', False)
PPTX_AVAILABLE = getattr(config, 'PPTX_AVAILABLE', False)
PIL_AVAILABLE = getattr(config, 'PIL_AVAILABLE', False)
FITZ_AVAILABLE = getattr(config, 'FITZ_AVAILABLE', False)
PYTESSERACT_AVAILABLE = getattr(config, 'PYTESSERACT_AVAILABLE', False)
SPACY_MODEL_LOADED = getattr(config, 'SPACY_MODEL_LOADED', False)
PYPDF2_AVAILABLE = getattr(config, 'PYPDF2_AVAILABLE', False)
EMBEDDING_MODEL_LOADED = getattr(config, 'EMBEDDING_MODEL_LOADED', False)
MAX_TEXT_LENGTH_FOR_NER  = getattr(config, 'MAX_TEXT_LENGTH_FOR_NER', 500000)
LANGCHAIN_SPLITTER_AVAILABLE = getattr(config, 'LANGCHAIN_SPLITTER_AVAILABLE', False)

PYPDF_PDFREADERROR = getattr(config, 'PYPDF_PDFREADERROR', Exception)
TESSERACT_ERROR = getattr(config, 'TESSERACT_ERROR', Exception)

# Libraries and Models (ensure these are None if not available to prevent AttributeError)
pypdf = getattr(config, 'pypdf', None)
PyPDF2 = getattr(config, 'PyPDF2', None)
pdfplumber = getattr(config, 'pdfplumber', None)
pd = getattr(config, 'pd', None)
DocxDocument = getattr(config, 'DocxDocument', None)
Presentation = getattr(config, 'Presentation', None)
Image = getattr(config, 'Image', None)
fitz = getattr(config, 'fitz', None)
pytesseract = getattr(config, 'pytesseract', None)
nlp_spacy_core = getattr(config, 'nlp_spacy_core', None)
document_embedding_model = getattr(config, 'document_embedding_model', None)
RecursiveCharacterTextSplitter = getattr(config, 'RecursiveCharacterTextSplitter', None)

# Constants
AI_CORE_CHUNK_SIZE = getattr(config, 'AI_CORE_CHUNK_SIZE', 1024) # Default if not in config
AI_CORE_CHUNK_OVERLAP = getattr(config, 'AI_CORE_CHUNK_OVERLAP', 200) # Default if not in config
DOCUMENT_EMBEDDING_MODEL_NAME = getattr(config, 'DOCUMENT_EMBEDDING_MODEL_NAME', "unknown_model")


# ==============================================================================
# Phase 2: Unified Rich Element Extraction Layer
# ==============================================================================

# Standard Output Structure for Element Extractors
# {
#     'text_content': Optional[str],
#     'tables': List[Union[pd.DataFrame, List[List[str]]]],
#     'images': List[Image.Image],
#     'parser_metadata': Dict[str, Any],
#     'is_scanned_heuristic': bool
# }

def _make_empty_extraction_result() -> Dict[str, Any]:
    """Helper to create a default empty result structure."""
    return {
        'text_content': None,
        'tables': [],
        'images': [],
        'parser_metadata': {},
        'is_scanned_heuristic': False
    }

def _extract_pdf_elements(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        logger.error(f"PDF file not found: {file_path}")
        return _make_empty_extraction_result()

    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    extracted_text_parts = []

    # 1. Text and Table Extraction with pdfplumber (if available)
    if PDFPLUMBER_AVAILABLE and pdfplumber:
        try:
            with pdfplumber.open(file_path) as pdf:
                num_pages_plumber = len(pdf.pages)
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text(x_tolerance=1, y_tolerance=1.5, layout=False) # layout=False for more raw text
                    if page_text and page_text.strip():
                        extracted_text_parts.append(page_text.strip())

                    # Extract tables
                    page_tables_data = page.extract_tables()
                    if page_tables_data:
                        for table_data_list in page_tables_data:
                            if not table_data_list: continue
                            if PANDAS_AVAILABLE and pd:
                                try:
                                    # Attempt to use first row as header if meaningful
                                    if len(table_data_list) > 1 and all(c is not None and isinstance(c, str) for c in table_data_list[0]):
                                        df = pd.DataFrame(table_data_list[1:], columns=table_data_list[0])
                                    else:
                                        df = pd.DataFrame(table_data_list)
                                    result['tables'].append(df)
                                except Exception as df_err:
                                    logger.warning(f"pdfplumber: DataFrame conversion error for table on page {i+1} of {file_base_name}: {df_err}. Storing as list.")
                                    result['tables'].append(table_data_list)
                            else:
                                result['tables'].append(table_data_list)
                
                result['text_content'] = "\n\n".join(extracted_text_parts).strip() or None
                if result['tables']: logger.info(f"pdfplumber: Extracted {len(result['tables'])} tables from {file_base_name}.")

                # Scanned PDF Heuristic (based on pdfplumber text)
                if num_pages_plumber > 0:
                    total_chars = sum(len(pt.replace(" ", "")) for pt in extracted_text_parts)
                    avg_chars_per_page = total_chars / num_pages_plumber
                    # Heuristic: low average characters per page suggests scanned
                    if avg_chars_per_page < 20 and total_chars < (num_pages_plumber * 50): # Tunable thresholds
                        result['is_scanned_heuristic'] = True
                        logger.info(f"PDF {file_base_name} potentially scanned (low avg text [{avg_chars_per_page:.1f} chars/page] from pdfplumber).")

        except Exception as e_plumber:
            logger.warning(f"pdfplumber: Error processing PDF {file_base_name}: {e_plumber}", exc_info=True)
            # If pdfplumber fails, pypdf (now pypdf) can be a fallback for basic text
            if PYPDF_AVAILABLE and pypdf and not result['text_content']:
                logger.info(f"Attempting pypdf fallback for text extraction from {file_base_name}")
                try:
                    reader = pypdf.PdfReader(file_path)
                    pypdf_text_parts = []
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text and page_text.strip():
                            pypdf_text_parts.append(page_text.strip())
                    result['text_content'] = "\n\n".join(pypdf_text_parts).strip() or None
                except Exception as e_pypdf:
                    logger.warning(f"pypdf fallback also failed for {file_base_name}: {e_pypdf}")


    # 2. Image Extraction with Fitz (PyMuPDF)
    if FITZ_AVAILABLE and fitz and PIL_AVAILABLE and Image:
        try:
            doc_fitz = fitz.open(file_path)
            if not result['is_scanned_heuristic'] and not result['text_content'] and len(doc_fitz) > 0:
                # If no text from plumber/pypdf, but fitz finds pages, highly likely scanned.
                result['is_scanned_heuristic'] = True
                logger.info(f"PDF {file_base_name} likely scanned (no text extracted, but pages found by fitz).")

            for page_idx in range(len(doc_fitz)):
                for img_info_tuple in doc_fitz.get_page_images(page_idx):
                    xref = img_info_tuple[0]
                    try:
                        img_bytes_dict = doc_fitz.extract_image(xref)
                        if img_bytes_dict and "image" in img_bytes_dict:
                             result['images'].append(Image.open(io.BytesIO(img_bytes_dict["image"])))
                    except Exception as img_err:
                        logger.warning(f"fitz: Could not extract/open image xref {xref} from page {page_idx} of {file_base_name}: {img_err}")
            if result['images']: logger.info(f"fitz: Extracted {len(result['images'])} images from {file_base_name}.")
            doc_fitz.close()
        except Exception as e_fitz:
            logger.warning(f"fitz: Error processing PDF {file_base_name} for images: {e_fitz}", exc_info=True)

    # 3. Metadata with PyPDF2 (or pypdf if PyPDF2 not available/fails)
    metadata_extractor = None
    if PYPDF2_AVAILABLE and PyPDF2:
        metadata_extractor = PyPDF2.PdfReader
        extractor_name = "PyPDF2"
    elif PYPDF_AVAILABLE and pypdf: # Fallback to pypdf for metadata
        metadata_extractor = pypdf.PdfReader
        extractor_name = "pypdf"

    if metadata_extractor:
        try:
            with open(file_path, 'rb') as f:
                reader = metadata_extractor(f)
                info = reader.metadata
                if info:
                    if hasattr(info, 'title') and info.title: result['parser_metadata']['title'] = str(info.title).strip()
                    if hasattr(info, 'author') and info.author: result['parser_metadata']['author'] = str(info.author).strip()
                    
                    pdf_date_formats = [
                        "D:%Y%m%d%H%M%S%z",    
                        "D:%Y%m%d%H%M%S",
                        "D:%Y%m%d%H%M%SZ",
                        "%Y%m%d%H%M%S%z",
                        "%Y%m%d%H%M%S",
                        "%Y%m%d%H%M%SZ",
                    ]
                    def parse_pdf_date(date_val_str_or_dt):
                        if isinstance(date_val_str_or_dt, datetime): return date_val_str_or_dt
                        if not isinstance(date_val_str_or_dt, str): return None
                        clean_date_str = date_val_str_or_dt.strip().rstrip("'")
                        for fmt in pdf_date_formats:
                            try: return datetime.strptime(clean_date_str, fmt)
                            except ValueError: continue
                        return None
                    

                    raw_creation_date = info.get("/CreationDate") if isinstance(info, dict) else getattr(info, 'creation_date', None)
                    creation_date_obj = parse_pdf_date(raw_creation_date)

                    if creation_date_obj: result['parser_metadata']['creation_date'] = creation_date_obj.isoformat()
                    
                    raw_mod_date = info.get("/ModDate") if isinstance(info, dict) else getattr(info, 'modification_date', None)
                    modification_date_obj = parse_pdf_date(raw_mod_date)
                    
                    if modification_date_obj: result['parser_metadata']['modification_date'] = modification_date_obj.isoformat()

                result['parser_metadata']['page_count'] = len(reader.pages)
        except Exception as e_meta:
            logger.warning(f"Metadata: Error using {extractor_name} for {file_base_name}: {e_meta}", exc_info=True)
            if 'page_count' not in result['parser_metadata'] and FITZ_AVAILABLE and fitz: # Fallback page count
                try:
                    doc_fitz_pc = fitz.open(file_path)
                    result['parser_metadata']['page_count'] = len(doc_fitz_pc)
                    doc_fitz_pc.close()
                except: pass


    return result

def _extract_docx_elements(file_path: str) -> Dict[str, Any]:
    if not (DOCX_AVAILABLE and DocxDocument and PIL_AVAILABLE and Image):
        logger.error("python-docx or Pillow not available. DOCX parsing will be limited.")
        return _make_empty_extraction_result()
    
    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    text_content_parts = []

    try:
        doc = DocxDocument(file_path)
        # Text
        for para in doc.paragraphs:
            if para.text.strip():
                text_content_parts.append(para.text.strip())
        result['text_content'] = "\n".join(text_content_parts).strip() or None

        # Tables
        for i, table in enumerate(doc.tables):
            table_list = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            if not table_list: continue
            if PANDAS_AVAILABLE and pd:
                try:
                    if len(table_list) > 1 and all(c for c in table_list[0]): # Use first row as header
                        result['tables'].append(pd.DataFrame(table_list[1:], columns=table_list[0]))
                    else:
                        result['tables'].append(pd.DataFrame(table_list))
                except Exception as df_err:
                    logger.warning(f"docx: DataFrame conversion error for table {i} in {file_base_name}: {df_err}. Storing as list.")
                    result['tables'].append(table_list)
            else:
                result['tables'].append(table_list)
        if result['tables']: logger.info(f"docx: Extracted {len(result['tables'])} tables from {file_base_name}.")

        # Images (Inline shapes)
        for rel_id, image_part in doc.part.image_parts:
             try:
                 img = Image.open(io.BytesIO(image_part.blob))
                 result['images'].append(img)
             except Exception as e_img:
                 logger.warning(f"docx: Error processing an image from {file_base_name}: {e_img}")
        # A more thorough way for inline_shapes if doc.part.image_parts is not sufficient:
        # for shape in doc.inline_shapes:
        #    if shape.type == MSO_SHAPE_TYPE.PICTURE: # Requires from docx.enum.shape import MSO_SHAPE_TYPE
        #        try:
        #            image_part = doc.part.related_parts[shape._inline.graphic.graphicData.pic.blipFill.blip.embed]
        #            img = Image.open(io.BytesIO(image_part.blob))
        #            result['images'].append(img)
        #        except Exception: pass # ignore if not an image or error
        if result['images']: logger.info(f"docx: Extracted {len(result['images'])} images from {file_base_name}.")


        # Metadata
        props = doc.core_properties
        if props.title: result['parser_metadata']['title'] = props.title
        if props.author: result['parser_metadata']['author'] = props.author
        if props.created: result['parser_metadata']['creation_date'] = props.created.isoformat()
        if props.modified: result['parser_metadata']['modification_date'] = props.modified.isoformat()
        result['parser_metadata']['page_count'] = len(doc.paragraphs) // 20 or 1 # Rough estimate

        # Scanned Heuristic
        if not result['text_content'] and result['images']:
            result['is_scanned_heuristic'] = True
            logger.info(f"DOCX {file_base_name} potentially image-based (no text, images present).")

    except FileNotFoundError:
        logger.error(f"docx: File not found: {file_path}")
    except Exception as e:
        logger.error(f"docx: Error parsing DOCX {file_base_name}: {e}", exc_info=True)
    
    return result

def _extract_pptx_elements(file_path: str) -> Dict[str, Any]:
    if not (PPTX_AVAILABLE and Presentation and PIL_AVAILABLE and Image):
        logger.error("python-pptx or Pillow not available. PPTX parsing will be limited.")
        return _make_empty_extraction_result()

    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    text_content_parts = []

    try:
        prs = Presentation(file_path)
        for slide_idx, slide in enumerate(prs.slides):
            slide_texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text_frame") and shape.text_frame and shape.text_frame.text.strip():
                    slide_texts.append(shape.text_frame.text.strip())
                elif hasattr(shape, "text") and shape.text.strip(): # For shapes with direct text
                    slide_texts.append(shape.text.strip())
                
                # Image extraction
                if hasattr(shape, "image"): # If shape is an image
                    try:
                        image_bytes = shape.image.blob
                        img = Image.open(io.BytesIO(image_bytes))
                        result['images'].append(img)
                    except Exception as e_img_shape:
                        logger.warning(f"pptx: Error extracting image from shape on slide {slide_idx} of {file_base_name}: {e_img_shape}")
            
            if slide_texts:
                text_content_parts.append("\n".join(slide_texts))
        
        result['text_content'] = "\n\n".join(text_content_parts).strip() or None
        if result['images']: logger.info(f"pptx: Extracted {len(result['images'])} images from {file_base_name}.")

        # Metadata
        props = prs.core_properties
        if props.title: result['parser_metadata']['title'] = props.title
        if props.author: result['parser_metadata']['author'] = props.author
        if props.created: result['parser_metadata']['creation_date'] = props.created.isoformat()
        if props.last_modified_by : result['parser_metadata']['last_modified_by'] = props.last_modified_by
        if props.modified : result['parser_metadata']['modification_date'] = props.modified.isoformat()

        result['parser_metadata']['page_count'] = len(prs.slides)

        # Scanned Heuristic
        if not result['text_content'] and result['images']:
            result['is_scanned_heuristic'] = True
            logger.info(f"PPTX {file_base_name} potentially image-based (no text, images present).")

    except FileNotFoundError:
        logger.error(f"pptx: File not found: {file_path}")
    except Exception as e:
        logger.error(f"pptx: Error parsing PPTX {file_base_name}: {e}", exc_info=True)

    return result

def _extract_csv_elements(file_path: str) -> Dict[str, Any]:
    if not (PANDAS_AVAILABLE and pd):
        logger.error("pandas not available. CSV parsing will be limited.")
        return _extract_generic_text_elements(file_path, ".csv") # Fallback to text

    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    try:
        df = pd.read_csv(file_path)
        result['tables'].append(df)
        # Create a text representation of the CSV for text_content
        # Could be markdown, simple string, or first N rows.
        # Using to_string() for now. Consider to_markdown() for better structure if text will be LLM input.
        result['text_content'] = df.to_string(index=False, na_rep='NULL').strip() or None
        logger.info(f"csv: Extracted 1 table (shape: {df.shape}) from {file_base_name}.")
    except FileNotFoundError:
        logger.error(f"csv: File not found: {file_path}")
    except Exception as e:
        logger.error(f"csv: Error parsing CSV {file_base_name}: {e}", exc_info=True)
        # Fallback to generic text if pandas fails
        return _extract_generic_text_elements(file_path, ".csv")
    return result


def _extract_generic_text_elements(file_path: str, file_type_ext: str) -> Dict[str, Any]:
    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
        result['text_content'] = text.strip() or None
        
        # For HTML/XML, optionally strip tags (basic)
        if file_type_ext in ['.html', '.xml'] and result['text_content']:
            stripped_text = re.sub(r'<[^>]+>', ' ', result['text_content'])
            result['text_content'] = re.sub(r'\s+', ' ', stripped_text).strip() or None

    except FileNotFoundError:
        logger.error(f"txt-like: File not found: {file_path}")
    except Exception as e:
        logger.error(f"txt-like: Error parsing {file_base_name}: {e}", exc_info=True)
    return result

def _extract_image_file_elements(file_path: str) -> Dict[str, Any]:
    if not (PIL_AVAILABLE and Image):
        logger.error("Pillow (PIL) not available. Image file parsing will fail.")
        return _make_empty_extraction_result()

    result = _make_empty_extraction_result()
    file_base_name = os.path.basename(file_path)
    try:
        img = Image.open(file_path)
        result['images'].append(img)
        result['is_scanned_heuristic'] = True # By definition, an image file is "scanned" for OCR
        logger.info(f"Image file {file_base_name} opened.")
    except FileNotFoundError:
        logger.error(f"image-file: File not found: {file_path}")
    except Exception as e:
        logger.error(f"image-file: Error opening {file_base_name}: {e}", exc_info=True)
    return result


def _get_rich_extraction_results(file_path: str) -> Dict[str, Any]:
    """Dispatcher for rich element extraction based on file type."""
    ext = os.path.splitext(file_path)[1].lower()
    logger.info(f"Rich extraction: Dispatching for file type '{ext}' ({os.path.basename(file_path)})")

    if ext == '.pdf':
        return _extract_pdf_elements(file_path)
    elif ext == '.docx':
        return _extract_docx_elements(file_path)
    elif ext == '.pptx':
        return _extract_pptx_elements(file_path)
    elif ext == '.csv':
        return _extract_csv_elements(file_path)
    elif ext in ['.txt', '.py', '.js', '.md', '.log', '.html', '.xml', '.json']:
        return _extract_generic_text_elements(file_path, ext)
    elif ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif']:
        return _extract_image_file_elements(file_path)
    else:
        logger.warning(f"Unsupported file extension for rich extraction: {ext} ({os.path.basename(file_path)}). Attempting generic text.")
        return _extract_generic_text_elements(file_path, ext) # Fallback for unknown types


# ==============================================================================
# Phase 3: Streamlined Main Processing Pipeline
# ==============================================================================

def _get_initial_parsed_document(file_path: str) -> Dict[str, Any]:
    """Calls the appropriate rich element extractor for the file."""
    return _get_rich_extraction_results(file_path)


# --- Stages 2-7 (OCR, Cleaning, Layout, Metadata, Chunking, Embedding) ---
# These functions are largely the same as your corrected versions, but will now consume
# the structured output from _get_initial_parsed_document.

def perform_ocr_on_images(image_objects: List[Any], file_base_name_for_log: str ="") -> str: # Added filename for logging
    if not image_objects: return ""
    if not (PYTESSERACT_AVAILABLE and pytesseract):
        logger.error(f"Pytesseract not available. OCR for {file_base_name_for_log} cannot be performed.")
        return ""

    logger.info(f"Performing OCR on {len(image_objects)} image(s) for {file_base_name_for_log}.")
    ocr_text_parts = []
    images_ocrd = 0
    for i, img_obj in enumerate(image_objects):
        try:
            if not (PIL_AVAILABLE and Image and isinstance(img_obj, Image.Image)):
                logger.warning(f"Skipping non-PIL Image object at index {i} for OCR of {file_base_name_for_log}.")
                continue
            # Improve image for OCR: convert to grayscale, potentially apply thresholding if needed
            processed_img_for_ocr = img_obj.convert('L') # Grayscale
            text = pytesseract.image_to_string(processed_img_for_ocr)
            if text and text.strip():
                ocr_text_parts.append(text.strip())
                images_ocrd += 1
        except Exception as e:
            if TESSERACT_ERROR and isinstance(e, TESSERACT_ERROR): # Check specific Tesseract error
                logger.critical(f"Tesseract executable not found or error for {file_base_name_for_log}. OCR will fail. Error: {e}")
                # Re-raise if it's a critical setup issue that will affect all subsequent OCR
                # For now, we'll let it try other images, but this indicates a setup problem.
            logger.error(f"Error during OCR for image {i+1}/{len(image_objects)} of {file_base_name_for_log}: {e}", exc_info=True)
    
    full_ocr_text = "\n\n--- OCR Text from Image ---\n\n".join(ocr_text_parts).strip()
    logger.info(f"OCR for {file_base_name_for_log}: Extracted {len(full_ocr_text)} chars from {images_ocrd} image(s).")
    return full_ocr_text


def clean_and_normalize_text_content(text: str, file_base_name_for_log: str ="") -> str:
    if not text or not text.strip(): return ""
    logger.info(f"Text cleaning for {file_base_name_for_log}: Initial length {len(text)}")
    
    # Basic regex cleaning (order matters)
    text = re.sub(r'<script[^>]*>.*?</script>|<style[^>]*>.*?</style>', ' ', text, flags=re.I | re.S) # Remove script/style
    text = re.sub(r'<[^>]+>', ' ', text) # Remove all other HTML tags
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE) # Remove URLs
    text = re.sub(r'\S*@\S*\s?', '', text, flags=re.MULTILINE) # Remove emails
    text = re.sub(r'\s*&\w+;\s*', ' ', text) # Remove HTML entities like  
    text = re.sub(r'[\n\r\t]+', ' ', text) # Normalize whitespace (newlines, tabs to single space)
    text = re.sub(r'\s+', ' ', text).strip() # Consolidate multiple spaces to one and strip ends
    
    # Character filtering (allow more common punctuation useful for context)
    # text = re.sub(r'[^\w\s.,!?"\'():;-]', '', text) # Keeps more standard punctuation
    # For more aggressive cleaning for embedding, you might use:
    text = re.sub(r'[^a-zA-Z0-9\s.,!?-]', '', text) # More restrictive, closer to your original

    text_lower = text.lower() # Convert to lowercase AFTER regex to preserve case for URLs/emails if needed

    if not (SPACY_MODEL_LOADED and nlp_spacy_core):
        logger.warning(f"SpaCy model not loaded for {file_base_name_for_log}. Skipping lemmatization. Returning regex-cleaned text.")
        return text_lower
    
    try:
        # Process in chunks if text is very long to avoid SpaCy memory issues, though less likely after cleaning
        max_spacy_len = 1000000 # SpaCy's default internal limit for nlp()
        if len(text_lower) > max_spacy_len:
            logger.warning(f"Text for SpaCy in {file_base_name_for_log} exceeds {max_spacy_len} chars. Processing in parts or truncating.")
            # Simple truncation for now, chunking for spacy is more complex
            text_lower = text_lower[:max_spacy_len]

        doc = nlp_spacy_core(text_lower, disable=['parser', 'ner']) # Disable unused pipes
        lemmatized_tokens = [
            token.lemma_ for token in doc 
            if not token.is_stop and \
               not token.is_punct and \
               not token.is_space and \
               len(token.lemma_) > 1 and \
               token.lemma_ != '-PRON-' # Exclude pronouns after lemmatization
        ]
        final_cleaned_text = " ".join(lemmatized_tokens)
        logger.info(f"SpaCy cleaning for {file_base_name_for_log}: Final length {len(final_cleaned_text)}")
        return final_cleaned_text
    except Exception as e:
        logger.error(f"SpaCy processing failed for {file_base_name_for_log}: {e}. Returning pre-SpaCy cleaned text.", exc_info=True)
        return text_lower


def reconstruct_document_layout(text_content: str, tables_data: List[Any], file_type: str, file_base_name_for_log: str ="") -> str:
    if not text_content and not tables_data: return ""
    logger.info(f"Layout reconstruction for {file_base_name_for_log} ({file_type}): Text len {len(text_content)}, Tables {len(tables_data)}")
    
    # Hyphenated word de-joining (if text_content is not None)
    processed_text = text_content if text_content else ""
    processed_text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', processed_text) # Across newlines
    # processed_text = re.sub(r'(\w+)-(\w+)', r'\1\2', processed_text) # Within same line (less common needed after initial parse)

    if tables_data:
        table_md_parts = []
        for i, table_obj in enumerate(tables_data):
            table_header = f"\n\n[START OF TABLE {i+1} extracted from {file_base_name_for_log}]\n"
            table_footer = f"\n[END OF TABLE {i+1}]\n"
            md_table_content = ""
            try:
                if PANDAS_AVAILABLE and pd and isinstance(table_obj, pd.DataFrame):
                    md_table_content = table_obj.to_markdown(index=False)
                elif isinstance(table_obj, list) and table_obj and all(isinstance(row, list) for row in table_obj):
                    # Basic list of lists to Markdown
                    if table_obj[0]: # Assume first row is header
                        md_table_content = "| " + " | ".join(map(str, table_obj[0])) + " |\n"
                        md_table_content += "| " + " | ".join(["---"] * len(table_obj[0])) + " |\n"
                        for row_data in table_obj[1:]:
                            if len(row_data) == len(table_obj[0]):
                                md_table_content += "| " + " | ".join(map(str, row_data)) + " |\n"
                            else: logger.warning(f"Table {i+1} (list) row length mismatch in {file_base_name_for_log}.")
                    else: md_table_content = "[Empty Table Data]"
                else: md_table_content = str(table_obj) # Fallback
            except Exception as e_table_md:
                logger.warning(f"Table {i+1} to Markdown conversion error for {file_base_name_for_log}: {e_table_md}. Using raw string.")
                md_table_content = str(table_obj)
            
            if md_table_content.strip():
                table_md_parts.append(table_header + md_table_content.strip() + table_footer)
        
        if table_md_parts:
            processed_text += "\n\n" + "\n\n".join(table_md_parts)
    
    # Final whitespace cleanup
    final_layout_text = re.sub(r'\s{2,}', ' ', processed_text).strip() # Consolidate multiple spaces
    logger.info(f"Layout reconstruction for {file_base_name_for_log}: Final length {len(final_layout_text)}")
    return final_layout_text


def extract_document_metadata_info(
    file_path: str, 
    processed_text: str, 
    parsed_doc_elements: Dict[str, Any], # Output from _get_initial_parsed_document
    original_file_name: str, 
    user_id: str
) -> Dict[str, Any]:
    logger.info(f"Metadata extraction for: {original_file_name} (User: {user_id})")
    
    parser_meta = parsed_doc_elements.get('parser_metadata', {})
    file_type_from_parser = os.path.splitext(original_file_name)[1].lower() # Fallback if not in parser_meta

    doc_meta = {
        'user_id': user_id,
        'original_name': original_file_name,
        'file_name': original_file_name,
        'file_path_on_server': file_path,
        'original_file_type': parser_meta.get('file_type', file_type_from_parser),
        'title': parser_meta.get('title', original_file_name),
        'author': parser_meta.get('author', "Unknown"),
        'creation_date': parser_meta.get('creation_date'),
        'modification_date': parser_meta.get('modification_date'),
        'page_count': parser_meta.get('page_count', 0),
        'char_count_processed_text': len(processed_text),
        'named_entities': {},
        'structural_elements': "Paragraphs" + (", Tables" if parsed_doc_elements.get('tables') else ""),
        'is_scanned_document': parsed_doc_elements.get('is_scanned_heuristic', False),
        'ocr_applied': False
    }

    # OS-level metadata (can augment or be overridden by parser_meta)
    try:
        doc_meta['file_size_bytes'] = os.path.getsize(file_path)
        if PANDAS_AVAILABLE and pd: # Using pandas for robust timestamp conversion
            # Only set OS dates if not already provided by a more specific parser
            if not doc_meta['creation_date']:
                 doc_meta['creation_date_os'] = pd.Timestamp(os.path.getctime(file_path), unit='s').isoformat()
            if not doc_meta['modification_date']:
                 doc_meta['modification_date_os'] = pd.Timestamp(os.path.getmtime(file_path), unit='s').isoformat()
    except Exception as e_os_meta:
        logger.warning(f"Metadata: OS metadata error for {original_file_name}: {e_os_meta}")

    # If page_count is still 0 after parser, estimate from text
    if doc_meta['page_count'] == 0 and processed_text:
        doc_meta['page_count'] = max(1, processed_text.count('\n\n') + 1) # Rough estimate

    # NER (Named Entity Recognition) - using SpaCy
    if processed_text and SPACY_MODEL_LOADED and nlp_spacy_core:
        logger.info(f"Extracting named entities for {original_file_name}...")
        try:
            text_for_ner = processed_text[:MAX_TEXT_LENGTH_FOR_NER] # Use config alias
            spacy_doc = nlp_spacy_core(text_for_ner) # NER pipe should be enabled by default
            
            entities_by_type = {}
            for ent in spacy_doc.ents:
                entities_by_type.setdefault(ent.label_, set()).add(ent.text)
            
            doc_meta['named_entities'] = {label: sorted(list(texts)) for label, texts in entities_by_type.items()}
            num_entities_found = sum(len(v) for v in doc_meta['named_entities'].values())
            logger.info(f"Extracted {num_entities_found} unique named entities for {original_file_name}.")
        except Exception as e_ner:
            logger.error(f"Metadata: NER error for {original_file_name}: {e_ner}", exc_info=True)
    else:
        logger.info(f"Skipping NER for {original_file_name} (no text or SpaCy model not loaded/configured for NER).")
    
    logger.info(f"Metadata extraction complete for {original_file_name}.")
    return doc_meta

# Chunking and Embedding functions remain largely the same as your corrected versions,
# just ensure they consume the correct data.
def chunk_document_into_segments(
    text_to_chunk: str,
    document_level_metadata: Dict[str, Any] # This is the output from extract_document_metadata_info
) -> List[Dict[str, Any]]:
    if not text_to_chunk or not text_to_chunk.strip():
        logger.warning(f"Chunking: No text for {document_level_metadata.get('file_name', 'unknown')}.")
        return []

    if not (LANGCHAIN_SPLITTER_AVAILABLE and RecursiveCharacterTextSplitter):
        logger.error("RecursiveCharacterTextSplitter not available. Cannot chunk text.")
        return []
        
    chunk_s = AI_CORE_CHUNK_SIZE
    chunk_o = AI_CORE_CHUNK_OVERLAP
    original_doc_name_for_log = document_level_metadata.get('file_name', 'unknown_doc')
    logger.info(f"Chunking {original_doc_name_for_log}: Size={chunk_s}, Overlap={chunk_o}")
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_s,
        chunk_overlap=chunk_o,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""], 
        keep_separator=True # Consider if True or False is better for your LLM
    )

    try:
        raw_text_segments: List[str] = text_splitter.split_text(text_to_chunk)
    except Exception as e_split: 
        logger.error(f"Chunking: Error splitting text for {original_doc_name_for_log}: {e_split}", exc_info=True)
        return []
        
    output_chunks: List[Dict[str, Any]] = []
    # Use a more robust base name if original name contains problematic characters for reference
    base_file_name_for_ref = re.sub(r'[^a-zA-Z0-9_-]', '_', os.path.splitext(original_doc_name_for_log)[0])


    for i, segment_content in enumerate(raw_text_segments):
        if not segment_content.strip(): 
            logger.debug(f"Skipping empty chunk at index {i} for {original_doc_name_for_log}.")
            continue

        # Create a deep copy of document-level metadata for each chunk
        chunk_specific_metadata = copy.deepcopy(document_level_metadata)
        
        qdrant_point_id = str(uuid.uuid4()) # Unique ID for this chunk in Qdrant

        # Add chunk-specific details to its metadata
        chunk_specific_metadata['chunk_id'] = qdrant_point_id 
        chunk_specific_metadata['chunk_reference_name'] = f"{base_file_name_for_ref}_chunk_{i:04d}"
        chunk_specific_metadata['chunk_index'] = i
        chunk_specific_metadata['chunk_char_count'] = len(segment_content)
        # Remove potentially very large or redundant fields from chunk metadata if necessary
        # e.g., chunk_specific_metadata.pop('named_entities', None) if too verbose per chunk
        
        output_chunks.append({
            'id': qdrant_point_id, # This ID is for Qdrant
            'text_content': segment_content,
            'metadata': chunk_specific_metadata # This payload goes into Qdrant
        })
    
    logger.info(f"Chunking: Split '{original_doc_name_for_log}' into {len(output_chunks)} non-empty chunks.")
    return output_chunks

def generate_segment_embeddings(document_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not document_chunks: return []
    if not (EMBEDDING_MODEL_LOADED and document_embedding_model):
        logger.error("Embedding model not loaded. Cannot generate embeddings.")
        for chunk_dict in document_chunks: chunk_dict['embedding'] = None
        return document_chunks

    model_name_for_logging = DOCUMENT_EMBEDDING_MODEL_NAME
    logger.info(f"Embedding {len(document_chunks)} chunks using {model_name_for_logging}.")
    
    texts_to_embed: List[str] = []
    valid_chunk_indices: List[int] = [] # To map embeddings back to original chunk objects

    for i, chunk_dict in enumerate(document_chunks):
        text_content = chunk_dict.get('text_content')
        if text_content and text_content.strip():
            texts_to_embed.append(text_content)
            valid_chunk_indices.append(i)
        else:
            chunk_dict['embedding'] = None # Ensure 'embedding' key exists
            logger.debug(f"Embedding: Chunk {chunk_dict.get('id', i)} has no text, skipping.")

    if not texts_to_embed:
        logger.warning("Embedding: No text content found in chunks to generate embeddings.")
        return document_chunks

    try:
        embeddings_np_array = document_embedding_model.encode(texts_to_embed, show_progress_bar=True) # Set to True for long lists
        
        for i, original_chunk_idx in enumerate(valid_chunk_indices):
            if i < len(embeddings_np_array):
                document_chunks[original_chunk_idx]['embedding'] = embeddings_np_array[i].tolist()
            else: # Should not happen if encode works correctly
                logger.error(f"Embedding: Mismatch in embedding count for chunk at original index {original_chunk_idx}.")
                document_chunks[original_chunk_idx]['embedding'] = None
        
        logger.info(f"Embedding: Generated and assigned embeddings to {len(valid_chunk_indices)} chunks.")
    except Exception as e_embed:
        logger.error(f"Embedding: Error during generation with {model_name_for_logging}: {e_embed}", exc_info=True)
        for original_chunk_idx in valid_chunk_indices: # Ensure all attempted chunks get None on error
            document_chunks[original_chunk_idx]['embedding'] = None
            
    return document_chunks


# --- Main Orchestration Function ---
def process_document_for_qdrant(
    file_path: str, # Could be empty if text_content_override is used
    original_name: str,
    user_id: str,
    text_content_override: Optional[str] = None # NEW parameter
) -> tuple[List[Dict[str, Any]], Optional[str], List[Dict[str, Any]]]:
    """
    Main orchestrator for processing a document or raw text.
    Returns:
        - final_chunks_for_qdrant: List of chunks with embeddings for Qdrant.
        - text_for_node_analysis: Consolidated text for Node.js general analysis (FAQ, Topics).
        - chunks_for_kg_worker: List of chunks with metadata (no embeddings) for KG worker.
    """
    logger.info(f"ai_core: Orchestrating document processing for '{original_name}', user '{user_id}'")
    
    # Check if source is valid (either text_content_override or existing file_path)
    if not text_content_override and not (file_path and os.path.exists(file_path)):
        logger.error(f"File not found at ai_core entry or no text_content_override: {file_path}")
        return [], None, []

    # Default return values for failure cases
    empty_qdrant_chunks = []
    no_analysis_text = None
    empty_kg_chunks = []

    try:
        initial_text_from_parser = None
        images_from_parser = []
        tables_from_parser = []
        is_scanned_heuristic = False
        file_type_from_parser = os.path.splitext(original_name)[1].lower() # Default type from original name

        if text_content_override:
            # If override is provided, use it directly, bypass file parsing.
            logger.info(f"ai_core: Using text_content_override for '{original_name}'.")
            initial_text_from_parser = text_content_override
            file_type_from_parser = "text_override" # Custom type for metadata for debugging/tracking
        else:
            # Original file parsing logic
            parsed_doc_elements = _get_initial_parsed_document(file_path)
            initial_text_from_parser = parsed_doc_elements.get('text_content')
            images_from_parser = parsed_doc_elements.get('images', [])
            tables_from_parser = parsed_doc_elements.get('tables', [])
            is_scanned_heuristic = parsed_doc_elements.get('is_scanned_heuristic', False)
            file_type_from_parser = os.path.splitext(original_name)[1].lower() # Or get from parsed_doc_elements if available

        # 2. OCR if needed (only if content was from a file/images and not explicitly overridden)
        ocr_text_output = ""
        ocr_applied_flag = False
        
        # Decide if OCR is necessary:
        # Only try OCR if there's no initial text (from parser or override) AND images were found
        # OR if it's explicitly an image file type and no override.
        should_ocr = (not text_content_override) and \
                     (is_scanned_heuristic or \
                      (file_type_from_parser in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif']) or \
                      (not initial_text_from_parser and images_from_parser) or \
                      (initial_text_from_parser and len(initial_text_from_parser) < 200 * len(images_from_parser) and images_from_parser))

        if should_ocr and images_from_parser:
            if PYTESSERACT_AVAILABLE and pytesseract:
                logger.info(f"OCR triggered for {original_name} based on heuristics/file type.")
                ocr_text_output = perform_ocr_on_images(images_from_parser, original_name)
                if ocr_text_output: ocr_applied_flag = True
            else:
                logger.warning(f"OCR needed for {original_name} but Pytesseract not available. Content may be incomplete.")
        
        # 3. Combine Text (Parser/Override + OCR)
        combined_raw_text_parts = []
        if initial_text_from_parser: combined_raw_text_parts.append(initial_text_from_parser)
        if ocr_text_output: combined_raw_text_parts.append(ocr_text_output)
        combined_raw_text = "\n\n".join(combined_raw_text_parts).strip()

        if not combined_raw_text and not tables_from_parser:
            logger.warning(f"No text content or tables for {original_name} after initial parsing/OCR. Processing cannot continue.")
            return empty_qdrant_chunks, no_analysis_text, empty_kg_chunks

        # 4. Clean Text
        cleaned_text = clean_and_normalize_text_content(combined_raw_text, original_name)
        if not cleaned_text and not tables_from_parser: # If cleaning results in empty text
            logger.warning(f"No meaningful text for {original_name} after cleaning, and no tables. Processing cannot continue.")
            return empty_qdrant_chunks, no_analysis_text, empty_kg_chunks

        # 5. Reconstruct Layout (Integrate Tables as Markdown)
        text_for_further_processing = reconstruct_document_layout(
            cleaned_text, # Use the cleaned text
            tables_from_parser,
            file_type_from_parser,
            original_name
        )
        raw_text_for_node_analysis = text_for_further_processing 

        # 6. Extract Comprehensive Metadata
        doc_metadata = extract_document_metadata_info(
            file_path if not text_content_override else f"virtual://{original_name}", # Provide a sensible path for metadata if override
            text_for_further_processing, # Pass the final text that will be chunked
            parsed_doc_elements if not text_content_override else {}, # Pass initial parse results or empty if override
            original_name,
            user_id
        )
        doc_metadata['ocr_applied'] = ocr_applied_flag # Update with actual OCR status
        doc_metadata['source_type_actual'] = file_type_from_parser # Capture true source type from URL processing

        # 7. Chunk Document
        chunks_with_metadata_for_qdrant_and_kg = chunk_document_into_segments(
            text_for_further_processing,
            doc_metadata # Pass rich metadata to chunks
        )
        if not chunks_with_metadata_for_qdrant_and_kg:
            logger.warning(f"No chunks produced for {original_name}. Cannot proceed with Qdrant/KG.")
            return empty_qdrant_chunks, raw_text_for_node_analysis, empty_kg_chunks

        # Prepare chunks for KG worker (these don't need embeddings yet)
        chunks_for_kg_worker = copy.deepcopy(chunks_with_metadata_for_qdrant_and_kg) 
        for chunk in chunks_for_kg_worker:
            chunk.pop('embedding', None) 

        # 8. Generate Embeddings for Qdrant chunks
        final_chunks_for_qdrant = generate_segment_embeddings(chunks_with_metadata_for_qdrant_and_kg)
        
        logger.info(f"ai_core: Successfully processed '{original_name}'. Generated {len(final_chunks_for_qdrant)} chunks for Qdrant.")
        return final_chunks_for_qdrant, raw_text_for_node_analysis, chunks_for_kg_worker

    except Exception as e:
        if TESSERACT_ERROR and isinstance(e, TESSERACT_ERROR):
            logger.critical(f"ai_core: Tesseract (OCR) not found processing {original_name}. OCR failed. Error: {e}", exc_info=False)
            raise
        
        logger.error(f"ai_core: Critical error processing {original_name}: {e}", exc_info=True)
        raise