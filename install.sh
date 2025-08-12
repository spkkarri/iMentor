#!/bin/bash

# TutorAI Chatbot - Complete Installation Script
# This script handles everything from system setup to running the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="iMentor TutorAI Chatbot"
APP_DIR="iMentor"
REPO_URL="https://github.com/spkkarri/iMentor.git"
REPO_BRANCH="Team-4"
NODE_VERSION="18"

echo -e "${BLUE}🚀 $APP_NAME - Complete Installation${NC}"
echo "=================================================="

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
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${BLUE}📋 Detected OS: $OS${NC}"

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
    esac
}

# Function to install PM2
install_pm2() {
    echo -e "${YELLOW}🚀 Installing PM2...${NC}"
    sudo npm install -g pm2 concurrently cross-env serve
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
    npm install
}

# Function to setup environment
setup_environment() {
    echo -e "${YELLOW}⚙️ Setting up environment variables...${NC}"
    
    if [ ! -f server/.env ]; then
        cat > server/.env << EOF
# Server Configuration
PORT=5007
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
                sudo firewall-cmd --permanent --add-port=3004/tcp
                sudo firewall-cmd --permanent --add-port=5007/tcp
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
    
    # Setup environment
    setup_environment
    
    # Build client
    build_client

    # Setup firewall (optional)
    setup_firewall

    # Start application
    start_app
    
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Application URLs:${NC}"
    echo -e "   Frontend: ${GREEN}http://localhost:3004${NC}"
    echo -e "   Backend:  ${GREEN}http://localhost:5007${NC}"
    echo ""
    echo -e "${BLUE}🔧 Useful commands:${NC}"
    echo -e "   pm2 status          - Check application status"
    echo -e "   pm2 logs            - View logs"
    echo -e "   pm2 restart all     - Restart application"
    echo -e "   npm run dev         - Start in development mode"
    echo ""
    echo -e "${YELLOW}⚠️ Don't forget to:${NC}"
    echo -e "   1. Edit server/.env with your API keys"
    echo -e "   2. Configure your firewall if needed"
    echo -e "   3. Set up SSL certificates for production"
}

# Run main function
main $1
