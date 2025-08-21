@echo off
echo 🚀 SDH Global AI Assistant - Быстрое развертывание
echo ==================================================
echo.

REM Проверяем зависимости
echo Проверяем зависимости...

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Git не установлен. Установите Git и повторите попытку.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js/npm не установлен. Установите Node.js и повторите попытку.
    pause
    exit /b 1
)

echo ✅ Зависимости проверены
echo.

echo Выберите способ развертывания:
echo 1. 🌐 Облачное развертывание (Railway + Vercel) - РЕКОМЕНДУЕТСЯ
echo 2. 🐳 Docker развертывание (локально)
echo 3. 💻 Локальная разработка
echo.

set /p choice="Введите номер варианта (1-3): "

if "%choice%"=="1" (
    echo.
    echo 🌐 Облачное развертывание
    echo =========================
    echo.
    echo Для облачного развертывания выполните следующие шаги:
    echo.
    echo 1. Форкните репозиторий на GitHub
    echo 2. Получите Gemini API ключ: https://makersuite.google.com
    echo.
    echo 3. Backend на Railway:
    echo    - Перейдите на: https://railway.app
    echo    - New Project → Deploy from GitHub → выберите ваш fork
    echo    - Root Directory: backend
    echo    - Добавьте Environment Variables (см. .env.example^)
    echo.
    echo 4. Frontend на Vercel:
    echo    - Перейдите на: https://vercel.com
    echo    - Import Project → выберите ваш fork
    echo    - Root Directory: frontend
    echo    - Environment Variable: VITE_API_URL=^<Railway URL^>/api
    echo.
    echo 5. Admin Panel на Vercel:
    echo    - Создайте новый проект на Vercel с тем же репозиторием
    echo    - Root Directory: admin-panel
    echo    - Environment Variable: NEXT_PUBLIC_API_URL=^<Railway URL^>/api
    echo.
    echo 📖 Подробные инструкции: читайте QUICK-DEPLOY.md
) else if "%choice%"=="2" (
    echo.
    echo 🐳 Docker развертывание
    echo ======================
    
    where docker >nul 2>nul
    if errorlevel 1 (
        echo ❌ Docker не установлен. Установите Docker и повторите попытку.
        pause
        exit /b 1
    )
    
    echo Создаем .env файл...
    if not exist .env (
        copy .env.example .env
        echo ✅ Создан .env файл из шаблона
        echo ⚠️  ВАЖНО: Отредактируйте .env файл и добавьте ваш GEMINI_API_KEY
        pause
    )
    
    echo Запускаем Docker контейнеры...
    docker-compose up -d
    
    echo.
    echo ✅ Приложение запущено!
    echo Frontend: http://localhost:5173
    echo Admin Panel: http://localhost:3000
    echo Backend API: http://localhost:3001
    echo.
    echo Чтобы остановить: docker-compose down
) else if "%choice%"=="3" (
    echo.
    echo 💻 Локальная разработка
    echo ======================
    
    echo Устанавливаем зависимости...
    call npm run install:all
    
    echo.
    echo Создаем файлы конфигурации...
    
    REM Backend .env
    if not exist backend\.env (
        copy backend\.env.example backend\.env
        echo ✅ Создан backend\.env
    )
    
    REM Frontend .env.local
    if not exist frontend\.env.local (
        copy frontend\.env.example frontend\.env.local
        echo ✅ Создан frontend\.env.local
    )
    
    REM Admin Panel .env.local
    if not exist admin-panel\.env.local (
        copy admin-panel\.env.example admin-panel\.env.local
        echo ✅ Создан admin-panel\.env.local
    )
    
    echo.
    echo ⚠️  ВАЖНО: Отредактируйте backend\.env и добавьте ваш GEMINI_API_KEY
    echo.
    echo Чтобы запустить приложение:
    echo 1. Backend:     cd backend ^&^& npm run dev
    echo 2. Frontend:    cd frontend ^&^& npm run dev
    echo 3. Admin Panel: cd admin-panel ^&^& npm run dev
    echo.
    echo Или используйте: npm run dev (запустит всё сразу^)
    echo.
    echo Также можете использовать готовые .bat файлы:
    echo - start-backend.bat
    echo - start-frontend.bat
    echo - start-admin.bat
) else (
    echo ❌ Неверный выбор. Попробуйте снова.
    pause
    exit /b 1
)

echo.
echo 🎉 Готово! Удачного использования SDH Global AI Assistant!
echo 📧 Поддержка: https://www.SDH.global
echo.
pause