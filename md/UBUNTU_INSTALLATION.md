# Ubuntu Server Installation Guide

This guide provides comprehensive instructions for installing the iMentor AI Tutoring Platform on Ubuntu servers.

## Quick Installation (Recommended)

### Option 1: One-Line Installation
```bash
curl -fsSL https://raw.githubusercontent.com/VinaySiddha/Team4/Team_4/ubuntu-install.sh | bash
```

### Option 2: Clone and Install
```bash
git clone https://github.com/VinaySiddha/Team4.git
cd Team4
chmod +x ubuntu-install.sh
./ubuntu-install.sh
```

## What the Installation Script Does

The `ubuntu-install.sh` script automatically handles:

### System Dependencies
- ✅ Updates Ubuntu packages
- ✅ Installs build tools and libraries
- ✅ Installs Python 3 and pip
- ✅ Installs system libraries for image processing, audio, etc.

### Node.js Setup
- ✅ Installs Node.js 18.x from NodeSource
- ✅ Installs npm package manager
- ✅ Verifies installation

### Docker Installation
- ✅ Installs Docker CE from official repository
- ✅ Installs Docker Compose (standalone)
- ✅ Adds current user to docker group
- ✅ Starts and enables Docker service

### Project Dependencies
- ✅ Installs root npm dependencies
- ✅ Installs server-side dependencies
- ✅ Installs client-side dependencies
- ✅ Installs Python ML dependencies (if available)

### Environment Setup
- ✅ Creates `.env` configuration file
- ✅ Sets up environment variables
- ✅ Configures application ports

### Docker Deployment
- ✅ Builds Docker images
- ✅ Starts containers with docker-compose
- ✅ Performs health checks
- ✅ Verifies application startup

### Utility Scripts
- ✅ Creates `start.sh` - Start the application
- ✅ Creates `stop.sh` - Stop the application
- ✅ Creates `status.sh` - Check application status
- ✅ Creates `update.sh` - Update and restart

## Prerequisites

- Ubuntu 16.04 or later (tested on 18.04, 20.04, 22.04)
- Minimum 2GB RAM, 4GB recommended
- At least 10GB free disk space
- User account with sudo privileges
- Internet connection

## Supported Ubuntu Versions

- ✅ Ubuntu 16.04 LTS
- ✅ Ubuntu 18.04 LTS
- ✅ Ubuntu 20.04 LTS
- ✅ Ubuntu 22.04 LTS
- ✅ Ubuntu 24.04 LTS (latest)

## Installation Process

### Step 1: Download and Run
```bash
# Download the installation script
wget https://raw.githubusercontent.com/VinaySiddha/Team4/Team_4/ubuntu-install.sh

# Make it executable
chmod +x ubuntu-install.sh

# Run the installation
./ubuntu-install.sh
```

### Step 2: Monitor Installation
The script will:
1. Check your Ubuntu version
2. Update system packages (may take 5-10 minutes)
3. Install system dependencies (may take 10-15 minutes)
4. Install Node.js and npm (2-3 minutes)
5. Install Docker and Docker Compose (5-10 minutes)
6. Install project dependencies (5-10 minutes)
7. Build and start Docker containers (5-10 minutes)

**Total time: 30-60 minutes depending on your internet connection and server performance**

### Step 3: Configure API Keys
After installation, edit the `.env` file with your actual API keys:
```bash
nano .env
```

Required API keys:
- `OPENAI_API_KEY` - For OpenAI GPT models
- `GOOGLE_API_KEY` - For Google Gemini models
- `ANTHROPIC_API_KEY` - For Claude models

### Step 4: Access Your Application
- **Frontend**: http://your-server-ip:4004
- **Backend API**: http://your-server-ip:4007
- **Health Check**: http://your-server-ip:4007/api/health

## Managing Your Installation

### Start the Application
```bash
./start.sh
# OR
docker-compose up -d
```

### Stop the Application
```bash
./stop.sh
# OR
docker-compose down
```

### Check Application Status
```bash
./status.sh
# OR
docker-compose ps
```

