#!/bin/bash

# iMentor - Test Version for Windows/WSL
# This version skips Ubuntu-specific checks for testing purposes

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

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Log file for installation
LOG_FILE="$SCRIPT_DIR/test-installation.log"

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

# Function to detect OS (modified for testing)
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

# Function to check system (modified for testing)
check_system() {
    local os=$(detect_os)
    print_info "Detected OS: $os"
    
    if [[ "$os" == "windows" ]]; then
        print_warning "Running on Windows - this is a test mode"
        print_info "For production, use this script on Ubuntu server"
        print_info "Continuing with limited testing functionality..."
    elif [[ "$os" == "ubuntu" ]]; then
        print_success "Running on Ubuntu - production mode"
    else
        print_warning "Running on $os - limited compatibility"
    fi
}

# Function to check if Node.js is available
check_nodejs() {
    print_step "Checking Node.js installation"
    
    if command -v node &> /dev/null; then
        local node_version=$(node -v)
        print_success "Node.js found: $node_version"
        
        if command -v npm &> /dev/null; then
            local npm_version=$(npm -v)
            print_success "npm found: $npm_version"
        else
            print_warning "npm not found"
        fi
    else
        print_warning "Node.js not found"
        print_info "On Ubuntu, the script would install Node.js automatically"
    fi
}

# Function to check if Docker is available
check_docker() {
    print_step "Checking Docker installation"
    
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version 2>/dev/null || echo "Docker found but not accessible")
        print_success "Docker found: $docker_version"
        
        # Test Docker access
        if docker ps &> /dev/null; then
            print_success "Docker is accessible and running"
        else
            print_warning "Docker found but may not be running or accessible"
        fi
    else
        print_warning "Docker not found"
        print_info "On Ubuntu, the script would install Docker automatically"
    fi
    
    if command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version 2>/dev/null || echo "Docker Compose found but not accessible")
        print_success "Docker Compose found: $compose_version"
    else
        print_warning "Docker Compose not found"
        print_info "On Ubuntu, the script would install Docker Compose automatically"
    fi
}

# Function to check project structure
check_project_structure() {
    print_step "Checking project structure"
    
    cd "$SCRIPT_DIR"
    
    # Check for essential files
    local files_to_check=(
        "package.json"
        "docker-compose.yml"
        "server/package.json"
        "client/package.json"
    )
    
    for file in "${files_to_check[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "Found: $file"
        else
            print_warning "Missing: $file"
        fi
    done
    
    # Check for directories
    local dirs_to_check=(
        "server"
        "client"
        "server/controllers"
        "server/routes"
        "client/src"
    )
    
    for dir in "${dirs_to_check[@]}"; do
        if [[ -d "$dir" ]]; then
            print_success "Found directory: $dir"
        else
            print_warning "Missing directory: $dir"
        fi
    done
}

# Function to test npm install (dry run)
test_npm_dependencies() {
    print_step "Testing npm dependencies (dry run)"
    
    cd "$SCRIPT_DIR"
    
    if command -v npm &> /dev/null; then
        # Test root package.json
        if [[ -f "package.json" ]]; then
            print_info "Testing root npm dependencies..."
            if npm ls --dry-run &> /dev/null; then
                print_success "Root dependencies look good"
            else
                print_warning "Root dependencies may have issues"
            fi
        fi
        
        # Test server package.json
        if [[ -f "server/package.json" ]]; then
            print_info "Testing server npm dependencies..."
            cd server
            if npm ls --dry-run &> /dev/null; then
                print_success "Server dependencies look good"
            else
                print_warning "Server dependencies may have issues"
            fi
            cd ..
        fi
        
        # Test client package.json
        if [[ -f "client/package.json" ]]; then
            print_info "Testing client npm dependencies..."
            cd client
            if npm ls --dry-run &> /dev/null; then
                print_success "Client dependencies look good"
            else
                print_warning "Client dependencies may have issues"
            fi
            cd ..
        fi
    else
        print_warning "npm not available - skipping dependency test"
    fi
}

# Function to test Docker build (if possible)
test_docker_build() {
    print_step "Testing Docker configuration"
    
    cd "$SCRIPT_DIR"
    
    if [[ -f "docker-compose.yml" ]]; then
        print_success "Found docker-compose.yml"
        
        if command -v docker-compose &> /dev/null; then
            print_info "Testing Docker Compose configuration..."
            if docker-compose config &> /dev/null; then
                print_success "Docker Compose configuration is valid"
            else
                print_warning "Docker Compose configuration may have issues"
            fi
        else
            print_warning "docker-compose not available - skipping config test"
        fi
    else
        print_error "docker-compose.yml not found"
    fi
    
    # Check Dockerfiles
    local dockerfiles=("Dockerfile.backend" "Dockerfile.frontend")
    for dockerfile in "${dockerfiles[@]}"; do
        if [[ -f "$dockerfile" ]]; then
            print_success "Found: $dockerfile"
        else
            print_warning "Missing: $dockerfile"
        fi
    done
}

