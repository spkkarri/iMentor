# In another file, for example: server/ai_core_service/main_chain.py

# 1. Import your newly defined tool
from .tools.web_search_tool import web_search

def get_answer_for_query(query: str):
    """
    This function attempts to find an answer, first in local documents,
    and then falls back to a web search if needed.
    """
    
    # --- Stage 1: Attempt to find info in local documents (hypothetical) ---
    print("--> Stage 1: Searching local documents...")
    local_result = None # Replace this with your actual local search function
    # local_result = local_retriever.get_relevant_documents(query)

    if local_result:
        # If you found something, process and return it
        return f"Information found in local documents:\n\n{local_result}"
    
    # --- Stage 2: Fallback to Web Search ---
    # This is the correct place for the logic from your original request.
    print("--> Stage 2: Performing robust web search...")
    try:
        # Call the imported tool's run method
        web_result = web_search.run(query) 
        return f"No information was found in local documents. According to a web search:\n\n{web_result}"
    except Exception as e:
        print(f"Error during web search: {e}")
        return "An error occurred while searching the web."

# --- Example of calling this function ---
if __name__ == "__main__":
    user_question = "What is the latest news about NASA's Artemis program?"
    final_answer = get_answer_for_query(user_question)
    print("\n--- FINAL ANSWER ---")
    print(final_answer)