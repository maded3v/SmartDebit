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

По умолчанию backend использует PostgreSQL:

- `DB_ENGINE=django.db.backends.postgresql`
- `DB_NAME=smartdebit_db`
- `DB_USER=smartdebit_user`
- `DB_PASSWORD=smartdebit_password`
- `DB_HOST=localhost`
- `DB_PORT=5432`

Для локального запуска можно переключиться на SQLite:

```bash
set DB_ENGINE=django.db.backends.sqlite3
set DB_NAME=db.sqlite3
python manage.py migrate
python manage.py runserver
```

## Основные API endpoints

- `GET /api/v1/smartdebit/services/`
- `GET /api/v1/smartdebit/dashboard/`
- `POST /api/v1/smartdebit/toggle/`
- `GET /api/v1/payments/`
- `POST /api/v1/payments/`
- `PATCH /api/v1/payments/:id/`
- `POST /api/v1/payments/:id/pay`
