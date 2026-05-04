from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User as AuthUser
from django.core.management.base import BaseCommand

from api.models import Account, RecurringPayment, ServiceDictionary, Transaction, User


class Command(BaseCommand):
    help = 'Seed demo user, services, and recurring payments'

    def handle(self, *args, **kwargs):
        auth_user, created = AuthUser.objects.get_or_create(username='demo')
        if created or not auth_user.has_usable_password():
            auth_user.set_password('demo123')
            auth_user.save()

        user, _ = User.objects.get_or_create(
            internal_id='user_1',
            defaults={'is_smartdebit_enabled': True, 'auth_user': auth_user},
        )
        if user.auth_user is None:
            user.auth_user = auth_user
            user.save(update_fields=['auth_user'])
        if not user.is_smartdebit_enabled:
            user.is_smartdebit_enabled = True
            user.save(update_fields=['is_smartdebit_enabled'])

        account, _ = Account.objects.get_or_create(
            user=user,
            defaults={'balance': Decimal('75430.50'), 'currency': 'RUB'},
        )

        services_seed = [
            {'name': 'Яндекс Плюс', 'category': 'Развлечения', 'is_mandatory': False},
            {'name': 'Ипотека Сбербанк', 'category': 'Кредиты', 'is_mandatory': True},
            {'name': 'KION', 'category': 'Кино', 'is_mandatory': False},
            {'name': 'Tinkoff Pro', 'category': 'Подписки', 'is_mandatory': False},
            {'name': 'ЖКХ (Квартплата)', 'category': 'ЖКХ', 'is_mandatory': True},
            {'name': 'Самокат', 'category': 'Развлечения', 'is_mandatory': False},
            {'name': 'Wildberries', 'category': 'Подписки', 'is_mandatory': False},
        ]

        service_by_name = {}
        for s in services_seed:
            service, _ = ServiceDictionary.objects.get_or_create(
                name=s['name'],
                defaults={'category': s['category'], 'is_mandatory': s['is_mandatory']},
            )
            service_by_name[s['name']] = service

        payments_seed = [
            {
                'service_name': 'Ипотека Сбербанк',
                'amount': Decimal('45000.00'),
                'status': 'active',
                'next_charge_date': date.today() + timedelta(days=1),
            },
            {
                'service_name': 'Яндекс Плюс',
                'amount': Decimal('299.00'),
                'status': 'active',
                'next_charge_date': date.today() + timedelta(days=2),
            },
            {
                'service_name': 'KION',
                'amount': Decimal('499.00'),
                'status': 'low_balance',
                'next_charge_date': date.today() + timedelta(days=3),
            },
        ]

        created_payments = 0
        for p in payments_seed:
            service = service_by_name[p['service_name']]
            if not RecurringPayment.objects.filter(user=user, service=service).exists():
                RecurringPayment.objects.create(
                    user=user,
                    service=service,
                    amount=p['amount'],
                    status=p['status'],
                    next_charge_date=p['next_charge_date'],
                )
                created_payments += 1

        transactions_seed = [
            ('Яндекс Плюс', Decimal('299.00'), 30),
            ('Яндекс Плюс', Decimal('299.00'), 60),
            ('KION', Decimal('499.00'), 31),
            ('KION', Decimal('499.00'), 62),
            ('Самокат', Decimal('1250.00'), 28),
            ('Самокат', Decimal('1250.00'), 56),
            ('Wildberries', Decimal('3450.00'), 33),
            ('Wildberries', Decimal('3450.00'), 65),
        ]

        created_tx = 0
        for merchant, amount, days_ago in transactions_seed:
            tx_date = date.today() - timedelta(days=days_ago)
            if not Transaction.objects.filter(
                account=account, merchant_name=merchant, amount=amount,
            ).filter(transaction_date__date=tx_date).exists():
                from django.utils import timezone
                from datetime import datetime
                Transaction.objects.create(
                    account=account,
                    merchant_name=merchant,
                    amount=amount,
                    transaction_date=timezone.make_aware(
                        datetime.combine(tx_date, datetime.min.time())
                    ),
                    status='completed',
                )
                created_tx += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seed completed: services={len(service_by_name)}, '
            f'payments_added={created_payments}, transactions_added={created_tx}'
        ))
        self.stdout.write(self.style.WARNING('Demo credentials: login=demo, password=demo123'))
