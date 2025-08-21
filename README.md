# FusedChatbotNew

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

FusedChatbotNew is a full-stack conversational AI application that integrates a React frontend, Node.js backend, and a Python-based AI core service. It supports multi-LLM interactions, Retrieval Augmented Generation (RAG), document analysis, and user-friendly features like voice-to-text recognition and chat deletion. The application dynamically generates FAQs, topics, and mindmaps based on document size, providing a robust platform for interactive AI-driven conversations.

---

## ✨ Features

*   **Multi-LLM Support:** Choose from Gemini, Groq LLaMA 3, or Ollama-hosted models for chat interactions.
*   **Retrieval Augmented Generation (RAG):** Upload documents (PDF, DOCX, PPTX, TXT) to augment chat responses with relevant context, including multi-query RAG for improved recall.
*   **Document Analysis:**
    *   **FAQ Generation:** Automatically extracts FAQs based on document content, scaling with document size.
    *   **Topic Identification:** Identifies key topics with explanations, dynamically adjusted by document length.
    *   **Mindmap Generation:** Creates hierarchical mindmaps using Mermaid for visualizing document structure.
*   **Chain-of-Thought (CoT):** Displays the AI's reasoning process for transparency in responses.
*   **User Management:** Supports user signup, signin, and session management.
*   **File Management:** Upload, list, rename, and delete user-specific documents.
*   **Chat History:** Save and retrieve chat sessions with RAG references and CoT.
*   **Voice-to-Text Recognition:** Convert spoken input into text for hands-free interaction.
*   **Chat Deletion:** Delete chat sessions for privacy and clutter management.
*   **Enhanced UI:** Modern, intuitive interface for a seamless user experience.
*   **Admin Pannel:** Users seeking access to Admin API keys can submit a request directly through the interface. Admins are automatically notified via email, and upon approval or rejection, users receive real-                        time status updates through email notifications.
*   **Agentic AI Features:**
     *   **Subject-Oriented Agent:** AI that intelligently analyzes documents and provides optimized, context-aware responses
     *   **Smart Quiz Generation:** Creates interactive quizzes directly from document content with adaptive difficulty
     *   **Document Intelligence:** Transforms any uploaded document into personalized learning experiences
*   **Prompt Enhancer:** The system automatically rewrites user prompts to make them clearer and more focused, helps to  understand better and give more accurate answers.
*   **Quiz Generator:** Upload a document, and the system automatically builds a quiz from the content.
*   **Code Compiler:** Write and run code (Python, JS, etc.) directly in the chat with instant results.It also helps us to find errors and clearly explain with suggestions to improve or fix the code.
*   **Podcast Generator:** Converts any document or topic into an engaging AI-generated podcast featuring two distinct voices in a conversational format.Users can interact with the podcast in real time by pausing and asking follow-up questions, creating a dynamic learning experience.
*   **Chat Enhancement:** Uses Redis caching to deliver faster responses by storing commonly used answers, chat context, and document previews.
*   **Presentation Builder:** Automatically generates professional PowerPoint presentations from uploaded documents or selected topics. The AI structures content into slides with titles, bullet points, summaries, and speaker notes, ready for download and presentation.


---

## 🏗 Architecture

This project uses a scalable *microservice-oriented architecture* to separate concerns and improve maintainability.

```bash
[React Frontend] 
        ↕ REST/WebSocket
[Node.js Backend (Orchestrator)] 
        ↕ REST/WebSocket
[Python AI Service (AI Core)]
```

### Core Services
*   **React Frontend:** Modern, dynamic user interface with real-time updates and responsive design.
*   **Node.js Backend (Orchestrator):** API gateway handling authentication, session management, file operations, and serving as the central hub for all client requests.
*   **Python AI Service (AI Core):** Dedicated AI engine managing all intelligent operations including:
    - RAG with FAISS vector database
    - Multi-LLM orchestration (Gemini, Groq, Ollama)
    - Document analysis and generation
    - **Podcast Generation** with audio synthesis
    - **Presentation Builder** with slide creation
    - Quiz and mindmap generation

### Supporting Infrastructure
*   **MongoDB:** Database for user data, chat history, and file metadata
*   **Redis:** Caching layer for improved response times           load balancing
*   **Neo4j:** Knowledge graph storage for enhanced document relationships
*   **File Storage:** Local filesystem for uploaded documents and generated content
*   **Docker Services:** Containerized Redis and Neo4j instances for development


---

## 🛠 Tech Stack

