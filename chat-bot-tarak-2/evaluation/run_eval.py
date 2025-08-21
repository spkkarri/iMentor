# evaluation/run_eval.py
import os
import sys
import json
import logging
import time
<<<<<<< HEAD
=======
import re
>>>>>>> 4a9e8dee009d9196894c1ba3e07be509822895ee

# --- Path Setup ---
current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.join(os.path.dirname(current_dir), 'server')
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from ai_core_service import llm_handler, file_parser, faiss_handler, config

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("EVALUATION")

# --- Configuration ---
TEST_USER_ID = "evaluation_user"
TEST_DOCUMENT_PATH = os.path.join(server_dir, "syllabi", "machine_learning.md")
EVAL_DATASET_PATH = os.path.join(current_dir, "eval_dataset.json")

# The system we are testing
SYSTEM_UNDER_TEST_PROVIDER = "gemini" 

# ==================================================================
#  DEFINITIVE FIX: Use a fast, efficient provider as the "Judge"
# ==================================================================
EVALUATOR_PROVIDER = "groq"
EVALUATOR_MODEL = "llama3-8b-8192" # Groq's fast Llama3 model
# ==================================================================

_EVALUATOR_PROMPT_TEMPLATE = """You are an impartial judge. Your task is to evaluate the correctness of a generated answer based on an expected answer.
You must provide a score of 'Correct', 'Partial', or 'Incorrect' and a brief reasoning.

- **Correct:** The generated answer fully and accurately addresses the user's question and aligns with the expected answer.
- **Partial:** The generated answer addresses some parts of the question but is missing key information or contains minor inaccuracies.
- **Incorrect:** The generated answer is completely wrong, irrelevant, or fails to answer the question.

User Question: "{question}"
Expected Answer: "{expected_answer}"
Generated Answer: "{generated_answer}"

Provide your evaluation in a JSON object with two keys: "score" and "reasoning".
Your entire response must be ONLY the JSON object.

Example:
{{
  "score": "Correct",
  "reasoning": "The generated answer correctly identifies all four types of machine learning mentioned."
}}
"""

def get_api_keys_from_env():
    from dotenv import load_dotenv
    dotenv_path = os.path.join(server_dir, '.env')
    load_dotenv(dotenv_path=dotenv_path)
    
    keys = {}
    if os.getenv("ADMIN_GEMINI_API_KEY"):
        keys['gemini'] = os.getenv("ADMIN_GEMINI_API_KEY")
    if os.getenv("ADMIN_GROQ_API_KEY"):
        keys['grok'] = os.getenv("ADMIN_GROQ_API_KEY")
    
    if not keys.get('gemini') or not keys.get('grok'):
        raise ValueError("Evaluation requires both ADMIN_GEMINI_API_KEY and ADMIN_GROQ_API_KEY to be set in server/.env")
        
    return keys

def evaluate_answer_with_llm(question, expected_answer, generated_answer, api_keys):
<<<<<<< HEAD
=======
    """
    Evaluates a generated answer using an LLM. This version includes robust
    JSON parsing to handle imperfect outputs from the evaluator model.
    """
>>>>>>> 4a9e8dee009d9196894c1ba3e07be509822895ee
    prompt = _EVALUATOR_PROMPT_TEMPLATE.format(
        question=question,
        expected_answer=expected_answer,
        generated_answer=generated_answer
    )
    try:
