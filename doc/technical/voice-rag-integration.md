# Интеграция паттерна VoiceRAG в текущий проект (Supabase + OpenAI/Gemini)

Документ — рабочий план и карта изменений для применения логики примера
`aisearch-openai-rag-audio-main` в вашем проекте, без использования Azure.
Цель: реализовать Realtime VoiceRAG (Full‑Duplex) с RAG-инструментом, используя
OpenAI Realtime API и/или Gemini Live API, и хранить знания в Supabase (pgvector).

## Краткая идея
- Сохранить архитектурный паттерн "Agent + Tools" из примера: живой аудиопоток
  (Full‑Duplex) поддерживает LLM (realtime), который в нужный момент вызывает
  внешнюю функцию/инструмент `search_fsm_rag`.
- Backend выступает proxy/session-orchestrator: ретранслирует аудио, ловит
  function-call от realtime агента и запускает RAG (поиск по Supabase +
  embeddings). Результат возвращается агенту для генерации ответа.

## Сравнение компонентов примера и вашей системы

- Пример (Azure)                →  Ваша система
- Azure OpenAI Realtime         →  OpenAI Realtime API (или Gemini Live)
- Azure AI Search / index       →  Supabase с `pgvector` (knowledge_base) или локальное векторное хранилище (ChromaDB) — рекомендуется для быстрого локального RAG/девелопмента
- Python RTMiddleTier (backend) →  Ваш backend (FastAPI / Node) — добавить адаптер
- Frontend RTClient             →  Frontend компонент (React) — создать VoiceRAGClient
- Ingest/Index scripts          →  Скрипты импорта и векторизации в `scripts/` (использовать OpenAI embeddings или Gemini embeddings)

## Публичный контракт (протокол) — WebSocket / messages

- Сообщения от клиента → backend (через WS):
  - `audio.chunk` {sessionId, seq, data: base64, mime}
  - `text.message` {sessionId, text}
  - `control` {sessionId, action: start|stop|pause|resume}

- Сообщения от backend → клиент:
  - `transcription.partial` {text, isFinal=false}
  - `transcription.final` {text, isFinal=true}
  - `agent.call_tool` {tool: "search_fsm_rag", args}
  - `response.text` {text, sources: [...]}
  - `response.audio` {audio: base64pcm}

Эти типы можно адаптировать под существующий frontend-протокол.

## Необходимые изменения в репозитории (файлы и задачи)

1) Документы (этот документ сохраняется): `doc/technical/voice-rag-integration.md` (сделано)

2) Backend — новые/модифицированные файлы:
   - `backend/voice_rag/rt_adapter_openai.py` — адаптер для OpenAI Realtime (WebSocket client) / поддержка Function Call lifecycle
   - `backend/voice_rag/rt_adapter_gemini.py` — (опционально) адаптер для Gemini Live
   - `backend/voice_rag/rag_tool.py` — реализация `search_fsm_rag(query)`:
       * подключение к Supabase (pgvector)
       * генерация embedding (OpenAI/Gemini)
       * similarity search (SQL + cosine/ivfflat)
       * форматирование контекста для агента
   - `backend/apps/voice_ws.py` — WebSocket gateway / session proxy (route `/ws/voice-rag`)
   - интеграция в существующий auth layer (OAuth2) и логирование

3) Frontend — новые/модифицированные файлы:
   - `frontend/components/VoiceRAGClient.tsx` — RT client: захват аудио, кодирование в PCM/16, отправка `audio.chunk`, получение `response.audio`
   - Обновления UI: индикатор RAG, список источников (citations), переключатель провайдера (OpenAI / Gemini)

4) Ингест/индексирование знаний (scripts):
   - `scripts/ingest_fsm_to_supabase.py` —
       * прочитать `doc/` или raw FSM файлы
       * разбить на чанки (RecursiveCharacterTextSplitter)
       * получить embeddings (OpenAI/внешний)
       * записать в Supabase `knowledge_base` таблицу (fields: id, title, content, embedding, metadata, language, company_id)
   - Миграции DB: добавить таблицу `knowledge_base` с `vector` колонкой (pgvector)

