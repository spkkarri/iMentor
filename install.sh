#!/bin/bash

# iMentor - Advanced AI Tutoring Platform Installation Script
# This script handles everything from system setup to running the application
# Features: Agentic MCP, Multi-Model AI, Document Processing, Content Generation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="iMentor - Advanced AI Tutoring Platform"
APP_DIR="iMentor"
REPO_URL="https://github.com/spkkarri/iMentor.git"
REPO_BRANCH="main"
NODE_VERSION="18"
PYTHON_VERSION="3.9"
CONDA_ENV_NAME="imentor"

echo -e "${BLUE}🚀 $APP_NAME - Complete Installation${NC}"
echo "=============================================================="
echo -e "${PURPLE}Features: Agentic MCP • Multi-Model AI • Document Processing${NC}"
echo "=============================================================="

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            echo "ubuntu"
        elif [ -f /etc/redhat-release ]; then
            echo "centos"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]] || [[ -n "$WINDIR" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${BLUE}📋 Detected OS: $OS${NC}"

# Function to check and install conda
install_conda() {
    echo -e "${YELLOW}🐍 Checking Conda installation...${NC}"

    if command -v conda &> /dev/null; then
        echo -e "${GREEN}✅ Conda already installed${NC}"
        return
    fi

    echo -e "${YELLOW}📦 Installing Miniconda...${NC}"

    case $OS in
        "ubuntu"|"linux")
            wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
            bash miniconda.sh -b -p $HOME/miniconda3
            rm miniconda.sh
            echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
            source ~/.bashrc
            ;;
        "macos")
            wget https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh -O miniconda.sh
            bash miniconda.sh -b -p $HOME/miniconda3
            rm miniconda.sh
            echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bash_profile
            source ~/.bash_profile
            ;;
        "windows")
            echo -e "${YELLOW}📦 Installing Miniconda for Windows...${NC}"
            if command -v winget &> /dev/null; then
                winget install -e --id Anaconda.Miniconda3
            elif command -v choco &> /dev/null; then
                choco install miniconda3 -y
            else
                echo -e "${YELLOW}⚠️ Please install Miniconda manually from https://docs.conda.io/en/latest/miniconda.html${NC}"
                echo -e "${YELLOW}⚠️ Or install Chocolatey first: https://chocolatey.org/install${NC}"
                echo -e "${YELLOW}⚠️ Then run: choco install miniconda3${NC}"
                read -p "Press Enter after Miniconda is installed..."
            fi
            ;;
        *)
            echo -e "${RED}❌ Please install Conda manually from https://docs.conda.io/en/latest/miniconda.html${NC}"
            exit 1
            ;;
    esac

    # Initialize conda
    if [ "$OS" != "windows" ]; then
        $HOME/miniconda3/bin/conda init bash
        source ~/.bashrc
    else
        echo -e "${YELLOW}⚠️ Please restart your terminal after Miniconda installation${NC}"
        echo -e "${YELLOW}⚠️ Or run: conda init cmd.exe (for Command Prompt)${NC}"
        echo -e "${YELLOW}⚠️ Or run: conda init powershell (for PowerShell)${NC}"
    fi
}

