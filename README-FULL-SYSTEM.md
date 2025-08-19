# SDH Global AI Assistant - Полная система

Полноценная система AI Assistant, разделенная на три компонента:
- **Backend** - API сервер (Node.js + Express + SQLite)
- **Admin Panel** - Панель администратора (Next.js)  
- **Frontend** - Пользовательский интерфейс (React + Vite)

## 🚀 Быстрый запуск

### 1. Backend (порт 3001)
```bash
cd backend
npm install
npm run dev
```

### 2. Admin Panel (порт 3000)
```bash
cd admin-panel
npm install
npm run dev
```

### 3. Frontend (порт 5173)
```bash
cd frontend
npm install
npm run dev
npm install vite
```

## 📁 Структура проекта

```
sdh-global-ai-assistant/
├── backend/                 # API сервер
│   ├── src/
│   │   ├── server.ts       # Главный сервер
│   │   ├── database/       # База данных SQLite
│   │   └── routes/         # API маршруты
│   ├── package.json
│   └── .env
├── admin-panel/            # Панель администратора
│   ├── src/
│   │   ├── app/           # Next.js app directory
│   │   ├── components/    # React компоненты
│   │   └── lib/          # Утилиты и API клиент
│   ├── package.json
│   └── .env.local
├── frontend/              # Пользовательский интерфейс
│   ├── components/        # React компоненты
│   ├── lib/              # Утилиты
│   ├── package.json
│   └── .env.local
└── shared/               # Общие типы
    └── types/
```

## 🔧 Настройка

### Backend настройки (.env)
```bash
PORT=3001
DATABASE_PATH=./database.sqlite
JWT_SECRET=your_jwt_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
GEMINI_API_KEY=your_gemini_api_key
```

### Admin Panel настройки (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Frontend настройки (.env.local)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=SDH Global AI Assistant
```

## 🎯 Основные функции

### Backend API
- **Аутентификация** - JWT токены для админ панели
- **Управление настройками** - API ключи, конфигурация
- **Управление агентами** - CRUD операции для AI агентов
- **База данных** - SQLite для хранения данных

### Admin Panel
- **🔐 Авторизация** - admin/admin123 (по умолчанию)
- **⚙️ Вкладка Settings** - Управление Gemini API ключом и настройками
- **🤖 Вкладка Agents** - Создание/редактирование AI агентов
- **📊 Интуитивный интерфейс** - Tailwind CSS дизайн

### Frontend  
- **🎤 Голосовой чат** - Реальное время аудио с AI
- **👥 Выбор агентов** - Получение агентов через API
- **🎨 Чистый интерфейс** - Без настроек пользователя
- **📱 Адаптивный дизайн** - Работает на всех устройствах

## 🔄 API Endpoints

### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `GET /api/auth/verify` - Проверка токена

### Настройки  
- `GET /api/settings` - Получить все настройки
- `PUT /api/settings/:key` - Обновить настройку
- `POST /api/settings` - Создать настройку

### Агенты
- `GET /api/agents` - Получить всех агентов
- `POST /api/agents` - Создать агента
- `PUT /api/agents/:id` - Обновить агента
- `DELETE /api/agents/:id` - Удалить агента

## 🛠 Развертывание

### Разработка
Запустите все три сервиса локально на разных портах.

### Production
1. **Backend** - Docker container или VPS
2. **Admin Panel** - Vercel/Netlify
3. **Frontend** - Vercel/Netlify/CDN

## 📧 Поддержка

**SDH Global**: Сообщество инженеров-программистов, помогающих стартапам добиться успеха.

Для разработки полного AI программного обеспечения и поддержки обращайтесь:
- 🌐 Сайт: [www.SDH.global](https://www.SDH.global)
- 📧 Поддержка: [www.SDH.global](https://www.SDH.global)

---

## 🔍 Логика работы

1. **Admin Panel** управляет настройками и агентами через Backend API
2. **Frontend** получает список агентов и настройки через Backend API  
3. **Backend** хранит всё в SQLite и предоставляет REST API
4. **Gemini API ключ** настраивается в Admin Panel и используется Frontend'ом

Теперь у вас есть полноценная модульная система! 🎉
