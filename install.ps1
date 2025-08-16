# Windows Installation Script for TutorAI Chatbot
# This script installs all dependencies for the TutorAI application

Write-Host "🚀 Starting TutorAI Chatbot Installation on Windows..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed. Please install npm 8+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Clean existing node_modules if they exist
Write-Host "🧹 Cleaning existing node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "server\node_modules") {
    Remove-Item -Recurse -Force "server\node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "client\node_modules") {
    Remove-Item -Recurse -Force "client\node_modules" -ErrorAction SilentlyContinue
}

# Install root dependencies
Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install root dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Root dependencies installed successfully" -ForegroundColor Green

# Install server dependencies
Write-Host "🔧 Installing server dependencies..." -ForegroundColor Yellow
Set-Location "server"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install server dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Server dependencies installed successfully" -ForegroundColor Green

# Go back to root
Set-Location ".."

# Install client dependencies
Write-Host "🎨 Installing client dependencies..." -ForegroundColor Yellow
Set-Location "client"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install client dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Client dependencies installed successfully" -ForegroundColor Green

# Go back to root
Set-Location ".."

Write-Host "==================================================" -ForegroundColor Green
Write-Host "🎉 Installation completed successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Cyan
Write-Host "  Development mode: npm run dev" -ForegroundColor White
Write-Host "  Production mode: npm start" -ForegroundColor White
Write-Host ""
Write-Host "To run only server: npm run server" -ForegroundColor White
Write-Host "To run only client: npm run client" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green
