from django.core.management.base import BaseCommand
from api.models import Category, ServiceDictionary

class Command(BaseCommand):
    help = 'Fills Category and Service Dictionary'

    def handle(self, *args, **kwargs):
        categories = ['Развлечения', 'Кредиты', 'Кино', 'Подписки', 'ЖКХ']
        cat_map = {}
        for cat_name in categories:
            cat, _ = Category.objects.get_or_create(name=cat_name)
            cat_map[cat_name] = cat

        services = [
            {'name': 'Яндекс Плюс', 'category': 'Развлечения', 'is_mandatory': False},
            {'name': 'Ипотека Сбербанк', 'category': 'Кредиты', 'is_mandatory': True},
            {'name': 'KION', 'category': 'Кино', 'is_mandatory': False},
            {'name': 'Tinkoff Pro', 'category': 'Подписки', 'is_mandatory': False},
            {'name': 'ЖКХ (Квартплата)', 'category': 'ЖКХ', 'is_mandatory': True},
        ]

        for s in services:
            ServiceDictionary.objects.get_or_create(
                name=s['name'],
                defaults={
                    'category': cat_map[s['category']],
                    'is_mandatory': s['is_mandatory']
                }
            )
        self.stdout.write(self.style.SUCCESS('Categories and Services seeded successfully.'))