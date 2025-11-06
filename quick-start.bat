@echo off
title SDH AI Assistant - Quick Start
color 0A

echo ================================================================
echo        SDH Global AI Assistant - Quick Start System
echo ================================================================
echo.

:: Check if dependencies are installed
echo [1/3] Checking dependencies...
if not exist "backend\node_modules" (
    echo ❌ Backend dependencies missing. Installing...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo ❌ Frontend dependencies missing. Installing...  
    cd frontend && npm install && cd ..
)
if not exist "admin-panel\node_modules" (
    echo ❌ Admin Panel dependencies missing. Installing...
    cd admin-panel && npm install && cd ..
)
if not exist "test-frontend\node_modules" (
    echo ❌ Test Frontend dependencies missing. Installing...
    cd test-frontend && npm install && cd ..
)

echo ✅ All dependencies ready!
echo.

:: Clean up any stuck processes
echo [2/3] Cleaning up old processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im npm.cmd >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5176') do taskkill /f /pid %%a >nul 2>&1

timeout /t 2 /nobreak >nul

:: Start services with better error handling
echo [3/3] Starting all services...
echo.

echo 🚀 Starting Backend (Port 3001)...
start "SDH Backend" cmd /c "cd /d %~dp0backend && npm run dev || pause"
timeout /t 3 /nobreak >nul

echo 🚀 Starting Frontend (Port 5174)...
start "SDH Frontend" cmd /c "cd /d %~dp0frontend && npm run dev || pause"
timeout /t 3 /nobreak >nul

echo 🚀 Starting Admin Panel (Port 3000)...
start "SDH Admin" cmd /c "cd /d %~dp0admin-panel && npm run dev || pause"
timeout /t 3 /nobreak >nul

echo 🚀 Starting Test Frontend (Port 5180)...
start "SDH Test" cmd /c "cd /d %~dp0test-frontend && npm run dev || pause"

echo.
echo ================================================================
echo                    🎉 LAUNCH COMPLETE!
echo ================================================================
echo.
echo Services should be starting up...
echo Backend:        http://localhost:3001
echo Frontend:       http://localhost:5175  
echo Admin Panel:    http://localhost:3000
echo Test Frontend:  http://localhost:5176
echo.

:: Wait and check status
echo Waiting 10 seconds for services to start...
timeout /t 10 /nobreak >nul

echo.
echo 📊 Port Status:
netstat -ano | findstr ":3000 " && echo ✅ Admin Panel (3000) - RUNNING || echo ❌ Admin Panel (3000) - FAILED
netstat -ano | findstr ":3001 " && echo ✅ Backend (3001) - RUNNING || echo ❌ Backend (3001) - FAILED  
netstat -ano | findstr ":5175 " && echo ✅ Frontend (5175) - RUNNING || echo ❌ Frontend (5175) - FAILED
netstat -ano | findstr ":5176 " && echo ✅ Test Frontend (5176) - RUNNING || echo ❌ Test Frontend (5176) - FAILED

echo.
echo 🌐 Opening URLs...
start "" "http://localhost:3001"
start "" "http://localhost:5175"
start "" "http://localhost:3000"
start "" "http://localhost:5176"

echo.
echo All done! Check the opened browser tabs and service windows.
pause