<<<<<<< HEAD
        response_str = llm_handler._call_llm_for_task(
=======
        response_str = llm_handler.execute_task(
>>>>>>> 4a9e8dee009d9196894c1ba3e07be509822895ee
            prompt=prompt,
            llm_provider=EVALUATOR_PROVIDER,
            llm_model_name=EVALUATOR_MODEL,
            api_keys=api_keys,
            ollama_host=None
        )
<<<<<<< HEAD
        response_str = response_str.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(response_str)
=======
        
        # --- NEW ROBUST PARSING LOGIC ---
        # 1. Find the start and end of the JSON object in the response string.
        # This handles cases where the LLM adds text like "Here is the JSON:" before or after.
        json_match = re.search(r'\{.*\}', response_str, re.DOTALL)
        if json_match:
            clean_str = json_match.group(0)
            # 2. Attempt to parse the cleaned string.
            return json.loads(clean_str)
        else:
            # If no JSON object is found at all, raise an error.
            raise ValueError("No valid JSON object found in the LLM response.")
        # --- END OF NEW LOGIC ---

>>>>>>> 4a9e8dee009d9196894c1ba3e07be509822895ee
    except Exception as e:
        logger.error(f"Failed to evaluate answer with LLM: {e}")
        return {"score": "Error", "reasoning": str(e)}

def run_evaluation():
    logger.info("--- Starting RAG Pipeline Evaluation ---")
    start_time = time.time()
    
    try:
        api_keys = get_api_keys_from_env()
        logger.info(f"Loaded API keys for evaluator: {list(api_keys.keys())}")
    except ValueError as e:
        logger.error(e)
        return

    if not os.path.exists(TEST_DOCUMENT_PATH):
        logger.error(f"FATAL: Test document not found at '{TEST_DOCUMENT_PATH}'.")
        return

    logger.info(f"Loading test document: {os.path.basename(TEST_DOCUMENT_PATH)}")
    document_text = file_parser.parse_file(TEST_DOCUMENT_PATH)
    document_chunks = file_parser.chunk_text(document_text, "test_document.md", TEST_USER_ID)
    faiss_handler.add_documents_to_index(TEST_USER_ID, document_chunks)
    logger.info(f"Indexed {len(document_chunks)} chunks for user '{TEST_USER_ID}'.")

    with open(EVAL_DATASET_PATH, 'r') as f:
        eval_questions = json.load(f)
    logger.info(f"Loaded {len(eval_questions)} questions from dataset.")
    
    results = []
    score_counts = {"Correct": 0, "Partial": 0, "Incorrect": 0, "Error": 0}

    for item in eval_questions:
        question = item['question']
        expected = item['expected_answer']
        logger.info(f"\n--- Testing Question: {question} ---")

        relevant_docs = faiss_handler.query_index(TEST_USER_ID, question, k=5)
        context_text = "\n\n".join([doc.page_content for doc, score in relevant_docs])
        
        if not context_text:
            logger.warning("No context was found for this question from the document.")
        
<<<<<<< HEAD
        generated_answer, _ = llm_handler.generate_response(
            llm_provider=SYSTEM_UNDER_TEST_PROVIDER, # Test Gemini
            query=question,
            context_text=context_text,
            api_keys=api_keys
        )
=======
            generated_answer, _ = llm_handler.generate_response(
                llm_provider=SYSTEM_UNDER_TEST_PROVIDER,
                model_name="gemini-1.5-pro-latest", # Use a more powerful model for the test
                query=question,
                context_text=context_text,
                api_keys=api_keys
            )
>>>>>>> 4a9e8dee009d9196894c1ba3e07be509822895ee
        logger.info(f"Generated Answer: {generated_answer}")

        # Add a small delay to be a good API citizen
        time.sleep(2)

        evaluation = evaluate_answer_with_llm(question, expected, generated_answer, api_keys)
        logger.info(f"Evaluation Score: {evaluation.get('score')} | Reasoning: {evaluation.get('reasoning')}")
        
        score = evaluation.get('score', 'Error')
        score_counts[score] += 1
        results.append({
            "question": question,
            "expected": expected,
            "generated": generated_answer,
            "evaluation": evaluation
        })

    total_questions = len(eval_questions)
    correct_score = score_counts["Correct"] + (0.5 * score_counts["Partial"])
    accuracy_score = (correct_score / total_questions) * 100 if total_questions > 0 else 0

    logger.info("\n\n--- EVALUATION COMPLETE ---")
    logger.info(f"Total Questions: {total_questions}")
    logger.info(f"Correct: {score_counts['Correct']}")
    logger.info(f"Partial: {score_counts['Partial']}")
    logger.info(f"Incorrect: {score_counts['Incorrect']}")
    logger.info(f"Errors: {score_counts['Error']}")
    logger.info(f"Weighted Accuracy Score: {accuracy_score:.2f}%")
    logger.info(f"Total Time: {time.time() - start_time:.2f} seconds")
    logger.info("---------------------------\n")

    with open("evaluation_results.json", "w") as f:
        json.dump(results, f, indent=2)
    logger.info("Detailed results saved to evaluation_results.json")


if __name__ == "__main__":
    run_evaluation()