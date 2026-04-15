# SmartDebit Backend API

Backend для проекта SmartDebit — умный контроль подписок и регулярных платежей.

## Быстрый старт

### Требования
- Python 3.10+
- PostgreSQL 14+
- pip

### Установка

1. Создайте виртуальное окружение:
```bash
python -m venv venv
venv\Scripts\activate  # Windows

### Установите зависимости:
pip install django djangorestframework psycopg2-binary

### Примените миграции:
python manage.py migrate

### Заполните базу тестовыми данными:
python manage.py seed_data

### Запустите сервер:
python manage.py runserver

Сервер доступен по адресу: http://127.0.0.1:8000/



# Заполнить справочник сервисов
python manage.py seed_data

# Создать суперпользователя для админки
python manage.py createsuperuser

# Запустить тесты
python manage.py test api

# Админка Django
http://127.0.0.1:8000/admin/