#  iMentor - Advanced AI Tutoring Platform

An intelligent AI-powered educational platform featuring **Agentic MCP**, multi-model support, comprehensive document processing, and advanced content generation capabilities. Built with React, Node.js, and MongoDB for seamless learning experiences.

##  Core Features

###  **Agentic MCP (Model Context Protocol)**
- **Intelligent Agents** - 5 specialized AI agents that autonomously use all application features
- **Multi-Agent Collaboration** - Agents work together on complex multi-step tasks
- **Autonomous Decision Making** - Agents intelligently choose optimal tools and strategies
- **Real-time Orchestration** - Seamless coordination between agents for comprehensive results

###  **Advanced AI Capabilities**
- **Multi-Model Support** - Gemini, Ollama, DeepSeek, Qwen, and more
- **Intelligent Routing** - Automatic model selection based on query analysis
- **Enhanced Personalization** - Adaptive learning based on user interactions
- **Performance Optimization** - Real-time caching and response optimization

###  **Document Intelligence**
- **RAG (Retrieval-Augmented Generation)** - Upload and query documents intelligently
- **Advanced File Processing** - PDF, DOCX, PPTX, images, audio, and video support
- **Content Extraction** - Intelligent text, image, and metadata extraction
- **Vector Search** - Semantic document search and analysis

###  **Enhanced Search & Research**
- **Deep Search V2** - Advanced web research with video integration
- **YouTube-like Video Display** - High-quality thumbnails and direct playback
- **Comprehensive Analysis** - Multi-source information synthesis
- **Source Verification** - Credible source identification and citation

###  **Content Generation**
- **Document Generation** - Professional PDF reports, PowerPoint presentations, Word documents
- **Podcast Scripts** - Detailed audio content with segments and timing
- **Enhanced Content Creation** - Multiple formats and templates
- **Download Management** - Secure file generation and access

## Quick Installation

### Prerequisites
- **Conda** (Anaconda or Miniconda) for Python environment management
- **Docker** with sudo privileges for containerized services
- **Node.js** 16+ and npm
- **MongoDB** (local or cloud)

### One-Command Setup
```bash
# Clone and install everything automatically
curl -fsSL https://raw.githubusercontent.com/spkkarri/iMentor/main/install.sh | bash
```

### Manual Installation
```bash
# Clone repository
git clone https://github.com/spkkarri/iMentor.git
cd iMentor

# Run installation script (uses conda and sudo docker)
chmod +x install.sh
./install.sh

# Or with Docker
./install.sh --docker
```

### Docker Installation
```bash
# Using Docker Compose (requires sudo)
git clone https://github.com/spkkarri/iMentor.git
cd iMentor
sudo docker-compose up -d
```

## 🤖 Agentic MCP System

### Specialized AI Agents

#### 🔬 **Research Analyst Agent**
- **Specialization**: Research and Analysis
- **Capabilities**: Web research, data synthesis, source verification, report generation
- **Tools**: Deep Search, RAG Service, PDF Generator, Enhanced Content Generator

#### 📝 **Content Creator Agent**
- **Specialization**: Content Generation
- **Capabilities**: Document creation, presentation design, content optimization
- **Tools**: PDF Generator, PPT Generator, Word Generator, Enhanced Content Generator

#### 📄 **Document Processor Agent**
- **Specialization**: Document Management
- **Capabilities**: File processing, content extraction, metadata analysis
- **Tools**: File Upload, Document Processor, RAG Service, Vector Store

#### 🎓 **Learning Assistant Agent**
- **Specialization**: Educational Support
- **Capabilities**: Concept explanation, personalized learning, assessment creation
- **Tools**: RAG Service, Enhanced Personalization, Multi-Model Service

#### ⚙️ **Workflow Coordinator Agent**
- **Specialization**: Task Orchestration
- **Capabilities**: Workflow planning, agent coordination, quality assurance
- **Tools**: Agentic Protocol Manager, Performance Optimizer, Metrics Collector

