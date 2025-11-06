@echo off
setlocal enabledelayedexpansion

:: === Settings ===
set "PORT=3001"
set "APP_DIR=c:\sdh\fsm\sdh-global-ai-assistant\backend"

echo [1/4] Checking if port %PORT% is in use...

:: Kill any process LISTENING on the port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Found process on port %PORT%: PID=%%P. Killing...
  taskkill /PID %%P /F >nul 2>&1
)

:: Extra sweep: kill any process that mentions the port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% "') do (
  echo Also killing PID=%%P ...
  taskkill /PID %%P /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo [2/4] Port %PORT% should now be free.
echo [3/4] Changing directory: "%APP_DIR%"
pushd "%APP_DIR%" || (echo ERROR: Cannot open "%APP_DIR%". & exit /b 1)

echo [4/4] Installing deps (if needed) and starting backend...
if exist package-lock.json (call npm ci) else (call npm install)
if errorlevel 1 (echo ERROR: npm install failed. & popd & exit /b 1)

:: Ensure backend picks the desired port (if your app reads PORT)
set PORT=%PORT%

call npm run dev

popd
endlocal
pause
