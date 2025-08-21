# server/ai_core_service/tools/quiz_generator_tool.py

import json # Make sure this import is at the top
from langchain.tools import BaseTool
# We NO LONGER need BaseModel, Field, or Type

# The tool is self-contained and gets its LLM via the handler/router.
from ai_core_service.llm_router import LLMRouter


# We DO NOT define an input schema class anymore.

class QuizGeneratorTool(BaseTool):
    """A tool for generating quizzes that handles raw JSON string input."""
    
    name: str = "quiz_generator"
    # The description still guides the agent to produce JSON.
    description: str = (
        "Use this tool to create a multiple-choice quiz. "
        "The Action Input MUST be a single-line, valid JSON string "
        "containing 'topic', 'context', and 'api_keys' keys."
    )
    # We REMOVE the args_schema. The tool now accepts a raw string.

    # The _run method now accepts a single string argument.
    def _run(self, tool_input: str) -> str:
        """Use the tool by parsing a raw JSON string."""
        print(f"--- Calling QuizGeneratorTool with raw string input: '{tool_input}' ---")
        
        try:
            # MANUALLY PARSE THE JSON
            data = json.loads(tool_input)
            topic = data['topic']
            context = data['context']
            api_keys = data['api_keys']
        except (json.JSONDecodeError, KeyError) as e:
            return f"Error: Invalid JSON input. The tool received a malformed string. Error: {e}"

        if not api_keys:
             return "Error: API keys were not found in the tool's input."

        try:
            # STEP 1: Create an instance of our new router
            router = LLMRouter(api_keys=api_keys)

            # STEP 2: Ask the router for the best LLM for this specific task
            # The task_type 'quiz_generation' must match a key in the router's table.
            llm_handler = router.get_llm_for_task(task_type="quiz_generation")
            
            print(f"--- QuizGeneratorTool routed to use {llm_handler.__class__.__name__} ---")

            # The rest of the logic remains the same
            num_questions = 2
            
            prompt = f"""
            You are an expert quiz creator. Your task is to generate a multiple-choice quiz based ONLY on the provided context.

            Topic: "{topic}"
            Number of Questions: {num_questions}

            Context:
            ---
            {context}
            ---

            Please generate a {num_questions}-question multiple-choice quiz. Each question must have exactly 4 options (A, B, C, D) and you must clearly indicate the single correct answer after each question.
            """
            response = llm_handler.generate_response(prompt, is_chat=False)
            return response
        except Exception as e:
            return f"Error: Failed to generate quiz. {e}"

    # The async version also accepts a single string.
    async def _arun(self, tool_input: str) -> str:
        """Use the tool asynchronously by parsing a raw JSON string."""
        # For simplicity, we can make this a blocking call in the async context.
        # For a truly async implementation, the LLMRouter and handler would need async methods.
        return self._run(tool_input)

# Create a single, exportable instance of the tool
quiz_generator_tool = QuizGeneratorTool()


# The test block is updated to test the new raw string input method.
if __name__ == '__main__':
    print("--- Running QuizGeneratorTool Unit Test (Raw String Input Design) ---")
    
    from dotenv import load_dotenv
    import os
    
    # Adjust path to find the .env file at the project root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
    dotenv_path = os.path.join(project_root, '.env')

    print(f"Attempting to load .env file from: {dotenv_path}")
    if not os.path.exists(dotenv_path):
        # Fallback for different execution contexts
        dotenv_path = os.path.join(os.getcwd(), '.env')
        print(f"Fallback: Attempting to load .env file from: {dotenv_path}")

    load_dotenv(dotenv_path=dotenv_path)
    
    test_api_keys = {
        "gemini": os.getenv("ADMIN_GEMINI_API_KEY"),
        "groq": os.getenv("ADMIN_GROQ_API_KEY")
    }

    if not test_api_keys.get("gemini"):
        print("ERROR: ADMIN_GEMINI_API_KEY not found in .env file for testing.")
    else:
        test_context = """
        Supervised learning is a subcategory of machine learning and artificial intelligence. 
        It is defined by its use of labeled datasets to train algorithms that to classify data or predict outcomes accurately. 
        As input data is fed into the model, it adjusts its weights until the model has been fitted appropriately. 
        Common algorithms include linear regression, logistic regression, and support vector machines.
        """
        
        # 1. Create the dictionary for the tool's arguments.
        tool_input_dict = {
            "topic": "Supervised Learning",
            "context": test_context,
            "api_keys": test_api_keys
        }
        
        # 2. Convert the dictionary to a JSON string, which is what the tool now expects.
        tool_input_string = json.dumps(tool_input_dict)
        
        print("\n--- Running Tool with Raw JSON String Input ---")
        # 3. Call the tool with the string.
        result = quiz_generator_tool.run(tool_input_string)
        
        print("\n--- Tool Output ---")
        print(result)