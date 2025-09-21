#!/bin/bash

# iMentor - Complete Ubuntu Server Installation Script
# This script handles everything from system setup to running the application
# Features: Agentic MCP, Multi-Model AI, Document Processing, Content Generation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="iMentor - Advanced AI Tutoring Platform"
NODE_VERSION="18"
PYTHON_VERSION="3.9"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Log file for installation
LOG_FILE="$SCRIPT_DIR/installation.log"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to print colored output
print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
    log "STEP: $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    log "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    log "WARNING: $1"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    log "ERROR: $1"
}

print_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
    log "INFO: $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root"
        print_info "Please run as a regular user with sudo privileges"
        exit 1
    fi
}

# Function to check Ubuntu version
check_ubuntu() {
    if [[ ! -f /etc/lsb-release ]]; then
        print_error "This script is designed for Ubuntu systems"
        exit 1
    fi
    
    source /etc/lsb-release
    print_info "Detected Ubuntu $DISTRIB_RELEASE ($DISTRIB_CODENAME)"
    
    # Check if Ubuntu version is supported (16.04+)
    major_version=$(echo $DISTRIB_RELEASE | cut -d. -f1)
    if [[ $major_version -lt 16 ]]; then
        print_error "Ubuntu 16.04 or later is required"
        exit 1
    fi
}

# Function to update system packages
update_system() {
    print_step "Updating system packages"
    sudo apt update && sudo apt upgrade -y
    print_success "System packages updated"
}

# Function to install system dependencies
install_system_dependencies() {
    print_step "Installing system dependencies"
    
    sudo apt install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        unzip \
        vim \
        htop \
        tree \
        jq \
        python3 \
        python3-pip \
        python3-venv \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
        libvips-dev \
        ffmpeg \
        espeak \
        espeak-data \
        libespeak-dev \
        sqlite3 \
        libsqlite3-dev
    
    print_success "System dependencies installed"
}

# Function to install Node.js
install_nodejs() {
    print_step "Installing Node.js $NODE_VERSION"
    
    if command -v node &> /dev/null; then
        current_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [[ $current_version -ge $NODE_VERSION ]]; then
            print_success "Node.js already installed ($(node -v))"
            return
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Verify installation
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        print_success "Node.js installed successfully ($(node -v))"
        print_success "npm installed successfully ($(npm -v))"
    else
        print_error "Node.js installation failed"
        exit 1
    fi
}

# Function to install Docker
install_docker() {
    print_step "Installing Docker"
    
    if command -v docker &> /dev/null; then
        print_success "Docker already installed ($(docker --version))"
        # Check if user is in docker group
        if groups $USER | grep &>/dev/null '\bdocker\b'; then
            print_success "User already in docker group"
        else
            print_step "Adding user to docker group"
            sudo usermod -aG docker $USER
            print_warning "You may need to log out and back in for docker group changes to take effect"
        fi
        return
    fi
    
    # Remove old versions
    sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Test Docker installation
    if sudo docker run hello-world &>/dev/null; then
        print_success "Docker installed and working correctly"
        sudo docker rmi hello-world &>/dev/null || true
    else
        print_error "Docker installation verification failed"
        exit 1
    fi
    
    print_warning "You may need to log out and back in for docker group changes to take effect"
}

# Function to install Docker Compose (standalone)
install_docker_compose() {
    print_step "Installing Docker Compose"
    
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose already installed ($(docker-compose --version))"
        return
    fi
    
    # Get latest version
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Verify installation
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose installed successfully ($(docker-compose --version))"
    else
        print_error "Docker Compose installation failed"
        exit 1
    fi
}

# Function to install Python dependencies
install_python_dependencies() {
    print_step "Installing Python dependencies"
    
    # Upgrade pip
    python3 -m pip install --upgrade pip
    
    # Install common Python packages
    python3 -m pip install --user \
        setuptools \
        wheel \
        virtualenv \
        requests \
        numpy \
        pandas
    
    print_success "Python dependencies installed"
}

