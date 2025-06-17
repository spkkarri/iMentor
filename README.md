# 📘 Local AI Engineering Tutor: Advanced RAG Assistant

A smart, interactive platform designed to enhance engineering education and research. This application leverages Retrieval-Augmented Generation (RAG) with local LLMs, advanced document analysis tools, voice interaction, and persistent user sessions to provide a comprehensive learning and assistance tool.

---

<!-- 🎬 **Demo Videos** (Optional: Add links to your demo videos here)
- 🧪 Product Walkthrough: [Link]
- 🛠️ Code Explanation: [Link] -->

---

## 🌟 Key Features

1.  **Conversational AI with RAG & Chain-of-Thought (CoT)**
    *   Answers queries based on user-uploaded PDF documents using a Retrieval-Augmented Generation pipeline.
    *   Powered by local Large Language Models (LLMs) through Ollama (e.g., `deepseek-r1:1.5b` for generation, `mxbai-embed-large` for embeddings).
    *   Displays the AI's step-by-step Chain-of-Thought (CoT) reasoning for transparency in both chat and analysis, enabling deeper understanding of how the AI arrives at its answers.
    *   Automatically cites sources from the documents within its responses.
    *   **Core Backend Packages**: `langchain`, `langchain-community`, `langchain-ollama`, `faiss-cpu`, `ollama`, `pymupdf`.

2.  **Advanced Document Analysis Suite**
    *   **FAQ Generation**: Automatically extracts potential Frequently Asked Questions and their answers directly from the document content.
    *   **Key Topics Identification**: Identifies and summarizes the main topics discussed within a selected document.
    *   **Interactive Mind Map Generation**: Creates hierarchical mind maps from document content, rendered using Mermaid.js for clear visual understanding of concepts and relationships.
    *   **Frontend Libraries**: Mermaid.js (for mind maps), Marked.js (for Markdown rendering).

3.  **Efficient PDF Document Management**
    *   Allows users to upload PDF files, which are then processed and added to the AI's knowledge base.
    *   Features automatic text extraction (using PyMuPDF), content chunking, and vectorization for effective RAG.
    *   Provides a clear list of available default and uploaded documents for analysis and chat.

4.  **Interactive UI with Enhanced Voice Capabilities**
    *   **Speech-to-Text (STT)**: Utilizes the browser's built-in Web Speech API (potentially with future integration for models like OpenAI Whisper) to convert spoken user queries into text input.
    *   **Text-to-Speech (TTS)**: Reads the AI's chat responses aloud using the browser's Web Speech API. A speaker icon is provided next to bot messages to trigger TTS.
    *   **UI Framework**: Bootstrap 5, custom CSS for a responsive dark theme.

5.  **Persistent Chat History & User Sessions**
    *   Saves complete chat sessions, including user queries, bot answers, Chain-of-Thought reasoning, and cited references.
    *   Utilizes a local SQLite database for robust chat history storage.
    *   Allows users to seamlessly resume previous conversations.

6.  **Secure User Authentication**
    *   Features user registration and login functionality to manage access.
    *   Passwords are securely hashed using Flask-Bcrypt.
    *   User account information is managed using MongoDB.
    *   **Authentication Packages**: `flask-bcrypt`, `pymongo`.

7.  **(Planned/In Development) Web Search Integration**
    *   Functionality to augment AI responses with real-time information from the web (e.g., using DuckDuckGo).

---

## 🤝 Team Contributions

| Teammate Name    | GitHub / ID      | Major Contributions                                                                                                             |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Aakhil Mohammad  | @Aakhil-Mohammad  | Added web search functionality (using DuckDuckGo).                                                                                |
|                  |                  | Improvised AI responses.                                                                                                        |
| Thrishitha Nalla | @trishitanalla   | Implemented Text-To-Speech (TTS) option. Changed Speech-To-Text model to OpenAI Whisper (or browser's Web Speech API as fallback). |
|                  |                  | Added mind map feature.                                                                                                         |
| Tejaswini Garaka | @Tejaswini-23    | Added login/register authentication and MongoDB connection.                                                                     |
| Mukesh Manepalli | @MukeshManepalli | Implemented Deep thinking (Chain of Thought – response generation by analyzing query in different perspectives and giving the final answer). |

---

## ⚙️ Setup & Installation Guide

### 🔧 Prerequisites

*   **Python**: Version 3.9 or later.
*   **Node.js**: (Not strictly required for this Flask-based project with static frontend files, but good practice if you plan to expand frontend tooling).
*   **Ollama**: Installed and running. Ensure you have pulled the required models:
    *   `ollama pull deepseek-r1:1.5b` (or your chosen LLM model)
    *   `ollama pull mxbai-embed-large` (or your chosen embedding model)
    *   Verify Ollama is accessible (default: `http://localhost:11434`).
*   **MongoDB**: Installed and running (for user authentication).
*   **Git**: For cloning the repository.

### 🧪 Step-by-Step Installation

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd <your-repository-name>/backend
    ```

2.  **Set up Python Environment & Install Dependencies**
    ```bash
    # Create a virtual environment (recommended)
    python -m venv venv
    # Activate the virtual environment
    # On Windows:
    # venv\Scripts\activate
    # On macOS/Linux:
    # source venv/bin/activate

    # Install Python packages
    pip install -r requirements.txt
    ```
    *Ensure `requirements.txt` includes: `flask`, `flask-cors`, `waitress`, `python-dotenv`, `langchain`, `langchain-community`, `langchain-ollama`, `ollama`, `faiss-cpu`, `pymupdf`, `tiktoken`, `requests`, `httpx`, `flask-bcrypt`, `pymongo`. (Add `duckduckgo-search` if Aakhil's web search is implemented in Python).*

3.  **Configure Environment Variables**
    *   Rename `backend/.env.txt` to `backend/.env`.
    *   Edit `backend/.env` and update the following if necessary:
        ```env
        OLLAMA_BASE_URL=http://localhost:11434
        OLLAMA_MODEL=deepseek-r1:1.5b
        OLLAMA_EMBED_MODEL=mxbai-embed-large
        LOGGING_LEVEL=INFO
        # Add any other environment variables your config.py might expect
        # e.g., for database connections if different from defaults
        ```

4.  **Initialize Database Schema & Default PDF Index**
    *   **User Authentication Database (MongoDB)**: Ensure your MongoDB server is running. The application will connect to it as defined (typically `mongodb://localhost:27017/`).
    *   **Chat History Database (SQLite)**: The SQLite database (`chat_history.db` by default) will be created/initialized automatically by `database.py` when the app starts or `init_db()` is called.
    *   **Process Default PDFs (Optional but Recommended for Initial Setup)**:
        *   Place any default PDF documents you want to be indexed at startup into the `backend/default_pdfs/` folder.
        *   Run the `default.py` script to build the initial FAISS vector store:
            ```bash
            python default.py
            ```
        *   This script requires Ollama to be running and accessible.

5.  **Run the Backend Application**
    ```bash
    python app.py
    ```
    The application will typically be served on `http://localhost:5000` (or the port specified in your run configuration).

6.  **Access the Application**
    *   Open your web browser and navigate to `http://localhost:5000` (or the configured URL).

---

## 🛠️ Running the Ollama Unit Test (Optional)
To verify Ollama model accessibility independently:
```bash
python Ollama_unittest.py
