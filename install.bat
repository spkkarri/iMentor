@echo off
chcp 65001 >nul
echo 🚀 Starting TutorAI Chatbot Installation on Windows...
echo ==================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm 8+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed
echo.

REM Clean existing node_modules if they exist
echo 🧹 Cleaning existing node_modules...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "server\node_modules" rmdir /s /q "server\node_modules"
if exist "client\node_modules" rmdir /s /q "client\node_modules"

REM Install root dependencies
echo 📦 Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)
echo ✅ Root dependencies installed successfully
echo.

REM Install server dependencies
echo 🔧 Installing server dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install server dependencies
    pause
    exit /b 1
)
echo ✅ Server dependencies installed successfully
cd ..
echo.

REM Install client dependencies
echo 🎨 Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install client dependencies
    pause
    exit /b 1
)
echo ✅ Client dependencies installed successfully
cd ..
echo.

echo ==================================================
echo 🎉 Installation completed successfully!
echo ==================================================
echo.
echo To start the application:
echo   Development mode: npm run dev
echo   Production mode: npm start
echo.
echo To run only server: npm run server
echo To run only client: npm run client
echo.
echo Happy coding! 🚀
echo.
pause