5) Конфигурация / env variables (пример, добавить в `.env` / secrets manager):
   - OPENAI_API_KEY
   - OPENAI_REALTIME_URL (если используется)
   - GEMINI_LIVE_ENDPOINT (если планируете Gemini)
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY (или postgres connection for pgvector)
   - DEFAULT_LANGUAGE=hy

6) Документация и примеры: `doc/technical/voice-rag-usage.md` — как запустить локально и в dev

## Как реализовать RAG-процесс (search_fsm_rag)

1. Получаем query (из function call или финальной транскрипции).
2. Если нужно — нормализуем и очищаем текст (удаляем лишние символы).
3. Генерируем embedding через OpenAI embeddings endpoint (или Gemini embeddings).
4. Выполняем SQL-подобный поиск в Supabase/Postgres с использованием `embedding <-> stored_embedding` cosine similarity (pgvector):

   SELECT id, title, content, metadata, embedding <-> $1 AS distance
   FROM knowledge_base
   WHERE language = 'hy' /* если применимо */
   ORDER BY embedding <-> $1
   LIMIT 5;

5. Формируем контекст (k фрагментов) в заранее согласованном формате, коротко указывая source (title, doc id, offset).
6. Возвращаем этот контекст агенту (через backend proxy) как результат function call.

## Поддержка мультиязычности и армянского языка

- Для STT/TTS: убедиться в качестве используемых моделей (OpenAI/Gemini/спец. провайдеры для армянского). При плохом качестве STT — рассмотреть гибрид: локальная модель для STT + LLM для NLU.
- В metadata хранить language, и при поиске фильтровать по language.

## Тесты и валидация

- Unit: mock Supabase client, mock embeddings, проверить формат ответа `search_fsm_rag`.
- Integration: локальная сессия realtime (use ephemeral API keys) — прогнать сценарио: голос → транскрипт → function call → поиск → final response.
- QA: оценка релевантности RAG (precision@k), латентности end-to-end.

## Приоритеты и оценки (быстрая дорожная карта)

- MVP (0–7 дней):
  1. Создать `scripts/ingest_fsm_to_supabase.py` и проиндексировать пару документов (1–2 дня)
  2. Реализовать `rag_tool.py` для поиска по Supabase (1–2 дня)
  3. Добавить WebSocket proxy skeleton и минимальный RT adapter, который эмулирует flow без реального realtime API (1–2 дня)

- Production‑ready (7–21 дней):
  1. Полная интеграция с OpenAI Realtime и/или Gemini Live (2–5 дней)
  2. TTS pipeline и отправка аудио обратно на фронт (1–3 дня)
  3. Мониторинг, секреты, infra (1–3 дня)

## Риски и замечания

- Качество армянского STT/TTS — основной риск. Если OpenAI/Gemini не дают достаточного качества, потребуется поиск альтернатив (Vosk, WhisperX, коммерческие TTS).
- Latency: realtime+RAG требует быстрой векторной базы и продуманной логики, иначе UX пострадает.
- Cost: embeddings и realtime usage могут быть дорогими — добавить rate limits и кэширование.

## Следующие шаги (предлагаю выполнить сейчас)
1. Подтвердите, что хотите, чтобы я создал этот файл (готово) и далее — автоматически
   создал skeleton-версии следующих файлов в репозитории: `backend/voice_rag/rag_tool.py`, `backend/apps/voice_ws.py`, `scripts/ingest_fsm_to_supabase.py`, `frontend/components/VoiceRAGClient.tsx`.
2. Я создам и закоммичу каркасы файлов + пример `.env.example` и простой README для локального запуска.

Если согласны — напишите `да, создать skeleton` или `только doc`.

---
_Составил: автоматизированный помощник — план интеграции VoiceRAG на базе OpenAI/Gemini и Supabase._
