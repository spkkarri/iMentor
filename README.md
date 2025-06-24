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

#### 🔹 Root (for concurrently)
```bash
npm install
```

#### 🔹 Backend (Node.js)
```bash
npm install --prefix server
```

#### 🔹 Frontend (React)
```bash
npm install --prefix client
```

#### 🔹 Python Microservices
Repeat the following steps for each service:  
`Notebook/backend`, `server/rag_service/`, `server/search_service/`, and `server/audio_service/`.

```bash
cd path/to/service
python -m venv .venv         # Create virtual environment (optional)
source .venv/bin/activate    # Activate it (use .venv\Scripts\activate on Windows)
pip install -r requirements.txt
```

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