# Function to check and install Docker
install_docker() {
    echo -e "${YELLOW}🐳 Checking Docker installation...${NC}"

    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✅ Docker already installed${NC}"
        # Test docker access
        if [ "$OS" = "windows" ]; then
            if docker ps &> /dev/null; then
                echo -e "${GREEN}✅ Docker access confirmed${NC}"
            else
                echo -e "${RED}❌ Docker requires proper access. Please ensure Docker Desktop is running${NC}"
                exit 1
            fi
        else
            if sudo docker ps &> /dev/null; then
                echo -e "${GREEN}✅ Docker sudo access confirmed${NC}"
            else
                echo -e "${RED}❌ Docker requires sudo access. Please ensure your user can run 'sudo docker'${NC}"
                exit 1
            fi
        fi
        return
    fi

    echo -e "${YELLOW}📦 Installing Docker...${NC}"

    case $OS in
        "ubuntu")
            # Install Docker
            sudo apt update
            sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt update
            sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

            # Install Docker Compose
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose

            # Start Docker service
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        "centos")
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        "macos")
            echo -e "${YELLOW}⚠️ Please install Docker Desktop for Mac from https://docs.docker.com/desktop/mac/install/${NC}"
            echo -e "${YELLOW}⚠️ After installation, ensure Docker Desktop is running${NC}"
            read -p "Press Enter after Docker Desktop is installed and running..."
            ;;
        "windows")
            echo -e "${YELLOW}📦 Installing Docker Desktop for Windows...${NC}"
            if command -v winget &> /dev/null; then
                winget install -e --id Docker.DockerDesktop
                echo -e "${YELLOW}⚠️ Please restart your system after Docker Desktop installation${NC}"
                echo -e "${YELLOW}⚠️ Then start Docker Desktop from the Start Menu${NC}"
            elif command -v choco &> /dev/null; then
                choco install docker-desktop -y
                echo -e "${YELLOW}⚠️ Please restart your system after Docker Desktop installation${NC}"
                echo -e "${YELLOW}⚠️ Then start Docker Desktop from the Start Menu${NC}"
            else
                echo -e "${YELLOW}⚠️ Please install Docker Desktop for Windows manually from:${NC}"
                echo -e "${YELLOW}⚠️ https://docs.docker.com/desktop/windows/install/${NC}"
                echo -e "${YELLOW}⚠️ Or install Chocolatey first: https://chocolatey.org/install${NC}"
                echo -e "${YELLOW}⚠️ Then run: choco install docker-desktop${NC}"
            fi
            read -p "Press Enter after Docker Desktop is installed and running..."
            ;;
        *)
            echo -e "${RED}❌ Please install Docker manually${NC}"
            exit 1
            ;;
    esac

    echo -e "${GREEN}✅ Docker installed successfully${NC}"
    if [ "$OS" != "windows" ]; then
        echo -e "${YELLOW}⚠️ Note: This script uses 'sudo docker' commands${NC}"
    fi
}

