# 🤖 TutorAI Chatbot

An advanced AI-powered tutoring system with multi-model support, RAG capabilities, and intelligent document processing.
Built with React, Node.js, and MongoDB for seamless learning experiences.

## ✨ Features

- **� Multi-Model Support** - Switch between Gemini, Ollama, and DeepSeek models
- **📚 RAG (Retrieval-Augmented Generation)** - Upload and query documents intelligently
- **🔍 Deep Search** - Web search with AI-powered analysis and summarization
- **🤝 MCP Agents** - Model Context Protocol for advanced AI interactions
- **� File Processing** - Support for PDF, DOCX, PPTX, images, and more
- **💬 Real-time Chat** - WebSocket-based instant communication
- **👤 User Management** - Authentication and personalized experiences
- **🎯 Smart Routing** - Intelligent query classification and model selection

## 🚀 Quick Installation

### One-Command Setup
```bash
# Clone and install everything automatically
curl -fsSL https://raw.githubusercontent.com/spkkarri/iMentor/Team-4/install.sh | bash
```

### Manual Installation
```bash
# Clone repository
git clone -b Team-4 https://github.com/spkkarri/iMentor.git
cd iMentor

# Run installation script
chmod +x install.sh
./install.sh

# Or with Docker
./install.sh --docker
```

### Docker Installation
```bash
# Using Docker Compose
git clone -b Team-4 https://github.com/spkkarri/iMentor.git
cd iMentor
docker-compose up -d
```

## ⚙️ Environment Variables

Create `server/.env` file with these variables:

```env
# Server Configuration
PORT=5007
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/iMentor_chatbot

# AI Services (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional AI Services
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OLLAMA_URL=http://localhost:11434

# Security
JWT_SECRET=your_secure_jwt_secret_here

# Feature Toggles
ENABLE_DEEP_SEARCH=true
ENABLE_MCP_AGENTS=true
ENABLE_FILE_UPLOAD=true
ENABLE_VOICE_FEATURES=false

# Performance
MAX_FILE_SIZE=50MB
CACHE_TTL=3600
RATE_LIMIT_REQUESTS=100
```

## 🔑 API Keys Setup

| Service | Required | Setup Instructions |
|---------|----------|-------------------|
| **Gemini** | ✅ Yes | [Google AI Studio](https://makersuite.google.com/app/apikey) → Create API Key |
| **DeepSeek** | ⚪ Optional | [DeepSeek Platform](https://platform.deepseek.com/) → Generate Key |
| **Ollama** | ⚪ Optional | [Install Ollama](https://ollama.ai/) → `ollama run llama2` |

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development mode
npm run server       # Server only
npm run client       # Client only
npm run build        # Build for production
npm start           # Production mode
npm run pm2:start   # Start with PM2
npm run pm2:logs    # View PM2 logs
```

### Project Structure
```
iMentor/
├── 📁 client/              # React frontend
│   ├── src/components/     # UI components
│   ├── src/services/       # API services
│   └── public/            # Static assets
├── � server/              # Node.js backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   └── middleware/        # Express middleware
├── 🐳 docker-compose.yml   # Docker configuration
├── ⚙️ ecosystem.config.js  # PM2 configuration
└── 🚀 install.sh          # Installation script
```

## 🌐 Access URLs

- **Frontend**: http://localhost:3004
- **Backend API**: http://localhost:5007
- **MongoDB**: mongodb://localhost:27017

## � Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup
```

### Using Docker
```bash
docker-compose -f docker-compose.yml up -d
```

### Manual Deployment
```bash
npm run build
npm start
```

## � Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change `PORT` in `.env` file |
| MongoDB connection failed | Ensure MongoDB is running: `sudo systemctl start mongod` |
| API key errors | Verify keys in `.env` file |
| Build failures | Run `npm install` and check Node.js version (18+) |

