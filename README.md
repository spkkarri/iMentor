# AI Tutor: Intelligent Learning Assistant

This project is a comprehensive AI-powered tutoring application designed to assist users through interactive chat, document analysis, and knowledge exploration. It integrates multiple Large Language Models (LLMs), Retrieval Augmented Generation (RAG) for contextual understanding from user-uploaded documents, and knowledge graph capabilities for critical thinking. The system also includes an admin interface for managing shared knowledge resources.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

*   **Node.js**: Version 18.x or later.
*   **npm**: For managing Node.js packages.
*   **Python**: Version 3.9 - 3.11 recommended. Check `server/rag_service/requirements.txt` for specific library compatibility.
*   **pip**: For installing Python packages.
*   **MongoDB**: A running instance for data storage (user accounts, chat history, document metadata).
*   **Docker**: Docker desktop version is required to run the containers(Neo4j & Qdrant)
    *   **Neo4j**: A running instance for graph database (used by the Python RAG service for knowledge graphs).
    *   **Qdrant**: A running instance for vector database (used by the Python RAG service).
*   **Google Gemini API Key** (Mandatory): If you plan to use Google's Gemini models.
*   **Ollama** (Optional): If you plan to use locally hosted Ollama models. Ensure Ollama is installed, running, and accessible.
*   **Tesseract OCR** (Mandatory): For processing image-based documents in the RAG service. Ensure it's installed and the path to the executable is correctly set in `server/rag_service/config.py` (via the `TESSERACT_CMD` environment variable loaded into `server/.env`).

## Installation Steps

1.  **Clone the Repository:**
    ```bash
        git clone `https://github.com/tej-a192/chatbot-Team-2.git`
        cd `chatbot-Team-2`
    ```

2.  **Backend Setup (Node.js Server):**
    *   Navigate to the server directory:
        ```bash
            cd server
        ```

    *   Create a `.env` file by copying `server/.env.example` (if it exists) or create it manually. Populate it with your specific configurations:
        ```bash
            PORT=5001
            MONGO_URI="your_mongodb_connection_string"
            JWT_SECRET="your_strong_jwt_secret"
            GEMINI_API_KEY="your_gemini_api_key" # If using Gemini
            PYTHON_RAG_SERVICE_URL="http://127.0.0.1:5000" # URL for the Python RAG service
            OLLAMA_API_BASE_URL="http://<ollama_host>:<ollama_port>" # If using Ollama
            OLLAMA_DEFAULT_MODEL="your_default_ollama_model" # e.g., qwen2.5:14b-instruct
            # Add Neo4j connection details if Python service reads them from this .env
            NEO4J_URI="bolt://localhost:7687"
            NEO4J_USERNAME="neo4j_user"
            NEO4J_PASSWORD="password"
            NEO4J_DATABASE="neo4j"
            # Add Qdrant connection details if Python service reads them from this .env
            QDRANT_HOST="localhost"
            QDRANT_PORT=6333
            # Ensure FIXED_ADMIN_USERNAME and FIXED_ADMIN_PASSWORD match frontend/.env for admin login
            FIXED_ADMIN_USERNAME="admin" 
            FIXED_ADMIN_PASSWORD="admin123"
        ```

    *   Install dependencies:
        ```bash
            npm install
        ```
3. **Tesseract OCR Installation & Setup:**
    * Installation: Follow this guide to install Tesseract OCR
    ```bash
        https://github.com/UB-Mannheim/tesseract/wiki#tesseract-at-ub-mannheim
    ```

    * Setup : 
    ```bash
        Add the `C:\Program Files\Tesseract-OCR` in the system environment variables
    ```
4. **Download and setup FFmpeg (used for podcast audio generation):**
   - Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
   - Extract to: `C:\ffmpeg`
   - Add `C:\ffmpeg\bin` to your system’s environment variables

3.  **Backend Setup (Python RAG & KG Service):**
    *   Navigate to the Python service directory:
        ```bash
            cd server/rag_service
        ```
    *   Install Python dependencies:
        ```bash
            pip install -r requirements.txt
        ```
    *   Ensure `config.py` correctly loads necessary environment variables (it typically reads from `server/.env` via `os.getenv`). Verify paths or settings like `TESSERACT_CMD` if you customized them.
    *   Run the following command to install the required SpaCy model after installing Python dependencies:
    ```bash
    python -m spacy download en_core_web_sm
    ```

    
4.  **Running the Backend (RAG & Node Server):**
    
    *   Run the Docker Containers(Qdrant & Neo4j):  Make sure Docker Desktop is running in the background 
        ```bash
            cd server/rag_service
            docker-compose up -d
        ```
        This command will the run the instances of Qdrant & Neo4j    
    
    *   Run the Python Flask application:
        ```bash
            cd server/rag_service
            python app.py
        ```
        This service will typically run on port 5000 (as configured by `PYTHON_RAG_SERVICE_URL` in `server/.env` and `API_PORT` in `server/rag_service/config.py`).
    
    *   Start the Node.js backend:
        ```bash
            cd server
            npm start 
        ```
        The server will typically run on the port specified in your `server/.env` file (e.g., `http://localhost:5001`).


5.  **Frontend Setup:**
    *   Navigate to the frontend directory:
        ```bash
            cd frontend
        ```
    *   Create a `.env` file. You can copy `frontend/.env.example` if available, or create one based on the provided `frontend/.env` content:
        ```bash
            VITE_API_BASE_URL=http://localhost:5001/api # Should match your Node.js backend API URL
            VITE_ADMIN_USERNAME=admin
            VITE_ADMIN_PASSWORD=admin123
        ```
    *   Install dependencies:
        ```bash
            npm install
        ```
