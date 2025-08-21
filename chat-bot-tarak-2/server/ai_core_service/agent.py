# server/ai_core_service/agent.py

# --- Imports ---
import logging # <-- ADD THIS LINE
from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv
import os

# --- Local Imports (CORRECTED) ---
from .tools.document_search_tool import create_smart_search_tool_for_user
from .tools.web_search_tool import web_search
from .tools.quiz_generator_tool import quiz_generator_tool
from .llm_handler import get_handler

# --- Prompt Template (WITH THE CRITICAL FIX) ---
REACT_PROMPT_TEMPLATE = """
**You are an Expert Research Assistant and a helpful, detailed tutor.**
Your primary goal is to provide a comprehensive, accurate, and well-structured answer to the user's question by using the tools at your disposal.

**You have access to the following tools:**
{tools}

**YOUR PROCESS:**
1.  **Analyze & Plan:** Carefully analyze the user's question and create a clear, multi-step plan. State your plan in your first thought.
2.  **Gather Information:** Execute your plan by using the tools. You must use your tools; do not answer from memory. If one tool fails or provides poor information, think about why and try again with a different tool or a better query.
3.  **Synthesize:** Once you have gathered sufficient, high-quality information from your tools, you must synthesize it into a final answer.

**RESPONSE FORMAT:**
You must use the following format for your reasoning process.

Question: the user's input question you must answer
Thought: [Your reasoning about the plan and the next step]
Action: The action to take, which MUST be one of [{tool_names}]
Action Input: The input required by the chosen action.
Observation: The result provided by the action.
... (this Thought/Action/Action Input/Observation loop can repeat multiple times)

Thought: I have gathered all the necessary information and am ready to construct the final response.
Final Answer: [Your final, comprehensive answer begins here]

**CRITICAL RULES FOR YOUR FINAL ANSWER:**
1.  **Be Comprehensive & Detailed:** Your final answer must be thorough and explanatory. Do not provide short, one-sentence answers. Synthesize information from all relevant tool observations.
2.  **Use Markdown for Structure:** You MUST format your final answer using Markdown. Use headings (`##`), subheadings (`###`), bullet points (`*`), and bold text (`**text**`) to create a clear, organized, and easy-to-read response.
3.  **Cite Your Sources:** If you use the `web_search` tool, you MUST cite the source URL from the observation at the end of the relevant sentence or paragraph, like this: `... (Source: https://example.com)`.
4.  **Conclude Cleanly:** You MUST finish your entire process by using the `Final Answer:` prefix. There is no step after the Final Answer.

##########################################################################
############               THIS IS THE FIX                    ############
##########################################################################
**CRITICAL RULE FOR HANDLING AMBIGUITY:**
If the user's question is too vague, ambiguous, or if you lack the information to use a tool effectively (e.g., you need the text of a document but don't have it), you MUST NOT invent information or try to use a tool anyway.
Instead, you MUST use the `Final Answer:` prefix to directly ask the user for the clarification you need.
Example of this rule:
Question: "explain what the pdf is saying ?"
Thought: The user's question is ambiguous. I don't know which PDF they are referring to, and I cannot access local files. I need to ask them for more information.
Final Answer: I can definitely help with that! Could you please provide the text from the PDF, or tell me more about its topic?

Begin!

Question: {input}
Thought:{agent_scratchpad}
"""