# Function to create test environment file
create_test_env() {
    print_step "Creating test environment file"
    
    cd "$SCRIPT_DIR"
    
    if [[ ! -f ".env.test" ]]; then
        cat > .env.test << 'EOF'
# Test Environment Configuration
NODE_ENV=development
PORT=4007
CLIENT_PORT=4004

# Database Configuration (for testing)
MONGODB_URI=mongodb://localhost:27017/imentordb_test

# JWT Configuration (test key)
JWT_SECRET=test-secret-key-change-in-production

# API Keys (placeholder - replace with real keys for testing)
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
        print_success "Created .env.test file"
        print_info "Edit .env.test with your actual API keys for testing"
    else
        print_info ".env.test file already exists"
    fi
}

# Function to show what would happen on Ubuntu
show_ubuntu_process() {
    print_step "What happens on Ubuntu server"
    
    echo -e "${CYAN}On Ubuntu, this script would:${NC}"
    echo -e "  1. ${YELLOW}Update system packages${NC} (apt update && apt upgrade)"
    echo -e "  2. ${YELLOW}Install system dependencies${NC} (build-essential, python3, libraries)"
    echo -e "  3. ${YELLOW}Install Node.js $NODE_VERSION${NC} (from NodeSource repository)"
    echo -e "  4. ${YELLOW}Install Docker CE${NC} (from Docker official repository)"
    echo -e "  5. ${YELLOW}Install Docker Compose${NC} (latest version)"
    echo -e "  6. ${YELLOW}Run npm install${NC} (root, server, client directories)"
    echo -e "  7. ${YELLOW}Create .env file${NC} (with default configuration)"
    echo -e "  8. ${YELLOW}Build Docker images${NC} (docker-compose build)"
    echo -e "  9. ${YELLOW}Start containers${NC} (docker-compose up -d)"
    echo -e "  10. ${YELLOW}Perform health checks${NC} (verify services are running)"
    echo -e "  11. ${YELLOW}Create utility scripts${NC} (start.sh, stop.sh, etc.)"
}

# Function to provide next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}🎯 Test Results Summary${NC}"
    echo -e "${CYAN}=========================${NC}"
    
    if command -v docker &> /dev/null && docker ps &> /dev/null; then
        echo -e "${GREEN}✅ You can test Docker deployment locally${NC}"
        echo -e "${CYAN}Run: docker-compose up -d${NC}"
    else
        echo -e "${YELLOW}⚠️ Docker not available - install Docker Desktop for local testing${NC}"
    fi
    
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        echo -e "${GREEN}✅ You can test npm installations locally${NC}"
        echo -e "${CYAN}Run: npm run install-all${NC}"
    else
        echo -e "${YELLOW}⚠️ Node.js not available - install Node.js for local testing${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📋 For Ubuntu Server Deployment:${NC}"
    echo -e "  1. ${CYAN}Transfer ubuntu-install.sh to your Ubuntu server${NC}"
    echo -e "  2. ${CYAN}Run: chmod +x ubuntu-install.sh${NC}"
    echo -e "  3. ${CYAN}Run: ./ubuntu-install.sh${NC}"
    echo -e "  4. ${CYAN}Wait 30-60 minutes for complete installation${NC}"
    echo ""
    echo -e "${BLUE}📋 For Local Windows Testing:${NC}"
    echo -e "  1. ${CYAN}Install Docker Desktop${NC}"
    echo -e "  2. ${CYAN}Install Node.js (https://nodejs.org)${NC}"
    echo -e "  3. ${CYAN}Run: npm run install-all${NC}"
    echo -e "  4. ${CYAN}Run: docker-compose up -d${NC}"
}

# Main test function
main() {
    echo -e "${BLUE}🧪 $APP_NAME - Installation Script Test${NC}"
    echo "=============================================================="
    echo -e "${PURPLE}Testing installation components and requirements${NC}"
    echo "=============================================================="
    echo ""
    
    log "Starting installation script test"
    
    # Test components
    check_system
    check_nodejs
    check_docker
    check_project_structure
    test_npm_dependencies
    test_docker_build
    create_test_env
    show_ubuntu_process
    show_next_steps
    
    log "Installation script test completed"
    
    echo ""
    echo -e "${GREEN}🎉 Test completed! Check test-installation.log for details${NC}"
}

# Run main function
main "$@"