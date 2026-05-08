from django.db import migrations, models


def add_is_manual_column_if_missing(apps, schema_editor):
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        columns = {
            column.name
            for column in connection.introspection.get_table_description(cursor, 'api_transaction')
        }

    if 'is_manual' in columns:
        return

    if connection.vendor == 'postgresql':
        schema_editor.execute(
            'ALTER TABLE api_transaction ADD COLUMN is_manual boolean NOT NULL DEFAULT false'
        )
        return

    if connection.vendor == 'sqlite':
        schema_editor.execute(
            'ALTER TABLE api_transaction ADD COLUMN is_manual bool NOT NULL DEFAULT 0'
        )
        return

    schema_editor.execute(
        'ALTER TABLE api_transaction ADD COLUMN is_manual boolean NOT NULL DEFAULT 0'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_recurringpayment_description'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_is_manual_column_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='transaction',
                    name='is_manual',
                    field=models.BooleanField(default=False),
                ),
            ],
        ),
    ]
