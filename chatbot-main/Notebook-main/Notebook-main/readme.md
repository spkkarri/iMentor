
## ⚙️ Setup & Installation Guide

### 🔧 Prerequisites

*   **Python**: Version 3.9 or later.
*   **Node.js**: (Not strictly required for this Flask-based project with static frontend files, but good practice if you plan to expand frontend tooling).
*   **Ollama**: Installed and running. Ensure you have pulled the required models:
    *   `ollama pull llama3:8b` (or your chosen LLM model)
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
    *Ensure `requirements.txt` includes: `flask`, `flask-cors`, `waitress`, `python-dotenv`, `langchain`, `langchain-community`, `langchain-ollama`, `ollama`, `faiss-cpu`, `pymupdf`, `tiktoken`, `requests`, `httpx`, `flask-bcrypt`, `pymongo`,`duckduckgo-search`*

3.  **Configure Environment Variables**
    *   Rename `backend/.env.txt` to `backend/.env`.
    *   Edit `backend/.env` and update the following if necessary:
        ```env
        OLLAMA_BASE_URL=http://localhost:11434
        OLLAMA_MODEL=llama3:8b
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
