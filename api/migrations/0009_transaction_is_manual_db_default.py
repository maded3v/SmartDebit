# Путь: api/migrations/0009_transaction_is_manual_db_default.py
from django.db import migrations, models


TRANSACTION_IS_MANUAL_INDEX = 'api_transaction_is_manual_9653a7ed'


def ensure_transaction_is_manual_defaults_and_index(apps, schema_editor):
    vendor = schema_editor.connection.vendor

    if vendor == 'postgresql':
        schema_editor.execute(
            'UPDATE api_transaction SET is_manual = FALSE WHERE is_manual IS NULL;'
        )
        schema_editor.execute(
            'ALTER TABLE api_transaction ALTER COLUMN is_manual SET DEFAULT FALSE;'
        )
        schema_editor.execute(
            f'CREATE INDEX IF NOT EXISTS {TRANSACTION_IS_MANUAL_INDEX} '
            'ON api_transaction (is_manual);'
        )
        return

    if vendor == 'sqlite':
        schema_editor.execute(
            'UPDATE api_transaction SET is_manual = 0 WHERE is_manual IS NULL;'
        )
        schema_editor.execute(
            f'CREATE INDEX IF NOT EXISTS {TRANSACTION_IS_MANUAL_INDEX} '
            'ON api_transaction (is_manual);'
        )
        return

    schema_editor.execute(
        f'CREATE INDEX IF NOT EXISTS {TRANSACTION_IS_MANUAL_INDEX} '
        'ON api_transaction (is_manual);'
    )


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
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    ensure_transaction_is_manual_defaults_and_index,
                    migrations.RunPython.noop,
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='transaction',
                    name='is_manual',
                    field=models.BooleanField(
                        db_default=False,
                        db_index=True,
                        default=False,
                    ),
                ),
            ],
        ),
    ]
