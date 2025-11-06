@echo off
chcp 65001 >nul
echo ========================================
echo   SDH Global AI Assistant - Full Start
echo ========================================
echo.

REM Step 1: Kill any process listening on important ports (3000, 3001, 5173)
echo [1/5] Убиваем процессы, занимающие порты: 3000, 3001, 5173...
for %%p in (3000 3001 5173) do (
	echo Checking port %%p...
	for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p"') do (
		echo Killing PID %%a that listens on port %%p
		taskkill /PID %%a /F >nul 2>&1
	)
)
timeout /t 1 /nobreak >nul

REM Fallback: stop any remaining node.exe processes to be safe
echo [2/5] Останавливаем все запущенные Node.js процессы (fallback)...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo ✓ Порты очищены и node процессы остановлены
echo.

REM Запуск Backend (порт 3001)
echo [3/5] Запускаем Backend на порту 3001...
start "Backend API (3001)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
echo ✓ Backend запущен
echo.

REM Запуск Frontend (порт 5173)
echo [4/5] Запускаем Frontend на порту 5173...
start "Frontend (5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
echo ✓ Frontend запущен
echo.

REM Запуск Admin Panel (порт 3000)
echo [5/5] Запускаем Admin Panel на порту 3000...
start "Admin Panel (3000)" cmd /k "cd /d %~dp0admin-panel && npm run dev"
timeout /t 3 /nobreak >nul
echo ✓ Admin Panel запущен
echo.

echo ========================================
echo   Все приложения успешно запущены!
echo ========================================
echo.
echo   Backend:      http://localhost:3001
echo   Frontend:     http://localhost:5173
echo   Admin Panel:  http://localhost:3000
echo.
echo Нажмите любую клавишу для выхода...
pause >nul
