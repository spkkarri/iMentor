@echo off
echo 🚀 Starting iMentor Application (Ports 4000-4999)
echo ================================================
echo.

echo 📍 Current directory: %CD%
echo.

echo 🔍 Step 1: Checking port availability...
node check_ports.js
echo.

echo 🎯 Step 2: Starting Backend Server (Port 4007)...
echo Opening new terminal for backend...
start "iMentor Backend" cmd /k "cd /d %CD%\server && echo 🖥️ Starting Backend Server on Port 4007... && npm start"

echo.
echo ⏳ Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak > nul

echo.
echo 🎯 Step 3: Starting Frontend Client (Port 4004)...
echo Opening new terminal for frontend...
start "iMentor Frontend" cmd /k "cd /d %CD%\client && echo 🌐 Starting Frontend Client on Port 4004... && npm start"

echo.
echo ✅ Application startup initiated!
echo.
echo 📋 Application URLs:
echo    Frontend: http://localhost:4004
echo    Backend:  http://localhost:4007
echo.
echo 💡 Tips:
echo    - Wait for both terminals to show "compiled successfully"
echo    - Frontend will automatically open in your browser
echo    - Backend API will be available at localhost:4007
echo.
echo 🔧 If you encounter issues:
echo    1. Check if ports are already in use
echo    2. Ensure MongoDB is running
echo    3. Verify all dependencies are installed
echo.

pause
