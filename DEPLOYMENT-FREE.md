# 🚀 Бесплатное развертывание SDH Global AI Assistant

Это руководство покажет, как развернуть приложение **совершенно бесплатно** на популярных облачных платформах.

## 📋 Содержание

1. [🌐 Railway + Vercel (Рекомендуется)](#railway--vercel-рекомендуется)
2. [🎯 Render + Netlify](#render--netlify)
3. [🐳 Docker Deploy](#docker-deploy)
4. [⚡ Полное развертывание за 15 минут](#полное-развертывание-за-15-минут)

---

## 🌐 Railway + Vercel (Рекомендуется)

### Почему это лучший вариант?
- ✅ **Railway**: 5$ в месяц кредита + отличная поддержка Node.js
- ✅ **Vercel**: Unlimited бесплатные деплои для фронтенда
- ✅ **Простота**: Автодеплой из GitHub
- ✅ **Масштабируемость**: Легко расширить при росте

### 🔧 Шаг 1: Развертывание Backend на Railway

1. **Создайте аккаунт**: [railway.app](https://railway.app)
2. **Подключите GitHub репозиторий**
3. **Создайте новый проект → Deploy from GitHub**
4. **Выберите ваш fork репозитория**
5. **Настройте переменные окружения**:

```bash
# В Railway Dashboard → Variables
PORT=3001
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_PATH=/app/database.sqlite
```

6. **Настройте деплой**:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

7. **Получите URL**: Скопируйте URL вашего backend (например: `https://your-app.railway.app`)

### 🎨 Шаг 2: Развертывание Frontend на Vercel

1. **Создайте аккаунт**: [vercel.com](https://vercel.com)
2. **Импортируйте проект из GitHub**
3. **Настройте параметры проекта**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Настройте переменные окружения**:
```bash
VITE_API_URL=https://your-backend.railway.app/api
VITE_APP_NAME=SDH Global AI Assistant
```

5. **Деплой**: Нажмите Deploy

### 🛠️ Шаг 3: Развертывание Admin Panel на Vercel

1. **Создайте второй проект на Vercel**
2. **Тот же репозиторий, но настройки**:
   - Root Directory: `admin-panel`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Переменные окружения**:
```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

---

## 🎯 Render + Netlify

### 🔧 Backend на Render

1. **Создайте аккаунт**: [render.com](https://render.com)
2. **New → Web Service**
3. **Подключите GitHub репозиторий**
4. **Настройки**:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

5. **Environment Variables** (как для Railway выше)

### 🎨 Frontend на Netlify

1. **Создайте аккаунт**: [netlify.com](https://netlify.com)
2. **Sites → Import from Git**
3. **Настройки**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

4. **Environment variables**:
```bash
VITE_API_URL=https://your-app.onrender.com/api
```

---

## 🐳 Docker Deploy

### Dockerfile для Backend

Создайте `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копируем package files
COPY package*.json ./
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Билдим приложение
RUN npm run build

# Экспозим порт
EXPOSE 3001

# Запускаем
CMD ["npm", "start"]
```

### Docker Compose

Создайте `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - JWT_SECRET=your_jwt_secret
      - GEMINI_API_KEY=your_gemini_key
    volumes:
      - ./data:/app/data

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://localhost:3001/api
    depends_on:
      - backend
```

---

## ⚡ Полное развертывание за 15 минут

### 📝 Быстрый чеклист:

1. **Подготовка (2 мин)**:
   - [ ] Fork репозитория на GitHub
   - [ ] Получите Gemini API ключ: [makersuite.google.com](https://makersuite.google.com)

2. **Backend на Railway (5 мин)**:
   - [ ] Регистрация на railway.app
   - [ ] Deploy from GitHub → выберите ваш fork
   - [ ] Root directory: `backend`
   - [ ] Добавьте environment variables
   - [ ] Скопируйте Railway URL

3. **Frontend на Vercel (4 мин)**:
   - [ ] Регистрация на vercel.com
   - [ ] Import project → ваш fork
   - [ ] Root directory: `frontend`
   - [ ] VITE_API_URL = ваш Railway URL + `/api`
   - [ ] Deploy

4. **Admin Panel на Vercel (4 мин)**:
   - [ ] Новый проект на Vercel
   - [ ] Root directory: `admin-panel`
   - [ ] NEXT_PUBLIC_API_URL = ваш Railway URL + `/api`
   - [ ] Deploy

5. **Тестирование**:
   - [ ] Откройте Admin Panel → логин admin/ваш_пароль
   - [ ] Settings → введите Gemini API ключ
   - [ ] Откройте Frontend → протестируйте чат

---

## 🔧 Настройка переменных окружения

### Backend Environment Variables

```bash
# Основные настройки
PORT=3001
NODE_ENV=production

# Безопасность
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# AI интеграция
GEMINI_API_KEY=your_gemini_api_key_from_google

# База данных
DATABASE_PATH=./database.sqlite
```

### Frontend Environment Variables

```bash
# API URL (замените на ваш Railway/Render URL)
VITE_API_URL=https://your-backend-app.railway.app/api

# Настройки приложения
VITE_APP_NAME=SDH Global AI Assistant
```

### Admin Panel Environment Variables

```bash
# API URL (тот же что и для frontend)
NEXT_PUBLIC_API_URL=https://your-backend-app.railway.app/api
```

---

## 🆘 Troubleshooting

### Backend не запускается
1. Проверьте логи в Railway/Render dashboard
2. Убедитесь что все environment variables заданы
3. Проверьте что NODE_ENV=production

### Frontend не подключается к Backend
1. Проверьте VITE_API_URL в Vercel/Netlify settings
2. Убедитесь что URL оканчивается на `/api`
3. Проверьте CORS настройки в backend

### Admin Panel не работает
1. Проверьте NEXT_PUBLIC_API_URL
2. Попробуйте логин admin/ваш_пароль
3. Проверьте что backend доступен

---

## 💰 Стоимость бесплатного развертывания

| Платформа | Backend | Frontend | Admin Panel | Итого/месяц |
|-----------|---------|----------|-------------|-------------|
| Railway + Vercel | $5 кредита | Бесплатно | Бесплатно | **$0-5** |
| Render + Netlify | Бесплатно | Бесплатно | Бесплатно | **$0** |
| Heroku | $7/месяц | Бесплатно | Бесплатно | **$7** |

**Рекомендация**: Railway + Vercel для лучшей производительности

---

## 📧 Поддержка

Нужна помощь с развертыванием? 

**SDH Global**: Сообщество инженеров-программистов, помогающих стартапам добиться успеха.

- 🌐 Сайт: [www.SDH.global](https://www.SDH.global)
- 📧 Поддержка: [www.SDH.global](https://www.SDH.global)

---

**Готово! Ваш AI Assistant теперь доступен в интернете 24/7 совершенно бесплатно! 🎉**