6.  **Running the Frontend:**
    *   Start the frontend development server:
        ```bash
            cd frontend
            npm run dev
        ```
        The frontend will typically be available at `http://localhost:5173` (or another port indicated by Vite).

5.  **Running the Full Application:**
    *   Ensure MongoDB, Qdrant, and Neo4j services are running.
    *   If using Ollama, ensure it's running and accessible.
    *   Start the Python RAG & KG Service (`server/rag_service/app.py`).
    *   Start the Node.js Backend Server (`server/server.js`).
    *   Start the Frontend Development Server (`cd frontend && npm run dev`).
    *   Access the application through the frontend URL provided by Vite.

## Features

*   **User Authentication**: Secure signup and login for regular users.
*   **Admin Portal**: Dedicated login and dashboard for administrators to manage shared documents and view their analysis.
*   **Interactive Chat Interface**: Real-time chat with an AI tutor.
*   **Multi-LLM Support**:
    *   Integration with Google Gemini models.
    *   Integration with local Ollama models.
    *   Users can switch between configured LLM providers.
*   **Retrieval Augmented Generation (RAG)**:
    *   Users can upload their documents.
    *   Advanced file parsing
    *   The AI can use content from these documents to provide contextual answers.
    *   Option to toggle RAG functionality for chat.
*   **Knowledge Graph (KG) Enhanced Critical Thinking**:
    *   AI can leverage knowledge graphs derived from documents for more in-depth responses.
    *   Toggle for enabling/disabling KG-based critical thinking.
*   **Document Management**:
    *   **User Documents**: Upload, list, and delete personal documents for RAG and analysis.
    *   **Default Documents**: Admins can upload, manage, and view automated analysis (FAQ, Topics, Mindmap) of shared documents. These can be selected as "Subjects" for focused chat by regular users.
*   **Advanced Analysis Tools**:
    *   **FAQ Generator**: Automatically creates Frequently Asked Questions from a selected document.
    *   **Key Topics Extractor**: Identifies and summarizes key topics within a document.
    *   **Mind Map Creator**: Generates a Mermaid.js mind map from document content.
*   **Chat History**: View and reload past chat sessions.
*   **Customizable System Prompts**:
    Users can define or select preset system prompts to guide the AI's behavior.
    *   Friendly Tutor
    *   Concept Explorer
    *   Knowledge Check
    *   Custom Prompt (Editable)
*   **Subject Focus for Chat**: Users can select an admin-uploaded document (as a "Subject") to focus the RAG chat context.
*   **Agentic Frameworks**:
    *   **Web Search Agent**:  
        We implemented a web search agentic framework that empowers the chatbot to fetch real-time information from the internet using **DuckDuckGo**. The agent dynamically decides how to respond based on the user's query:
        * If the question is factual or answerable by the LLMs (Gemini or Ollama), it directly fetches a response using the model.
        * If the question requires up-to-date or external information, the query is routed through a web search agent that retrieves relevant content from DuckDuckGo and integrates it into the final answer.
   *   **Podcast Generator**:  
        We implemented a podcast generation agentic framework that transforms documents into spoken audio using **gTTS (Google Text-to-Speech)**. This feature allows users to listen to the contents of any uploaded document as a podcast:
        * The system first extracts and processes the full text content from the uploaded file (PDFs, DOCX, or text).
        * Using gTTS, the text is converted into natural-sounding speech and saved as an MP3 file.
        * FFmpeg is used to ensure the audio is properly encoded and compatible for playback or download.
        * The generated podcast file is then made available for streaming or download through the chat interface.

*   **Others**:
    *   Speech-to-Text for user input.
    *   Text-to-Speech for AI messages.
    *   Light/Dark theme toggle.
    *   Responsive UI design.

## Contributors

This project is a collaborative effort. The contributors are listed below and their individual contributions are available in the video explanation.
1.  Pavan Teja B 
2.  Livingston D
3.  Murali Krishna B
4.  Mahaboob Subhani SK
5.  Anusha P

## 📽️ Demo Video

[Click here to watch the full demo](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing)

## **Features that are not added into video:**
1. Agentic Framework
2. Web Search
3. Podcast Generation
4. Long Term Memory
5. Content Generation [DOCX, PPTX]
6. Knowledge Graph Visualization

---

## 👥 Team Contributions

| Teammate Name             | Branch Name | Major Contributions                                                                                             | Contribution Link |
|--------------------------|-------------|------------------------------------------------------------------------------------------------------------------|-------------------|
| **Pavan Teja B**         | `dev/rex`   | Advanced File Parsing(Text, Tables, Images), Analysis Generation(FAQs, Topics, Mindmaps), Knowledge graph generation, , DB Management, Markdown, Prompting with CoT & Few-Shot Prompting             | [Link](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing) |
| **Rohith Syam Livingston D** | `alpha`     | Qdrant, Neo4j, Mermaid, Admin Features, Critical Thinking, Long Term Memory                                       | [Link](https://drive.google.com/file/d/1qmUmFZX1RuCS3icSPGMQ2kAHeJERGRAr/view?usp=drive_link) |
| **Murali Krishna B**     | `dev-mk`    | Front & Backend Integration, Multi-LLM Switch, Session and Global State Management                             |                   |
| **Mehaboob Subhani**     | `skms`      | UI Development, Web Search Agentic framework using DuckDuckGo, Content generation(ppt,docs) for analysis tools, User profile management, Podcast generation using gTTS                                                                                                 | [Link](https://drive.google.com/file/d/1OV0eD5PkwTATlsBHhuT6u4A-cKnuMyke/view?usp=sharing) |
| **Anusha P**             | `anu`       | Research, Speech-to-Text, Text-to-Speech using                                                  |                   |
