from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_recurringpayment_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='is_manual',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
