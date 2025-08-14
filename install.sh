#!/bin/bash

# ==============================================================================
# iMentor Project Installer for Debian/Ubuntu (Conda Edition)
# This script will:
#   1. Check for and install all required system-level dependencies.
#   2. Check for and install Miniconda if a conda installation is not found.
#   3. Configure the project by creating .env files with placeholders for secrets.
#   4. Install all Node.js and Python dependencies into their respective environments.
#   5. Run the initial database seeder script.
# ==============================================================================

# --- Configuration & Helpers ---
set -e # Exit immediately if a command fails

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function to check if a command exists
function check_command() {
    command -v "$1" &> /dev/null
}

# --- Main Functions ---
function install_prerequisites() {
    echo -e "${YELLOW}[INFO] Updating package lists...${NC}"
    apt-get update

    echo -e "${YELLOW}[INFO] Installing base dependencies (curl, git, tesseract, ffmpeg)...${NC}"
    apt-get install -y curl git tesseract-ocr ffmpeg gnupg

    # --- Install Docker ---
    if ! check_command docker; then
        echo -e "${YELLOW}[INFO] Docker not found. Installing...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl start docker
        systemctl enable docker
        rm get-docker.sh
    else
        echo -e "${GREEN}[SUCCESS] Docker is already installed.${NC}"
    fi

    # --- Install Node.js v18 ---
    if ! check_command node || ! node -v | grep -q "v18"; then
        echo -e "${YELLOW}[INFO] Node.js v18 not found. Installing...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        echo -e "${GREEN}[SUCCESS] Node.js v18 is already installed.${NC}"
    fi

    # --- Install MongoDB ---
    if ! check_command mongod; then
        echo -e "${YELLOW}[INFO] MongoDB not found. Installing...${NC}"
        curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
        apt-get update
        apt-get install -y mongodb-org
        systemctl start mongod
        systemctl enable mongod
    else
        echo -e "${GREEN}[SUCCESS] MongoDB is already installed.${NC}"
    fi

    # --- Install Miniconda ---
    if ! check_command conda; then
        echo -e "${YELLOW}[INFO] Conda not found. Installing Miniconda...${NC}"
        MINICONDA_INSTALL_DIR="/opt/miniconda" # Install for all users
        curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o miniconda.sh
        bash miniconda.sh -b -p "$MINICONDA_INSTALL_DIR"
        rm miniconda.sh
        # Make conda command available to all users in new shells
        ln -s "$MINICONDA_INSTALL_DIR/bin/conda" /usr/local/bin/conda
        echo -e "${YELLOW}[INFO] Conda installed. Please restart your terminal after this script finishes for the 'conda' command to be available.${NC}"
    else
        echo -e "${GREEN}[SUCCESS] Conda is already installed.${NC}"
    fi
}

function configure_environment() {
    echo -e "\n${YELLOW}[INFO] Creating .env files with placeholders...${NC}"

    # Create server/.env with placeholders for secrets
    cat > server/.env << EOL
# --- Server Port & Database ---
PORT=2000
MONGO_URI="mongodb://localhost:27017/chatbot_gemini"

# --- Security ---
JWT_SECRET="GENERATE_A_STRONG_RANDOM_SECRET_KEY_HERE"
ENCRYPTION_SECRET="GENERATE_A_64_CHAR_HEX_SECRET_HERE_ (e.g., using 'openssl rand -hex 32')"

# --- Language Model (LLM) APIs ---
GEMINI_API_KEY="ADD_YOUR_GOOGLE_GEMINI_API_KEY_HERE"
OLLAMA_API_BASE_URL="http://localhost:11434"
OLLAMA_DEFAULT_MODEL="llama3"

# --- Internal & External Service URLs ---
PYTHON_RAG_SERVICE_URL="http://127.0.0.1:2001"
REDIS_URL="redis://localhost:2005"
ELASTICSEARCH_URL=http://localhost:2006
SENTRY_DSN="ADD_YOUR_SENTRY_DSN_HERE_OR_LEAVE_BLANK"

# --- Admin credentials for Basic Auth on admin routes ---
FIXED_ADMIN_USERNAME=admin@admin.com
FIXED_ADMIN_PASSWORD=admin123

# --- AWS S3 Credentials for Dataset Management ---
S3_BUCKET_NAME="your-s3-bucket-name-here"
AWS_ACCESS_KEY_ID="ADD_YOUR_AWS_ACCESS_KEY_ID_HERE"
AWS_SECRET_ACCESS_KEY="ADD_YOUR_AWS_SECRET_ACCESS_KEY_HERE"
AWS_REGION="us-east-1"
EOL
    echo -e "${GREEN}[SUCCESS] Created server/.env with placeholders.${NC}"

    # Create frontend/.env
    cat > frontend/.env << EOL
VITE_API_BASE_URL=http://localhost:2000/api
VITE_ADMIN_USERNAME=admin@admin.com
VITE_ADMIN_PASSWORD=admin123
EOL
    echo -e "${GREEN}[SUCCESS] Created frontend/.env.${NC}"

    echo -e "\n${RED}================== ACTION REQUIRED ==================${NC}"
    echo -e "${YELLOW}Your .env files have been created."
    echo -e "${YELLOW}You MUST edit ${RED}server/.env${YELLOW} to add your secret keys for Gemini, AWS, etc."
    echo -e "${YELLOW}The application will NOT run correctly without them!${NC}"
    echo -e "${RED}=====================================================${NC}\n"
}

