# SmartDebit Backend DB

Рабочая схема БД для backend находится в `backend/db/schema.sql`.

## Что добавлено относительно исходной диаграммы

- `SERVICE_DICTIONARY.provider_name` - поле для хранения провайдера сервиса в ответах API.
- Индексы на ключевые фильтры дашборда (`status`, `next_charge_date`, `created_at`).

## Текущее подключение в проекте

- `mock-api` использует эту же схему для локального dev-стенда.
- sqlite-файл создается в `backend/data/smartdebit.sqlite`.
