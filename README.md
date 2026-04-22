# SmartDebit

Учебный проект с банковским интерфейсом и SmartDebit-флоу.

## Структура

- `frontend/` - React + TypeScript + Vite.
- `api/`, `smartdebit_core/`, `manage.py` - Django backend.
- `db/schema.sql` - SQL-схема данных.

## Быстрый старт

### 1) Backend (Django)

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
$env:DB_ENGINE="django.db.backends.sqlite3"
$env:DB_NAME="db.sqlite3"
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

Backend поднимется на `http://127.0.0.1:8000`.

### 2) Frontend

В новом терминале:

```bash
cd frontend
npm install
npm run dev
```

Frontend поднимется на `http://127.0.0.1:5173`.

Vite уже настроен с proxy `/api` -> `http://127.0.0.1:8000`.

## Конфиг БД

Рекомендуемый способ для прода и облака — `DATABASE_URL`.

- `DATABASE_URL=postgres://...` (Neon)
- `DB_SSL_REQUIRE=True` для облачной PostgreSQL

Если `DATABASE_URL` не задан, backend использует конфиг через отдельные переменные.

По умолчанию используется SQLite (без доп. настройки):

- `DB_ENGINE=django.db.backends.sqlite3`
- `DB_NAME=db.sqlite3`

Для PostgreSQL задайте:

- `DB_ENGINE=django.db.backends.postgresql`
- `DB_NAME=smartdebit_db`
- `DB_USER=smartdebit_user`
- `DB_PASSWORD=smartdebit_password`
- `DB_HOST=localhost`
- `DB_PORT=5432`

## Deploy: Vercel + Render + Neon

### 1) Neon (PostgreSQL)

- Создайте проект и базу в Neon.
- Скопируйте строку подключения `DATABASE_URL`.

### 2) Render (Backend)

- В репозитории уже есть `render.yaml`, можно деплоить через Blueprint.
- Создайте `Web Service` из этого репозитория.
- Build Command:

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

- Start Command:

```bash
python manage.py migrate && python manage.py seed_data && gunicorn smartdebit_core.wsgi:application
```

- Добавьте переменные окружения:
  - `DJANGO_SECRET_KEY`
  - `DJANGO_DEBUG=False`
  - `DATABASE_URL=<из Neon>`
  - `DB_SSL_REQUIRE=True`
  - `DJANGO_ALLOWED_HOSTS=<render-host>,api.<your-domain>`
  - `DJANGO_CORS_ALLOWED_ORIGINS=https://<vercel-host>,https://app.<your-domain>`
  - `DJANGO_CSRF_TRUSTED_ORIGINS=https://<vercel-host>,https://app.<your-domain>`

- Если используете Neon, обязательно задайте `DATABASE_URL` в Render env.
- Миграции и seed выполняются автоматически на старте сервиса.

### 3) Vercel (Frontend)

- Импортируйте проект `frontend/` в Vercel.
- Добавьте env:
  - `VITE_API_BASE_URL=https://<render-host>/api/v1`
  - `VITE_AUTH_PROVIDER=mock`

Примечание: backend пока не содержит `/auth/*` эндпоинты, поэтому для прод-демо нужен `mock` режим авторизации на фронте.

## Основные API endpoints

- `GET /api/v1/smartdebit/services/`
- `GET /api/v1/smartdebit/dashboard/`
- `POST /api/v1/smartdebit/toggle/`
- `GET /api/v1/payments/`
- `POST /api/v1/payments/`
- `PATCH /api/v1/payments/:id/`
- `POST /api/v1/payments/:id/pay`
