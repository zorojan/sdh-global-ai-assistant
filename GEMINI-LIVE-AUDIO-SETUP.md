# 🎙️ Gemini Live Audio с поддержкой армянского

## 🚀 Что изменилось?

Обновлена модель на **`gemini-2.5-flash-native-audio-preview-09-2025`** которая поддерживает:
- ✅ Armenian (Հայերեն)
- ✅ Russian (Русский)
- ✅ English
- ✅ И другие языки

## 📋 Архитектура

```
Frontend (Port 5175)
    ↓
    └─→ Backend Proxy (Port 3001)
        └─→ Google Gemini Live API
```

**Почему так?**
- ❌ CORS: Browser не может подключиться напрямую к WebSocket Google API
- ✅ Proxy: Backend имеет неограниченный доступ к Google APIs
- ✅ Security: API key хранится только на backend

## 🔧 Запуск системы

### 1. Backend (Port 3001)
```bash
cd backend
npx ts-node src/server.ts
# Или: npm run dev
```

### 2. Frontend Test (Port 5175)
```bash
cd test-frontend
npm run dev
```

### 3. Откройте браузер
```
http://localhost:5175
```

## 🎯 Использование

### Шаги тестирования аудио:

1. **Provider Selection**: Выберите "🤖 Gemini Live"
2. **Mode Selection**: Выберите "🎤 Voice Chat"
3. **Agent Selection**: Выберите агента (например, Armenian Support)
4. **Start Voice**: Нажмите "🎤 Start Voice Session"
5. **Speak**: Говорите на микрофон (Armenian/Russian/English)
6. **Listen**: Слушайте ответ

## 📊 Diagnostics

Приложение показывает:
- ✅ API Keys Status
- ✅ Model Information
- ✅ TTS Model
- ✅ System Prompt
- ✅ Language Settings
- ✅ All Connected Agents

## 📝 Initial Session Log

При подключении логируется:
- Model name
- TTS Model
- System Prompt
- Agent Information
- Language
- Connection timestamp

## 🔐 API Key Setup

```bash
# 1. Откройте admin panel
http://localhost:3000

# 2. Настройте Gemini API Key в Settings
# Key должен быть получен из:
# https://aistudio.google.com/apikey
```

## 🐛 Troubleshooting

### Port 3001 занят
```bash
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Port 5175 занят
```bash
netstat -ano | findstr :5175
taskkill /PID <PID> /F
```

### API Key не найден
```bash
# Проверьте что admin panel настроил gemini_api_key
# в Supabase settings table
```

### Микрофон не работает
```bash
# 1. Проверьте разрешения браузера
# 2. Откройте браузер консоль (F12)
# 3. Ищите ошибки доступа к microphone
```

## 📚 Модели

| Model | Язык | Статус |
|-------|------|--------|
| `gemini-2.5-flash-native-audio-preview-09-2025` | 🇦🇲 Armenian | ✅ Default |
| `gemini-2.5-flash-native-audio-preview-09-2025` | 🇷🇺 Russian | ✅ Supported |
| `gemini-2.5-flash-native-audio-preview-09-2025` | 🇬🇧 English | ✅ Supported |

## 🔗 API Endpoints

```
POST /api/gemini/live/setup
  - Initialize session
  - Returns: sessionId

POST /api/gemini/live/send
  - Send audio to Gemini
  - Returns: text + audio response

GET /api/gemini/live/status
  - Check active sessions

POST /api/gemini/live/cleanup
  - Close session
```

## ✅ Checklist

- [x] Backend Gemini Live proxy created
- [x] Frontend client uses backend proxy
- [x] Model updated to support Armenian
- [x] Diagnostics panel working
- [x] Session logging working
- [x] Error handling implemented
- [x] CORS bypass working

## 🎉 Ready to Test!

Открыть браузер: **http://localhost:5175**
