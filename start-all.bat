@echo off
title SDH AI Assistant - Starting All Services
color 0A

echo ================================================================
echo        SDH Global AI Assistant - Unified Launcher
echo ================================================================
echo.

:: Kill all existing processes first
echo [1/5] Stopping all existing services...
call stop-all.bat >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start Backend (Port 3001)
echo [2/5] Starting Backend Server (Port 3001)...
start "Backend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\backend && npm run dev"
timeout /t 3 /nobreak >nul

:: Start Frontend (Port 5174)  
echo [3/5] Starting Frontend Server (Port 5174)...
start "Frontend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\frontend && npm run dev"
timeout /t 3 /nobreak >nul

:: Start Admin Panel (Port 3000)
echo [4/5] Starting Admin Panel (Port 3000)...
start "Admin Panel" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\admin-panel && npm run dev"
timeout /t 3 /nobreak >nul

:: Start Test Frontend (Port 5176)
echo [5/5] Starting Test Frontend (Port 5176)...
start "Test Frontend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\test-frontend && npm run dev"

echo.
echo ================================================================
echo                    ALL SERVICES STARTING...
echo ================================================================
echo.
echo Backend:        http://localhost:3001
echo Frontend:       http://localhost:5175
echo Admin Panel:    http://localhost:3000  
echo Test Frontend:  http://localhost:5176
echo.
echo Press any key to open all URLs in browser...
pause >nul

:: Open all URLs
start "" "http://localhost:3001"
start "" "http://localhost:5175"
start "" "http://localhost:3000"
start "" "http://localhost:5176"

echo.
echo ================================================================
echo              ALL SERVICES ARE NOW RUNNING!
echo ================================================================
pause