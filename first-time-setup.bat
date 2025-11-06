@echo off
title SDH AI Assistant - First Time Setup
color 0A

echo ================================================================
echo     SDH Global AI Assistant - First Time Setup & Launch
echo ================================================================
echo.

echo This will:
echo 1. Install all dependencies
echo 2. Start all services
echo.
echo Press any key to continue...
pause >nul

echo.
echo [1/2] Installing all dependencies...
call install-all.bat

echo.
echo [2/2] Starting all services...
call start-all.bat

echo.
echo ================================================================
echo                    SETUP COMPLETE! 🚀
echo ================================================================
pause