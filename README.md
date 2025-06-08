# Advanced AI Chatbot with RAG and Analysis Tools

This project is a sophisticated, multi-service chatbot application. It features a main Node.js backend that orchestrates tasks between a user-facing React frontend and specialized Python microservices for Retrieval-Augmented Generation (RAG) and advanced document analysis.

---

## 🧠 Core Features

* **Conversational AI**: Core chat powered by **Google Gemini Pro**.
* **Microservice Architecture**: Decoupled services for scalability and maintainability.
* **RAG Service**: Allows the chatbot to answer questions based on a library of uploaded documents.
* **Notebook/Analysis Service**: Generates FAQs, topics, mindmaps, and more using local LLMs via **Ollama**.
* **User Authentication & Persistent History**: Secure sessions via JWT and history stored in **MongoDB**.

---

## 📁 Project Structure

Place both folders side-by-side in a parent directory for correct relative path resolution:

```
/your_main_projects_folder/
├── Notebook/                # Python Analysis & Ollama-based Service
│   └── backend/
│       ├── .venv/
│       ├── app.py
│       └── requirements.txt
│
└── Chatbot-geminiV3/        # Main Chatbot Application
    ├── client/              # React Frontend
    ├── server/              # Node.js Backend
    │   └── rag_service/     # Python RAG Service
    ├── .env.example
    └── README.md
```

---

## ⚙️ Prerequisites

Install the following before proceeding:

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (v18.x or later)
* [Python](https://www.python.org/) (v3.9 or later)
* [MongoDB](https://www.mongodb.com/try/download/community) or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
* [Ollama](https://ollama.com/)

Pull the required LLM model:

```bash
ollama pull mistral:7b-instruct
```

---

## 🛠️ Installation & Setup

### 1. Clone the Repository

Clone the main chatbot repository and ensure `Notebook` is placed alongside it:

```bash
git clone https://github.com/Hary5357c/chatbot-academics-project.git Chatbot-geminiV3
```

### 2. Set Up Environment Variables

Inside `Chatbot-geminiV3`, copy the example `.env` file:

```bash
cd Chatbot-geminiV3
cp .env.example .env
```

Edit `.env` and fill in required values like `GEMINI_API_KEY`, `MONGO_URI`, etc.

### 3. Install Dependencies

#### Backend (Node.js)

```bash
cd server
npm install
cd ..
```

#### Frontend (React)

```bash
cd client
npm install
cd ..
```

#### Python Services

**Notebook Service:**

```bash
cd ../Notebook/backend
python -m venv .venv
# Activate (Windows PowerShell):
.\.venv\Scripts\Activate.ps1
# or (Command Prompt):
.\.venv\Scripts\activate.bat
pip install -r requirements.txt
cd ../../Chatbot-geminiV3
```

**RAG Service:**

```bash
cd server/rag_service
python -m venv .venv
# Activate (Windows PowerShell):
.\.venv\Scripts\Activate.ps1
# or (Command Prompt):
.\.venv\Scripts\activate.bat
pip install -r requirements.txt
cd ../../..
```

---

## 🚀 Running the Application

Open **four terminals** and run each service in the following order:

---

### 📌 Terminal 1: Notebook Analysis Service

```bash
cd ../Notebook/backend
.\.venv\Scripts\Activate.ps1   # or use activate.bat for CMD
python app.py
```

✅ Output: `Serving on http://0.0.0.0:5000`

---

### 📌 Terminal 2: RAG Service

```bash
cd Chatbot-geminiV3/server
.\rag_service\.venv\Scripts\Activate.ps1
python -m rag_service.app
```

✅ Output: `Serving on http://0.0.0.0:5002`

---

### 📌 Terminal 3: Node.js Backend

```bash
cd Chatbot-geminiV3/server
npm start
```

✅ Output: `🚀 Server listening on port 5001`

---

### 📌 Terminal 4: React Frontend

```bash
cd Chatbot-geminiV3/client
npm start
```

✅ Output:
`Compiled successfully!`
Open in browser: `http://localhost:3000`

---

You're now ready to use the **Advanced AI Chatbot** with integrated document analysis and RAG!