# --- NEW: Main Agent Creation Function with Fallback Logic ---
def create_agent_with_fallback(user_id: str, api_keys: dict, ollama_host: str = None):
    """
    Creates and returns an AgentExecutor.
    It prioritizes using a powerful external LLM (Gemini or Groq) if API keys are provided.
    If no keys are available, it falls back to using a local Ollama instance.
    """
    llm_client = None
    provider_used = "N/A"

    # --- Attempt 1: Use Gemini (if key is available) ---
    if api_keys.get("gemini"):
        try:
            logging.info("Attempting to create agent with Gemini...")
            handler = get_handler(provider_name='gemini', api_keys=api_keys, model_name="gemini-1.5-pro-latest")
            llm_client = handler.client
            provider_used = "gemini"
        except Exception as e:
            logging.warning(f"Gemini key was present, but handler failed: {e}. Trying next provider.")

    # --- Attempt 2: Use Groq (if Gemini failed and Groq key is available) ---
    if not llm_client and api_keys.get("groq"):
        try:
            logging.info("Attempting to create agent with Groq...")
            handler = get_handler(provider_name='groq', api_keys=api_keys, model_name="llama3-70b-8192")
            llm_client = handler.client
            provider_used = "groq"
        except Exception as e:
            logging.warning(f"Groq key was present, but handler failed: {e}. Trying fallback.")
            
    # --- Attempt 3: Fallback to Ollama (if all else fails) ---
    if not llm_client:
        try:
            logging.info("API keys for Gemini/Groq not found or failed. Creating agent with Ollama fallback.")
            handler = get_handler(
                provider_name='ollama',
                api_keys={}, # No keys needed
                model_name="qwen2.5:14b-instruct", # A capable model for agentic tasks
                ollama_host=ollama_host # Pass the user's custom host if available
            )
            llm_client = handler.client
            provider_used = "ollama"
        except Exception as e:
            logging.error(f"FATAL: All LLM providers, including Ollama fallback, failed to initialize for agent: {e}")
            # If even Ollama fails, we cannot create an agent.
            raise ConnectionError("Could not initialize any LLM for the agent. Please check your API keys or ensure Ollama is running.") from e

    logging.info(f"Successfully initialized LLM for agent using provider: {provider_used}")
    
    # Now, create the agent executor using the successfully initialized LLM client
    return create_agent_executor(llm=llm_client, user_id=user_id, user_api_keys=api_keys)


# --- Agent Creation Function (Now a helper) ---
def create_agent_executor(llm, user_id: str, user_api_keys: dict):
    # This function remains completely unchanged.
    """
    Creates a secure, user-specific AgentExecutor.
    """
    # 1. Create the user-specific tool using the factory.
    user_smart_search_tool = create_smart_search_tool_for_user(user_id)

    # 2. Assemble the list of tools.
    tools = [user_smart_search_tool, web_search, quiz_generator_tool]
    
    # 3. Create the prompt.
    prompt = PromptTemplate.from_template(REACT_PROMPT_TEMPLATE)

    # 4. Create the agent with the personalized tools.
    agent = create_react_agent(llm, tools, prompt)
    
    agent_executor = AgentExecutor(
        agent=agent, 
        tools=tools,
        verbose=True, 
        handle_parsing_errors=True,
        return_intermediate_steps=True,
        max_iterations=15 
    )
    return agent_executor

# --- Test Block ---
if __name__ == '__main__':
    # (The rest of your file remains exactly the same)
    print("--- Running Agent End-to-End Test (User-Specific Tools) ---")
    dotenv_path = os.path.join(os.getcwd(), '.env')
    print(f"Agent test loading .env from: {dotenv_path}")
    load_dotenv(dotenv_path=dotenv_path)
    
    TEST_USER_ID = "test_user_for_agent_run"
    print(f"Agent will run as user: '{TEST_USER_ID}'")
    
    test_api_keys = {"gemini": os.getenv("ADMIN_GEMINI_API_KEY"), "groq": os.getenv("ADMIN_GROQ_API_KEY")}
    
    if not test_api_keys.get("gemini"):
        print("ERROR: ADMIN_GEMINI_API_KEY not found in .env.")
    else:
        try:
            agent_llm = get_handler(provider_name='gemini', api_keys=test_api_keys).client
            
            student_agent = create_agent_executor(
                llm=agent_llm, 
                user_id=TEST_USER_ID, 
                user_api_keys=test_api_keys
            )
            
            # Use the exact query that was causing the loop
            query = "explain what the pdf is saying ?"
            print(f"\n--- Starting Agent with Ambiguous Query ---\nQuery: '{query.strip()}'")
            
            response = student_agent.invoke({"input": query})
            print("\n--- Agent Final Answer ---")
            print(response.get('output'))

        except Exception as e:
            print(f"\n--- An error occurred during agent execution ---")
            print(f"Error Type: {type(e).__name__}, Message: {e}")