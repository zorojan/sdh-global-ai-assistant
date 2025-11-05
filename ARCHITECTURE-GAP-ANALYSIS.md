# 📊 АРХИТЕКТУРНЫЙ АНАЛИЗ: НАША СИСТЕМА VS РЕКОМЕНДАЦИИ

## 🎯 ТЕКУЩЕЕ СОСТОЯНИЕ НАШЕЙ СИСТЕМЫ

### ✅ Что у нас уже реализовано правильно:

#### 1. **Gemini Live API (Realtime S2S)** ✅
- ✅ **WebSocket подключение** к Gemini Live API  
- ✅ **Нативный аудио стрим** (микрофон → API → динамики)
- ✅ **Низкая задержка** благодаря прямому стримингу
- ✅ **Говорящий смайлик** для визуальной обратной связи
- ✅ **Конфигурируемый агент** через URL параметры

#### 2. **Classic Pipeline (STT → LLM → TTS)** ✅  
- ✅ **Текстовый чат** через backend API
- ✅ **Gemini Pro** для текстовых сообщений  
- ✅ **Провайдер-агностическая** архитектура (OpenAI + Gemini)

#### 3. **Армянский язык (hy-AM)** ✅
- ✅ **Gemini TTS** с поддержкой армянского (hy-AM)
- ✅ **Голосовые настройки** Kore (рекомендован для армянского)
- ✅ **Языковые настройки** в админ-панели

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЕЛЫ (по сравнению с документом)

### ❌ 1. **OpenAI Realtime API отсутствует**
**Документ рекомендует:** OpenAI Realtime API с WebRTC для браузерных приложений

**Наша система:** Только Gemini Live API

**Проблема:** Нет альтернативы для пользователей предпочитающих OpenAI

### ❌ 2. **Нет поддержки OpenAI STT/TTS pipeline** 
**Документ рекомендует:** 
- STT: `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`
- TTS: `gpt-4o-mini-tts` с армянским голосом

**Наша система:** Только текстовый чат через OpenAI, нет аудио pipeline

### ❌ 3. **Отсутствует barge-in функциональность**
**Документ подчеркивает:** Возможность прерывания AI во время ответа

**Наша система:** Нет явной поддержки barge-in

### ❌ 4. **Нет системных инструкций для армянского**
**Документ рекомендует:** 
```
"Speak in Eastern Armenian (hy-AM). Avoid English code-switching.
Read numbers in Armenian words. Pause at `։` and `՝`."
```

**Наша система:** Полагается на автоопределение языка

### ❌ 5. **Безопасность API ключей**
**Документ подчеркивает:** "Keep API keys server-side only—never expose keys to browsers"

**Наша система:** geminiApiKey передается через URL параметры в браузер

---

## 🎯 ПЛАН УЛУЧШЕНИЙ (Приоритеты)

### 🔴 ВЫСОКИЙ ПРИОРИТЕТ

#### 1. **Безопасность API ключей**
- [ ] Убрать geminiApiKey из URL параметров
- [ ] Создать server-side прокси для WebRTC SDP
- [ ] Использовать временные токены для браузера

#### 2. **OpenAI Realtime API интеграция**
- [ ] Добавить OpenAI Realtime API поддержку  
- [ ] WebRTC подключение через server-side SDP прокси
- [ ] Выбор провайдера в виджете (OpenAI/Gemini)

### 🟡 СРЕДНИЙ ПРИОРИТЕТ  

#### 3. **OpenAI STT/TTS Pipeline**
- [ ] Интегрировать `gpt-4o-transcribe` для STT
- [ ] Добавить `gpt-4o-mini-tts` с армянскими голосами  
- [ ] Classic pipeline режим в виджете

#### 4. **Армянские системные инструкции**
- [ ] Добавить промпты для Eastern Armenian
- [ ] Конфигурация пунктуации и чисел
- [ ] Предотвращение code-switching

### 🟢 НИЗКИЙ ПРИОРИТЕТ

#### 5. **Barge-in функциональность** 
- [ ] Прерывание AI ответа
- [ ] Детекция голосовой активности пользователя
- [ ] Плавное переключение между говорящими

#### 6. **Дополнительные улучшения**
- [ ] Мониторинг латентности (< 500-800ms)
- [ ] Reconnect/keep-alive для Gemini Live
- [ ] Расширенная диагностика качества

---

## 📈 АРХИТЕКТУРНЫЕ РЕКОМЕНДАЦИИ

### Предлагаемая новая архитектура виджета:

```
Widget.tsx
   ↓
ChatWidget.tsx
   ↓ (выбор режима)
┌─────────────────────┬─────────────────────┐
│   Realtime Mode     │   Pipeline Mode     │  
│                     │                     │
│ OpenAI Realtime API │ STT → LLM → TTS    │
│ Gemini Live API     │ OpenAI/Gemini      │
│                     │ Classic chain      │
└─────────────────────┴─────────────────────┘
```

### Компоненты для реализации:

1. **`RealtimeProvider`** - OpenAI Realtime + Gemini Live
2. **`PipelineProvider`** - STT/TTS цепочка  
3. **`SecureTokenManager`** - Server-side API ключи
4. **`ArmenianPromptManager`** - Системные инструкции
5. **`BargeInController`** - Прерывание диалога

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Немедленно:** Исправить безопасность API ключей
2. **Эта неделя:** Добавить OpenAI Realtime API  
3. **Следующая неделя:** Реализовать армянские промпты
4. **В будущем:** STT/TTS pipeline и barge-in

---

## 📚 ССЫЛКИ НА ДОКУМЕНТАЦИЮ

Все рекомендации основаны на официальных источниках:
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) 
- [OpenAI STT/TTS](https://platform.openai.com/docs/guides/text-to-speech)
- [Gemini Speech Generation](https://ai.google.dev/gemini-api/docs/speech-generation)