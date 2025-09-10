@echo off
REM iMentor Docker Deployment Script for Windows
REM This script provides one-click deployment for the iMentor application

setlocal enabledelayedexpansion

REM Check if Docker is installed
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

where docker-compose >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

REM Set command (default to start if no argument provided)
set "command=%~1"
if "%command%"=="" set "command=start"

if "%command%"=="start" goto start
if "%command%"=="stop" goto stop
if "%command%"=="restart" goto restart
if "%command%"=="status" goto status
if "%command%"=="logs" goto logs
if "%command%"=="cleanup" goto cleanup
if "%command%"=="help" goto help
goto unknown

:start
echo [INFO] Building and starting iMentor services...
docker-compose up --build -d
if %errorlevel% equ 0 (
    echo [SUCCESS] Services started successfully!
    echo [INFO] Frontend available at: http://localhost:4004
    echo [INFO] Backend API available at: http://localhost:5007
    echo [INFO] MongoDB available at: localhost:27017
    echo [INFO] Redis available at: localhost:6379
) else (
    echo [ERROR] Failed to start services
)
goto end

:stop
echo [INFO] Stopping iMentor services...
docker-compose down
echo [SUCCESS] Services stopped successfully!
goto end

:restart
echo [INFO] Restarting iMentor services...
docker-compose restart
echo [SUCCESS] Services restarted successfully!
goto end

:status
echo [INFO] Service Status:
docker-compose ps
goto end

:logs
echo [INFO] Viewing logs for all services...
docker-compose logs -f
goto end

:cleanup
echo [WARNING] This will remove all containers, images, and volumes!
set /p "confirm=Are you sure? (y/N): "
if /i "!confirm!"=="y" (
    echo [INFO] Cleaning up...
    docker-compose down -v --rmi all
    docker system prune -f
    echo [SUCCESS] Cleanup completed!
) else (
    echo [INFO] Cleanup cancelled.
)
goto end

:help
echo iMentor Docker Deployment Script
echo.
echo Usage: %~nx0 [COMMAND]
echo.
echo Commands:
echo   start     Build and start all services
echo   stop      Stop all services
echo   restart   Restart all services
echo   status    Show service status
echo   logs      View logs
echo   cleanup   Remove all containers, images, and volumes
echo   help      Show this help message
echo.
echo Examples:
echo   %~nx0 start    # Start the application
echo   %~nx0 logs     # View application logs
echo   %~nx0 stop     # Stop the application
goto end

:unknown
echo [ERROR] Unknown command: %command%
echo.
call :help
exit /b 1

:end
if "%command%"=="logs" goto skip_pause
if "%command%"=="help" goto skip_pause
pause
:skip_pause