function install_dependencies() {
    echo -e "\n${YELLOW}[INFO] Installing Node.js dependencies for backend...${NC}"
    (cd server && npm install)
    
    echo -e "\n${YELLOW}[INFO] Installing Node.js dependencies for frontend...${NC}"
    (cd frontend && npm install)
    
    # Use the conda executable from the system path
    CONDA_PATH="conda"

    echo -e "\n${YELLOW}[INFO] Creating Conda environment 'imentor_env' with Python 3.10...${NC}"
    if "$CONDA_PATH" env list | grep -q "imentor_env"; then
        echo -e "${YELLOW}[INFO] Conda environment 'imentor_env' already exists. Skipping creation.${NC}"
    else
        "$CONDA_PATH" create -n imentor_env python=3.10 -y
    fi

    echo -e "\n${YELLOW}[INFO] Installing Python dependencies into 'imentor_env'... (This may take a very long time)${NC}"
    # Use 'conda run' to execute commands within the specified environment
    "$CONDA_PATH" run -n imentor_env pip install -r server/rag_service/requirements.txt
    
    echo -e "\n${YELLOW}[INFO] Downloading SpaCy model into 'imentor_env'...${NC}"
    "$CONDA_PATH" run -n imentor_env python -m spacy download en_core_web_sm
}

function seed_database() {
    echo -e "\n${YELLOW}[INFO] Seeding database with initial LLM configurations...${NC}"
    (cd server && node scripts/seedLLMs.js)
}

# --- Main Script Logic ---
echo -e "${GREEN}========================================="
echo "  iMentor Project Installer              "
echo "=========================================${NC}"
echo

# 1. Check for root privileges
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[ERROR] This script requires superuser privileges to install system dependencies."
  echo -e "Please run with 'sudo'."
  exit 1
fi

install_prerequisites
configure_environment
install_dependencies
seed_database

# --- Completion Message ---
echo
echo -e "${GREEN}========================================="
echo "  Installation Complete!                 "
echo "=========================================${NC}"
echo
echo -e "${RED}IMPORTANT:${NC} Remember to edit ${YELLOW}server/.env${NC} with your secret keys!"
echo
echo -e "${YELLOW}To run the application, open FOUR separate terminal windows:${NC}"
echo
echo "1. ${GREEN}Terminal 1 (Docker Services):${NC}"
echo "   ${RED}sudo${NC} docker compose up -d"
echo
echo "2. ${GREEN}Terminal 2 (Python RAG Service):${NC}"
echo "   ${GREEN}conda activate imentor_env${NC}"
echo "   cd server/rag_service"
echo "   python app.py"
echo
echo "3. ${GREEN}Terminal 3 (Node.js Backend):${NC}"
echo "   cd server"
echo "   npm start"
echo
echo "4. ${GREEN}Terminal 4 (Frontend):${NC}"
echo "   cd frontend"
echo "   npm run dev"
echo
echo "Then, open your browser to ${YELLOW}https://localhost:2002${NC} (Note: it's HTTPS)"
echo

# Make the script executable for future use by the user.
chmod +x install.sh