# Function to install system dependencies
install_system_deps() {
    echo -e "${YELLOW}📦 Installing system dependencies...${NC}"

    case $OS in
        "ubuntu")
            sudo apt update && sudo apt upgrade -y
            sudo apt install -y \
                curl wget git build-essential \
                python3 python3-pip pkg-config \
                libcairo2-dev libpango1.0-dev libjpeg-dev \
                libgif-dev librsvg2-dev libvips-dev \
                ffmpeg espeak espeak-data libespeak-dev \
                sqlite3 libsqlite3-dev
            ;;
        "centos")
            sudo yum update -y
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y curl wget git python3 python3-pip \
                cairo-devel pango-devel libjpeg-devel \
                giflib-devel librsvg2-devel vips-devel \
                ffmpeg espeak espeak-devel sqlite-devel
            ;;
        "macos")
            if ! command -v brew &> /dev/null; then
                echo "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install node python3 ffmpeg espeak sqlite3 vips
            ;;
        "windows")
            echo -e "${YELLOW}📦 Installing Windows dependencies...${NC}"
            
            # Check Git
            if command -v git &> /dev/null; then
                echo -e "${GREEN}✅ Git already installed ($(git --version | cut -d' ' -f3))${NC}"
            else
                echo -e "${BLUE}Installing Git...${NC}"
                if command -v winget &> /dev/null; then
                    winget install -e --id Git.Git --silent
                elif command -v choco &> /dev/null; then
                    choco install git -y
                else
                    echo -e "${RED}❌ Please install Git manually from https://git-scm.com/download/win${NC}"
                fi
            fi
            
            # Check Python
            if command -v python &> /dev/null; then
                echo -e "${GREEN}✅ Python already installed ($(python --version))${NC}"
            else
                echo -e "${BLUE}Installing Python...${NC}"
                if command -v winget &> /dev/null; then
                    winget install -e --id Python.Python.3.11 --silent
                elif command -v choco &> /dev/null; then
                    choco install python3 -y
                else
                    echo -e "${RED}❌ Please install Python manually from https://python.org/downloads${NC}"
                fi
            fi
            
            # Check Node.js
            if command -v node &> /dev/null; then
                echo -e "${GREEN}✅ Node.js already installed ($(node --version))${NC}"
            else
                echo -e "${BLUE}Installing Node.js...${NC}"
                if command -v winget &> /dev/null; then
                    winget install -e --id OpenJS.NodeJS --silent
                elif command -v choco &> /dev/null; then
                    choco install nodejs -y
                else
                    echo -e "${RED}❌ Please install Node.js manually from https://nodejs.org${NC}"
                fi
            fi
            
            # Check Visual Studio Build Tools (optional for native modules)
            echo -e "${BLUE}Checking Visual Studio Build Tools (for native modules)...${NC}"
            if command -v winget &> /dev/null; then
                winget list | grep -i "Microsoft.VisualStudio" &> /dev/null
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✅ Visual Studio Build Tools detected${NC}"
                else
                    echo -e "${YELLOW}Installing Visual Studio Build Tools (this may take a while)...${NC}"
                    winget install -e --id Microsoft.VisualStudio.2022.BuildTools --silent --accept-package-agreements
                fi
            elif command -v choco &> /dev/null; then
                choco install visualstudio2022buildtools -y
            else
                echo -e "${YELLOW}⚠️ Visual Studio Build Tools not installed - may cause issues with native modules${NC}"
                echo -e "${YELLOW}⚠️ Install from: https://visualstudio.microsoft.com/downloads/${NC}"
            fi
            
            # Install additional tools via Chocolatey if available
            if command -v choco &> /dev/null; then
                echo -e "${BLUE}Installing additional tools via Chocolatey...${NC}"
                choco install sqlite ffmpeg -y --no-progress
            else
                echo -e "${YELLOW}⚠️ Chocolatey not available for additional tools${NC}"
                echo -e "${YELLOW}⚠️ Consider installing Chocolatey from: https://chocolatey.org/install${NC}"
                echo -e "${YELLOW}⚠️ Optional tools: SQLite, FFmpeg${NC}"
            fi
            ;;
        *)
            echo -e "${RED}❌ Unsupported OS. Please install dependencies manually.${NC}"
            exit 1
            ;;
    esac
}

# Function to install Node.js
install_nodejs() {
    echo -e "${YELLOW}📦 Installing Node.js $NODE_VERSION...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            echo -e "${GREEN}✅ Node.js $NODE_CURRENT already installed${NC}"
            return
        fi
    fi
    
    case $OS in
        "ubuntu"|"linux")
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
            sudo apt install -y nodejs
            ;;
        "centos")
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        "macos")
            brew install node@${NODE_VERSION}
            ;;
        "windows")
            echo -e "${YELLOW}📦 Installing Node.js for Windows...${NC}"
            if command -v winget &> /dev/null; then
                winget install -e --id OpenJS.NodeJS
            elif command -v choco &> /dev/null; then
                choco install nodejs -y
            else
                echo -e "${YELLOW}⚠️ Please install Node.js manually from https://nodejs.org${NC}"
                read -p "Press Enter after Node.js is installed..."
            fi
            ;;
    esac
}

