# 🚀 Deployment Guide - Vercel

## 📋 Структура приложения после деплоя

После деплоя в Vercel у вас будет **ОДИН URL** с тремя частями:

```
https://your-app.vercel.app/          - Frontend (основное приложение)
https://your-app.vercel.app/admin     - Admin Panel  
https://your-app.vercel.app/api       - Backend API
```

## 🛠️ Подготовка к деплою

### 1. Установить Vercel CLI (если нужно)
```bash
npm install -g vercel
```

### 2. Настроить переменные окружения
В Vercel Dashboard -> Settings -> Environment Variables добавить:

```bash
# Обязательные переменные
GEMINI_API_KEY=ваш_gemini_api_ключ
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ваш_админ_пароль

# Опциональные
NODE_ENV=production
```

### 3. Проверить сборку локально
```bash
# В корне проекта
npm run build

# Если ошибок нет - готов к деплою
```

## 🚀 Деплой в Vercel

### Вариант 1: Через Vercel Dashboard (рекомендуется)
1. Зайти на [vercel.com](https://vercel.com)
2. Подключить GitHub репозиторий
3. В настройках проекта указать:
   - **Build Command:** `npm run build`
   - **Output Directory:** оставить пустым
   - **Install Command:** `npm run install:all`
4. Добавить переменные окружения (см. выше)
5. Нажать **Deploy**

### Вариант 2: Через CLI
```bash
# В корне проекта
vercel --prod

# Следовать инструкциям в терминале
```

## 🌐 URL Structure после деплоя

### Frontend (Главное приложение)
```
https://your-app.vercel.app/
https://your-app.vercel.app/widget.html
```

### Admin Panel
```
https://your-app.vercel.app/admin        - Главная страница админки
https://your-app.vercel.app/admin/login  - Логин (если нужен)
```

### API Endpoints
```
https://your-app.vercel.app/api/health     - Проверка работоспособности
https://your-app.vercel.app/api/agents     - Управление агентами
https://your-app.vercel.app/api/settings   - Настройки системы
https://your-app.vercel.app/api/auth       - Авторизация
```

## ✅ Проверка после деплоя

### 1. Проверить API
```bash
curl https://your-app.vercel.app/api/health
# Должно вернуть: {"status":"OK","timestamp":"..."}
```

### 2. Проверить Admin Panel
- Открыть `https://your-app.vercel.app/admin`
- Войти с admin/password
- Проверить что все вкладки загружаются

### 3. Проверить Frontend
- Открыть `https://your-app.vercel.app`
- Проверить что чат работает
- Протестировать голосовое взаимодействие

## 🐛 Возможные проблемы и решения

### Проблема: Build Failed "npm run build exited with 1"
**Решение:**
```bash
# 1. Проверить сборку локально
npm run clean:all
npm run install:all  
npm run build

# 2. Если ошибки - исправить их
# 3. Закоммитить изменения и попробовать деплой снова
```

### Проблема: API не отвечает (500 ошибка)
**Решение:**
1. Проверить переменные окружения в Vercel Dashboard
2. Убедиться что GEMINI_API_KEY добавлен
3. Проверить логи в Vercel Dashboard -> Functions

### Проблема: Admin Panel не загружается
**Решение:**
1. Проверить что `/admin` работает: `https://your-app.vercel.app/admin`
2. Очистить кэш браузера
3. Проверить console в браузере на ошибки

### Проблема: Database ошибки
**Решение:**
В serverless окружении SQLite может работать нестабильно. Рассмотрите:
1. Использование Vercel KV (Redis)
2. Подключение внешней PostgreSQL (Supabase, Planetscale)
3. Использование Vercel Postgres

## 🔧 Локальная разработка vs Продакшн

### Локально (3 порта):
```bash
npm run dev
# Frontend:     http://localhost:5175
# Admin Panel:  http://localhost:3000  
# Backend API:  http://localhost:3001
```

### В продакшене (1 URL):
```bash  
# Все на одном домене:
# Frontend:     https://your-app.vercel.app/
# Admin Panel:  https://your-app.vercel.app/admin
# Backend API:  https://your-app.vercel.app/api
```

## 📝 Следующие шаги

### После успешного деплоя:
1. **Настроить DNS** (если нужен кастомный домен)
2. **Настроить мониторинг** (Vercel Analytics)  
3. **Backup базы данных** (если используете SQLite)
4. **Настроить CI/CD** (автодеплой при push)

### Обновления:
```bash
# Для обновления достаточно:
git push origin main

# Vercel автоматически пересоберет и задеплоит
```

## 🔗 Полезные ссылки

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)

---

**🎉 После деплоя у вас будет полнофункциональное приложение на одном URL с тремя компонентами!**