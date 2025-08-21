import os
from dotenv import load_dotenv
import sys

print(f"--- Debugging .env Loading ---")
print(f"Current script's directory: {os.path.dirname(os.path.abspath(__file__))}")

current_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.join(os.path.dirname(current_dir), 'server')
dotenv_path = os.path.join(server_dir, '.env')

print(f"Expected .env path: {dotenv_path}")

if os.path.exists(dotenv_path):
    print("\nSUCCESS: Found the .env file at the expected path.")
    load_dotenv(dotenv_path=dotenv_path)
    
    gemini_key = os.getenv("ADMIN_GEMINI_API_KEY")
    groq_key = os.getenv("ADMIN_GROQ_API_KEY")

    print(f"ADMIN_GEMINI_API_KEY loaded: {'Yes' if gemini_key else 'NO'}")
    print(f"ADMIN_GROQ_API_KEY loaded: {'Yes' if groq_key else 'NO'}")
    
    if not gemini_key or not groq_key:
        print("\nERROR: File was found, but keys are not loading. Check for typos or extra spaces in the .env file itself.")

else:
    print("\nFATAL ERROR: The .env file was NOT found at the expected path.")
    print("Please check your folder structure. The .env file must be in the 'server' directory.")

print("--- End of Debug ---")