# Function to install MongoDB
install_mongodb() {
    echo -e "${YELLOW}🗄️ Installing MongoDB...${NC}"
    
    if command -v mongod &> /dev/null; then
        echo -e "${GREEN}✅ MongoDB already installed${NC}"
        return
    fi
    
    case $OS in
        "ubuntu")
            wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
            echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt update && sudo apt install -y mongodb-org
            sudo systemctl start mongod && sudo systemctl enable mongod
            ;;
        "centos")
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            sudo yum install -y mongodb-org
            sudo systemctl start mongod && sudo systemctl enable mongod
            ;;
        "macos")
            brew tap mongodb/brew
            brew install mongodb-community
            brew services start mongodb/brew/mongodb-community
            ;;
        "windows")
            echo -e "${YELLOW}📦 Installing MongoDB for Windows...${NC}"
            
            # Check if MongoDB is already installed
            if command -v mongod &> /dev/null; then
                echo -e "${GREEN}✅ MongoDB already installed${NC}"
                return
            fi
            
            # Check if MongoDB service exists (might be installed but not in PATH)
            if sc query "MongoDB" &> /dev/null; then
                echo -e "${GREEN}✅ MongoDB service detected${NC}"
                return
            fi
            
            if command -v winget &> /dev/null; then
                echo -e "${BLUE}Installing MongoDB via winget...${NC}"
                winget install -e --id MongoDB.Server --silent
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✅ MongoDB installed successfully${NC}"
                else
                    echo -e "${YELLOW}⚠️ MongoDB installation via winget failed, trying alternative...${NC}"
                fi
            elif command -v choco &> /dev/null; then
                echo -e "${BLUE}Installing MongoDB via Chocolatey...${NC}"
                choco install mongodb -y
            else
                echo -e "${YELLOW}⚠️ Please install MongoDB manually from:${NC}"
                echo -e "${YELLOW}⚠️ https://www.mongodb.com/try/download/community${NC}"
                echo -e "${YELLOW}⚠️ Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas${NC}"
                read -p "Press Enter after MongoDB is installed..."
            fi
            
            echo -e "${YELLOW}⚠️ MongoDB service may need to be started manually${NC}"
            echo -e "${YELLOW}⚠️ Alternative: Use MongoDB Atlas (cloud) for easier setup${NC}"
            ;;
    esac
}

# Function to setup conda environment
setup_conda_env() {
    echo -e "${YELLOW}🐍 Setting up Conda environment...${NC}"

    # Ensure conda is available
    if ! command -v conda &> /dev/null; then
        echo -e "${RED}❌ Conda not found. Please install Conda first.${NC}"
        if [ "$OS" = "windows" ]; then
            echo -e "${YELLOW}⚠️ You may need to restart your terminal after Conda installation${NC}"
        fi
        exit 1
    fi

    # Create conda environment if it doesn't exist
    if conda env list | grep -q "^${CONDA_ENV_NAME} "; then
        echo -e "${GREEN}✅ Conda environment '${CONDA_ENV_NAME}' already exists${NC}"
    else
        echo -e "${YELLOW}📦 Creating Conda environment '${CONDA_ENV_NAME}' with Python ${PYTHON_VERSION}...${NC}"
        conda create -n $CONDA_ENV_NAME python=$PYTHON_VERSION -y
    fi

    # Activate environment and install Python dependencies
    echo -e "${YELLOW}📦 Installing Python dependencies in Conda environment...${NC}"
    
    if [ "$OS" = "windows" ]; then
        # Windows conda activation
        conda activate $CONDA_ENV_NAME
    else
        # Unix conda activation
        source $(conda info --base)/etc/profile.d/conda.sh
        conda activate $CONDA_ENV_NAME
    fi

    # Install Python packages
    if [ -f "server/requirements.txt" ]; then
        pip install -r server/requirements.txt
    else
        # Install common ML/AI packages
        pip install numpy pandas scikit-learn transformers torch torchvision torchaudio
        pip install langchain langchain-community chromadb faiss-cpu
        pip install fastapi uvicorn pydantic requests beautifulsoup4
        pip install python-multipart aiofiles python-dotenv
    fi

    echo -e "${GREEN}✅ Conda environment setup complete${NC}"
    echo -e "${YELLOW}💡 To activate: conda activate ${CONDA_ENV_NAME}${NC}"
}

