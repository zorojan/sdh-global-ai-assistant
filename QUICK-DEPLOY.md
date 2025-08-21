# 🚀 Быстрое развертывание за 10 минут

**Получите ваш AI Assistant в интернете БЕСПЛАТНО за 10 минут!**

## 📋 Что вам понадобится
- [ ] GitHub аккаунт
- [ ] Gemini API ключ ([получить бесплатно](https://makersuite.google.com))

## ⚡ Самый быстрый способ (Railway + Vercel)

### 1️⃣ Backend на Railway (3 минуты)
1. Форкните этот репозиторий на GitHub
2. Идите на [railway.app](https://railway.app) → Войдите через GitHub
3. New Project → Deploy from GitHub → Выберите ваш fork
4. **Service Settings**:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. **Environment Variables**:
   ```
   PORT=3001
   NODE_ENV=production
   JWT_SECRET=your_super_secret_jwt_key_here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password
   GEMINI_API_KEY=your_gemini_api_key
   DATABASE_PATH=./database.sqlite
   ```
6. Deploy → Скопируйте URL (например: `https://your-app.railway.app`)

### 2️⃣ Frontend на Vercel (3 минуты)
1. Идите на [vercel.com](https://vercel.com) → Войдите через GitHub
2. Import Project → Выберите ваш fork
3. **Project Settings**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables**:
   ```
   VITE_API_URL=https://your-app.railway.app/api
   VITE_APP_NAME=SDH Global AI Assistant
   ```
5. Deploy → Скопируйте URL фронтенда

### 3️⃣ Admin Panel на Vercel (3 минуты)
1. На Vercel создайте **новый проект** с тем же репозиторием
2. **Project Settings**:
   - Root Directory: `admin-panel`
   - Build Command: `npm run build`
3. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-app.railway.app/api
   ```
4. Deploy → Скопируйте URL админки

### 4️⃣ Настройка (1 минута)
1. Откройте Admin Panel URL
2. Войдите: admin / ваш_пароль
3. Settings → Введите Gemini API ключ
4. Готово! 🎉

---

## 🌐 Альтернативные платформы

### 🆓 100% Бесплатно (Render + Netlify)
- **Backend**: [Render.com](https://render.com) (750 часов/месяц бесплатно)
- **Frontend**: [Netlify.com](https://netlify.com) (100GB трафика/месяц)
- **Admin Panel**: [Netlify.com](https://netlify.com)

### 🐳 Docker деплой
```bash
# Клонируйте репозиторий
git clone https://github.com/ваш-username/sdh-global-ai-assistant.git

# Создайте .env файл
cp .env.example .env
# Отредактируйте .env с вашими ключами

# Запустите всё одной командой
docker-compose up -d
```

---

## 🔧 Готовые ссылки для деплоя

### One-Click Deploy кнопки:

**Railway (Backend):**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/quickstart)

**Vercel (Frontend):**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zorojan/sdh-global-ai-assistant&root-directory=frontend)

**Netlify (Frontend):**
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/zorojan/sdh-global-ai-assistant&base=frontend)

---

## 💰 Стоимость
- **Railway**: $5 кредита/месяц (достаточно для малых проектов)
- **Vercel**: Бесплатно до 100GB трафика
- **Render**: 750 часов/месяц бесплатно
- **Netlify**: 100GB/месяц бесплатно

**Итого: $0-5/месяц** ⭐

---

## 🆘 Помощь

**Проблемы с развертыванием?**

1. 📖 Читайте подробное руководство: [DEPLOYMENT-FREE.md](./DEPLOYMENT-FREE.md)
2. 🐛 Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. 🌐 Поддержка: [www.SDH.global](https://www.SDH.global)

---

**Готово! Ваш AI Assistant теперь работает в облаке! 🚀**