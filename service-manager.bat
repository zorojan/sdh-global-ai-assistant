@echo off
title SDH AI Assistant - Service Manager
color 0B

:menu
cls
echo ================================================================
echo           SDH Global AI Assistant - Service Manager
echo ================================================================
echo.
echo Select an option:
echo.
echo   0. Install All Dependencies (First Time Setup)
echo   1. Start All Services
echo   2. Stop All Services  
echo   3. Restart All Services
echo   4. Start Individual Service
echo   5. Check Service Status
echo   6. Open All URLs
echo   7. Exit
echo.
echo ================================================================
set /p choice="Enter your choice (0-7): "

if "%choice%"=="0" goto install_deps
if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto stop_all
if "%choice%"=="3" goto restart_all
if "%choice%"=="4" goto individual
if "%choice%"=="5" goto status
if "%choice%"=="6" goto urls
if "%choice%"=="7" goto exit
goto menu

:install_deps
call install-all.bat
goto menu

:start_all
call start-all.bat
goto menu

:stop_all
call stop-all.bat
goto menu

:restart_all
call restart-all.bat
goto menu

:individual
cls
echo ================================================================
echo                   Start Individual Service
echo ================================================================
echo.
echo   1. Backend (Port 3001)
echo   2. Frontend (Port 5175)
echo   3. Admin Panel (Port 3000)
echo   4. Test Frontend (Port 5176)
echo   5. Back to main menu
echo.
set /p service="Select service (1-5): "

if "%service%"=="1" start "Backend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\backend && npm run dev"
if "%service%"=="2" start "Frontend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\frontend && npm run dev"
if "%service%"=="3" start "Admin Panel" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\admin-panel && npm run dev"
if "%service%"=="4" start "Test Frontend" cmd /k "cd /d f:\app\fsm\sdh-global-ai-assistant\test-frontend && npm run dev"
if "%service%"=="5" goto menu

pause
goto menu

:status
cls
echo ================================================================
echo                     Service Status Check
echo ================================================================
echo.
echo Checking ports...
echo.
netstat -ano | findstr ":3000 " && echo ✓ Admin Panel (3000) - RUNNING || echo ✗ Admin Panel (3000) - STOPPED
netstat -ano | findstr ":3001 " && echo ✓ Backend (3001) - RUNNING || echo ✗ Backend (3001) - STOPPED
netstat -ano | findstr ":5175 " && echo ✓ Frontend (5175) - RUNNING || echo ✗ Frontend (5175) - STOPPED
netstat -ano | findstr ":5176 " && echo ✓ Test Frontend (5176) - RUNNING || echo ✗ Test Frontend (5176) - STOPPED
echo.
pause
goto menu

:urls
echo Opening all service URLs...
start "" "http://localhost:3000"
start "" "http://localhost:3001"
start "" "http://localhost:5175"
start "" "http://localhost:5176"
pause
goto menu

:exit
exit