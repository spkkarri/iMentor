# iMentor: The Agentic Learning Assistant

iMentor is a comprehensive, AI-powered tutoring application designed to assist users through interactive chat, document analysis, and knowledge exploration. It integrates multiple Large Language Models (LLMs), a sophisticated Retrieval-Augmented Generation (RAG) pipeline for contextual understanding from user-uploaded documents, and knowledge graph capabilities for critical thinking. The system also includes an admin interface for managing shared knowledge resources and a full suite of observability tools for monitoring system health and user activity.

<br />

<details>
  <summary><strong>Table of Contents</strong></summary>

- [Project Abstract](#project-abstract)
- [Core Features](#core-features)
  - [Intelligent & Interactive Chat](#intelligent--interactive-chat)
  - [Advanced Knowledge Management & RAG](#advanced-knowledge-management--rag)
  - [Personalized Learning & Academic Tools](#personalized-learning--academic-tools)
  - [Administrator & Platform Management](#administrator--platform-management)
  - [Full-Stack Observability](#full-stack-observability)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Linux Setup (Debian/Ubuntu)](#linux-setup-debianubuntu)
  - [Windows Setup](#windows-setup)
- [Usage](#usage)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Install Dependencies & Seed Database](#3-install-dependencies--seed-database)
  - [4. Running The Application](#4-running-the-application)
- [Observability Stack](#observability-stack)
- [Contributors](#contributors)
- [Demo Video](#demo-video)

</details>

<br />

## Project Abstract

iMentor is an advanced, multi-agent learning platform engineered to provide a deeply personalized and tool-augmented educational experience. It goes beyond simple Q&A by employing a sophisticated agentic architecture that intelligently routes user queries to the most appropriate tool—be it internal knowledge retrieval, real-time web search, academic database queries, or direct LLM reasoning. The platform features a comprehensive RAG pipeline for ingesting and understanding a wide array of user-provided sources (documents, media, URLs), a dynamic knowledge graph for long-term memory and critical thinking, and a suite of generative tools for creating academic content. For administrators, iMentor offers a robust dashboard for managing curated content, overseeing platform analytics, and orchestrating a feedback-driven model fine-tuning loop, all monitored by an enterprise-grade observability stack.

---

## Core Features

### Intelligent & Interactive Chat

-   **Multi-LLM Orchestration**: The system uses an intelligent **LLM Router** (`llmRouterService.js`) that analyzes each user query against heuristic keywords (e.g., 'code', 'translate') and the current context. It dynamically selects the best-suited model from a database of configured LLMs (e.g., a coding model for a programming question, a multilingual model for translation) to ensure the highest quality response. Users can also manually override their default provider.
-   **Explainable Thinking Process (Tree of Thoughts)**: When "Critical Thinking Mode" is enabled, the application activates a **Tree of Thoughts (ToT) orchestrator** (`totOrchestrator.js`). This agent breaks complex queries into a multi-step plan, evaluates the best plan, and executes each step. Its reasoning is streamed to the user in real-time via the **Thinking Dropdown** (`ThinkingDropdown.jsx`), making the AI's decision-making process fully transparent.
-   **Custom AI Persona**: Users can tailor the AI's behavior by selecting from pre-configured system prompts (e.g., "Friendly Tutor," "Concept Explorer") or writing their own custom instructions in the **Left Panel** (`LeftPanel.jsx`). This `systemPrompt` is passed to the LLM with every request.
-   **Speech-to-Text (STT) & Text-to-Speech (TTS)**: The UI supports voice interaction. The `useWebSpeech` hook enables voice input via the browser's native Speech Recognition API, and the `useTextToSpeech` hook reads the AI's responses aloud (`ChatInput.jsx`, `MessageBubble.jsx`).
-   **Rich Content Rendering**: The AI is prompted to respond using Markdown, tables, and **KaTeX** for mathematical formulas. The frontend (`MessageBubble.jsx`, `markdownUtils.jsx`) correctly renders this rich content, including syntax-highlighted code snippets via **Prism.js**.

### Advanced Knowledge Management & RAG

-   **Multi-Modal Knowledge Ingestion**: The platform can ingest and process a wide array of sources (`SourceIngestion.jsx`). The backend `knowledge_engine.py` and `media_processor.py` can handle:
    -   **Documents**: PDF, DOCX, TXT, Markdown.
    -   **Media Files**: MP3, MP4 (audio is extracted and transcribed).
    -   **Web Content**: Standard webpage URLs and YouTube video links (transcripts are fetched).
-   **Comprehensive RAG Pipeline**: When a source is ingested, it undergoes a full processing pipeline in `ai_core.py`:
    1.  **Extraction**: Text, tables, and images are extracted using libraries like `pdfplumber`, `python-docx`, and `fitz`.
    2.  **OCR**: **Tesseract** extracts text from images or scanned PDFs.
    3.  **Transcription**: **OpenAI Whisper** transcribes audio from media files.
    4.  **Cleaning**: Text is cleaned and lemmatized using **spaCy**.
    5.  **Layout Reconstruction**: Tables are converted to Markdown and integrated with the text.
    6.  **Chunking & Embedding**: The final text is segmented and converted into vector embeddings using **Sentence Transformers**.
    7.  **Storage**: Embeddings are stored in **Qdrant**, and metadata is prepared for the Knowledge Graph.
-   **Admin-Curated Subjects**: Professors can upload foundational documents via the **Admin Dashboard**. These appear as selectable "Subjects" (`SubjectList.jsx`) for all students, allowing users to focus their RAG queries on a specific, curated curriculum.

### Personalized Learning & Academic Tools

-   **Personalized Study Plans**: From the `StudyPlanPage.jsx`, users can state a learning goal. The `curriculumOrchestrator.js` first uses an LLM to determine if the goal is specific enough. If not, it generates clarifying questions. Once the goal is refined, it creates a multi-module, step-by-step curriculum tailored to the user's profile and identified weaknesses, which is then saved to the `LearningPath` database model.
-   **Knowledge Gap Identification & Recommendations**: After a chat session concludes, the `sessionAnalysisService.js` uses an LLM to analyze the transcript. It identifies topics where the user showed confusion (**Knowledge Gaps**) and saves them to their profile. It then generates **"Next Step" recommendations** based on the key topics discussed, which are cached in **Redis** and presented at the start of the next session.
-   **Real-time Dynamic Concept Mapping**: During a live chat, the AI extracts key concepts and relationships in the background (`kgExtractionService.js`). Users can open the **Live Concept Map** (`RealtimeKgPanel.jsx`) to see an interactive **ReactFlow** visualization of how ideas in the current conversation are connected, fetched directly from the **Neo4j** graph database.
-   **Secure Code Executor & AI Assistant**: A sandboxed environment (`CodeExecutorPage.jsx`) where users can write and run code in Python, Java, C, and C++. The backend (`app.py`) uses temporary directories and the `subprocess` module for secure execution. An integrated **AI Assistant** (`AIAssistantBot.jsx`) can:
    -   **Analyze Code**: Provide a detailed review of functionality, bugs, and improvements.
    -   **Generate Test Cases**: Create a suite of standard, edge, and error cases.
    -   **Explain Errors**: Give a beginner-friendly explanation for compilation or runtime errors.
-   **Academic Integrity Suite**: A dedicated page (`AcademicIntegrityPage.jsx`) with tools to promote ethical writing. The `integrity_services.py` backend provides:
    -   **Plagiarism Detection**: Integrates with the **Turnitin API** for similarity reports.
    -   **Bias & Inclusivity Check**: Uses a hybrid approach of wordlists (`bias_wordlists.py`) and an LLM to flag potentially biased language and suggest alternatives.
    -   **Readability Analysis**: Calculates Flesch-Kincaid, Gunning Fog, and other scores using `textstat`.
-   **Generative Content Tools**:
    -   **AI Quiz Generator**: Users can upload a document, and the backend (`quiz_utils.py`, `app.py`) will use an LLM to generate a multiple-choice quiz based on its content.
    -   **Multi-Voice Podcast Generator**: Transforms any document into a high-quality, three-speaker conversational podcast. `podcast_generator.py` uses an LLM to write a script, then uses **Coqui TTS** (`tts_service.py`) to synthesize distinct voices by pitch-shifting a base voice model.
    -   **DOCX & PPTX Generation**: From any analysis modal, users can generate a report. The `document_generator.py` backend uses an LLM to expand the content and then uses the `python-docx` and `python-pptx` libraries to create and serve the downloadable files.

### Administrator & Platform Management

-   **Full Analytics Dashboard**: The `/admin/analytics` route (`AnalyticsDashboardPage.jsx`) provides a comprehensive overview of platform health. Backend routes in `analytics.js` query **MongoDB** for user counts and **Elasticsearch** for event logs to populate charts showing user growth, feature adoption, and content engagement.
-   **Secure Dataset Management**: The admin dashboard features a `DatasetManager.jsx` for managing fine-tuning datasets. It interfaces with `s3Service.js` to use **pre-signed URLs**, allowing direct, secure uploads from the admin's browser to an **AWS S3** bucket without routing large files through the application server.
-   **Feedback Loop for Model Fine-Tuning**:
    1.  **Feedback Collection**: Users can give thumbs up/down feedback on AI responses (`MessageBubble.jsx`). This is stored in the `LLMPerformanceLog` collection (`feedback.js`).
    2.  **Orchestration**: An admin can trigger a fine-tuning job from the dashboard (`ModelFeedbackStats.jsx`).
    3.  **Execution**: The Node.js backend (`finetuning.js`) collects all positive feedback data, saves it to a shared volume, and calls the Python service. The `fine_tuner.py` script then uses **Unsloth** and Hugging Face's `SFTTrainer` to fine-tune a base model (e.g., Llama 3) and registers the new, improved model with **Ollama**.
-   **Secure Authentication & API Key Management**: The platform uses JWTs for session management with hashed passwords stored using `bcryptjs`. The admin dashboard (`ApiKeyRequestManager.jsx`) allows professors to review and approve/reject student requests for a system-provided Gemini API key. Approved keys are encrypted (`crypto.js`) and stored in the user's profile.

### Full-Stack Observability

-   **Centralized Logging**: The Node.js (`logger.js`) and Python (`config.py`) backends are configured to output structured **JSON logs**. A **Filebeat** container (`filebeat.yml`) is configured to ship these logs to an **Elasticsearch** instance.
-   **Log Visualization & Search**: A **Kibana** service is deployed, providing a powerful UI to search, filter, and create visualizations from the aggregated application logs, enabling deep debugging and user activity tracking.
-   **Performance Monitoring**: The Node.js backend exposes a `/metrics` endpoint using **prom-client**. A **Prometheus** container (`prometheus.yml`) is configured to scrape this endpoint, collecting real-time application metrics like HTTP request latency and error rates.
-   **Dashboards & Alerting**: A **Grafana** instance is deployed with a pre-configured data source for Prometheus and a sample dashboard (`dashboard.json`), allowing for easy visualization of application health and performance.
-   **Real-time Error Tracking**: Both the Node.js (`instrument.js`) and Python (`app.py`) services are integrated with **Sentry** for real-time, cross-platform error aggregation, reporting, and alerting.

---

## Getting Started

### Prerequisites

You will need the following software installed on your system to run the application.

-   **Node.js**: Version 18.x
-   **npm**: Comes bundled with Node.js
-   **Python**: Version 3.10–3.11 (3.10 is recommended)
-   **pip**: Comes bundled with Python
-   **MongoDB**: For database storage
-   **Docker & Docker Compose**: To run containerized services (Qdrant, Neo4j, ELK Stack, etc.)
-   **Tesseract OCR**: For processing image-based documents
-   **FFmpeg**: For audio and podcast generation

---

## Installation

### Linux Setup (Debian/Ubuntu)

Run the following commands as root or with `sudo` to install all necessary dependencies.

> [!NOTE]
> The MongoDB installation script uses the repository for Ubuntu 22.04 (`jammy`). This is intentional for compatibility and should work correctly on newer Ubuntu versions as well.

```bash
# Update package lists
sudo apt update

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker

# Install Node.js (18.x) & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# Install Python 3.10 & pip (and necessary build tools)
sudo apt install -y python3.10 python3.10-venv python3.10-dev python3-pip

# Install Tesseract OCR
sudo apt install -y tesseract-ocr

# Install FFmpeg
sudo apt install -y ffmpeg

# --- Install MongoDB ---
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

sudo apt update

sudo apt install -y mongodb-org

sudo systemctl start mongod

sudo systemctl enable mongod
```

Windows Setup
For Windows, dependencies must be installed individually. Using a package manager like Chocolatey can simplify the process.
[!NOTE]
After installing command-line tools like FFmpeg or Tesseract, you must add their installation bin directories to your system's PATH environment variable and restart your terminal or command prompt.
Docker Desktop: Download and install from the official Docker website.
Node.js: Download and run the Node.js 18.x LTS installer from nodejs.org.
Python: Install Python 3.10 from the Microsoft Store or python.org. Ensure you check "Add Python to PATH" during installation.
MongoDB: Download and run the MongoDB Community Server installer from the MongoDB website.
Tesseract OCR: Download and run an installer from the Tesseract at UB Mannheim project.
FFmpeg: Download the FFmpeg binaries from the official website, extract the files, and add the bin folder to your system's PATH.
Usage
1. Clone the Repository
code
```Bash
git clone https://github.com/tej-a192/chatbot-Team-2.git
cd chatbot-Team-2
2. Configure Environment Variables
Create .env files for the server and frontend by copying the provided examples.
[!IMPORTANT]
The .env files contain sensitive information like API keys and database credentials. They are ignored by Git via the .gitignore file and should never be committed to your repository.
Backend Server:
```
code
```Bash
cd server

example env

PORT=5001
MONGO_URI="mongodb://localhost:27017/chatbot_gemini"
JWT_SECRET="your_super_strong_and_secret_jwt_key_12345"
GEMINI_API_KEY="AIzaSyCHuH6_DJuxGawHM2QqU5YNM8Zpp0xVl_I"
PROMPT_COACH_GEMINI_MODEL=gemini-2.5-pro
PROMPT_COACH_OLLAMA_MODEL=qwen2.5:14b-instruct
PYTHON_RAG_SERVICE_URL="http://127.0.0.1:5000"
OLLAMA_API_BASE_URL="https://angels-himself-fixtures-unknown.trycloudflare.com"
OLLAMA_DEFAULT_MODEL="qwen2.5:14b-instruct"
ENCRYPTION_SECRET=583c0c57ffbb993163e28273671daebf880eb972d6d1402613be9da09a5297e2
SENTRY_DSN="https://458178e6527d82e9373ea1b1b34d3954@o4509804762497024.ingest.us.sentry.io/4509804765577216"
REDIS_URL="redis://localhost:6379"
FIXED_ADMIN_USERNAME=admin@admin.com
FIXED_ADMIN_PASSWORD=admin123
ELASTICSEARCH_URL=http://localhost:9200
# --- AWS S3 Credentials for Dataset Management ---
# Replace placeholders below with your actual values
S3_BUCKET_NAME="ai-tutor-datasets-rohith"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"


```

```Bash
# From the root directory
cd frontend


example env

VITE_API_BASE_URL=http://localhost:5001/api
VITE_ADMIN_USERNAME=admin@admin.com
VITE_ADMIN_PASSWORD=admin123

```

Edit the `.env` file to point to your backend API.

### 3. Install Dependencies & Seed Database

This step installs all required packages and populates the database with the initial LLM models for the admin panel.

1.  **Install Node.js & Python packages**:
    ```bash
    # In one terminal (from root directory)
    cd server
    npm install
    
    # In a second terminal (from root directory)
    cd server/rag_service
    pip install -r requirements.txt
    python -m spacy download en_core_web_sm
    ```

2.  **Seed the LLM Data for the Admin Panel**:
    > [!IMPORTANT]
    > This script must be run once before starting the application. It populates the database with the default LLM providers, making them available for the AI Router and admin dashboard.
    ```bash
    # In your first terminal (the one in the 'server' directory)
    node scripts/seedLLMs.js
    ```

### 4. Running The Application

Open multiple terminal windows to run each component of the application in the correct order.

1.  **Start Docker Services**: Run all containerized services in detached mode.
    ```bash
    # From the root directory of the project
    docker compose up -d
    ```

2.  **Run the Python RAG Service**:
    ```bash
    # In your second terminal (the 'server/rag_service' directory)
    python app.py
    ```

3.  **Run the Node.js Backend**:
    ```bash
    # In your first terminal (the 'server' directory)
    npm start
    ```

4.  **Run the Frontend Application**:
    ```bash
    # In a third terminal (from root directory)
    cd frontend
    npm install
    npm run dev
    ```

You can now access the application at **`http://localhost:5173`** in your browser.

---

## Observability Stack

The application stack includes a full suite of monitoring tools. Access them via your browser:

> [!NOTE]
> The Neo4j Browser at `http://localhost:7001` will prompt for a username and password. The default credentials, as set in the `docker-compose.yml` file, are `neo4j` / `password`.

-   **Grafana**: `http://localhost:7005` (Visualize application performance metrics)
-   **Kibana**: `http://localhost:7003` (Explore and search application logs)
-   **Prometheus**: `http://localhost:7004` (View raw metrics and service discovery)
-   **Qdrant UI**: `http://localhost:7000/dashboard` (Inspect vector database collections)
-   **Neo4j Browser**: `http://localhost:7001` (Query and visualize the knowledge graph)

---

## Contributors

| Name                  | Role / Branch | 
| --------------------- |---------------| 
| **Pavan Teja B**      | `dev/rex`     |                      
| **Livingston D**      | `alpha`       |                      
| **Murali Krishna B**  | `dev-mk`      |                      
| **Mehaboob Subhani SK** | `skms`      |                      
| **Anusha P**          | `anu`         |                      

---

## Demo Video

👉 [Click to Watch the Full Application Demo](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing)