### Frontend
*   **Framework:** React 18 with Hooks
*   **Styling:** Tailwind CSS
*   **State Management:** React Context API
*   **HTTP Client:** Axios
*   **UI Components:** Custom components with CSS modules
*   **Real-time:** WebSocket support for live updates

### Backend (Orchestrator)
*   **Runtime:** Node.js 22.x
*   **Framework:** Express.js
*   **Database:** MongoDB with Mongoose ODM
*   **Authentication:** JWT, bcrypt.js
*   **Session Management:** Express-session with Redis store
*   **File Upload:** Multer for multipart uploads
*   **Validation:** Express-validator

### AI Service
*   **Runtime:** Python 3.12
*   **Framework:** Flask
*   **ML/AI Libraries:** 
    *   **LLMs:** Google Gemini, Groq, Ollama
    *   **Vector Database:** FAISS (Facebook AI Similarity Search)
    *   **Embeddings:** Sentence-Transformers
    *   **Audio Processing:** PyDub, gTTS for podcast generation
    *   **Document Processing:** PyPDF2, python-docx, python-pptx
    *   **Graph Database:** Neo4j with py2neo
    *   **Caching:** Redis with redis-py
*   **Task Queue:** Celery for async processing
*   **File Storage:** Local filesystem with UUID naming

### Infrastructure & DevOps
*   **Containerization:** Docker & Docker Compose
*   **Process Management:** PM2 for Node.js services
*   **Reverse Proxy:** Nginx (optional for production)
*   **Environment Management:** dotenv for configuration
*   **Development Tools:** Nodemon


---

## ✅ Prerequisites

*   *FFmpeg:* [Link](https://www.gyan.dev/ffmpeg/builds/)
        1.after download sucessful you need to add the bin directory to your system's envi path
*   *Node.js:* v16 or higher with npm.
*   *Python:* v3.9 or higher with pip.
*   *Git:* For cloning the repository.
*   *MongoDB:* A running instance (local MongoDB Community Server or a free MongoDB Atlas cluster).
*   *(Optional) Ollama:* Installed and running for local LLM support.

# Install Node.js (22.x) & npm
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash
sudo apt install -y nodejs
```

# Install Python 3.12 & pip
```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3.12-dev python3-pip
```

# Install MongoDB
```bash
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod
```

# Install ffmpeg
```bash
sudo apt update
sudo apt install ffmpeg
```

# Install Docker
```bash
sudo apt install -y docker.io
sudo systemctl enable --now docker
```

---

## 🚀 Getting Started

## ⚙ Setup and Installation

Follow these steps to set up and run the FusedChatbotNew project locally.

### Step 1: Clone the Repository

Clone the project from GitHub and navigate to the project directory:

```bash
git clone <your-repository-url>
cd FusedChatbotNew
```

---

## Step 2: Configure Environment Variables

### Backend (Node.js)

*   *Navigate to the server directory and create a .env file by copying the example file.
*   *Navigate to the server/ai_core_service directory and create a .env file by copying the example file.

```bash
cd server
```
```
# For Linux/macOS
cp .env.example .env

# For Windows
copy .env.example .env
```



---

## Step 3: Install Dependencies

### Backend (Node.js)

In the server directory, install the required Node.js dependencies:

```bash
cd server
npm install
```


---

#### AI Core Service Dependencies (Python)
```bash
cd ai_core_service
python3 -m venv venv

# Activate:
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows CMD
.\venv\Scripts\Activate.bat

# Linux/macOS
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

#### Frontend Dependencies (React)
```bash
cd ../../client
npm install
```
#### MCP Dependencies 
``` bash
cd ../../mcp-server-duckduckgo-search
npm install
```

---
## Running the Application
###Run the three services in separate terminal windows
## Running the Neo4j services
```bash
docker run -d --name neo4j-db --restart unless-stopped -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/test neo4j:latest
```
## Running Redis services
```bash
docker run -d --name redis-server --restart unless-stopped -p 6379:6379 redis:latest
```
### Terminal 1: start the MCP server 
``` bash
cd mcp-servers

cd mcp-server-duckduckgo-search
# activating the server

npm run dev

``` 

### Terminal 2: Start the AI Core Service (Python)
```bash
cd server

# Activate virtual environment
cd ai_core_service

.\venv\Scripts\Activate.ps1  # Windows
# or
source ai_core_service/venv/bin/activate     # macOS/Linux

cd..  #run the command in the server
python -m ai_core_service.app
```

### Terminal 3: Start the Backend Server (Node.js)
```bash
cd server
node server.js
```

### Terminal 4: Start the Frontend (React)
```bash
cd client
npm start
```

## Accessing the Application
Go to: [http://localhost:6001](http://localhost:6001)



