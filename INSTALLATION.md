# TutorAI Chatbot - Installation Guide

This guide will help you install the TutorAI Chatbot application on both Windows and Ubuntu 24.04 systems.

## Prerequisites

### For Both Platforms
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Git**: For cloning the repository

### For Ubuntu 24.04 (Additional)
- **Python**: Version 3.9 or higher
- **Docker**: For containerized services
- **MongoDB**: For database

## Installation Methods

### Method 1: Automated Installation (Recommended)

#### Windows
1. **PowerShell Script** (Recommended):
   ```powershell
   # Run PowerShell as Administrator
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\install.ps1
   ```

2. **Batch File** (Alternative):
   ```cmd
   # Double-click install.bat or run in Command Prompt
   install.bat
   ```

#### Ubuntu 24.04
```bash
# Make script executable and run
chmod +x install.sh
./install.sh
```

### Method 2: Manual Installation

#### Step 1: Clone Repository
```bash
git clone <your-repository-url>
cd iMentor
```

#### Step 2: Install Dependencies

**Windows (PowerShell/Command Prompt):**
```powershell
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

**Ubuntu (Terminal):**
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

#### Step 3: Environment Setup
```bash
# Copy and edit environment file
cp server/.env.example server/.env
# Edit server/.env with your API keys
```

#### Step 4: Start Application
```bash
# Development mode
npm run dev

# Production mode
npm start

# Run only server
npm run server

# Run only client
npm run client
```

## Troubleshooting

### Common Issues

#### 1. npm install Fails
**Problem**: Circular dependency or postinstall script issues
**Solution**: Use the automated installation scripts or manual step-by-step installation

#### 2. Permission Errors (Ubuntu)
**Problem**: npm permission denied
**Solution**: 
```bash
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER ~/.config
```

#### 3. Node.js Version Issues
**Problem**: Incompatible Node.js version
**Solution**: Use Node Version Manager (nvm)
```bash
# Ubuntu
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Windows
# Download from https://nodejs.org/
```

#### 4. Port Already in Use
**Problem**: Port 4004 or 4007 already occupied
**Solution**: 
```bash
# Check what's using the port
netstat -tulpn | grep :4004
netstat -tulpn | grep :4007

# Kill the process or change ports in .env
```

### Platform-Specific Issues

#### Windows
- **PowerShell Execution Policy**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **Path Issues**: Ensure Node.js and npm are in your system PATH
- **Antivirus**: Temporarily disable antivirus if it blocks npm install

#### Ubuntu
- **Firewall**: Ensure ports 4004 and 4007 are open
- **SELinux**: If using SELinux, configure it properly or disable temporarily
- **System Updates**: Keep your system updated with `sudo apt update && sudo apt upgrade`

## Verification

After installation, verify everything is working:

1. **Check Services**:
   ```bash
   # Check if server is running
   curl http://localhost:4007/health
   
   # Check if client is accessible
   curl http://localhost:4004
   ```

2. **Check Logs**:
   ```bash
   # View application logs
   npm run logs
   
   # Check PM2 status (if using)
   pm2 status
   ```

3. **Test Features**:
   - Open http://localhost:4004 in your browser
   - Try uploading a document
   - Test the chat functionality
   - Verify MCP agents are working

## Development vs Production

### Development Mode
```bash
npm run dev
```
- Hot reload enabled
- Debug information
- Development environment variables

### Production Mode
```bash
npm start
```
- Optimized builds
- PM2 process management
- Production environment variables

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs in the terminal
3. Check the GitHub issues page
4. Ensure all prerequisites are met

## Next Steps

After successful installation:

1. Configure your API keys in `server/.env`
2. Set up your database connections
3. Configure MCP agents
4. Customize the application settings
5. Deploy to production if needed

---

**Happy coding! 🚀**

For more information, visit the main README.md file.
