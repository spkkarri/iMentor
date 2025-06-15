# 📘 Engineering Tutor AI: Agentic Research Assistant for Engineering Education

A smart, interactive platform to revolutionize engineering education using Retrieval-Augmented Generation (RAG), AI voice tools, and visual learning enhancements.

---

## 🎬 Demo Videos
- 🧪 [Product Walkthrough](https://github.com/user-attachments/assets/b2d8fa7f-f7df-431d-b1f5-64173e8b7944)
- 🛠️ [Code Explanation](https://github.com/user-attachments/assets/a4dc6e7f-1783-41e5-b5c7-9b1cc3810da2)

---

## 🧠 Key Features

### 1. 🗣️ Conversational Podcast Generator

- Converts technical documents into a two-person dialogue script.
- Uses TTS (Text-to-Speech) to generate natural MP3 audio.
- Pydub + FFmpeg process and export professional audio files.

> **Packages**:

```bash
pip install gtts pydub
```

> **System**: [FFmpeg](https://ffmpeg.org/) must be installed and added to system PATH.

---

### 2. 🧠 Interactive Mind Map Generator

- Automatically creates clean, readable mindmaps from document hierarchy.
- Styled and arranged using Dagre graph layout for intuitive structure.
- Interactive fullscreen view with zoom, pan, and drag options.

> **Packages**:

```bash
npm install dagre react-flow-renderer react-icons react-tiny-popover
```

---

### 3. 📂 Multi-File Upload Support

- Upload and manage multiple documents (PDF, DOCX, PPTX, TXT).
- Real-time upload progress and organized action menus for each file.
- Rename, delete, convert to podcast, or generate mind map on the go.

---

### 4. 🔗 Chain-of-Thought Reasoning with RAG

- AI answers are context-aware, pulling knowledge directly from uploaded files.
- Falls back to general Gemini model only when document data is insufficient.

> **Packages**:

```bash
pip install langchain sentence-transformers faiss-cpu google-generativeai
```

---

### 5. 💾 Persistent Chat History

- User chat sessions are stored in MongoDB.
- Auto-saved and reloadable even after browser restarts.
- Modal interface for easy loading, deleting, and managing chats.

---

### 6. 🎤 STT & TTS Interaction

- STT: Convert voice queries to text.
- TTS: Read AI replies aloud using real-time speech engines.

> **Packages**:

```bash
pip install pyttsx3 gtts
```

---

## ⚙️ Setup & Installation Guide

### 🔧 Prerequisites

- Node.js (v16 or later)
- Python (v3.9 or later)
- MongoDB
- FFmpeg
- Gemini API Key from [Google AI Studio](https://makersuite.google.com/)

---

### 🧪 Step-by-Step Installation

#### 1. Clone the Repo

```bash
git clone https://github.com/AswanthAllu/intern_project.git
cd intern_project
```

#### 2. Terminal 1: Start MongoDB

Make sure MongoDB is running locally:

```bash
mongod
```

#### 3. Terminal 2: Start Python AI Microservice

```bash
cd server/rag_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

If missing, create `requirements.txt` with:

```
flask
google-generativeai
pyttsx3
gtts
pydub
langchain
faiss-cpu
sentence-transformers
```

Start service:

```bash
export GEMINI_API_KEY=your_api_key
python app.py
```

#### 4. Terminal 3: Start Node.js Backend

```bash
cd server
npm install
```

Create `.env` in `/server`:

```
PORT=5001
MONGO_URI=mongodb://localhost:27017/chatbotGeminiDB
PYTHON_RAG_SERVICE_URL=http://127.0.0.1:5002
GEMINI_API_KEY=your_api_key
JWT_SECRET=random_secret
```

Start backend:

```bash
npm start
```

#### 5. Terminal 4: Start React Frontend

```bash
cd client
npm install
npm install dagre react-flow-renderer react-icons react-tiny-popover
npm start
```
### 👥My  Contribution

| Name     | GitHub Username | Contribution Areas                                                                 |
|----------|------------------|------------------------------------------------------------------------------------|
|Jaya Aswanth Allu | [AswanthAllu](https://github.com/AswanthAllu) | Chain of Thought, Persistent Chat History (MongoDB),STT/TTS, Podcast Generation, Mind Map Generation, RAG Pipeline,Chat & File Deletion Features,  Multiple File Upload, UI/UX Design |


