# SmartDebit Mock Service

Учебный прототип фичи SmartDebit для практики интеграции в интерфейс банка.

## Структура

- `frontend/` - React + TypeScript интерфейс.
- `mock-api/` - Express мок API с SQLite базой.
- `backend/db/schema.sql` - рабочая SQL-схема БД по ER-диаграмме проекта.
- `mock-api/db/bootstrap.js` - инициализация SQLite для dev-стенда.

## Быстрый старт

1. Запуск мок API:

```bash
cd mock-api
npm install
npm run dev
```

2. Запуск фронтенда (в новом терминале):

```bash
cd frontend
npm install
npm run dev
```

## Основные эндпоинты мок API

- `GET /api/v1/smartdebit/dashboard`
- `POST /api/v1/smartdebit/toggle`
- `POST /api/v1/smartdebit/payments`
- `PATCH /api/v1/smartdebit/payments/:paymentId/status`
- `POST /api/v1/smartdebit/payments/:paymentId/pay-debt`

## База данных

- Движок: SQLite (`backend/data/smartdebit.sqlite`).
- Инициализация и сидирование выполняются автоматически при запуске `mock-api`.
- В схему добавлено поле `provider_name` в `SERVICE_DICTIONARY` для корректного отображения провайдера в UI.
