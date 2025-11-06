@echo off
title SDH AI Assistant - Stopping All Services
color 0C

echo ================================================================
echo        SDH Global AI Assistant - Stopping All Services
echo ================================================================
echo.

echo [1/4] Killing Node.js processes...
taskkill /f /im node.exe >nul 2>&1

echo [2/4] Killing npm processes...
taskkill /f /im npm.cmd >nul 2>&1

echo [3/4] Killing ports 3000, 3001, 5174, 5180...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5176') do taskkill /f /pid %%a >nul 2>&1

echo [4/4] Cleaning up...
timeout /t 1 /nobreak >nul

echo.
echo ================================================================
echo                ALL SERVICES STOPPED!
echo ================================================================
echo.
pause