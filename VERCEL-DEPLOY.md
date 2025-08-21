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

Шаги для деплоя (рекомендованный, пошагово)

Вариант A (рекомендуемый): Frontend + Admin на Vercel, Backend на Render / Railway / VPS

1) Frontend (Vite)
   - В Vercel: New Project → Import Git Repository → укажите репозиторий `sdh-global-ai-assistant`.
   - При настройке проекта укажите Root Directory = `frontend`.
   - Build Command: `npm run build` (по умолчанию Vite), Output Directory: `dist`.
   - Add Environment Variables (Project Settings):
      - `GEMINI_API_KEY` = <your-key>
      - `API_URL` = https://your-backend.example.com (адрес бэкенда после деплоя)

2) Admin panel (Next.js)
   - Новый проект в Vercel, Root Directory = `admin-panel`.
   - Vercel автоматически обнаружит Next.js и настроит сборку.
   - Add Environment Variables (Project Settings):
      - `GEMINI_API_KEY` = <your-key>
      - `API_URL` = https://your-backend.example.com

3) Backend (Render / Railway / VPS) — причину: SQLite не подходит для Vercel
   - Рекомендация: разместить backend как отдельный сервис (Render, Railway, DigitalOcean App, Heroku) или как Docker контейнер.
   - Альтернатива: развернуть Postgres (Supabase/Neon) и оставить backend на Render/Railway.
   - Вариант быстрого запуска на Render:
      - Создайте новый Web Service → Connect repo → Root Directory = `backend`.
      - Build Command: `npm install && npm run build`
      - Start Command: `npm run start`
      - Add Environment Variables to Render/Provider:
         - `DATABASE_URL` = postgresql://user:pass@host:5432/dbname
         - `GEMINI_API_KEY` = <your-key>
         - `ADMIN_PASSWORD` = <initial-admin-password>

Вариант B (всё в Vercel, advanced): перевести backend в serverless (файлы в `backend/api/`)
   - Нужно переписать Express маршруты в Vercel serverless functions (api/). Я могу подготовить обёртку, но это требует рефакторинга.

Примечание про БД
   - На Vercel не храните `database.sqlite`. Используйте managed Postgres (Supabase, Neon).
   - Для миграций с Prisma: в окружении с `DATABASE_URL` выполните `npx prisma migrate deploy`.

Проверка локально перед деплоем
   - В локальной разработке можно использовать SQLite: убедитесь, что `backend/.env` содержит `DATABASE_URL=file:./database.sqlite`.
   - Выполните в папке `backend`:
      ```powershell
      $env:DATABASE_URL = "file:./database.sqlite"
      npx prisma db push
      npx prisma generate
      npm run dev
      ```

Установка секретов в Vercel
   - Откройте Project Settings → Environment Variables и добавьте:
      - `GEMINI_API_KEY` (Value, protected)
      - `DATABASE_URL` (для backend, если деплоите backend как serverless или используете Prisma in production)
      - `ADMIN_PASSWORD` (опционально)

Дополнительные файлы, добавленные в репозиторий
   - `backend/Dockerfile` — для хостинга backend в Docker-совместимых провайдерах.

Готов выполнить автоматизацию
   - Могу:
      - автоматически выполнить `prisma db push` локально и запустить сервер для проверки, либо
      - подготовить serverless-обёртку для Vercel и применить её в ветке `deploy/vercel`.


Примечания и ограничения
- SQLite (файл `database.sqlite`) не подходит для Vercel — используйте внешний managed DB (Postgres, MySQL) или разверните backend на платформе, где файловая система постоянна.
- Backend как Express сервер лучше размещать на Render/Railway/Heroku/VPS, либо переписать API в формате serverless (файлы в `api/`).
- Убедитесь, что все environment variables настроены в Vercel (особенно API-ключи).

Готов продолжить
- Могу создать PR из ветки `deploy/vercel` или сразу запушить её в origin и показать команды.
- Могу подготовить пример `api/` обёртки для `backend` чтобы он стал совместим с Vercel serverless.

Автор: автоматизированный помощник — добавьте свои правки в ветке перед мерджем.
