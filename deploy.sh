#!/bin/bash

# SDH Global AI Assistant - Быстрое развертывание
# Этот скрипт поможет вам развернуть приложение на бесплатных платформах

echo "🚀 SDH Global AI Assistant - Быстрое развертывание"
echo "=================================================="

# Проверяем зависимости
echo "Проверяем зависимости..."

if ! command -v git &> /dev/null; then
    echo "❌ Git не установлен. Установите Git и повторите попытку."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm не установлен. Установите Node.js и повторите попытку."
    exit 1
fi

echo "✅ Зависимости проверены"

# Предлагаем варианты развертывания
echo ""
echo "Выберите способ развертывания:"
echo "1. 🌐 Облачное развертывание (Railway + Vercel) - РЕКОМЕНДУЕТСЯ"
echo "2. 🐳 Docker развертывание (локально)"
echo "3. 💻 Локальная разработка"

read -p "Введите номер варианта (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Облачное развертывание"
        echo "========================="
        echo ""
        echo "Для облачного развертывания выполните следующие шаги:"
        echo ""
        echo "1. Форкните репозиторий на GitHub"
        echo "2. Получите Gemini API ключ: https://makersuite.google.com"
        echo ""
        echo "3. Backend на Railway:"
        echo "   - Перейдите на: https://railway.app"
        echo "   - New Project → Deploy from GitHub → выберите ваш fork"
        echo "   - Root Directory: backend"
        echo "   - Добавьте Environment Variables (см. .env.example)"
        echo ""
        echo "4. Frontend на Vercel:"
        echo "   - Перейдите на: https://vercel.com"
        echo "   - Import Project → выберите ваш fork"
        echo "   - Root Directory: frontend"
        echo "   - Environment Variable: VITE_API_URL=<Railway URL>/api"
        echo ""
        echo "5. Admin Panel на Vercel:"
        echo "   - Создайте новый проект на Vercel с тем же репозиторием"
        echo "   - Root Directory: admin-panel"
        echo "   - Environment Variable: NEXT_PUBLIC_API_URL=<Railway URL>/api"
        echo ""
        echo "📖 Подробные инструкции: читайте QUICK-DEPLOY.md"
        ;;
    2)
        echo ""
        echo "🐳 Docker развертывание"
        echo "======================"
        
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker не установлен. Установите Docker и повторите попытку."
            exit 1
        fi
        
        echo "Создаем .env файл..."
        if [ ! -f .env ]; then
            cp .env.example .env
            echo "✅ Создан .env файл из шаблона"
            echo "⚠️  ВАЖНО: Отредактируйте .env файл и добавьте ваш GEMINI_API_KEY"
            read -p "Нажмите Enter когда отредактируете .env файл..."
        fi
        
        echo "Запускаем Docker контейнеры..."
        docker-compose up -d
        
        echo ""
        echo "✅ Приложение запущено!"
        echo "Frontend: http://localhost:5173"
        echo "Admin Panel: http://localhost:3000"
        echo "Backend API: http://localhost:3001"
        echo ""
        echo "Чтобы остановить: docker-compose down"
        ;;
    3)
        echo ""
        echo "💻 Локальная разработка"
        echo "======================"
        
        echo "Устанавливаем зависимости..."
        npm run install:all
        
        echo ""
        echo "Создаем файлы конфигурации..."
        
        # Backend .env
        if [ ! -f backend/.env ]; then
            cp backend/.env.example backend/.env
            echo "✅ Создан backend/.env"
        fi
        
        # Frontend .env.local
        if [ ! -f frontend/.env.local ]; then
            cp frontend/.env.example frontend/.env.local
            echo "✅ Создан frontend/.env.local"
        fi
        
        # Admin Panel .env.local
        if [ ! -f admin-panel/.env.local ]; then
            cp admin-panel/.env.example admin-panel/.env.local
            echo "✅ Создан admin-panel/.env.local"
        fi
        
        echo ""
        echo "⚠️  ВАЖНО: Отредактируйте backend/.env и добавьте ваш GEMINI_API_KEY"
        echo ""
        echo "Чтобы запустить приложение:"
        echo "1. Backend:     cd backend && npm run dev"
        echo "2. Frontend:    cd frontend && npm run dev"
        echo "3. Admin Panel: cd admin-panel && npm run dev"
        echo ""
        echo "Или используйте: npm run dev (запустит всё сразу)"
        ;;
    *)
        echo "❌ Неверный выбор. Попробуйте снова."
        exit 1
        ;;
esac

echo ""
echo "🎉 Готово! Удачного использования SDH Global AI Assistant!"
echo "📧 Поддержка: https://www.SDH.global"