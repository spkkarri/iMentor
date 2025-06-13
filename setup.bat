@echo off
cls
:: ================================================================
::              CHATBOT PROJECT: FULL SETUP INSTALLER
:: ================================================================

echo.
echo ████████████████████████████████████████████████████████████████
echo █                                                             █
echo █          CHATBOT PROJECT - FULL DEPENDENCY SETUP            █
echo █                                                             █
echo █  This script will install all Node.js and Python packages.  █
echo █  Make sure Node.js, Python, and Git are already installed.  █
echo █                                                             █
echo ████████████████████████████████████████████████████████████████
echo.
pause

:: ======================== INSTALL CONCURRENTLY =========================
cls
echo.
echo ────────────────────────────────────────────────────────────────
echo              STEP 1 of 5: Installing 'concurrently'
echo ────────────────────────────────────────────────────────────────
npm install -g concurrently
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install 'concurrently'. Please check your npm installation or try running as Administrator.
    pause
    exit /b
)
echo [✅ SUCCESS] 'concurrently' installed successfully.
echo.
pause

:: ======================== BACKEND DEPENDENCIES =========================
cls
echo.
echo ────────────────────────────────────────────────────────────────
echo           STEP 2 of 5: Installing Backend Dependencies
echo ────────────────────────────────────────────────────────────────
cd server
npm install
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install backend dependencies.
    pause
    exit /b
)
cd ..
echo [✅ SUCCESS] Backend dependencies installed successfully.
echo.
pause

:: ======================== FRONTEND DEPENDENCIES ========================
cls
echo.
echo ────────────────────────────────────────────────────────────────
echo           STEP 3 of 5: Installing Frontend Dependencies
echo ────────────────────────────────────────────────────────────────
cd client
npm install
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install frontend dependencies.
    pause
    exit /b
)
cd ..
echo [✅ SUCCESS] Frontend dependencies installed successfully.
echo.
pause

:: ======================== PYTHON DEPENDENCIES ==========================
cls
echo.
echo ────────────────────────────────────────────────────────────────
echo          STEP 4 of 5: Installing Python Microservices
echo ────────────────────────────────────────────────────────────────
echo Virtual environments will be created for each Python service.
echo.

:: Install Notebook Service
echo ---------------------------------------------------------------
echo Installing Notebook Service Dependencies...
cd ..\Notebook\backend
python -m venv .venv
call .\.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install Notebook dependencies.
    pause
    exit /b
)
cd ..\..\Chatbot-geminiV3
echo [✅ SUCCESS] Notebook Service dependencies installed.
echo.

:: Install RAG Service
echo ---------------------------------------------------------------
echo Installing RAG Service Dependencies...
cd server\rag_service
python -m venv .venv
call .\.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install RAG dependencies.
    pause
    exit /b
)
cd ..\..
echo [✅ SUCCESS] RAG Service dependencies installed.
echo.

:: Install Search Service
echo ---------------------------------------------------------------
echo Installing Search Service Dependencies...
cd server\search_service
python -m venv .venv
call .\.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [❌ ERROR] Failed to install Search dependencies.
    pause
    exit /b
)
cd ..\..
echo [✅ SUCCESS] Search Service dependencies installed.
echo.
pause

:: ========================== COMPLETION =================================
cls
echo.
echo ████████████████████████████████████████████████████████████████
echo █                                                             █
echo █                 ✅  SETUP COMPLETED SUCCESSFULLY  ✅              █
echo █                                                             █
echo █ You can now start the application by running:               █
echo █                                                             █
echo █                 start-all.bat                               █
echo █                                                             █
echo ████████████████████████████████████████████████████████████████
echo.
pause
exit
