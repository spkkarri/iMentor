#!/bin/bash

# ==============================================================================
#  Complete Environment and Dependency Installation Script for iMentor
# ==============================================================================
# This script automates the full project setup, including:
#   1. Checking for Docker.
#   2. Starting required database services (Neo4j, Redis) via 'sudo docker'.
#   3. Creating a standard Python virtual environment (venv).
#   4. Installing dependencies for all application services.
#   5. Generating required .env files with placeholders.
#
# USAGE:
#   1. From the project root, make the script executable: chmod +x install.sh
#   2. Run the script: ./install.sh
# ==============================================================================

# Exit immediately if any command fails.
set -e

# --- Helper variables for colored output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting the complete environment and dependency setup...${NC}"

# --- Step 1: Check for Docker Prerequisite ---
echo -e "\n${CYAN}Step 1/7: Checking for Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker Desktop and ensure it is running.${NC}"
    exit 1
fi
if ! sudo docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is installed but the Docker daemon is not running or you lack sudo permissions.${NC}"
    echo -e "${YELLOW}Please start Docker and try again, or ensure your user can run 'sudo docker' without a password prompt.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is installed and accessible via sudo.${NC}"


# --- Step 2: Start Neo4j and Redis Containers ---
echo -e "\n${CYAN}Step 2/7: Starting required database containers (Neo4j & Redis)...${NC}"
echo -e "${YELLOW}  -> This will use 'sudo' and may prompt for your password.${NC}"
sudo docker stop neo4j-db redis-server >/dev/null 2>&1 || true
sudo docker rm neo4j-db redis-server >/dev/null 2>&1 || true

echo -e "${YELLOW}  -> Starting Neo4j container on ports 6474 (UI) and 6687 (Bolt)...${NC}"
sudo docker run --name neo4j-db \
    -p 6474:7474 \
    -p 6687:7687 \
    -d \
    --restart unless-stopped \
    -e NEO4J_AUTH=neo4j/test \
    neo4j:latest

echo -e "${YELLOW}  -> Starting Redis container on port 6379...${NC}"
sudo docker run --name redis-server \
    -p 6379:6379 \
    -d \
    --restart unless-stopped \
    redis:latest

echo -e "${GREEN}✅ Database containers started successfully.${NC}"


# --- Step 3: Install Node.js Backend Dependencies ---
echo -e "\n${CYAN}Step 3/7: Installing dependencies for the Node.js Backend...${NC}"
cd ./chat-bot-tarak-2/server
npm install
cd ../..
echo -e "${GREEN}✅ Node.js Backend dependencies installed successfully.${NC}"


# --- Step 4: Install React Frontend Dependencies ---
echo -e "\n${CYAN}Step 4/7: Installing dependencies for the React Frontend...${NC}"
cd ./chat-bot-tarak-2/client
npm install
cd ../..
echo -e "${GREEN}✅ React Frontend dependencies installed successfully.${NC}"


# --- Step 5: Set up Python AI Core Service with venv ---
echo -e "\n${CYAN}Step 5/7: Setting up Python virtual environment for the AI Core Service...${NC}"
cd ./chat-bot-tarak-2/server/ai_core_service
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}  -> Creating Python virtual environment (venv)...${NC}"
    python3 -m venv venv
fi

echo -e "${YELLOW}  -> Activating virtual environment and installing Python packages...${NC}"
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../../..
echo -e "${GREEN}✅ Python AI Core Service setup is complete.${NC}"


# --- Step 6: Install and Build DuckDuckGo Microservice ---
echo -e "\n${CYAN}Step 6/7: Installing and building the DuckDuckGo Search Microservice...${NC}"
cd ./mcp-servers/mcp-server-duckduckgo-search
npm install
echo -e "${YELLOW}  -> Building TypeScript source code...${NC}"
npm run build
cd ../..
echo -e "${GREEN}✅ DuckDuckGo Microservice setup is complete.${NC}"


# --- Step 7: Create .env files with placeholders ---
echo -e "\n${CYAN}Step 7/7: Creating .env files with placeholder values...${NC}"

# --- Server .env ---
cat > ./chat-bot-tarak-2/server/.env <<EOL

ADMIN_GEMINI_API_KEY=
ADMIN_GROQ_API_KEY=

ADMIN_USERNAME=admin@12345
ADMIN_PASSWORD=admin@12345

PORT=6002
PYTHON_AI_CORE_SERVICE_URL="http://localhost:6003"
ENABLE_KG_SERVICE=false

HUGGING_FACE_HUB_TOKEN="hf_lzSsuUaGtlZ vijay uyzLgjJpPRekWrWxLeECuZH"
MONGO_URI="mongodb+srv://vijaytarakjangumalli:yWO7DfHxcjP8TS3L@cluster6.8i66og9.mongodb.net/chatbot6?retryWrites=true&w=majority&appName=Cluster6"
JWT_SECRET=asdfewertyuiop1234567890qwertyuiop
NODE_ENV="development"
DEFAULT_LLM_PROVIDER_NODE="groq_llama3"
# python -c "import secrets; print(secrets.token_hex(32))"
API_ENCRYPTION_KEY=your_generated_key_here
EOL
echo -e "${GREEN}✅ Created 'chat-bot-tarak-2/server/.env'${NC}"

# --- AI Core Service .env ---
cat > ./chat-bot-tarak-2/server/ai_core_service/.env <<EOL

OLLAMA_BASE_URL="http://172.180.9.187:11434"
OLLAMA_MODEL="llama3:latest"
OLLAMA_MODEL="qwen2.5:14b-instruct"
EOL
echo -e "${GREEN}✅ Created 'chat-bot-tarak-2/server/ai_core_service/.env'${NC}"

# --- Client .env ---
cat > ./chat-bot-tarak-2/client/.env <<EOL
# Add frontend environment variables as needed
PORT=6001
DANGEROUSLY_DISABLE_HOST_CHECK=true

EOL
echo -e "${GREEN}✅ Created 'chat-bot-tarak-2/client/.env'${NC}"


# --- Final Instructions ---
echo -e "\n\n${GREEN}🎉 Full environment and all dependencies are set up!${NC}"
echo -e "\n${YELLOW}IMPORTANT:${NC} .env files were generated with placeholder values."
echo "Please review and update them before running the application:"
echo -e "${CYAN}  - chat-bot-tarak-2/server/.env"
echo "  - chat-bot-tarak-2/server/ai_core_service/.env"
echo "  - chat-bot-tarak-2/client/.env${NC}"

echo ""
echo "To run the Python AI service:"
echo -e "  ${CYAN}source chat-bot-tarak-2/server/ai_core_service/venv/bin/activate${NC}"
echo -e "  ${CYAN}python app.py${NC} (or however your AI service is started)"


sudo chown -R $USER:$USER venv