### View Logs
```bash
docker-compose logs -f
```

### Update the Application
```bash
./update.sh
# OR
git pull && docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

## Troubleshooting

### Installation Fails
1. Check the installation log: `cat installation.log`
2. Ensure you have sudo privileges
3. Check internet connection
4. Verify Ubuntu version compatibility

### Docker Permission Issues
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or use:
newgrp docker
```

### Application Won't Start
1. Check Docker containers: `docker-compose ps`
2. View logs: `docker-compose logs`
3. Check ports are available: `sudo netstat -tlnp | grep -E ':(4004|4007)'`
4. Verify `.env` file exists and is configured

### Port Conflicts
If ports 4004 or 4007 are in use, edit `docker-compose.yml`:
```yaml
ports:
  - "5004:80"  # Change 4004 to 5004
  - "5007:4007"  # Change 4007 to 5007
```

### Memory Issues
- Minimum 2GB RAM required
- Check available memory: `free -h`
- Close unnecessary services
- Consider upgrading server

## Firewall Configuration

If using a firewall, open the required ports:

### UFW (Ubuntu Firewall)
```bash
sudo ufw allow 4004
sudo ufw allow 4007
sudo ufw reload
```

### iptables
```bash
sudo iptables -A INPUT -p tcp --dport 4004 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 4007 -j ACCEPT
sudo iptables-save
```

## Security Considerations

1. **Change default passwords** in `.env`
2. **Use strong API keys**
3. **Configure CORS properly** for production
4. **Use HTTPS** in production (consider nginx reverse proxy)
5. **Regular updates**: Run `./update.sh` periodically
6. **Monitor logs**: Check `docker-compose logs` regularly

## Performance Tuning

### For High Traffic
1. Increase Docker memory limits in `docker-compose.yml`
2. Use a reverse proxy (nginx) for load balancing
3. Scale with multiple instances
4. Monitor resource usage: `htop`, `docker stats`

### Database Optimization
If using external MongoDB:
1. Configure connection pooling
2. Add database indexes
3. Monitor query performance

## Advanced Configuration

### Custom Domains
1. Configure your domain's DNS to point to your server
2. Update `CORS_ORIGIN` in `.env`
3. Set up SSL certificates (Let's Encrypt recommended)

### SSL/HTTPS Setup with nginx
```bash
# Install nginx
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Configure nginx reverse proxy (see nginx.conf example)
```

## Support and Maintenance

### Regular Maintenance
- **Daily**: Check application status
- **Weekly**: Review logs and update if needed
- **Monthly**: System updates and security patches

### Backup Strategy
```bash
# Backup database
docker-compose exec backend mongodump --out /backup

# Backup uploaded files
tar -czf uploads-backup.tar.gz uploads/

# Backup configuration
cp .env .env.backup
```

### Monitoring
Consider setting up monitoring tools:
- **Uptime monitoring**: Pingdom, UptimeRobot
- **Log monitoring**: ELK stack, Splunk
- **Performance monitoring**: New Relic, Datadog

## Getting Help

If you encounter issues:

1. **Check the logs**: `cat installation.log`
2. **Review troubleshooting section** above
3. **Check Docker status**: `docker-compose ps`
4. **Verify system requirements**
5. **Contact support** with detailed error information

## Features Included

### 🤖 AI Models Supported
- OpenAI GPT-3.5/GPT-4
- Google Gemini Pro/Ultra
- Anthropic Claude
- Local models via Ollama

### 📚 Document Processing
- PDF parsing and analysis
- Word document processing
- Text extraction and indexing
- Multi-format support

### 🔍 Advanced Search
- Deep semantic search
- RAG (Retrieval Augmented Generation)
- Context-aware responses
- Vector database integration

### 🎯 Agentic MCP Features
- Research Analyst Agent
- Content Creator Agent
- Document Processor Agent
- Learning Assistant Agent
- Workflow Coordinator Agent

---

**🚀 Enjoy your iMentor AI Tutoring Platform!**