# Function to install project dependencies
install_project_dependencies() {
    print_step "Installing project dependencies"
    
    cd "$SCRIPT_DIR"
    
    # Install root dependencies
    if [[ -f "package.json" ]]; then
        print_step "Installing root npm dependencies"
        npm install
        print_success "Root dependencies installed"
    fi
    
    # Install server dependencies
    if [[ -d "server" && -f "server/package.json" ]]; then
        print_step "Installing server dependencies"
        cd server
        npm install
        cd ..
        print_success "Server dependencies installed"
    fi
    
    # Install client dependencies
    if [[ -d "client" && -f "client/package.json" ]]; then
        print_step "Installing client dependencies"
        cd client
        npm install
        cd ..
        print_success "Client dependencies installed"
    fi
    
    # Install deep_search dependencies if they exist
    if [[ -d "server" && -f "server/package.json" ]]; then
        print_step "Installing server dependencies"
        cd server
        npm install
        cd ..
        print_success "Server dependencies installed"
    fi
    
    # Install Python dependencies for ML components
    if [[ -d "server/ml_inference" && -f "server/ml_inference/requirements.txt" ]]; then
        print_step "Installing Python ML dependencies"
        cd server/ml_inference
        python3 -m pip install --user -r requirements.txt
        cd ../..
        print_success "Python ML dependencies installed"
    fi
    
    print_success "All project dependencies installed"
}



# Function to setup environment files
setup_environment() {
    print_step "Setting up environment files"
    
    cd "$SCRIPT_DIR"
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            print_info "Created .env from .env.example"
        else
            cat > .env << EOF
# Environment Configuration
NODE_ENV=production
PORT=4007
CLIENT_PORT=4004

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/imentordb

# JWT Configuration
JWT_SECRET=your-secret-key-here

# API Keys (Replace with your actual keys)
OPENAI_API_KEY=your-openai-key-here
GOOGLE_API_KEY=your-google-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here

# File Upload Configuration
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads

# Security Configuration
CORS_ORIGIN=http://localhost:4004
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
EOF
            print_info "Created basic .env file"
        fi
        print_warning "Please edit .env file with your actual API keys"
    else
        print_info ".env file already exists"
    fi
    
    # Create server/.env if it doesn't exist
    if [[ ! -f "server/.env" && -f ".env" ]]; then
        cp .env server/.env
        print_info "Copied .env to server directory"
    fi
}

# Function to build and start Docker containers
start_docker_containers() {
    print_step "Building and starting Docker containers"
    
    cd "$SCRIPT_DIR"
    
    # Check if docker-compose.yml exists
    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found"
        exit 1
    fi
    
    # Stop any existing containers
    print_step "Stopping existing containers"
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build and start containers
    print_step "Building Docker images"
    docker-compose build --no-cache
    
    print_step "Starting Docker containers"
    docker-compose up -d
    
    # Wait for containers to start
    print_step "Waiting for containers to start"
    sleep 10
    
    # Check container status
    if docker-compose ps | grep -q "Up"; then
        print_success "Docker containers started successfully"
        
        # Display container status
        echo -e "\n${CYAN}Container Status:${NC}"
        docker-compose ps
        
        # Display logs for debugging
        echo -e "\n${CYAN}Recent logs:${NC}"
        docker-compose logs --tail=20
        
    else
        print_error "Some containers failed to start"
        echo -e "\n${CYAN}Container Status:${NC}"
        docker-compose ps
        echo -e "\n${CYAN}Logs for debugging:${NC}"
        docker-compose logs
        exit 1
    fi
}

