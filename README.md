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
- FFmpeg integration for professional audio processing and export.

> **Packages**:

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/core @ffmpeg-installer/ffmpeg fluent-ffmpeg
```

> **System**: [FFmpeg](https://ffmpeg.org/) must be installed and added to system PATH.

---

### 2. 🧠 Interactive Mind Map Generator

- Automatically creates clean, readable mindmaps from document hierarchy.
- Styled and arranged using Dagre graph layout for intuitive structure.
- Interactive fullscreen view with zoom, pan, and drag options.

> **Packages**:

```bash
npm install dagre reactflow react-icons react-tiny-popover
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
- Vector-based document search using FAISS for efficient retrieval.

> **Packages**:

```bash
npm install @langchain/community @langchain/core @langchain/google-genai faiss-node
```

---

### 5. 💾 Persistent Chat History

- User chat sessions are stored in MongoDB.
- Auto-saved and reloadable even after browser restarts.
- Modal interface for easy loading, deleting, and managing chats.

---

### 6. 🎤 STT & TTS Interaction

- STT: Convert voice queries to text using browser APIs.
- TTS: Read AI replies aloud using real-time speech engines.

> **Packages**:

```bash
npm install @google-cloud/text-to-speech say
```

---

### 7. 🔍 Deep Search Integration

- Web search capabilities using DuckDuckGo API.
- Intelligent query decomposition and result synthesis.
- Cached search results for improved performance.

---

## ⚙️ Setup & Installation Guide

### 🔧 Prerequisites

- Node.js (v16 or later)
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

#### 3. Terminal 2: Start Node.js Backend

```bash
cd server
npm install
```

Create `.env` in `/server`:

```
PORT=5005
MONGO_URI=mongodb://localhost:27017/chatbotGeminiDB4
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=random_secret
```

Start backend:

```bash
npm start
```

#### 4. Terminal 3: Start React Frontend

```bash
cd client
npm install
npm start
```

---

## 🏗️ Architecture

### Backend (Node.js/Express)
- **RAG Pipeline**: Document processing with vector embeddings
- **AI Services**: Gemini AI integration for chat and content generation
- **File Management**: Multi-format document upload and processing
- **Audio Processing**: Podcast generation with FFmpeg
- **Search Services**: Deep search with DuckDuckGo integration

### Frontend (React)
- **Chat Interface**: Real-time messaging with RAG support
- **File Manager**: Drag-and-drop upload with progress tracking
- **Mind Map Viewer**: Interactive graph visualization
- **Audio Player**: Podcast playback with controls
- **Responsive Design**: Mobile-friendly interface

### Database (MongoDB)
- **User Management**: Authentication and session storage
- **Chat History**: Persistent conversation storage
- **File Metadata**: Document information and processing status
- **Vector Store**: FAISS indices for document search

---

## 🔧 Environment Variables

### Server (.env)
```
PORT=5005
MONGO_URI=mongodb://localhost:27017/chatbotGeminiDB4
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_secret
```

### Client (.env)
```
REACT_APP_API_URL=http://localhost:5005
```

---

## 📦 Key Dependencies

### Backend Dependencies
- `@google/generative-ai`: Gemini AI integration
- `@langchain/community`: LangChain for RAG
- `faiss-node`: Vector similarity search
- `mongoose`: MongoDB ODM
- `express`: Web framework
- `multer`: File upload handling
- `fluent-ffmpeg`: Audio processing

### Frontend Dependencies
- `react`: UI framework
- `reactflow`: Mind map visualization
- `dagre`: Graph layout algorithms
- `axios`: HTTP client
- `react-markdown`: Markdown rendering

---

## 🚀 Development

### Running in Development Mode
```bash
# Backend
cd server
npm run dev

# Frontend
cd client
npm start
```

### Testing
```bash
# Backend tests
cd server
npm test

# Frontend tests
cd client
npm test
```

---

## 👥 My Contribution

| Name     | GitHub Username | Contribution Areas                                                                 |
|----------|------------------|------------------------------------------------------------------------------------|
| Jaya Aswanth Allu | [AswanthAllu](https://github.com/AswanthAllu) | Chain of Thought, Persistent Chat History (MongoDB), STT/TTS, Podcast Generation, Mind Map Generation, RAG Pipeline, Chat & File Deletion Features, Multiple File Upload, UI/UX Design |

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.


