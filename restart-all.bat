@echo off
title SDH AI Assistant - Restart All Services
color 0E

echo ================================================================
echo        SDH Global AI Assistant - Restarting All Services
echo ================================================================
echo.

echo [1/2] Stopping all services...
call stop-all.bat

echo.
echo [2/2] Starting all services...
timeout /t 2 /nobreak >nul
call start-all.bat