# Function to check application health
check_application_health() {
    print_step "Checking application health"
    
    local max_attempts=30
    local attempt=1
    
    # Check frontend
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s http://localhost:4004 > /dev/null 2>&1; then
            print_success "Frontend is responding (http://localhost:4004)"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_warning "Frontend health check timed out"
            break
        fi
        
        print_info "Waiting for frontend to start (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    # Reset attempt counter for backend
    attempt=1
    
    # Check backend
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s http://localhost:4007/api/health > /dev/null 2>&1; then
            print_success "Backend is responding (http://localhost:4007)"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_warning "Backend health check timed out"
            break
        fi
        
        print_info "Waiting for backend to start (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
}

# Function to create useful scripts
create_utility_scripts() {
    print_step "Creating utility scripts"
    
    cd "$SCRIPT_DIR"
    
    # Create start script
    cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting iMentor application..."
docker-compose up -d
echo "Application started. Access at:"
echo "  Frontend: http://localhost:4004"
echo "  Backend:  http://localhost:4007"
EOF
    chmod +x start.sh
    
    # Create stop script
    cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping iMentor application..."
docker-compose down
echo "Application stopped."
EOF
    chmod +x stop.sh
    
    # Create status script
    cat > status.sh << 'EOF'
#!/bin/bash
echo "iMentor Application Status:"
echo "=========================="
docker-compose ps
echo ""
echo "Container Logs (last 10 lines):"
echo "==============================="
docker-compose logs --tail=10
EOF
    chmod +x status.sh
    
    # Create update script
    cat > update.sh << 'EOF'
#!/bin/bash
echo "Updating iMentor application..."
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
echo "Update completed."
EOF
    chmod +x update.sh
    
    print_success "Utility scripts created (start.sh, stop.sh, status.sh, update.sh)"
}

# Function to display final information
display_completion_info() {
    echo ""
    echo -e "${GREEN}🎉 iMentor Installation Completed Successfully!${NC}"
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
    echo -e "   API Health: ${GREEN}http://localhost:4007/api/health${NC}"
    echo ""
    echo -e "${BLUE}🔧 Available Commands:${NC}"
    echo -e "   ${CYAN}./start.sh${NC}          - Start the application"
    echo -e "   ${CYAN}./stop.sh${NC}           - Stop the application"
    echo -e "   ${CYAN}./status.sh${NC}         - Check application status"
    echo -e "   ${CYAN}./update.sh${NC}         - Update and restart application"
    echo -e "   ${CYAN}docker-compose logs -f${NC} - View live logs"
    echo ""
    echo -e "${BLUE}📁 Important Files:${NC}"
    echo -e "   ${CYAN}.env${NC}                - Environment configuration"
    echo -e "   ${CYAN}docker-compose.yml${NC}  - Docker configuration"
    echo -e "   ${CYAN}installation.log${NC}    - Installation log file"
    echo ""
    echo -e "${YELLOW}⚠️ Next Steps:${NC}"
    echo -e "   1. Edit ${CYAN}.env${NC} file with your actual API keys"
    echo -e "   2. Configure your firewall to allow ports 4004 and 4007"
    echo -e "   3. Access the application at ${GREEN}http://localhost:4004${NC}"
    echo -e "   4. Enable Agentic MCP features in the chat interface"
    echo ""
    echo -e "${GREEN}🚀 Ready to experience intelligent AI tutoring!${NC}"
    echo ""
}

# Main installation function
main() {
    echo -e "${BLUE}🚀 $APP_NAME - Ubuntu Installation${NC}"
    echo "=============================================================="
    echo -e "${PURPLE}Features: Agentic MCP • Multi-Model AI • Document Processing${NC}"
    echo "=============================================================="
    echo ""
    
    log "Starting iMentor installation"
    
    # Pre-installation checks
    check_root
    check_ubuntu
    
    # Installation steps
    update_system
    install_system_dependencies
    install_nodejs
    install_docker
    install_docker_compose
    install_python_dependencies
    install_project_dependencies
    setup_environment
    
    # Docker setup and application startup
    start_docker_containers
    check_application_health
    
    # Post-installation setup
    create_utility_scripts
    
    log "Installation completed successfully"
    display_completion_info
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi