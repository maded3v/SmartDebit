from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand

from api.models import Account, RecurringPayment, ServiceDictionary, User


class Command(BaseCommand):
    help = 'Seed demo user, services, and recurring payments'

    def handle(self, *args, **kwargs):
        user, _ = User.objects.get_or_create(
            internal_id='user_1',
            defaults={'is_smartdebit_enabled': True},
        )

        if not user.is_smartdebit_enabled:
            user.is_smartdebit_enabled = True
            user.save(update_fields=['is_smartdebit_enabled'])

        Account.objects.get_or_create(
            user=user,
            defaults={'balance': Decimal('75430.50'), 'currency': 'RUB'},
        )

        services_seed = [
            {'name': 'Яндекс Плюс', 'category': 'Развлечения', 'is_mandatory': False},
            {'name': 'Ипотека Сбербанк', 'category': 'Кредиты', 'is_mandatory': True},
            {'name': 'KION', 'category': 'Кино', 'is_mandatory': False},
            {'name': 'Tinkoff Pro', 'category': 'Подписки', 'is_mandatory': False},
            {'name': 'ЖКХ (Квартплата)', 'category': 'ЖКХ', 'is_mandatory': True},
        ]

        service_by_name = {}
        for service_data in services_seed:
            service, _ = ServiceDictionary.objects.get_or_create(
                name=service_data['name'],
                defaults={
                    'category': service_data['category'],
                    'is_mandatory': service_data['is_mandatory'],
                },
            )
            service_by_name[service_data['name']] = service

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
        for payment_data in payments_seed:
            service = service_by_name[payment_data['service_name']]
            payment_exists = RecurringPayment.objects.filter(user=user, service=service).exists()
            if payment_exists:
                continue

            RecurringPayment.objects.create(
                user=user,
                service=service,
                amount=payment_data['amount'],
                status=payment_data['status'],
                next_charge_date=payment_data['next_charge_date'],
            )
            created_payments += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Seed completed: services={len(service_by_name)}, payments_added={created_payments}',
            ),
        )
