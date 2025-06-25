# 🚀 AI-Powered Learning & Document Analysis Platform

A full-stack, multi-agent AI application built to revolutionize learning and document comprehension. This platform combines multiple large language models (LLMs), a robust Retrieval-Augmented Generation (RAG) system, and specialized microservices into one seamless, interactive experience.

---

## ✨ Features

### 💬 Multi-Modal & Voice-Enabled Chat
- **Interactive Interface**: A responsive React frontend for real-time conversations.
- **Voice I/O**: Full voice support with integrated **Speech-to-Text (STT)** for hands-free input and toggleable **Text-to-Speech (TTS)** for listening to AI responses.
- **Multi-LLM Backend**: Dynamically switch between top-tier LLMs like **Google Gemini**, high-speed **Groq**, and local **Ollama** models.

### 📚 Advanced Document Comprehension
- **Retrieval-Augmented Generation (RAG)**: Upload PDF documents to build a custom, searchable knowledge base. The AI references your documents to generate precise, context-aware answers.
- **Deep Document Analysis**:
  - **FAQ Generation**: Automatically creates a list of questions and answers from document content.
  - **Key Topics Extraction**: Summarizes and highlights major themes.
  - **Mind Map Creation**: Visualizes document structure for better understanding.

### 🧠 Agentic Tools & Capabilities
- **Web Search Agent**: Autonomously pulls real-time information from the internet via DuckDuckGo when its internal knowledge is insufficient.
- **Podcast Generator**: Converts entire documents into natural-sounding audio podcasts using `gTTS` and `FFmpeg`.

### 🔁 Robust Chat & Session Management
- **Persistent Chat History**: Save, view, and reload past conversations.
- **Customizable System Prompts**: Tweak the AI's personality and behavior to fit your learning style.
- **Chain-of-Thought & Source Citing**: The AI provides reasoning and cites sources from your documents for verifiable accuracy.

---

## 🏗️ Architecture Overview

This project follows a **microservices architecture**, orchestrated from the root directory for modularity and scalability.

```
chatbot-academics-project/
├── client/             # React frontend (UI)
├── server/             # Node.js backend (API, Auth)
│   ├── rag_service/    # Python RAG service (FAISS-based)
│   ├── search_service/ # Python web search agent
│   ├── audio_service/  # Python podcast/audio generator
├── Notebook/           # Python document analysis service
```

---

## 🛠️ Tech Stack

| Layer          | Technology                                       |
|----------------|--------------------------------------------------|
| **Frontend**   | React.js                                         |
| **Backend**    | Node.js, Express.js                              |
| **Microservices** | Python (Flask, Waitress)                   |
| **AI Libraries** | LangChain, Sentence Transformers             |
| **Database**   | MongoDB                                          |
| **Vector DB**  | FAISS                                            |
| **AI Providers** | Google Gemini, GroqCloud, Ollama             |
| **Orchestration** | `concurrently` for parallel service startup |

---

## 🔧 Setup & Installation

### ✅ Prerequisites

- **Node.js** (v18 or later)
- **npm**
- **Python** (v3.9–3.11 recommended)
- **pip**
- **MongoDB** (Running instance)
- **[Optional] Ollama** (for local LLM support)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Hary5357c/chatbot-academics-project.git
cd chatbot-academics-project
```

---

### 2. Configure Environment Variables

- Navigate to the `server/` directory.
- Copy the `.env.example` file:

```bash
cp server/.env.example server/.env
```

- Fill in your API keys and config values:
  - `GEMINI_API_KEY`
  - `GROQ_API_KEY`
  - `MONGO_URI`
  - And others as required

---

### 3. Install Dependencies

This step installs all required dependencies for the Node.js/React applications and the Python microservices.

---

#### 🔹 Root & Node.js/React (npm)

Run the following commands from the **root** directory of the project:

```bash
# 1. Install root-level dependencies (e.g., concurrently)
npm install

# 2. Install backend (Node.js) dependencies
npm install --prefix server

# 3. Install frontend (React) dependencies
npm install --prefix client
```

---

#### 🔹 Python Microservices (pip)

It is recommended to create and activate a virtual environment (`.venv`) inside each Python microservice directory.

**Directories to configure:**

- `Notebook/backend`
- `server/rag_service`
- `server/search_service`
- `server/audio_service`

Instructions differ slightly based on your operating system:

---

##### ▶ On Windows (PowerShell)

```powershell
# Notebook Service
cd Notebook/backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cd ../..

# RAG Service
cd server/rag_services
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cd ../..

# Search Service
cd server/search_service
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cd ../..

# Audio Service
cd server/audio_service
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cd ../..
```

---

##### ▶ On Linux / macOS (Bash or Zsh)

```bash
# Notebook Service
cd Notebook/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# RAG Service
cd server/rag_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Search Service
cd server/search_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Audio Service
cd server/audio_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

---

> ✅ **Tip:** Always activate the correct virtual environment before running or developing each Python service.


---

### 4. Start the Application

From the **project root**, run:

```bash
npm run start-all
```

This will use `concurrently` to spin up:

- Frontend (React)
- Main Backend (Node.js)
- RAG Service
- Search Service
- Audio Service
- Notebook/Analysis Service

🟢 The platform will be live at:  
**http://localhost:3000**

---

---

## 💡 Important Notes & Troubleshooting

#### 📁 Run from the Root
Ensure all `npm` and `git` commands are executed from the **project's root directory** (`chatbot-academics-project/`). This guarantees that paths and script references resolve correctly.

---

#### 🐍 Virtual Environments are Key
Each Python microservice (`Notebook`, `rag_service`, `search_service`, `audio_service`) must have its **own virtual environment** (`.venv`).  

The `npm run start-all` script is configured to **automatically activate** these environments.  
If you skip creating them, you'll likely encounter errors like:

```
ModuleNotFoundError: No module named '...'
```

---

#### 🚀 Why Use `npm run start-all`?

**Do not manually run Python files** like `python app.py`.  

The unified `start-all` script:
- Handles complex `cd` (change directory) operations
- Uses Python's `-m` module execution to ensure packages and paths resolve correctly
- Enables seamless communication between services (especially for the RAG pipeline)

> ✅ This is crucial for cross-service imports and shared data handling to work reliably.

---

#### ⚠️ `KMP_DUPLICATE_LIB_OK` Error (Windows)

On Windows, if you encounter errors related to **libiomp5md.dll** (common with PyTorch or NumPy), set the following environment variable **before running the start command**:

```powershell
$env:KMP_DUPLICATE_LIB_OK="TRUE"
npm run start-all
```

> This bypasses Intel MKL library conflicts that may crash your process.

---



## 🧪 Example Use Cases

- Learn from custom textbooks, research papers, or notes.
- Generate structured summaries and mind maps for study.
- Convert academic documents into audio formats for passive learning.
- Ask complex, contextual questions and get AI-backed answers.

---

## 📫 Contact

For questions, feature requests, or contributions:

📧 Email: [kurmapuhsai@gmail.com]  
🐙 GitHub: [github.com/Hary5357c](https://github.com/Hary5357c)

---


