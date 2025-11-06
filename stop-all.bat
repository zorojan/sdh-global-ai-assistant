@echo off
chcp 65001 >nul
echo ========================================
echo   Остановка всех Node.js процессов
echo ========================================
echo.

taskkill /F /IM node.exe >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo ✓ Все процессы успешно остановлены
) else (
    echo ℹ Не найдено запущенных Node.js процессов
)

echo.
echo Нажмите любую клавишу для выхода...
pause >nul
