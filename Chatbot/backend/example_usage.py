from reasoning_chatbot import ReasoningChatbot
from langchain_community.llms.ollama import Ollama

def main():
    """
    Example usage of the ReasoningChatbot.
    """
    print("Initializing LLM. This may take a moment...")
    try:
        # --- Configuration ---
        # Ensure you have a model like 'llama3' or 'mistral' pulled in Ollama.
        # Check available models with `ollama list`
        llm = Ollama(model="tinyllama", temperature=0.1)
        # Test the connection
        llm.invoke("Hi")
    except Exception as e:
        print(f"\n--- FATAL ERROR ---")
        print(f"Could not connect to the Ollama LLM.")
        print(f"Please ensure the Ollama server is running and the specified model is available.")
        print(f"You can start Ollama with 'ollama serve' and pull a model with 'ollama pull llama3'.")
        print(f"Error details: {e}")
        return

    print("LLM Initialized. Setting up Reasoning Chatbot...")
    
    # Initialize the chatbot with web search enabled
    chatbot = ReasoningChatbot(llm=llm, web_search_enabled=True)

    # --- Example 1: A complex technical query ---
    print("\n" + "="*50)
    print("Query 1: What is Retrieval-Augmented Generation (RAG)?")
    print("="*50 + "\n")
    
    query1 = "What is Retrieval-Augmented Generation (RAG) in the context of large language models?"
    response1 = chatbot.ask(query1)
    
    print("\n--- CHATBOT RESPONSE ---")
    print(response1)
    print("--- END OF RESPONSE ---\n")

    # --- Example 2: A query about a concept with practical implications ---
    print("\n" + "="*50)
    print("Query 2: Explain the concept of 'technical debt' in software engineering.")
    print("="*50 + "\n")

    query2 = "Explain the concept of 'technical debt' in software engineering."
    response2 = chatbot.ask(query2)

    print("\n--- CHATBOT RESPONSE ---")
    print(response2)
    print("--- END OF RESPONSE ---\n")

    # --- Example 3: Demonstration with document context and no web search ---
    print("\n" + "="*50)
    print("Query 3: How is our project doing based on this status update?")
    print("="*50 + "\n")

    # Disable web search for this instance to rely only on the provided context
    chatbot_no_search = ReasoningChatbot(llm=llm, web_search_enabled=False)
    
    project_status_context = """
    Project Phoenix - Weekly Status Update:
    - The new UI authentication module is complete and deployed to staging. User feedback is positive.
    - The database migration task is 40% complete but is blocked by a performance issue in the new indexing service.
    - Team bandwidth is reduced this week due to two members on leave.
    - Q3 financial projections are looking stable.
    """
    query3 = "What is the status of Project Phoenix and what are the key risks?"
    response3 = chatbot_no_search.ask(query3, document_context=project_status_context)

    print("\n--- CHATBOT RESPONSE (No Web Search) ---")
    print(response3)
    print("--- END OF RESPONSE ---\n")


if __name__ == "__main__":
    main()