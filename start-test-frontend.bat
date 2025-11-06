@echo off
setlocal enabledelayedexpansion

:: === Settings ===
set "PORT=5174"
set "APP_DIR=f:\app\fsm\sdh-global-ai-assistant\test-frontend"

echo [1/4] Checking if port %PORT% is in use...

:: Find PIDs listening on the port and kill them
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Found process on port %PORT%: PID=%%P. Killing...
  taskkill /PID %%P /F >nul 2>&1
)

:: Extra sweep: kill any process that mentions the port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% "') do (
  echo Also killing PID=%%P ...
  taskkill /PID %%P /F >nul 2>&1
)

:: Short wait and re-check
timeout /t 2 /nobreak >nul
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% " ^| findstr /V /C:"No") do (
  echo WARNING: PID %%P still using port %PORT%. Trying again...
  taskkill /PID %%P /F >nul 2>&1
)

echo [2/4] Port %PORT% should now be free.
echo [3/4] Changing directory: "%APP_DIR%"
pushd "%APP_DIR%" || (echo ERROR: Cannot open "%APP_DIR%". & exit /b 1)

echo [4/4] Installing deps and starting dev server...
call npm install
if errorlevel 1 (echo ERROR: npm install failed. & popd & exit /b 1)

:: If your dev server respects PORT, you can enforce it:
:: set PORT=%PORT%

call npm run dev

popd
endlocal
pause
