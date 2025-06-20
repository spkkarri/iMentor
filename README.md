# AI Tutor: Intelligent Learning Assistant

This project is a comprehensive AI-powered tutoring application designed to assist users through interactive chat, document analysis, and knowledge exploration. It integrates multiple Large Language Models (LLMs), Retrieval Augmented Generation (RAG) for contextual understanding from user-uploaded documents, and knowledge graph capabilities for critical thinking. The system also includes an admin interface for managing shared knowledge resources.

---

## 🐧 One-Time Linux Setup (Run as Root)

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# Install Node.js (18.x) & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Python 3.11 & pip
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Install Tesseract OCR
sudo apt install -y tesseract-ocr

# Install FFmpeg
sudo apt install -y ffmpeg

# Import the MongoDB public GPG key
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg

# Add the MongoDB repo for Ubuntu 22.04 (Jammy) instead of 24.04 (Noble)
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update and install
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

```

---

## Prerequisites

- **Node.js**: Version 18.x or later
- **npm**: Installed with Node.js
- **Python**: Version 3.9–3.11 (3.11 recommended)
- **pip**: For installing Python packages
- **MongoDB**: For user and document data storage
- **Docker**: Required to run Qdrant & Neo4j containers
- **Neo4j**: Graph database (via Docker)
- **Qdrant**: Vector store (via Docker)
- **Google Gemini API Key**: Mandatory
- **Tesseract OCR**: For image-based document processing
- **FFmpeg**: For audio (podcast) generation
- **Ollama (Optional)**: For using local LLMs

---

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/tej-a192/chatbot-Team-2.git
cd chatbot-Team-2
```

---

### 2. Backend Setup (Node.js Server)

```bash
cd server
cp .env.example .env
```

Edit `.env` and fill in your keys:
```env
PORT=5001
MONGO_URI="mongodb://localhost:27017/chatbot"
JWT_SECRET="your_jwt_secret"
GEMINI_API_KEY="your_gemini_key"
PYTHON_RAG_SERVICE_URL="http://127.0.0.1:5000"
NEO4J_URI="bolt://localhost:7687"
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
QDRANT_HOST=localhost
QDRANT_PORT=6333
FIXED_ADMIN_USERNAME=admin
FIXED_ADMIN_PASSWORD=admin123
```

Install dependencies:
```bash
npm install
```

---

### 3. Backend Setup (Python RAG & KG Service)

```bash
cd server/rag_service
cp .env.example .env  # if available
pip install -r requirements.txt
python3.11 -m spacy download en_core_web_sm
```

Edit `config.py` if needed to point to:
```python
TESSERACT_CMD = "/usr/bin/tesseract"
```

---

### 4. Start Qdrant & Neo4j with Docker

```bash
cd server/rag_service
docker compose up -d
```

---

### 5. Run Python RAG Service

```bash
cd server/rag_service
python3.11 app.py
```

---

### 6. Run Node.js Server

```bash
cd server
npm start
```

---

### 7. Frontend Setup

```bash
cd frontend
cp .env.example .env
```

Fill in:
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=admin123
```

Install and start:
```bash
npm install
npm run dev
```

---

## ✅ Final Checklist to Run Entire App

1. MongoDB is running (port `27017`)
2. Neo4j is running (port `7687`)
3. Qdrant is running (port `6333`)
4. Python RAG (`localhost:5000`) is running
5. Node backend (`localhost:5001`) is running
6. Frontend (`localhost:5173`) is open in browser

---

## Features

- 🔐 **User Authentication** (JWT-based)
- 📁 **Document Upload & Parsing**
- 🔍 **RAG-enabled Chat** with document context
- 📊 **Knowledge Graph Critical Thinking**
- 📚 **FAQ, Topic, Mindmap Generators**
- 🎧 **Podcast Generator (gTTS + FFmpeg)**
- 🌐 **Web Search Agent (DuckDuckGo API)**
- 🔄 **Multi-LLM Support (Gemini + Ollama)**
- 📝 **Chat History and Reload**
- 🎤 **Speech-to-Text** + 🗣️ **Text-to-Speech**
- 🌙 **Light/Dark Mode Toggle**

---

## Contributors

| Name                      | Role / Branch  | Contribution Summary                                                                                          | Video |
|---------------------------|----------------|---------------------------------------------------------------------------------------------------------------|--------|
| **Pavan Teja B**          | `dev/rex`      | File parsing, FAQ/Topic/Map generation, KG creation, DB ops, Prompt tuning                                    | [Link](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing) |
| **Livingston D**          | `alpha`        | Qdrant, Neo4j, Mermaid, Admin flow, Long-term memory, KG critical thinking                                    | [Link](https://drive.google.com/file/d/1qmUmFZX1RuCS3icSPGMQ2kAHeJERGRAr/view?usp=drive_link) |
| **Murali Krishna B**      | `dev-mk`       | Front/Back integration, Multi-LLM support, Session/global state                                                | — |
| **Mehaboob Subhani SK**   | `skms`         | UI, Web Search Agent, DOC/PPT generation, Podcast support, Profile management                                  | [Link](https://drive.google.com/file/d/1OV0eD5PkwTATlsBHhuT6u4A-cKnuMyke/view?usp=sharing) |
| **Anusha P**              | `anu`          | Research, STT and TTS implementation                                                                           | — |

---

## 📽️ Demo Video

👉 [Click to Watch Full Demo](https://drive.google.com/file/d/107Sbtf64_KrW18NLRDvvUS0_BnpWmFJ9/view?usp=sharing)

---

## 🛠️ Features Not Shown in Video

1. Agentic Framework
2. Web Search Agent
3. Podcast Generation
4. Long-Term Memory
5. Content Generation (DOCX, PPTX)
6. Knowledge Graph Visualization

---
