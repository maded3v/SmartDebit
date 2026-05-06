from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_user_auth_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='recurringpayment',
            name='description',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
