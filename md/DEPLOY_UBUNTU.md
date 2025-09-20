# Quick Ubuntu Server Deployment Guide

## 🚀 One-Command Installation

For Ubuntu 16.04+ servers, use this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/VinaySiddha/Team4/Team_4/ubuntu-install.sh | bash
```

## 🔧 Manual Installation Steps

If you prefer to download first:

```bash
# Download the script
wget https://raw.githubusercontent.com/VinaySiddha/Team4/Team_4/ubuntu-install.sh

# Make executable
chmod +x ubuntu-install.sh

# Run installation
./ubuntu-install.sh
```

## 📁 From Repository

If you have the repository:

```bash
git clone https://github.com/VinaySiddha/Team4.git
cd Team4
chmod +x ubuntu-install.sh
./ubuntu-install.sh
```

## ⏱️ Installation Timeline

- **System updates**: 5-10 minutes
- **Dependencies**: 10-15 minutes  
- **Node.js/Docker**: 5-10 minutes
- **Project setup**: 5-10 minutes
- **Docker build**: 5-10 minutes
- **Total**: 30-60 minutes

## 🎯 What Gets Installed

1. **System packages** (build-essential, python3, libraries)
2. **Node.js 18.x** from NodeSource
3. **Docker CE** and Docker Compose
4. **All npm dependencies** (root, server, client)
5. **Environment configuration**
6. **Docker containers** (built and started)
7. **Utility scripts** (start.sh, stop.sh, etc.)

## 📋 After Installation

- **Frontend**: http://your-server-ip:4004
- **Backend**: http://your-server-ip:4007  
- **Health**: http://your-server-ip:4007/api/health

## 🛠️ Management Commands

```bash
./start.sh          # Start application
./stop.sh           # Stop application  
./status.sh         # Check status
./update.sh         # Update and restart
docker-compose logs # View logs
```

## 🔐 Configuration

Edit `.env` file with your API keys:
```bash
nano .env
```

Required keys:
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` 
- `ANTHROPIC_API_KEY`

## 🌐 Firewall Setup

```bash
sudo ufw allow 4004
sudo ufw allow 4007
sudo ufw reload
```

## 🆘 If Something Goes Wrong

1. Check logs: `cat installation.log`
2. Check containers: `docker-compose ps`
3. View container logs: `docker-compose logs`
4. Restart: `docker-compose restart`

---

**Ready to deploy? Just run the one-command installation above! 🚀**