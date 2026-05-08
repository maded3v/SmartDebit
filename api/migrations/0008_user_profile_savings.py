# Путь: api/migrations/0008_user_profile_savings.py
from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_transaction_is_manual'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='user',
            name='email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),
        migrations.AddField(
            model_name='user',
            name='full_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='user',
            name='avatar_url',
            field=models.URLField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='account',
            name='savings_balance',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=12,
            ),
        ),
    ]
