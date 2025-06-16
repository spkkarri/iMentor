# AI-Powered PDF Analysis & Retrieval Backend

This project provides a backend system for intelligent PDF document analysis and retrieval using modern AI and vector search technologies. It leverages [LangChain](https://python.langchain.com/), [Ollama](https://ollama.com/), [FAISS](https://github.com/facebookresearch/faiss), and [pdfplumber](https://github.com/jsvine/pdfplumber) to enable advanced document chunking, semantic search, and LLM-powered analysis.

---
## 🖼️ Future UI Preview

Below is a preview of how the front end will look in the future:

![Future UI Preview](image1)
![image](https://github.com/user-attachments/assets/3090025f-82da-4380-a610-1e57299a3eea)


## 🧾 Project Overview

This project is a full-stack, AI-powered PDF analysis and tutoring platform. It enables users to upload, analyze, and chat about PDF documents with advanced features such as conversational memory, thread/session management, document/user separation, and multi-modal document analysis (FAQ, topics, mindmaps). The backend is built with Python (Flask), LangChain, Ollama, FAISS, MongoDB, and pdfplumber. The frontend uses HTML, Bootstrap, and JavaScript for a modern, responsive UI.

---

## ✨ Key Features (Comprehensive)

- **User Authentication & JWT Sessions:** Secure signup/login, hashed passwords, JWT-based session management.
- **User/Document Separation:** Each user's uploads, chat threads, and document analyses are isolated and managed independently in MongoDB.
- **PDF Upload & Extraction:** Upload PDFs, extract and clean text using `pdfplumber`
- **Document Chunking & Vector Store:** Splits documents for efficient retrieval, stores embeddings in FAISS, supports per-user and per-document chunking.
- **Semantic Search & RAG:** Combines vector search and LLMs for context-aware answers, with support for document-specific queries (e.g., `@filename.pdf ...`).
- **Conversational AI Tutor:**

  - Chat interface with session/thread memory, chain-of-thought reasoning, and references.
  - Conversation summary buffer (LangChain memory) for long-term context.
  - Thread/session management: create, list, and resume previous chat threads, each with its own summary and history.
  - Per-thread conversational summary and title (auto-generated and updatable).
- **Document Analysis Tools:**

  - FAQ extraction (auto-generates Q&A from document content)
  - Topic summarization (lists and explains key topics)
  - Mindmap generation (Mermaid.js, optionally using Nougat for LaTeX/Markdown extraction)
- **Voice Input & TTS:**

  - Speech-to-text for chat input (Web Speech API)
  - Text-to-speech for bot responses (toggleable)
- **API Endpoints:**

  - For chat, document upload, analysis, history, thread/session management, and status.
- **Robust Error Handling:**

  - Handles AI/model/server errors gracefully, with user-friendly messages and logging.
- **Integrations:**

  - Ollama (LLM & embeddings, load-balanced across multiple URLs)
  - LangChain (chains, memory, prompts)
  - FAISS (vector search)
  - MongoDB (user, document, thread, and message storage)
  - Nougat (optional, for advanced PDF-to-Mermaid mindmap extraction)
- **Export Tools:**

  - Export chat or analysis results to PDF (via backend utility).
- **Extensible Protocols:**

  - Protocols for model/agent context, tool integration, and future expansion.

---

## 🧠 Architecture & Design (2025)

- **Backend:**
  - `app.py`: Flask API, all endpoints, app initialization, error handling.
  - `database.py`: MongoDB connection, user/document/thread/message management, per-user isolation.
  - `ai_core.py`: All AI logic (Ollama LLM/embeddings, RAG, chunking, memory, analysis, mindmap, fallback logic).
  - `config.py`: Centralized config, prompt templates, environment, logging, protocol imports.
  - `utils.py`: Helper functions (parsing, reference extraction, HTML escaping, PDF export).
  - `default.py`: Pre-flight checks, initial vector store setup.
  - `protocols.py`: Protocol definitions for model/agent context, tool APIs.
- **Frontend:**
  - `static/script.js`: All UI logic, event handling, API calls, chat/analysis/voice/tts/session management.
  - `static/style.css`: Custom dark theme, responsive layout, chat/analysis/mindmap styling.
  - `templates/index.html`: Bootstrap-based UI, dynamic controls, chat/analysis panels.
- **Data Storage:**
  - MongoDB for all user, document, thread, and message data.
  - FAISS for vector search (per-user, per-document chunking).
  - File system for PDF uploads and index storage.
- **Design Patterns:**
  - Modular separation (AI, DB, API, utils, protocols)
  - RAG pipeline: user prompt → sub-queries → vector search → LLM synthesis → response
  - Chain-of-thought enforced in prompts, memory, and UI
  - Per-thread conversational summary and title

---

## 🚀 Setup & Installation (Windows, PowerShell)

1. **Clone the repository:**
   ```powershell
   git clone <your-repo-url>
   cd Notebook
   ```
2. **Set up Python environment:**
   - Python 3.10+ recommended
   - Install dependencies:
     ```powershell
     pip install -r backend/requirements.txt
     ```
3. **Configure environment variables:**
   - Edit `backend/.env` for Ollama, MongoDB, and model settings.
4. **Run the backend server:**
   ```powershell
   python backend/app.py
   ```
5. **Access the app:**
   - Open your browser to `http://localhost:5000`

---
Nore. **set Environment Variables**
   ```powershell
   set KMP_DUPLICATE_LIB_OK=TRUE     # On Windows
   export KMP_DUPLICATE_LIB_OK=TRUE  # On Linux/Mac
   ```
## 📦 Dependencies & Tools (2025)

- **Flask, Flask-CORS, Waitress:** Web server & API
- **Flask-Bcrypt, PyJWT:** Auth & JWT
- **python-dotenv:** Env config
- **LangChain:** LLM orchestration, chains, memory
- **Ollama:** LLM and embeddings (load-balanced)
- **FAISS:** Vector similarity search
- **pdfplumber, pymupdf, camelot-py:** PDF extraction
- **Nougat:** PDF-to-Mermaid mindmap (optional)
- **tiktoken:** Tokenization
- **requests, httpx:** HTTP requests
- **pandas:** Data manipulation
- **MongoDB (pymongo):** User, document, thread, message storage
- **Bootstrap, Mermaid.js, Marked.js:** Frontend UI, diagrams, markdown

---

## 👥 Team Contributions

| Teammate Name | GitHub / ID      | Major Contributions                                                                         | Explanation Video / Document|
| ------------- | ---------------- | ------------------------------------------------------------------------------------------- |-------------------------------|
| Vinay Kumar Siddha      | `@VinaySiddha` | Chain-of-Thought reasoning, Conversational memory, session/thread logic                    |                                 |
| Kalyan Kumar Padilam       | `@Padilamkalyankumar`            | Frontend UI/UX, Thread/session management in UI, Chat with PDF using `@`                  |                                 |
| Anjaneya Karthik Sarika      | `@KarthikSarika`            | Text-To-Speech [TTS], Speech-To-Text [STT] {Both Notebook & ChatBot}, Load Balancing Using Round Robin, Interactive MindMap [Upcoming Updates]                   |      https://docs.google.com/document/d/15O2ljrBFHRFzpFtijZH4DqBnD096cHisidTlz4xgMWA/edit?usp=sharing                           |
| Saketh        | `@NarkidimilliSaketh`            | Mindmap Generation using Nougat, MongoDB integration, User-Specific Vector Stores, Podcast Of concept [Upcoming Updates]   |      https://www.youtube.com/watch?v=aEpNPP20kTA                           |
| Padmasri Jalla        | `@Padmasri-2005`            | Frontend UI/UX, OTP Authentication [login/signup/mongoconnection id:seshaveni-229] [Upcoming Updates]                                      | https://drive.google.com/file/d/1HNUw6zRSm08ax0-JxPDi1sRNJssF18La/view?usp=drivesdk                            |
| Deepthi       | `@DeepthiSannayila`            | Prompt Edit,Copy,Like and Dislike of content,Pause - Play - Stop Functionalities of Model                                   |      https://drive.google.com/file/d/16oT2tc_ql6WO6wRrt5TA6Bjfz7mOTGpy/view?usp=drivesdk                          |
| Venkata Sai Sri Deepika Kakumanu      | `@KVSSDeepika`            | Frontend UI/UX, OTP Authentication [Upcoming Updates]                                     | https://drive.google.com/file/d/1ziVnjDM7Mf6GlwqGCCkggp6gNAbgJ5Du/view?usp=drive_link                                |

---

