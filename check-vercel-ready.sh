#!/bin/bash

echo "🔧 Проверка готовности к деплою в Vercel..."

# Проверить что все package.json существуют
echo "📦 Проверка package.json файлов..."
if [ ! -f "package.json" ]; then
    echo "❌ Отсутствует корневой package.json"
    exit 1
fi

if [ ! -f "backend/package.json" ]; then
    echo "❌ Отсутствует backend/package.json"
    exit 1
fi

if [ ! -f "admin-panel/package.json" ]; then
    echo "❌ Отсутствует admin-panel/package.json"
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo "❌ Отсутствует frontend/package.json"
    exit 1
fi

echo "✅ Все package.json файлы найдены"

# Проверить vercel.json
if [ ! -f "vercel.json" ]; then
    echo "❌ Отсутствует vercel.json"
    exit 1
fi

echo "✅ vercel.json найден"

# Проверить API файл
if [ ! -f "api/index.ts" ]; then
    echo "❌ Отсутствует api/index.ts"
    exit 1
fi

echo "✅ api/index.ts найден"

# Попробовать сборку
echo "🏗️ Попытка сборки..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "❌ Ошибка установки зависимостей"
    exit 1
fi

npm run build

if [ $? -ne 0 ]; then
    echo "❌ Ошибка сборки"
    exit 1
fi

echo "🎉 Готово к деплою в Vercel!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Создать проект на vercel.com"
echo "2. Подключить этот Git репозиторий"
echo "3. Добавить переменные окружения:"
echo "   - GEMINI_API_KEY"
echo "   - JWT_SECRET" 
echo "   - ADMIN_USERNAME"
echo "   - ADMIN_PASSWORD"
echo "4. Нажать Deploy"
echo ""
echo "📖 Подробная инструкция: VERCEL-DEPLOYMENT.md"