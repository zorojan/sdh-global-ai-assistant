# 🏗️ АРХИТЕКТУРА ВИДЖЕТА SDH AI ASSISTANT

## 📋 ОГЛАВЛЕНИЕ
- [Общая структура](#общая-структура)
- [Компоненты и их роли](#компоненты-и-их-роли)
- [Цепочка вызовов](#цепочка-вызовов)
- [API взаимодействие](#api-взаимодействие)
- [Параметры виджета](#параметры-виджета)
- [Режимы работы](#режимы-работы)
- [Голосовая функциональность](#голосовая-функциональность)
- [Типичные проблемы](#типичные-проблемы)

---

## 🔗 ОБЩАЯ СТРУКТУРА

```
widget.html
   ↓
widget.tsx (ReactDOM.render)
   ↓
Widget.tsx (URL parser + config)
   ↓
ChatWidget.tsx (main component)
   ↓
VoiceChatWidget.tsx (voice mode)
   ↓
LiveAPIProviderWidget (Gemini Live API)
   ↓
BasicFaceWidget (говорящий смайлик)
```

---

## 📁 КОМПОНЕНТЫ И ИХ РОЛИ

### 1. **widget.html**
- **Роль**: Точка входа для iframe виджета
- **Функции**: 
  - Загружает `widget.tsx` как модуль
  - Устанавливает базовые стили
  - Обеспечивает 100vh/100vw контейнер

### 2. **widget.tsx**
- **Роль**: React точка входа
- **Функции**:
  - `ReactDOM.createRoot().render(<Widget />)`
  - Подключает глобальные стили

### 3. **Widget.tsx** 
- **Роль**: Конфигуратор и парсер параметров
- **Функции**:
  - Парсит URL параметры (`agentId`, `theme`, `geminiApiKey`, etc.)
  - Валидирует обязательный `agentId`
  - Применяет CSS кастомные свойства
  - Передает конфиг в `ChatWidget`

**Ключевые параметры:**
```typescript
{
  agentId: string,           // ОБЯЗАТЕЛЬНЫЙ
  theme: 'light' | 'dark',
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
  title: string,
  placeholder: string,
  primaryColor: string,
  apiUrl: string,
  geminiApiKey: string       // Для голосового режима
}
```

### 4. **ChatWidget.tsx** (ГЛАВНЫЙ КОМПОНЕНТ)
- **Роль**: Основная логика виджета
- **Функции**:
  - Загружает данные агента через API
  - Управляет состояниями диалога
  - Показывает экран выбора режима
  - Обрабатывает текстовые сообщения
  - Интегрирует голосовой режим

**Состояния:**
```typescript
type DialogMode = 'text' | 'voice' | null;
// null = показывается экран выбора режима
```

**Ключевые функции:**
- `loadAgent()` - загрузка данных агента
- `sendMessage()` - отправка текстовых сообщений
- `startDialog(mode)` - переключение в режим

### 5. **VoiceChatWidget.tsx**
- **Роль**: Голосовой интерфейс
- **Функции**:
  - Обёртка для `LiveAPIProviderWidget`
  - Управление подключением к Gemini Live API
  - Отображение говорящего смайлика
  - Индикация состояния (подключение/прослушивание/громкость)

### 6. **LiveAPIProviderWidget + use-live-api-widget.ts**
- **Роль**: Интеграция с Gemini Live API
- **Функции**:
  - WebSocket подключение к Gemini
  - Аудио стриминг (микрофон → API → динамики)
  - Обработка голосовых команд
  - Управление конфигурацией модели

---

## 🔄 ЦЕПОЧКА ВЫЗОВОВ

### Инициализация:
1. `widget.html` загружается в iframe
2. `widget.tsx` создает React приложение
3. `Widget.tsx` парсит URL и создает конфиг
4. `ChatWidget.tsx` загружает данные агента
5. Показывается экран выбора режима

### Текстовый режим:
1. Пользователь выбирает "💬 Text Chat"
2. `setDialogMode('text')`
3. Показывается интерфейс текстового чата
4. Сообщения отправляются через `POST /api/agents/chat`

### Голосовой режим:
1. Пользователь выбирает "🎤 Voice Chat"
2. `setDialogMode('voice')`
3. Рендерится `<VoiceChatWidget>`
4. Устанавливается соединение с Gemini Live API
5. Активируется говорящий смайлик

---

## 🌐 API ВЗАИМОДЕЙСТВИЕ

### Backend API (localhost:3001):
```
GET /api/agents/{agentId}        - Загрузка конкретного агента
GET /api/public/agents           - Список всех агентов (fallback)
POST /api/agents/chat            - Отправка текстовых сообщений
GET /api/health                  - Проверка здоровья сервера
```

### Gemini Live API:
```
WebSocket подключение для голосового режима
Требует geminiApiKey в URL параметрах
```

---

## ⚙️ ПАРАМЕТРЫ ВИДЖЕТА

### URL формат:
```
http://localhost:5173/widget.html?agentId=devops-specialist&theme=light&geminiApiKey=YOUR_KEY
```

### Обязательные параметры:
- `agentId` - ID агента для взаимодействия

### Опциональные параметры:
- `theme` - light/dark (по умолчанию: light)
- `position` - расположение кнопки (по умолчанию: bottom-right)
- `title` - заголовок виджета
- `placeholder` - плейсхолдер для ввода
- `primaryColor` - основной цвет (по умолчанию: #007bff)
- `apiUrl` - URL backend API (по умолчанию: http://localhost:3001)
- `geminiApiKey` - ключ для голосового режима (по умолчанию: demo-key)

---

## 🔀 РЕЖИМЫ РАБОТЫ

### 1. **Экран выбора** (DialogMode = null)
- Показывается при первом открытии
- Две кнопки: "💬 Text Chat" и "🎤 Voice Chat"
- Отображается информация об агенте

### 2. **Текстовый режим** (DialogMode = 'text')
- Классический чат интерфейс
- История сообщений
- Поле ввода + кнопка отправки
- Индикатор набора текста

### 3. **Голосовой режим** (DialogMode = 'voice')
- Говорящий смайлик (BasicFaceWidget)
- Кнопка записи/остановки
- Индикатор громкости
- Статус подключения

---

## 🎤 ГОЛОСОВАЯ ФУНКЦИОНАЛЬНОСТЬ

### Компоненты:
```
VoiceChatWidget
  ↓
LiveAPIProviderWidget (контекст)
  ↓
useLiveAPIContextWidget (хук)
  ↓
use-live-api-widget.ts (логика)
  ↓
GenAILiveClient (WebSocket)
```

### Состояния подключения:
- `isConnecting` - процесс подключения
- `connected` - успешное подключение
- `isListening` - активное прослушивание
- `volume` - уровень громкости (0-1)

### Аудио цепочка:
```
Микрофон → AudioStreamer → Gemini Live API → AudioStreamer → Динамики
                ↓                                    ↓
          Volume Meter                         BasicFaceWidget
```

---

## ⚠️ ТИПИЧНЫЕ ПРОБЛЕМЫ

### 1. **Агент не загружается**
**Причины:**
- Неверный `agentId` в URL
- Backend API недоступен (порт 3001)
- Ошибка в базе данных

**Решение:**
- Проверить URL параметр `agentId`
- Убедиться что backend запущен
- Проверить `/api/public/agents` endpoint

### 2. **Голосовой режим не работает**
**Причины:**
- Отсутствует или неверный `geminiApiKey`
- Проблемы с доступом к микрофону
- Ошибка WebSocket подключения
- CORS проблемы

**Решение:**
- Добавить валидный `geminiApiKey` в URL
- Проверить разрешения на микрофон
- Проверить консоль браузера на ошибки

### 3. **Виджет не отображается**
**Причины:**
- Frontend сервер не запущен (порт 5173)
- Ошибки компиляции React
- Проблемы с iframe

**Решение:**
- Запустить `npm run dev` в папке frontend
- Проверить консоль на ошибки
- Убедиться что iframe src корректный

### 4. **CSS стили не применяются**
**Причины:**
- Проблемы с Tailwind CSS
- Ошибки в ChatWidget.css
- Конфликты CSS переменных

**Решение:**
- Проверить сборку CSS
- Убедиться что CSS переменные установлены в Widget.tsx

---

## 🚀 КОМАНДЫ ЗАПУСКА

```bash
# Backend (порт 3001)
cd backend && npm run dev

# Frontend (порт 5173) 
cd frontend && npm run dev

# Admin Panel (порт 3000)
cd admin-panel && npm run dev

# Быстрый тест API
./test-api.bat
```

---

## 📝 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Базовый виджет:
```html
<iframe src="http://localhost:5173/widget.html?agentId=devops-specialist"></iframe>
```

### С голосовым режимом:
```html
<iframe src="http://localhost:5173/widget.html?agentId=devops-specialist&geminiApiKey=YOUR_REAL_KEY"></iframe>
```

### Полная конфигурация:
```html
<iframe src="http://localhost:5173/widget.html?agentId=devops-specialist&theme=dark&position=bottom-left&title=DevOps+Helper&primaryColor=%23ff6b6b&geminiApiKey=YOUR_KEY"></iframe>
```

---

## 🔧 ОТЛАДКА

### Важные точки проверки:
1. **Backend здоровье**: `http://localhost:3001/api/health`
2. **Список агентов**: `http://localhost:3001/api/public/agents`
3. **Виджет**: `http://localhost:5173/widget.html?agentId=devops-specialist`
4. **Консоль браузера**: проверить ошибки JavaScript
5. **Network tab**: проверить API запросы

### Логирование:
- Backend: логи в терминале с nodemon
- Frontend: `console.log` в браузере
- Голосовой режим: префикс `🎤 Widget:` в консоли

---

## 📚 СВЯЗАННЫЕ ФАЙЛЫ

**Основные компоненты:**
- `frontend/widget.html`
- `frontend/widget.tsx`
- `frontend/components/Widget.tsx`
- `frontend/components/ChatWidget.tsx`
- `frontend/components/VoiceChatWidget.tsx`

**Голосовая функциональность:**
- `frontend/contexts/LiveAPIContextWidget.tsx`
- `frontend/hooks/media/use-live-api-widget.ts`
- `frontend/components/demo/basic-face/BasicFaceWidget.tsx`

**Стили:**
- `frontend/components/ChatWidget.css`
- `frontend/index.css`

**Backend API:**
- `backend/src/routes/agents.ts`
- `backend/src/database/init.ts`

---

*Документ создан: 19 августа 2025*
*Версия: 1.0*
