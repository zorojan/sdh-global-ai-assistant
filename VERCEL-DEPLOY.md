# Vercel Deployment Guide

## 📦 Deployment Structure

Наш проект настроен для деплоя с упрощенной структурой без admin панели (пока).

### Архитектура:
- **Frontend**: Главный интерфейс на `/`
- **Backend API**: Serverless функции на `/api/*`
- **Admin Panel**: Отключен (будет добавлен позже)

## 🚀 Шаги для деплоя

### 1. Подготовка репозитория
```bash
git add .
git commit -m "Ready for Vercel deployment without admin panel"
git push
```

### 2. Настройка Vercel

1. Идите на [vercel.com](https://vercel.com)
2. Войдите и нажмите "Add New" → "Project"
3. Импортируйте ваш Git репозиторий
4. Vercel автоматически определит настройки из `vercel.json`

### 3. Environment Variables

Добавьте эти переменные окружения в Vercel:

```env
# Обязательные
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_jwt_secret_here
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password

# Опциональные (для базы данных)
DATABASE_URL=sqlite:./database.db
```

### 4. Deploy

Нажмите "Deploy" - Vercel автоматически:
- Соберет frontend с помощью Vite
- Настроит serverless функции для API
- Создаст роуты согласно `vercel.json`

## 🔗 URL Structure

После деплоя:
- **Frontend**: `https://your-app.vercel.app/`
- **API**: `https://your-app.vercel.app/api/agents`
- **Widget**: `https://your-app.vercel.app/widget.html`

## ✅ Проверка работы

1. Откройте главную страницу
2. Проверьте API: `https://your-app.vercel.app/api/agents`
3. Протестируйте виджет

## 🔧 Troubleshooting

### Если не работает API:
- Проверьте Environment Variables в Vercel
- Посмотрите логи функций в Vercel Dashboard

### Если не работает frontend:
- Проверьте build логи
- Убедитесь что все файлы закоммичены

## 📝 Примечания

- Admin панель временно отключена из-за Next.js build issues
- База данных SQLite будет создана автоматически при первом запросе
- Все компоненты voice enhancement и company settings работают

## 🎯 Готово!

Ваш AI Assistant готов к продакшену с полной поддержкой:
- ✅ Голосовые характеристики агентов
- ✅ Настройки компании
- ✅ Многоязычность (Armenian, Russian, English)
- ✅ Voice-to-voice чат
- ✅ Встраиваемый виджет