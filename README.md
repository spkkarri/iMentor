# FusedChatbotNew

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

FusedChatbotNew is a full-stack conversational AI application that integrates a React frontend, Node.js backend, and a Python-based AI core service. It supports multi-LLM interactions, Retrieval Augmented Generation (RAG), document analysis, and user-friendly features like voice-to-text recognition and chat deletion. The application dynamically generates FAQs, topics, and mindmaps based on document size, providing a robust platform for interactive AI-driven conversations.

---
## FusedChatbot Overview : https://drive.google.com/file/d/1PRQY62gIbIBbgZ_V-Tl60lrYrHRlrRuK/view?usp=sharing 
## Code Overview : https://youtu.be/y3pUV6oN1wU?si=3GeETW5_nirLbIyo
## Installation Video : https://drive.google.com/file/d/1GD_JbBEaLgkipeuYwjFK3QYLk6scmMQY/view?usp=drive_link
---

## ✨ Features

*   *Multi-LLM Support:* Choose from Gemini, Groq LLaMA 3, or Ollama-hosted models for chat interactions.
*   *Retrieval Augmented Generation (RAG):* Upload documents (PDF, DOCX, PPTX, TXT) to augment chat responses with relevant context, including multi-query RAG for improved recall.
*   *Document Analysis:*
    *   *FAQ Generation:* Automatically extracts FAQs based on document content, scaling with document size.
    *   *Topic Identification:* Identifies key topics with explanations, dynamically adjusted by document length.
    *   *Mindmap Generation:* Creates hierarchical mindmaps using Mermaid for visualizing document structure.
*   *Chain-of-Thought (CoT):* Displays the AI's reasoning process for transparency in responses.
*   *User Management:* Supports user signup, signin, and session management.
*   *File Management:* Upload, list, rename, and delete user-specific documents.
*   *Chat History:* Save and retrieve chat sessions with RAG references and CoT.
*   *Voice-to-Text Recognition:* Convert spoken input into text for hands-free interaction.
*   *Chat Deletion:* Delete chat sessions for privacy and clutter management.
*   *Enhanced UI:* Modern, intuitive interface for a seamless user experience.
*   *Admin Pannel:* When a user wants to access the Admin API keys, they must first submit a request to the admin. The API keys will be accessible to the user only after the admin grants approval.


---

## 🏗 Architecture

This project uses a scalable *microservice-oriented architecture* to separate concerns and improve maintainability.

[React Frontend] ↔ [Node.js Backend (Orchestrator)] ↔ [Python AI Service (AI Core)]

*   *React Frontend:* A modern, dynamic user interface.
*   *Node.js Backend:* Acts as an orchestrator and API gateway. It handles user authentication, session management, and file operations. It does *not* contain heavy AI logic.
*   *Python AI Service:* A dedicated service for all specialized AI tasks, including RAG, vector database management (FAISS), and all communication with LLMs (Gemini, Groq, Ollama).

---

## 🛠 Tech Stack

*   *Frontend:* React, Axios
*   *Backend (Orchestrator):* Node.js, Express.js
*   *AI Service:* Python, Flask
*   *Database:* MongoDB with Mongoose
*   *AI & ML:*
    *   *LLMs:* Google Gemini, Groq, Ollama
    *   *Vector Database:* FAISS (Facebook AI Similarity Search)
    *   *Embeddings:* Sentence-Transformers
*   *Authentication:* JWT (JSON Web Tokens), bcrypt.js

---

## ✅ Prerequisites

*   *Node.js:* v16 or higher with npm.
*   *Python:* v3.9 or higher with pip.
*   *Git:* For cloning the repository.
*   *MongoDB:* A running instance (local MongoDB Community Server or a free MongoDB Atlas cluster).
*   *(Optional) Ollama:* Installed and running for local LLM support.

# Install Node.js (22.x) & npm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash
sudo apt install -y nodejs

# Install Python 3.11 & pip
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Install MongoDB
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

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
python -m venv venv

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
---
## Running the Application
###Run the three services in separate terminal windows

### Terminal 1: Start the AI Core Service (Python)
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

### Terminal 2: Start the Backend Server (Node.js)
```bash
cd server
node server.js
```

### Terminal 3: Start the Frontend (React)
```bash
cd client
npm start
```

## Accessing the Application
Go to: [http://localhost:3000](http://localhost:3000)
