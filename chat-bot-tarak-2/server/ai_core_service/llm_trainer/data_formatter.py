# FusedChatbot/server/scripts/format_data.py

import json
import logging
import os

# --- Configuration ---
# Configure logging for clear, informative output
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Define file paths relative to this script's location for portability
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DATA_PATH = os.path.join(CURRENT_DIR, 'raw_data.json')
OUTPUT_DATASET_PATH = os.path.join(CURRENT_DIR, 'formatted_dataset.jsonl')

# --- Data Formatting Functions ---

def format_chat_pairs(chat_pairs: list[dict]) -> list[dict]:
    """
    Formats raw chat pairs into a structured text format for fine-tuning.

    This function converts a list of prompt/response dictionaries into the
    instruction-following format expected by many models (e.g., Llama, Mistral).
    Example: "<s>[INST] {prompt} [/INST] {response} </s>"

    Args:
        chat_pairs: A list of dictionaries, each with 'prompt' and 'response' keys.

    Returns:
        A list of dictionaries, each with a single 'text' key holding the formatted string.
    """
    logging.info(f"Formatting {len(chat_pairs)} raw chat pairs...")
    formatted_examples = []
    for pair in chat_pairs:
        prompt = pair.get('prompt', '').strip()
        response = pair.get('response', '').strip()

        # Skip any pairs that are missing a prompt or a response
        if not prompt or not response:
            continue
        
        # This is a widely used format for instruction-tuned models.
        # <s> and </s> are start/end of sequence tokens.
        # [INST] and [/INST] clearly delineate the user's instruction.
        formatted_text = f"<s>[INST] {prompt} [/INST] {response} </s>"
        
        # The final dataset is a list of these dictionaries, suitable for JSONL
        formatted_examples.append({"text": formatted_text})
    
    logging.info(f"Successfully created {len(formatted_examples)} formatted chat examples.")
    return formatted_examples

def format_documents_as_qa(documents: list) -> list:
    """
    [PLACEHOLDER] In a real pipeline, this function would use a powerful LLM
    to generate high-quality Question/Answer pairs from the document text.
    For now, it returns an empty list.
    """
    logging.warning("Skipping document-to-QA formatting. This is a placeholder for future implementation.")
    # Example of what this might do in the future:
    # qa_pairs = llm.generate_qa(documents)
    # return format_chat_pairs(qa_pairs) # Reuse the same formatting logic
    return []

# --- Script Execution ---

if __name__ == '__main__':
    logging.info("--- Starting Full Data Formatter Script ---")

    if not os.path.exists(RAW_DATA_PATH):
        logging.error(f"Input file not found: {RAW_DATA_PATH}. Please run data_collection.py first.")
    else:
        try:
            with open(RAW_DATA_PATH, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to read or parse {RAW_DATA_PATH}: {e}")
            # Exit if the JSON is malformed
            exit()
        
        # 1. Format data from both sources
        chat_examples = format_chat_pairs(raw_data.get('chat_pairs', []))
        doc_examples = format_documents_as_qa(raw_data.get('documents', []))
        
        # 2. Combine into a single dataset
        final_dataset = chat_examples + doc_examples
        
        # 3. Write to a .jsonl file (JSON Lines format)
        if final_dataset:
            try:
                with open(OUTPUT_DATASET_PATH, 'w', encoding='utf-8') as f:
                    for entry in final_dataset:
                        f.write(json.dumps(entry, ensure_ascii=False) + '\n')
                logging.info(f"Successfully saved {len(final_dataset)} examples to {OUTPUT_DATASET_PATH}")
            except IOError as e:
                logging.error(f"Failed to write formatted dataset: {e}")
        else:
            logging.warning("No data was generated. The output file will not be created.")


        print("\n--- Final Summary ---")
        print(f"Total formatted examples created: {len(final_dataset)}")
        if final_dataset:
            print("\n--- Example of a formatted entry from the final dataset ---")
            print(json.dumps(final_dataset[0], indent=2))
        
        logging.info("--- Data Formatter Script Finished ---")