# Function to install PM2
install_pm2() {
    echo -e "${YELLOW}🚀 Installing PM2...${NC}"
    if [ "$OS" = "windows" ]; then
        npm install -g pm2 concurrently cross-env serve
        echo -e "${YELLOW}⚠️ PM2 on Windows may require additional setup${NC}"
        echo -e "${YELLOW}⚠️ Consider using pm2-windows-service for production${NC}"
    else
        sudo npm install -g pm2 concurrently cross-env serve
    fi
}

# Function to clone repository
clone_repo() {
    echo -e "${YELLOW}📥 Cloning repository...${NC}"

    if [ -d "$APP_DIR" ]; then
        echo -e "${YELLOW}⚠️ Directory $APP_DIR exists. Updating...${NC}"
        cd $APP_DIR && git checkout $REPO_BRANCH && git pull origin $REPO_BRANCH && cd ..
    else
        git clone -b $REPO_BRANCH $REPO_URL $APP_DIR
    fi

    cd $APP_DIR
}

# Function to install dependencies
install_deps() {
    echo -e "${YELLOW}📦 Installing application dependencies...${NC}"
    
    # Install all dependencies from root (workspace setup handles server/client automatically)
    echo -e "${BLUE}Installing all dependencies from root directory...${NC}"
    echo -e "${BLUE}This will automatically install server and client dependencies via npm workspaces${NC}"
    npm install
    
    echo -e "${GREEN}✅ All dependencies installed successfully${NC}"
    echo -e "${GREEN}✅ Server and client dependencies automatically installed via workspace setup${NC}"
}

# Function to setup environment
setup_environment() {
    echo -e "${YELLOW}⚙️ Setting up environment variables...${NC}"
    
    if [ ! -f server/.env ]; then
        cat > server/.env << EOF
# Server Configuration
PORT=4007
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/iMentor_chatbot

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OLLAMA_URL=your_ollama_url_here

# Security
JWT_SECRET=$(openssl rand -hex 32)

# Optional Features
ENABLE_DEEP_SEARCH=true
ENABLE_MCP_AGENTS=true
ENABLE_FILE_UPLOAD=true
EOF
        echo -e "${GREEN}✅ Environment file created at server/.env${NC}"
        echo -e "${YELLOW}⚠️ Please edit server/.env with your actual API keys${NC}"
    else
        echo -e "${GREEN}✅ Environment file already exists${NC}"
    fi
}

# Function to build client
build_client() {
    echo -e "${YELLOW}🏗️ Building client for production...${NC}"
    cd client && npm run build && cd ..
}

# Function to start application
start_app() {
    echo -e "${YELLOW}🚀 Starting application...${NC}"
    
    # Start with PM2 for production
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo -e "${GREEN}✅ Application started with PM2${NC}"
    else
        # Fallback to npm for development
        echo -e "${YELLOW}Starting in development mode...${NC}"
        npm run dev &
        echo -e "${GREEN}✅ Application started in development mode${NC}"
    fi
}

