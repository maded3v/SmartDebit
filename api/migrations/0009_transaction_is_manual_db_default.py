# Путь: api/migrations/0009_transaction_is_manual_db_default.py
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Безопасная миграция для поля Transaction.is_manual.

    На проде (Postgres) колонка уже существует и помечена NOT NULL, но без
    DEFAULT на уровне БД. Из-за этого любые INSERT, в которых is_manual не
    передан явно, падали с NotNullViolation. Здесь мы:
      1) Накатываем db_default=False, чтобы Django генерировал
         ALTER TABLE ... ALTER COLUMN is_manual SET DEFAULT FALSE.
      2) Для существующих NULL-значений (если такие где-то остались
         в нестандартных средах) проставляем False через RunSQL.
    """

    dependencies = [
        ('api', '0008_user_profile_savings'),
    ]

    operations = [
        migrations.RunSQL(
            sql="UPDATE api_transaction SET is_manual = FALSE WHERE is_manual IS NULL;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name='transaction',
            name='is_manual',
            field=models.BooleanField(
                db_default=False,
                db_index=True,
                default=False,
            ),
        ),
    ]