### Real-World Use Cases

#### Academic Research
```
User: "Research quantum computing and create a comprehensive academic report"

Workflow:
1. Research Analyst Agent → Performs deep web search for latest research
2. Document Processor Agent → Analyzes any uploaded research papers
3. Content Creator Agent → Generates comprehensive PDF report with citations
4. Learning Assistant Agent → Adds educational explanations for complex concepts

Result: Professional academic report with web research, document analysis, and clear explanations
```

#### Business Presentation
```
User: "Create a presentation about digital transformation for executives"

Workflow:
1. Research Analyst Agent → Researches current digital transformation trends
2. Content Creator Agent → Creates professional PowerPoint presentation
3. Workflow Coordinator Agent → Ensures quality and consistency

Result: Executive-ready presentation with current market data and professional design
```

## ⚙️ Environment Variables

Create `server/.env` file with these variables:

```env
# Server Configuration
PORT=4007
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

## 🎯 Usage

### Getting Started
1. **Open the application** at `http://localhost:4004`
2. **Choose your mode**:
   - **Standard Chat**: Basic AI conversation
   - **RAG Mode**: Upload documents and ask questions about them
   - **Deep Search**: AI-powered web research with video integration
   - **Agentic MCP**: Intelligent agents for complex multi-step tasks

### Agentic MCP Usage
Enable Agentic MCP for intelligent task automation:

#### Academic Research
```
"Research quantum computing and create a comprehensive academic report"
→ Research Analyst + Content Creator agents collaborate
→ Result: Professional PDF report with research and analysis
```

#### Business Presentations
```
"Create a presentation about digital transformation for executives"
→ Research Analyst + Content Creator agents work together
→ Result: Executive-ready PowerPoint with current market data
```

#### Document Analysis
```
"Analyze these research papers and provide key insights"
→ Document Processor + Learning Assistant agents collaborate
→ Result: Comprehensive analysis with educational context
```

### Advanced Features
- **Multi-Model Selection**: Gemini, Ollama, DeepSeek, Qwen support
- **Enhanced Video Search**: YouTube-like interface with direct playback
- **Document Generation**: PDF reports, PowerPoint presentations, Word documents
- **File Processing**: Support for PDF, DOCX, PPTX, images, audio, video
- **Performance Monitoring**: Real-time agent performance and system health

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

# Conda environment management
conda activate imentor    # Activate Python environment
conda deactivate         # Deactivate environment

# Docker management (requires sudo)
sudo docker-compose up -d     # Start services
sudo docker-compose down      # Stop services
sudo docker-compose logs      # View logs
sudo docker-compose ps        # Check status
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

- **Frontend**: http://localhost:4004
- **Backend API**: http://localhost:4007
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
| Conda not found | Install Miniconda and add to PATH |
| Docker permission denied | Use `sudo docker` commands or add user to docker group |

### Conda Environment Issues
```bash
# If conda command not found
export PATH="$HOME/miniconda3/bin:$PATH"
source ~/.bashrc

# Recreate environment
conda env remove -n imentor
conda create -n imentor python=3.9 -y
conda activate imentor
```

### Docker Permission Issues
```bash
# Ensure Docker service is running
sudo systemctl start docker

# Check Docker status
sudo docker ps

# If permission denied, ensure user is in docker group (optional)
sudo usermod -aG docker $USER
# Note: Logout and login again for group changes to take effect
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request


## 🙏 Acknowledgments

- **Google** for Gemini AI and advanced language models
- **DeepSeek** for high-performance AI capabilities
- **Ollama** for local AI model deployment
- **MongoDB** team for robust database solutions
- **React** team for the powerful frontend framework
- **Docker** for containerization technology
- **Conda** for Python environment management
- **All contributors and testers** who made this project possible

#   a s w a n t h  
 #   a s w a n t h  
 