from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth.models import User as AuthUser
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Account, RecurringPayment, ServiceDictionary, Transaction, User


def make_dt(days_ago):
    d = date.today() - timedelta(days=days_ago)
    return timezone.make_aware(datetime.combine(d, datetime.min.time()))


ALL_SERVICES = [
    # Развлечения
    {'name': 'Яндекс Плюс',       'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'KION',               'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Netflix',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Spotify',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'START',              'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Самокат',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Wildberries',        'category': 'Подписки',    'is_mandatory': False},
    # IT / серверы
    {'name': 'VPS reg.ru',         'category': 'Серверы',     'is_mandatory': False},
    {'name': 'GitHub',             'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Figma',              'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Notion',             'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Домен .ru',          'category': 'Серверы',     'is_mandatory': False},
    # Кредиты
    {'name': 'Ипотека Сбербанк',   'category': 'Кредиты',     'is_mandatory': True},
    {'name': 'Автокредит ВТБ',     'category': 'Кредиты',     'is_mandatory': True},
    {'name': 'Кредит Тинькофф',    'category': 'Кредиты',     'is_mandatory': True},
    # ЖКХ и связь
    {'name': 'ЖКХ (Квартплата)',   'category': 'ЖКХ',         'is_mandatory': True},
    {'name': 'Электричество',      'category': 'ЖКХ',         'is_mandatory': True},
    {'name': 'Интернет Ростелеком','category': 'Связь',        'is_mandatory': False},
    {'name': 'Мобильная связь МТС','category': 'Связь',        'is_mandatory': False},
    # Финансы
    {'name': 'Обслуживание счёта', 'category': 'Финансы',     'is_mandatory': False},
    {'name': 'Страховка ОСАГО',    'category': 'Финансы',     'is_mandatory': True},
    {'name': 'Tinkoff Pro',        'category': 'Подписки',     'is_mandatory': False},
]

USERS_DATA = [
    {
        'username': 'user1',
        'first_name': 'Илья',
        'last_name': 'Кузнецов',
        'internal_id': 'user_1',
        'balance': Decimal('42300.00'),
        'smartdebit': True,
        'payments': [
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  3),
            ('Netflix',            Decimal('799.00'),   'active',  7),
            ('Мобильная связь МТС',Decimal('550.00'),   'active',  5),
            ('Интернет Ростелеком',Decimal('650.00'),   'active', 12),
        ],
        'transactions': [
            ('Яндекс Плюс',        Decimal('299.00'),  32),
            ('Яндекс Плюс',        Decimal('299.00'),  62),
            ('Netflix',            Decimal('799.00'),  33),
            ('Netflix',            Decimal('799.00'),  63),
            ('Мобильная связь МТС',Decimal('550.00'),  30),
            ('Мобильная связь МТС',Decimal('550.00'),  60),
            ('Интернет Ростелеком',Decimal('650.00'),  28),
            ('Интернет Ростелеком',Decimal('650.00'),  58),
        ],
    },
    {
        'username': 'user2',
        'first_name': 'Мария',
        'last_name': 'Смирнова',
        'internal_id': 'user_2',
        'balance': Decimal('18500.00'),
        'smartdebit': True,
        'payments': [
            ('Ипотека Сбербанк',   Decimal('52000.00'), 'active',  1),
            ('ЖКХ (Квартплата)',   Decimal('8400.00'),  'active',  4),
            ('Электричество',      Decimal('1200.00'),  'active',  6),
            ('Яндекс Плюс',        Decimal('299.00'),   'active', 10),
            ('Обслуживание счёта', Decimal('299.00'),   'active', 15),
        ],
        'transactions': [
            ('Ипотека Сбербанк',   Decimal('52000.00'), 31),
            ('Ипотека Сбербанк',   Decimal('52000.00'), 61),
            ('ЖКХ (Квартплата)',   Decimal('8400.00'),  29),
            ('ЖКХ (Квартплата)',   Decimal('8200.00'),  59),
            ('Электричество',      Decimal('1100.00'),  27),
            ('Электричество',      Decimal('1350.00'),  57),
            ('Яндекс Плюс',        Decimal('299.00'),   30),
            ('Обслуживание счёта', Decimal('299.00'),   28),
        ],
    },
    {
        'username': 'user3',
        'first_name': 'Алексей',
        'last_name': 'Орлов',
        'internal_id': 'user_3',
        'balance': Decimal('125000.00'),
        'smartdebit': True,
        'payments': [
            ('VPS reg.ru',         Decimal('890.00'),   'active',  2),
            ('GitHub',             Decimal('560.00'),   'active',  8),
            ('Figma',              Decimal('1200.00'),  'active', 11),
            ('Notion',             Decimal('480.00'),   'active', 14),
            ('Домен .ru',          Decimal('199.00'),   'active', 20),
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  5),
            ('Spotify',            Decimal('199.00'),   'active',  9),
        ],
        'transactions': [
            ('VPS reg.ru',         Decimal('890.00'),   30),
            ('VPS reg.ru',         Decimal('890.00'),   60),
            ('GitHub',             Decimal('560.00'),   31),
            ('GitHub',             Decimal('560.00'),   61),
            ('Figma',              Decimal('1200.00'),  32),
            ('Figma',              Decimal('1200.00'),  62),
            ('Notion',             Decimal('480.00'),   29),
            ('Spotify',            Decimal('199.00'),   28),
            ('Spotify',            Decimal('199.00'),   58),
            ('Яндекс Плюс',        Decimal('299.00'),   33),
        ],
    },
    {
        'username': 'user4',
        'first_name': 'Анна',
        'last_name': 'Воронова',
        'internal_id': 'user_4',
        'balance': Decimal('67800.00'),
        'smartdebit': True,
        'payments': [
            ('Ипотека Сбербанк',   Decimal('38000.00'), 'active',  1),
            ('ЖКХ (Квартплата)',   Decimal('9200.00'),  'active',  3),
            ('Электричество',      Decimal('1500.00'),  'active',  5),
            ('Интернет Ростелеком',Decimal('700.00'),   'active',  8),
            ('Мобильная связь МТС',Decimal('800.00'),   'active', 10),
            ('Яндекс Плюс',        Decimal('299.00'),   'active', 12),
            ('KION',               Decimal('499.00'),   'active', 16),
            ('Страховка ОСАГО',    Decimal('4200.00'),  'active', 25),
        ],
        'transactions': [
            ('Ипотека Сбербанк',   Decimal('38000.00'), 30),
            ('Ипотека Сбербанк',   Decimal('38000.00'), 60),
            ('ЖКХ (Квартплата)',   Decimal('9200.00'),  28),
            ('ЖКХ (Квартплата)',   Decimal('8900.00'),  58),
            ('Электричество',      Decimal('1450.00'),  26),
            ('Электричество',      Decimal('1600.00'),  56),
            ('Интернет Ростелеком',Decimal('700.00'),   29),
            ('Мобильная связь МТС',Decimal('800.00'),   27),
            ('Яндекс Плюс',        Decimal('299.00'),   31),
            ('KION',               Decimal('499.00'),   32),
        ],
    },
    {
        'username': 'user5',
        'first_name': 'Дмитрий',
        'last_name': 'Павлов',
        'internal_id': 'user_5',
        'balance': Decimal('4200.00'),
        'smartdebit': False,
        'payments': [
            ('Мобильная связь МТС',Decimal('300.00'),   'active',  5),
            ('Spotify',            Decimal('199.00'),   'active',  9),
            ('Яндекс Плюс',        Decimal('149.00'),   'active', 14),
        ],
        'transactions': [
            ('Мобильная связь МТС',Decimal('300.00'),   29),
            ('Мобильная связь МТС',Decimal('300.00'),   59),
            ('Spotify',            Decimal('199.00'),   31),
            ('Яндекс Плюс',        Decimal('149.00'),   28),
            ('Яндекс Плюс',        Decimal('149.00'),   58),
        ],
    },
    {
        'username': 'user6',
        'first_name': 'Елена',
        'last_name': 'Соколова',
        'internal_id': 'user_6',
        'balance': Decimal('89000.00'),
        'smartdebit': True,
        'payments': [
            ('Кредит Тинькофф',    Decimal('15000.00'), 'active',  2),
            ('Автокредит ВТБ',     Decimal('22000.00'), 'active',  4),
            ('VPS reg.ru',         Decimal('2400.00'),  'active',  6),
            ('Домен .ru',          Decimal('399.00'),   'active', 18),
            ('Tinkoff Pro',        Decimal('199.00'),   'active',  7),
            ('Обслуживание счёта', Decimal('599.00'),   'active', 13),
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  9),
        ],
        'transactions': [
            ('Кредит Тинькофф',    Decimal('15000.00'), 30),
            ('Кредит Тинькофф',    Decimal('15000.00'), 60),
            ('Автокредит ВТБ',     Decimal('22000.00'), 29),
            ('Автокредит ВТБ',     Decimal('22000.00'), 59),
            ('VPS reg.ru',         Decimal('2400.00'),  28),
            ('VPS reg.ru',         Decimal('2400.00'),  58),
            ('Tinkoff Pro',        Decimal('199.00'),   27),
            ('Обслуживание счёта', Decimal('599.00'),   26),
            ('Обслуживание счёта', Decimal('599.00'),   56),
            ('Яндекс Плюс',        Decimal('299.00'),   31),
        ],
    },
    {
        'username': 'user7',
        'first_name': 'Никита',
        'last_name': 'Фролов',
        'internal_id': 'user_7',
        'balance': Decimal('31500.00'),
        'smartdebit': True,
        'payments': [
            ('Автокредит ВТБ',     Decimal('18500.00'), 'active',  2),
            ('Страховка ОСАГО',    Decimal('5800.00'),  'active', 22),
            ('Мобильная связь МТС',Decimal('650.00'),   'active',  6),
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  9),
            ('START',              Decimal('399.00'),   'active', 13),
        ],
        'transactions': [
            ('Автокредит ВТБ',     Decimal('18500.00'), 31),
            ('Автокредит ВТБ',     Decimal('18500.00'), 61),
            ('Страховка ОСАГО',    Decimal('5800.00'),  45),
            ('Мобильная связь МТС',Decimal('650.00'),   29),
            ('Мобильная связь МТС',Decimal('650.00'),   59),
            ('Яндекс Плюс',        Decimal('299.00'),   30),
            ('START',              Decimal('399.00'),   28),
            ('START',              Decimal('399.00'),   58),
        ],
    },
    {
        'username': 'user8',
        'first_name': 'Ольга',
        'last_name': 'Романова',
        'internal_id': 'user_8',
        'balance': Decimal('11200.00'),
        'smartdebit': False,
        'payments': [
            ('ЖКХ (Квартплата)',   Decimal('6800.00'),  'active',  3),
            ('Электричество',      Decimal('900.00'),   'active',  6),
            ('Мобильная связь МТС',Decimal('350.00'),   'active',  8),
            ('Интернет Ростелеком',Decimal('500.00'),   'active', 11),
        ],
        'transactions': [
            ('ЖКХ (Квартплата)',   Decimal('6800.00'),  30),
            ('ЖКХ (Квартплата)',   Decimal('6600.00'),  60),
            ('Электричество',      Decimal('900.00'),   28),
            ('Электричество',      Decimal('850.00'),   58),
            ('Мобильная связь МТС',Decimal('350.00'),   27),
            ('Интернет Ростелеком',Decimal('500.00'),   29),
            ('Интернет Ростелеком',Decimal('500.00'),   59),
        ],
    },
    {
        'username': 'user9',
        'first_name': 'Сергей',
        'last_name': 'Лебедев',
        'internal_id': 'user_9',
        'balance': Decimal('58000.00'),
        'smartdebit': True,
        'payments': [
            ('Figma',              Decimal('1600.00'),  'active',  4),
            ('Домен .ru',          Decimal('249.00'),   'active', 17),
            ('VPS reg.ru',         Decimal('1200.00'),  'active',  6),
            ('Notion',             Decimal('480.00'),   'active', 10),
            ('Spotify',            Decimal('199.00'),   'active', 12),
            ('Мобильная связь МТС',Decimal('500.00'),   'active',  7),
            ('Обслуживание счёта', Decimal('299.00'),   'active', 19),
        ],
        'transactions': [
            ('Figma',              Decimal('1600.00'),  30),
            ('Figma',              Decimal('1600.00'),  60),
            ('VPS reg.ru',         Decimal('1200.00'),  29),
            ('VPS reg.ru',         Decimal('1200.00'),  59),
            ('Notion',             Decimal('480.00'),   28),
            ('Notion',             Decimal('480.00'),   58),
            ('Spotify',            Decimal('199.00'),   31),
            ('Домен .ru',          Decimal('249.00'),   45),
            ('Мобильная связь МТС',Decimal('500.00'),   27),
            ('Обслуживание счёта', Decimal('299.00'),   26),
        ],
    },
    {
        'username': 'user10',
        'first_name': 'Виктория',
        'last_name': 'Морозова',
        'internal_id': 'user_10',
        'balance': Decimal('1850.00'),
        'smartdebit': True,
        'payments': [
            ('Кредит Тинькофф',    Decimal('12000.00'), 'low_balance', 1),
            ('ЖКХ (Квартплата)',   Decimal('7500.00'),  'low_balance', 2),
            ('Мобильная связь МТС',Decimal('450.00'),   'active',      6),
            ('Яндекс Плюс',        Decimal('299.00'),   'frozen',     10),
        ],
        'transactions': [
            ('Кредит Тинькофф',    Decimal('12000.00'), 61),
            ('ЖКХ (Квартплата)',   Decimal('7500.00'),  60),
            ('Мобильная связь МТС',Decimal('450.00'),   29),
            ('Мобильная связь МТС',Decimal('450.00'),   59),
            ('Яндекс Плюс',        Decimal('299.00'),   58),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed 10 test users with realistic transaction history'

    def handle(self, *args, **kwargs):
        service_map = {}
        for s in ALL_SERVICES:
            obj, _ = ServiceDictionary.objects.get_or_create(
                name=s['name'],
                defaults={'category': s['category'], 'is_mandatory': s['is_mandatory']},
            )
            service_map[s['name']] = obj

        created_users = 0
        created_payments = 0
        created_tx = 0

        for data in USERS_DATA:
            auth_user, created = AuthUser.objects.get_or_create(username=data['username'])
            auth_user_updated = False

            if created or not auth_user.has_usable_password():
                auth_user.set_password(data['username'])
                auth_user_updated = True

            if auth_user.first_name != data.get('first_name', ''):
                auth_user.first_name = data.get('first_name', '')
                auth_user_updated = True

            if auth_user.last_name != data.get('last_name', ''):
                auth_user.last_name = data.get('last_name', '')
                auth_user_updated = True

            if auth_user_updated:
                auth_user.save()

            user, _ = User.objects.get_or_create(
                internal_id=data['internal_id'],
                defaults={
                    'is_smartdebit_enabled': data['smartdebit'],
                    'auth_user': auth_user,
                },
            )
            if user.auth_user is None:
                user.auth_user = auth_user
                user.save(update_fields=['auth_user'])

            if created:
                created_users += 1

            account, _ = Account.objects.get_or_create(
                user=user,
                defaults={'balance': data['balance'], 'currency': 'RUB'},
            )

            for service_name, amount, status, days_until in data['payments']:
                service = service_map[service_name]
                if not RecurringPayment.objects.filter(user=user, service=service).exists():
                    RecurringPayment.objects.create(
                        user=user,
                        service=service,
                        amount=amount,
                        status=status,
                        next_charge_date=date.today() + timedelta(days=days_until),
                    )
                    created_payments += 1

            for merchant, amount, days_ago in data['transactions']:
                tx_date = date.today() - timedelta(days=days_ago)
                if not Transaction.objects.filter(
                    account=account,
                    merchant_name=merchant,
                    amount=amount,
                    transaction_date__date=tx_date,
                ).exists():
                    Transaction.objects.create(
                        account=account,
                        merchant_name=merchant,
                        amount=amount,
                        transaction_date=make_dt(days_ago),
                        status='completed',
                    )
                    created_tx += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seed completed: users_created={created_users}, '
            f'payments_added={created_payments}, transactions_added={created_tx}'
        ))
        self.stdout.write(self.style.WARNING(
            'Logins: user1/user1 ... user10/user10'
        ))
