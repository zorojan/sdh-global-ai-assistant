# 🆘 Troubleshooting Guide

## 🌐 Проблемы с развертыванием

### Railway Backend не запускается

**Симптомы**: Backend показывает ошибку при деплое или недоступен по URL

**Решения**:
1. **Проверьте переменные окружения**:
   ```
   PORT=3001
   NODE_ENV=production
   JWT_SECRET=минимум_32_символа
   GEMINI_API_KEY=ваш_ключ_от_google
   ```

2. **Проверьте логи в Railway Dashboard**:
   - Deployment logs
   - Runtime logs
   - Ошибки сборки

3. **Типичные ошибки**:
   ```bash
   # Ошибка: "Module not found"
   # Решение: Проверьте что Root Directory = "backend"
   
   # Ошибка: "Port already in use"  
   # Решение: Railway автоматически присваивает PORT
   
   # Ошибка: "Database not writable"
   # Решение: Используйте относительный путь "./database.sqlite"
   ```

### Vercel Frontend не подключается к Backend

**Симптомы**: Frontend загружается, но не может связаться с API

**Решения**:
1. **Проверьте VITE_API_URL**:
   ```bash
   # Правильно (с /api в конце):
   VITE_API_URL=https://your-app.railway.app/api
   
   # Неправильно:
   VITE_API_URL=https://your-app.railway.app
   ```

2. **Проверьте CORS в backend**:
   ```typescript
   // backend/src/server.ts должен содержать:
   app.use(cors({
     origin: ['https://your-frontend.vercel.app'],
     credentials: true
   }));
   ```

3. **Проверьте в браузере** (F12 → Console):
   ```javascript
   // Ошибка CORS:
   // "Access to fetch at ... has been blocked by CORS policy"
   
   // Ошибка 404:
   // "GET https://your-app.railway.app/api/agents 404"
   ```

### Netlify Build fails

**Симптомы**: Netlify не может собрать фронтенд

**Решения**:
1. **Проверьте настройки сборки**:
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```

2. **Node.js версия**:
   ```bash
   # В netlify.toml добавьте:
   [build.environment]
   NODE_VERSION = "18"
   ```

### Admin Panel не авторизуется

**Симптомы**: Страница логина не принимает admin/пароль

**Решения**:
1. **Проверьте переменные в Railway**:
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=ваш_пароль
   ```

2. **Проверьте API URL в админке**:
   ```bash
   # В настройках Vercel для admin панели:
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
   ```

3. **Сброс пароля** (Railway console):
   ```bash
   # Подключитесь к Railway shell и выполните:
   npm run reset-admin
   ```

---

## 🔍 Диагностика проблемы с кнопкой Play

## ✅ Что работает:
1. ✅ Backend API на порту 3001
2. ✅ Admin Panel на порту 3000  
3. ✅ Frontend на порту 5176
4. ✅ Данные агентов загружаются из админки в Header

## ❌ Что не работает:
1. ❌ Кнопка Play не включается (не меняется на pause)
2. ❌ Цвет смайлика не изменяется при подключении
3. ❌ Диалог не работает

## 🔧 Добавленная отладка:

### В консоли браузера смотрите:
- `📊 DataInitializer raw agents from API:` - сырые данные из API
- `🎭 DataInitializer formatted agents:` - отформатированные агенты
- `🎯 KeynoteCompanion setting config:` - конфигурация Live API
- `🎮 ControlTray Debug:` - состояние кнопок
- `😀 BasicFace render:` - параметры смайлика
- `🔘 Connect button clicked:` - при нажатии Play
- `🔌 useLiveApi connect called:` - при попытке подключения

### На экране:
- Debug панель в правом верхнем углу показывает:
  - API Key: ✅/❌ 
  - UserConfig: ✅/❌

## 🎯 Возможные причины проблемы:

1. **Config не установлен** - проверьте что `🎯 KeynoteCompanion setting config` выводит правильную конфигурацию

2. **Проблема с голосом** - в базе может быть неправильный voice, должен быть один из:
   - 'Aoede', 'Charon', 'Fenrir', 'Kore', 'Leda', 'Orus', 'Puck', 'Zephyr'

3. **Проблема с API ключом** - проверьте что в админке установлен правильный Gemini API ключ

4. **Проблемы с микрофоном** - браузер может не дать разрешение на микрофон

5. **Проблемы с Live API** - Gemini Live API может быть недоступен

## 📋 План действий:
1. Откройте http://localhost:5176 в браузере
2. Откройте консоль разработчика (F12)
3. Нажмите кнопку Play
4. Посмотрите все сообщения в консоли
5. Сообщите какие ошибки появляются

## 🔧 Быстрые проверки:
- В админке: убедитесь что API ключ Gemini установлен
- В админке: проверьте что агенты имеют правильные голоса
- В браузере: разрешите доступ к микрофону если спросит