# Function to setup firewall (optional)
setup_firewall() {
    echo -e "${YELLOW}🔥 Setting up firewall...${NC}"

    case $OS in
        "ubuntu"|"linux")
            if command -v ufw &> /dev/null; then
                sudo ufw allow 22      # SSH
                sudo ufw allow 3004    # Client
                sudo ufw allow 5007    # Server
                sudo ufw allow 27017   # MongoDB (if needed)
                echo -e "${GREEN}✅ Firewall rules added${NC}"
                echo -e "${YELLOW}⚠️ Run 'sudo ufw enable' to activate firewall${NC}"
            else
                echo -e "${YELLOW}⚠️ UFW not available, skipping firewall setup${NC}"
            fi
            ;;
        "centos")
            if command -v firewall-cmd &> /dev/null; then
                sudo firewall-cmd --permanent --add-port=4004/tcp
                sudo firewall-cmd --permanent --add-port=4007/tcp
                sudo firewall-cmd --permanent --add-port=27017/tcp
                sudo firewall-cmd --reload
                echo -e "${GREEN}✅ Firewall rules added${NC}"
            else
                echo -e "${YELLOW}⚠️ firewall-cmd not available, skipping firewall setup${NC}"
            fi
            ;;
        "macos")
            echo -e "${YELLOW}⚠️ macOS firewall setup skipped (configure manually if needed)${NC}"
            ;;
        "windows")
            echo -e "${YELLOW}🔥 Windows Firewall configuration...${NC}"
            echo -e "${YELLOW}⚠️ Please manually configure Windows Firewall to allow:${NC}"
            echo -e "   • Port 4004 (Frontend)"
            echo -e "   • Port 4007 (Backend)"
            echo -e "   • Port 27017 (MongoDB - if needed)"
            echo -e "${YELLOW}⚠️ Or run as Administrator and use Windows Firewall commands${NC}"
            echo -e "${YELLOW}⚠️ Example: netsh advfirewall firewall add rule name=\"iMentor Frontend\" dir=in action=allow protocol=TCP localport=4004${NC}"
            ;;
    esac
}

# Main installation process
main() {
    echo -e "${BLUE}Starting installation process...${NC}"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        echo -e "${RED}❌ Please don't run this script as root${NC}"
        exit 1
    fi
    
    # Install system dependencies
    install_system_deps

    # Install and setup Conda
    install_conda

    # Install and setup Docker
    install_docker

    # Install Node.js
    install_nodejs

    # Install MongoDB
    install_mongodb

    # Install PM2
    install_pm2
    
    # Clone repository (if not already in it)
    if [ ! -f "package.json" ]; then
        clone_repo
    fi
    
    # Install dependencies
    install_deps

    # Setup Conda environment
    setup_conda_env

    # Setup environment
    setup_environment
    
    # Build client
    build_client

    # Setup firewall (optional)
    setup_firewall

    # Start application
    start_app
    
    echo ""
    echo -e "${GREEN}🎉 iMentor Installation completed successfully!${NC}"
    echo ""
    echo -e "${PURPLE}🤖 Agentic MCP Features Available:${NC}"
    echo -e "   • Research Analyst Agent    - Web research & analysis"
    echo -e "   • Content Creator Agent     - Document & presentation generation"
    echo -e "   • Document Processor Agent  - File processing & extraction"
    echo -e "   • Learning Assistant Agent  - Educational support & tutoring"
    echo -e "   • Workflow Coordinator Agent - Task orchestration & optimization"
    echo ""
    echo -e "${BLUE}📋 Application URLs:${NC}"
    echo -e "   Frontend: ${GREEN}http://localhost:4004${NC}"
    echo -e "   Backend:  ${GREEN}http://localhost:4007${NC}"
    echo ""
    echo -e "${BLUE}🔧 Useful commands:${NC}"
    echo -e "   pm2 status              - Check application status"
    echo -e "   pm2 logs                - View logs"
    echo -e "   pm2 restart all         - Restart application"
    echo -e "   npm run dev             - Start in development mode"
    echo -e "   conda activate ${CONDA_ENV_NAME}  - Activate Python environment"
    echo -e "   sudo docker-compose ps  - Check Docker services"
    echo ""
    echo -e "${YELLOW}⚠️ Don't forget to:${NC}"
    echo -e "   1. Edit server/.env with your API keys"
    echo -e "   2. Enable Agentic MCP in the chat interface"
    echo -e "   3. Configure your firewall if needed"
    echo -e "   4. Set up SSL certificates for production"
    echo ""
    echo -e "${GREEN}🚀 Ready to experience intelligent AI agents!${NC}"
}

# Run main function
main $1
