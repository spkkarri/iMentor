# Advanced AI Chatbot with RAG and Analysis Tools

This project is a sophisticated, multi-service chatbot application featuring a main **Node.js backend** that orchestrates tasks between a user-facing **React frontend** and specialized **Python microservices** for:

* Retrieval-Augmented Generation (RAG)
* Web Search
* Advanced Document Analysis

---

## 📁 Project Architecture

Ensure the following directory structure, with both main folders placed side-by-side:

```
/your_main_projects_folder/
├── Notebook/                   # Python Analysis & Ollama-based Service
│   └── backend/
│
└── Chatbot-geminiV3/           # Main Chatbot Application
    ├── client/                 # React Frontend
    ├── server/                 # Node.js Backend
    │   ├── rag_service/        # Python RAG Service
    │   └── search_service/     # Python Web Search Service
    ├── setup.bat               # Automated Installer
    ├── start-all.bat           # Automated Starter
    └── package.json            # Script Runner
```

---

## ⚙️ Prerequisites

Make sure you have the following installed:

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (v18.x or later)
* [Python](https://www.python.org/) (v3.9 or later)
* [MongoDB](https://www.mongodb.com/try/download/community) (local or MongoDB Atlas)
* [Ollama](https://ollama.com/) (required for the Notebook/Analysis service)

---

## 🛠️ Installation & Running the Project (Windows)

This project includes **automated batch scripts** for quick setup and one-click launch.

---

### 📅 Step 1: First-Time Setup (Automated)

Run the `setup.bat` script to automatically install all required global tools and project dependencies.

#### Instructions:

1. **Open Command Prompt or PowerShell as Administrator.**
2. Navigate to the `Chatbot-geminiV3` directory:

   ```bash
   cd path/to/Chatbot-geminiV3
   ```
3. Run the setup script:

   ```bash
   .\setup.bat
   ```
4. Copy `.env.example` to `.env` and add your required API keys and secrets.

---

### 🔄 Step 2: Running the Application (Automated)

After completing the setup, start the entire application using **one command.**

#### Instructions:

1. Open a **single terminal** in the `Chatbot-geminiV3` directory.
2. Run the master start script:

   ```bash
   .\start-all.bat
   ```

This will start **all five services concurrently**, with each service's logs clearly labeled, for example:

```
[BACKEND] Server listening on port 5001
[FRONTEND] Compiled successfully!
[RAG] Serving on http://0.0.0.0:5002
[SEARCH] Search service running on port 5003
[NOTEBOOK] Serving on http://0.0.0.0:5000
```

#### Access the Application:

Open your browser and go to:
**[http://localhost:3000](http://localhost:3000)**

---

### ❌ Stopping the Application

Press `Ctrl + C` in the terminal where `start-all.bat` is running to stop all services simultaneously.

---

You're now ready to use the **Advanced AI Chatbot** with integrated RAG, web search, and document analysis!
