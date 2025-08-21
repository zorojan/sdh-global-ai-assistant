Ветка для деплоя в Vercel

Рекомендация
- Рекомендуется деплоить каждый сабпроект отдельно в Vercel:
  - `frontend/` (Vite static site)
  - `admin-panel/` (Next.js)
  - `backend/` — рекомендуется размещать отдельно (Render, Railway, VPS) или преобразовать в serverless API (перенести маршруты в `api/`) для Vercel.

Что добавлено в этой ветке
- `frontend/vercel.json` — статическая сборка для Vite (`dist`)
- `admin-panel/vercel.json` — стандартная конфигурация для Next.js
- `backend/vercel.json` — пример конфигурации функций Node.js (потребует адаптации: перевод роутов в `api/` или создание тонкого обёртки)
- `VERCEL-DEPLOY.md` — инструкция с шагами и переменными окружения

Шаги для деплоя (быстрая инструкция)
1. Войдите в Vercel и создайте новый проект (Import Git Repository).
2. Подключите репозиторий и выберите папку для проекта:
   - Для `frontend` укажите Root Directory = `frontend`
   - Для `admin-panel` укажите Root Directory = `admin-panel`
   - Для `backend` (если вы хотите пробовать serverless) укажите Root Directory = `backend` и адаптируйте код к `api/` структуре
3. В разделе Environment Variables добавьте секреты:
   - `GEMINI_API_KEY` — ключ для Gemini/Live API
   - `NODE_ENV` — production
   - Для backend: URL внешней БД или другой механизм хранения (SQLite не подходит на Vercel)
4. Для `frontend` и `admin-panel` Vercel автоматически выполнит сборку и деплой.

Примечания и ограничения
- SQLite (файл `database.sqlite`) не подходит для Vercel — используйте внешний managed DB (Postgres, MySQL) или разверните backend на платформе, где файловая система постоянна.
- Backend как Express сервер лучше размещать на Render/Railway/Heroku/VPS, либо переписать API в формате serverless (файлы в `api/`).
- Убедитесь, что все environment variables настроены в Vercel (особенно API-ключи).

Готов продолжить
- Могу создать PR из ветки `deploy/vercel` или сразу запушить её в origin и показать команды.
- Могу подготовить пример `api/` обёртки для `backend` чтобы он стал совместим с Vercel serverless.

Автор: автоматизированный помощник — добавьте свои правки в ветке перед мерджем.
