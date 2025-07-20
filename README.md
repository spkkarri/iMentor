# Engineering Tutor AI: Agentic Research Assistant for Engineering Education

A smart, interactive platform to revolutionize engineering education using Retrieval-Augmented Generation (RAG), AI voice tools, and visual learning enhancements.

---

## 🎮 Demo Videos

* 🧪 [Product Walkthrough](https://github.com/user-attachments/assets/b2d8fa7f-f7df-431d-b1f5-64173e8b7944)
* 🛠️ [Code Explanation](https://github.com/user-attachments/assets/a4dc6e7f-1783-41e5-b5c7-9b1cc3810da2)

---

## 🧠 Key Features

### 1. 🗣️ Conversational Podcast Generator

* Converts technical documents into dialogue scripts.
* Uses TTS to generate MP3 audio.
* FFmpeg + eSpeak for high-quality synthesis.

**Requirements:**

* [FFmpeg](https://ffmpeg.org/download.html)
* [eSpeak](http://espeak.sourceforge.net/download.html)

**Packages:**

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg-installer/ffmpeg fluent-ffmpeg say
```

### 2. 🧠 Interactive Mind Map Generator

* Creates readable mind maps with Dagre layout.
* Interactive fullscreen view.

**Packages:**

```bash
npm install dagre reactflow react-icons react-tiny-popover
```

### 3. 📂 Multi-File Upload Support

* Upload PDFs, DOCX, PPTX, TXT with real-time progress.
* Action menu: rename, delete, convert to podcast, generate mind map.

### 4. 🔗 Chain-of-Thought Reasoning with RAG

* Answers pulled directly from uploaded docs.
* Uses FAISS for vector search.

**Packages:**

```bash
npm install @langchain/community @langchain/core @langchain/google-genai faiss-node
```

### 5. 💾 Persistent Chat History

* MongoDB for storing user sessions.
* Load, delete, manage chats via modal interface.

### 6. 🎤 STT & TTS Interaction

* STT: Voice-to-text using browser APIs.
* TTS: Replies spoken using real-time engines.

**Packages:**

```bash
npm install @google-cloud/text-to-speech say
```

### 7. 🔍 Deep Search Integration

* Uses DuckDuckGo API for advanced search.
* Decomposes queries, aggregates and caches results.

**Packages:**

```bash
npm install duck-duck-scrape axios node-cache
```

---

## ⚙️ Setup & Installation Guide

### Prerequisites

* Node.js (v18+)
* MongoDB
* FFmpeg
* eSpeak

### Installation Steps

1. **Clone the Repository**

```bash
git clone -b Team-4 https://github.com/spkkarri/iMentor.git
```

2. **Install System Dependencies**

**FFmpeg:**

* Windows: [FFmpeg for Windows](https://ffmpeg.org/download.html#build-windows)
* macOS: `brew install ffmpeg`
* Linux: `sudo apt-get install ffmpeg`

**eSpeak:**

* Windows: [eSpeak Windows](http://espeak.sourceforge.net/download.html)
* macOS: `brew install espeak`
* Linux: `sudo apt-get install espeak`

3. **Terminal 1: Backend Setup**

```bash
cd server
npm install
```

Create `.env` file in `/server`:

```env
PORT=5007
MONGO_URI=mongodb://localhost:27017/chatbotGeminiDB4
GEMINI_API_KEY=your_key
JWT_SECRET=random_secret1234
HF_API_KEY=your_huggingface_api_key
```

Start Backend:

```bash
npm start
```

4. **Terminal 2: Frontend Setup**

```bash
cd client
npm install
PORT=3004 npm start
```

---

## 🏗️ Architecture

### Backend (Node.js/Express)

* RAG pipeline with vector embeddings
* Gemini AI integration
* Multi-format file processing
* Podcast generation with FFmpeg + eSpeak
* Deep search engine with DuckDuckGo

### Frontend (React)

* Chat UI with RAG support
* File upload manager
* Mind map visualizer
* Audio player
* Deep search interface
* Mobile-friendly design

### Database (MongoDB)

* Auth & session management
* Persistent chats
* File metadata
* FAISS vector store
* Search cache

---

## 📦 Environment Variables

`.env` for `/server`:

```env
PORT=5005
MONGO_URI=mongodb://localhost:27017/chatbotGeminiDB4
GEMINI_API_KEY=your_key
JWT_SECRET=random_secret1234
HF_API_KEY=your_huggingface_api_key
```

---

## 📦 Key Dependencies

### Backend

* `@google/generative-ai`
* `@langchain/community`
* `faiss-node`
* `mongoose`
* `express`
* `multer`
* `fluent-ffmpeg`
* `duck-duck-scrape`
* `node-cache`
* `say`

### Frontend

* `react`
* `reactflow`
* `dagre`
* `axios`
* `react-markdown`

---

## 🚀 Development

### Dev Mode

```bash
cd server
npm run dev

cd client
npm start
```

### Testing

```bash
cd server
npm test

cd client
npm test
```

---

## 👥 Team Contributions

| Name              | GitHub Username                               | Contributions                                                                                             |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Jaya Aswanth Allu | [AswanthAllu](https://github.com/AswanthAllu) | Chain of Thought, Persistent Chat History, STT/TTS, Podcast Generator, Mind Maps, RAG, Deep Search, UI/UX |
| Solomon Matthews  | [7nos](https://github.com/7nos)               | Deep Search Engine                                                                                        |
