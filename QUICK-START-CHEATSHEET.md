# 🚀 ШПАРГАЛКА: Голосовые улучшения и настройки компании

*Быстрый справочник для продолжения разработки*

## ⚡ Быстрый старт

### Запуск системы:
```bash
# 1. Backend (порт 3001)
cd backend && npm run dev

# 2. Admin панель (порт 3000)  
cd admin-panel && npm run dev

# 3. Frontend (порт 5175)
cd frontend && npm run dev
```

### Проверка работоспособности:
```bash
# Проверить backend API
curl http://localhost:3001/api/health

# Проверить доступ к настройкам (нужна авторизация)
# Войти в admin панель: http://localhost:3000
```

---

## 🎯 Что было добавлено

### ✅ 1. Усиленные языковые инструкции
- **Файл:** `backend/src/routes/agents.ts` 
- **Функция:** `generateSystemPromptWithLanguage`
- **Языки:** Армянский (hy-AM), Русский (ru-RU), Английский (en-US)
- **Особенность:** КРИТИЧЕСКИЕ предупреждения против смешения языков

### ✅ 2. Голосовые характеристики агентов
- **База данных:** Колонка `voice_characteristics` в таблице `agents`
- **Admin панель:** Поля в формах создания/редактирования агентов
- **Типы:** Обновлены во всех модулях (`shared/types`, `frontend/lib`, etc.)

### ✅ 3. Настройки компании
- **База данных:** 4 новых настройки в таблице `settings`
- **Admin панель:** Новая вкладка "🏢 О компании" 
- **Промпты:** Динамическое использование информации о компании

### ✅ 4. Исправления API
- **Проблема:** Неавторизованные запросы от admin панели
- **Решение:** Использование `settingsAPI` вместо прямых fetch запросов

---

## 🔍 Ключевые файлы для изменений

```
📁 Backend (порт 3001)
├── src/database/init.ts - миграции БД
├── src/routes/agents.ts - языки + промпты  
└── src/routes/settings.ts - API настроек

📁 Admin Panel (порт 3000)
├── src/app/page.tsx - вкладки
├── src/components/AgentsTab.tsx - формы агентов
├── src/components/CompanyTab.tsx - настройки компании
└── src/lib/api.ts - API клиент

📁 Frontend (порт 5175)  
├── lib/prompts.ts - системные промпты
├── lib/api-client.ts - типы
└── components/demo/keynote-companion/KeynoteCompanion.tsx

📁 Shared
└── types/index.ts - общие типы
```

---

## 🧪 Быстрые тесты

### Тест 1: Голосовые характеристики
```bash
# 1. Открыть admin панель -> Агенты  
# 2. Создать агента с voice_characteristics:
"Говорите медленно и четко, дружелюбным тоном"
# 3. Сохранить -> проверить в базе данных
```

### Тест 2: Настройки компании
```bash
# 1. Открыть admin панель -> О компании
# 2. Изменить название на "Test Company"  
# 3. Добавить описание
# 4. Сохранить -> проверить, что агенты используют новое название
```

### Тест 3: Языковые инструкции
```bash
# 1. Создать агента с языком hy-AM (армянский)
# 2. Запустить голосовой чат
# 3. Убедиться: агент отвечает ТОЛЬКО на армянском
```

---

## 🚨 Возможные проблемы

### Проблема: 401 Unauthorized
**Причина:** Нет авторизационного токена
**Решение:** Войти в admin панель перед API запросами

### Проблема: EADDRINUSE порт занят
**Причина:** Процессы не остановлены
**Решение:** `taskkill /F /IM node.exe` (Windows)

### Проблема: База данных не обновилась
**Причина:** Миграция не выполнилась
**Решение:** Удалить `database.db` и перезапустить backend

### Проблема: Агент не использует голосовые характеристики
**Причина:** Поле пустое или промпт не обновился
**Решение:** Проверить `generateSystemPromptWithLanguage`

---

## 🔧 Команды для разработки

### База данных:
```bash
# Проверить структуру таблицы agents
sqlite3 backend/database.db "PRAGMA table_info(agents);"

# Проверить настройки компании  
sqlite3 backend/database.db "SELECT * FROM settings WHERE key LIKE 'company_%';"

# Проверить агентов с голосовыми характеристиками
sqlite3 backend/database.db "SELECT id, name, voice_characteristics FROM agents;"
```

### Логи и отладка:
```bash
# Backend логи
cd backend && npm run dev | grep -E "(error|Error|ERROR)"

# Проверить API эндпоинты
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/settings
```

---

## 📋 Чеклист для продолжения

### Сегодня сделано ✅
- [x] Усиленные языковые инструкции (армянский, русский)
- [x] Система голосовых характеристик
- [x] Конфигурируемые настройки компании  
- [x] Admin панель с новой вкладкой
- [x] Исправления API авторизации

### Завтра можно добавить 🎯
- [ ] Тестирование всех функций
- [ ] Добавить больше языков (французский, немецкий)
- [ ] Предустановленные шаблоны голосовых характеристик
- [ ] Логотип и брендинг компании
- [ ] Экспорт/импорт настроек

### На будущее 🚀  
- [ ] Аналитика использования языков
- [ ] A/B тестирование голосовых характеристик
- [ ] Интеграция с внешними TTS сервисами
- [ ] Мультиязычные настройки компании

---

## 💡 Полезные SQL запросы

```sql
-- Все настройки компании
SELECT * FROM settings WHERE key LIKE 'company_%';

-- Агенты с голосовыми характеристиками  
SELECT id, name, voice_characteristics FROM agents 
WHERE voice_characteristics IS NOT NULL AND voice_characteristics != '';

-- Агенты по языкам
SELECT language, COUNT(*) as count FROM agents GROUP BY language;

-- Последние обновления настроек
SELECT key, value, updated_at FROM settings 
WHERE key LIKE 'company_%' ORDER BY updated_at DESC;
```

---

## 🎨 Структура компонентов Admin панели

```typescript
// CompanyTab.tsx - основные функции
fetchCompanyInfo() - загрузка настроек
handleSave() - сохранение через settingsAPI  
handleChange() - обновление локального состояния

// AgentsTab.tsx - новые поля
voice_characteristics: string - текстовое поле
language: 'hy-AM' | 'ru-RU' | 'en-US' - выбор языка
```

---

*Создано: 5 ноября 2025*  
*Статус: Готово к продолжению разработки* 🚀