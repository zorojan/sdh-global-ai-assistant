@echo off
title SDH AI Assistant - Install All Dependencies
color 0E

echo ================================================================
echo        SDH Global AI Assistant - Installing Dependencies
echo ================================================================
echo.

echo [1/5] Installing root dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)

echo [2/5] Installing backend dependencies...
cd backend
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

echo [3/5] Installing frontend dependencies...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

echo [4/5] Installing admin-panel dependencies...
cd admin-panel
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install admin-panel dependencies
    pause
    exit /b 1
)
cd ..

echo [5/5] Installing test-frontend dependencies...
cd test-frontend
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install test-frontend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ================================================================
echo            ✅ ALL DEPENDENCIES INSTALLED SUCCESSFULLY!
echo ================================================================
echo.
echo You can now run: start-all.bat
echo.
pause