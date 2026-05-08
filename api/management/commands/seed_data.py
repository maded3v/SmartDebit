import calendar
import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth.models import User as AuthUser
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Account, RecurringPayment, ServiceDictionary, Transaction, User


# Опорная дата истории операций. ВСЕ исторические транзакции считаются
# относительно неё (PIVOT_DATE - timedelta(days=N)), а НЕ от date.today().
# Это делает seed полностью идемпотентным: повторный запуск в другой день
# не порождает новые «копии» подписок на соседние числа. Дата выбрана
# так, чтобы рандомные ad-hoc операции естественно попадали в окно
# "1 апреля – 10 мая" (см. _RANDOM_DAYS_AGO_MIN / _MAX ниже).
PIVOT_DATE = date(2026, 5, 10)

# Окно «с апреля по 10 мая» относительно PIVOT_DATE.
# 0 дней назад -> 10 мая, 39 дней назад -> 1 апреля.
_RANDOM_DAYS_AGO_MIN = 0
_RANDOM_DAYS_AGO_MAX = 39
_HISTORY_WINDOW_START = PIVOT_DATE - timedelta(days=_RANDOM_DAYS_AGO_MAX)
_HISTORY_WINDOW_END = PIVOT_DATE


def _safe_date(year: int, month: int, day: int) -> date:
    """Защита от 31 февраля и т.п. — клампим день к последнему дню месяца."""
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def _add_months(d: date, months: int) -> date:
    """Сдвиг даты на ±N месяцев с сохранением дня месяца (с клампом)."""
    new_year = d.year
    new_month = d.month + months
    while new_month > 12:
        new_year += 1
        new_month -= 12
    while new_month < 1:
        new_year -= 1
        new_month += 12
    return _safe_date(new_year, new_month, d.day)


def _recurring_history_dates(days_until: int) -> list[date]:
    """Список дат «прошлых» списаний для месячной подписки.

    days_until — через сколько дней произойдёт *следующее* списание относительно
    PIVOT_DATE. Берём предыдущее списание (на месяц раньше) и шагаем назад
    по одному месяцу, пока попадаем в окно [PIVOT-39, PIVOT].

    Гарантия: ровно одна дата в каждом календарном месяце окна. Никаких
    «двойных» списаний на соседние числа.
    """
    pivot_next = PIVOT_DATE + timedelta(days=days_until)
    cursor = _add_months(pivot_next, -1)
    result: list[date] = []
    while cursor >= _HISTORY_WINDOW_START:
        if cursor <= _HISTORY_WINDOW_END:
            result.append(cursor)
        cursor = _add_months(cursor, -1)
    return result


def _make_dt(d: date, hour: int = 9, minute: int = 0, second: int = 0):
    """date -> aware datetime с явным временем суток. Время важно для
    стабильной сортировки нескольких транзакций одного дня (newest first)."""
    naive = datetime.combine(d, datetime.min.time()).replace(
        hour=hour, minute=minute, second=second
    )
    return timezone.make_aware(naive)


def make_dt(days_ago: int):
    """Старая форма: PIVOT_DATE - days_ago, время 09:00. Оставлена для совместимости."""
    return _make_dt(PIVOT_DATE - timedelta(days=days_ago))


def _twe(codepoints: str) -> str:
    """Twemoji 14 PNG, 72x72. Универсальные иконки для категорий без бренда."""
    return f'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/{codepoints}.png'


# Иконки по категориям (fallback для мерчантов без отдельного брендового лого).
CATEGORY_ICON_URLS = {
    'food':     _twe('1f37d'),  # 🍽
    'fastfood': _twe('1f32d'),  # 🌭
    'burger':   _twe('1f354'),  # 🍔
    'pizza':    _twe('1f355'),  # 🍕
    'coffee':   _twe('2615'),   # ☕
    'bakery':   _twe('1f956'),  # 🥖
    'grocery':  _twe('1f6d2'),  # 🛒
    'home':     _twe('1f3e0'),  # 🏠
    'shop':     _twe('1f6cd'),  # 🛍
    'clothes':  _twe('1f455'),  # 👕
    'kids':     _twe('1f476'),  # 👶
    'pet':      _twe('1f436'),  # 🐶
    'pharmacy': _twe('1f48a'),  # 💊
    'gas':      _twe('26fd'),   # ⛽
    'metro':    _twe('1f687'),  # 🚇
    'bus':      _twe('1f68c'),  # 🚌
    'taxi':     _twe('1f695'),  # 🚕
    'flowers':  _twe('1f490'),  # 💐
    'fitness':  _twe('1f3cb'),  # 🏋
    'beauty':   _twe('1f487'),  # 💇
    'health':   _twe('2695'),   # ⚕
    'vet':      _twe('1f43e'),  # 🐾
    'utility':  _twe('1f4a1'),  # 💡
    'market':   _twe('1f3ec'),  # 🏬
}


# Мерчанты для рандомной ad-hoc истории. Каждый кортеж:
#   (название, категория, (min ₽, max ₽), brand_icon_url | None)
# Если brand_icon_url не задан, используется иконка категории.
RANDOM_MERCHANTS = [
    # Кафе и рестораны (Краснодар)
    ('Угли-Угли',             'food',     (650, 1900),  None),
    ('Ryotei',                'food',     (1200, 4500), None),
    ('Катенька-Катюша',       'food',     (450, 1800),  None),
    ('Кубана Тоскана',        'food',     (550, 2200),  None),
    ('Баран-Рапан',           'food',     (480, 1900),  None),
    ('Mamai-Cafe',            'food',     (380, 1500),  None),
    ('Co-Co Chalet',          'food',     (420, 1700),  None),
    ('Red Fox',               'food',     (380, 1500),  None),
    ('Ave Bistro',            'food',     (450, 1800),  None),
    ('Мадьяр',                'food',     (520, 2100),  None),
    ('Соседи кафе',           'food',     (320, 980),   None),
    ('Cafe Krasnodar',        'food',     (350, 1400),  None),
    ('Любо-дорого',           'food',     (390, 1500),  None),
    ('Шашлык Юга',            'food',     (480, 2000),  None),
    ('Pho Bo',                'food',     (420, 980),   None),
    ('Омате',                 'food',     (480, 1600),  None),
    ('Матрона',               'food',     (380, 1500),  None),
    ('Pankiss',               'food',     (420, 1500),  None),
    ('MOST',                  'food',     (520, 1800),  None),
    ('Шаверма Bar',           'fastfood', (260, 520),   None),
    # Сетевой фастфуд
    ('McDonalds',             'burger',   (220, 750),   'https://cdn.simpleicons.org/mcdonalds/FFC72C'),
    ('Burger King',           'burger',   (250, 780),   'https://cdn.simpleicons.org/burgerking/D62300'),
    ('KFC',                   'burger',   (260, 850),   'https://cdn.simpleicons.org/kfc/F40027'),
    ('Subway',                'fastfood', (290, 690),   'https://cdn.simpleicons.org/subway/008C15'),
    ('Вкусно — и точка',      'burger',   (220, 740),   None),
    # Кофейни (Краснодар)
    ('Lubocoffee',            'coffee',   (160, 420),   None),
    ('Surf Coffee',           'coffee',   (180, 480),   None),
    ('Coffeeset',             'coffee',   (160, 360),   None),
    ('Сгущенка',              'coffee',   (140, 380),   None),
    ('Sunny cafe',            'coffee',   (180, 420),   None),
    ('Суворов 1433',          'coffee',   (180, 460),   None),
    ('Set / Сэт',             'coffee',   (160, 380),   None),
    ('Вэлкюм',                'coffee',   (150, 360),   None),
    ('Lokatsia Coffee',       'coffee',   (180, 420),   None),
    # Пекарни и кондитерские
    ('Графская выпечка',      'bakery',   (90, 480),    None),
    ('Ряженка',               'bakery',   (80, 420),    None),
    ('Сладкоежка',            'bakery',   (120, 580),   None),
    ('Чайкофф',               'coffee',   (180, 580),   None),
    # Продуктовые сети
    ('Магнит',                'grocery',  (180, 2200),  'https://logo.clearbit.com/magnit.ru'),
    ('Магнит у дома',         'grocery',  (180, 1800),  'https://logo.clearbit.com/magnit.ru'),
    ('Магнит Семейный',       'grocery',  (520, 4200),  'https://logo.clearbit.com/magnit.ru'),
    ('Магнит Косметик',       'shop',     (250, 1900),  'https://logo.clearbit.com/magnit.ru'),
    ('Пятёрочка',             'grocery',  (250, 2500),  'https://logo.clearbit.com/5ka.ru'),
    ('Лента',                 'grocery',  (520, 4500),  'https://logo.clearbit.com/lenta.com'),
    ("О'Кей",                 'grocery',  (480, 4100),  'https://logo.clearbit.com/okmarket.ru'),
    ('Metro Cash & Carry',    'grocery',  (820, 6800),  'https://logo.clearbit.com/metro-cc.ru'),
    ('Красный Яр',            'grocery',  (320, 2400),  None),
    ('Табрис',                'grocery',  (380, 2800),  None),
    # Гипермаркеты для дома
    ('Леруа Мерлен',          'home',     (450, 8500),  'https://logo.clearbit.com/leroymerlin.ru'),
    ('OBI',                   'home',     (520, 9200),  'https://cdn.simpleicons.org/obi/FF7900'),
    ('Бауцентр',              'home',     (380, 7800),  None),
    ('Castorama',             'home',     (480, 6500),  None),
    ('Hoff',                  'home',     (1500, 12000),'https://logo.clearbit.com/hoff.ru'),
    # Электроника
    ('М.Видео',               'shop',     (1900, 12000),'https://logo.clearbit.com/mvideo.ru'),
    ('Эльдорадо',             'shop',     (1500, 11000),'https://logo.clearbit.com/eldorado.ru'),
    ('DNS',                   'shop',     (1200, 9800), 'https://logo.clearbit.com/dns-shop.ru'),
    ('Media Markt',           'shop',     (1800, 11000),None),
    # Одежда и обувь
    ('Mustang',               'clothes',  (1200, 4500), None),
    ('Zolla',                 'clothes',  (520, 2900),  None),
    ('Funday',                'clothes',  (450, 2500),  None),
    ('Ostin',                 'clothes',  (650, 3200),  None),
    ('Твоё',                  'clothes',  (390, 1900),  None),
    ('Cotone',                'clothes',  (480, 2400),  None),
    ('Kari',                  'clothes',  (480, 2900),  None),
    ('Modis',                 'clothes',  (520, 2800),  None),
    ('Gloria Jeans',          'clothes',  (590, 3200),  None),
    ('H&M',                   'clothes',  (690, 4500),  'https://cdn.simpleicons.org/handm/E50010'),
    ('Nike',                  'clothes',  (1900, 9500), 'https://cdn.simpleicons.org/nike/000000'),
    ('Adidas',                'clothes',  (1700, 8900), 'https://cdn.simpleicons.org/adidas/000000'),
    ('Reebok',                'clothes',  (1500, 7200), 'https://cdn.simpleicons.org/reebok/E41E26'),
    ('Puma',                  'clothes',  (1600, 7800), 'https://cdn.simpleicons.org/puma/000000'),
    ('Columbia',              'clothes',  (2200, 11000),None),
    ('North Face',            'clothes',  (2400, 12500),None),
    # Детское
    ('Детский мир',           'kids',     (380, 3500),  'https://logo.clearbit.com/detmir.ru'),
    ('Дочки-Сыночки',         'kids',     (350, 2800),  None),
    ('Kari Kids',             'kids',     (290, 1900),  None),
    ('Всезнайка',             'kids',     (260, 1500),  None),
    ('Малыш',                 'kids',     (240, 1400),  None),
    ('Баю-Бай',               'kids',     (220, 1300),  None),
    # Зоо
    ('Барсик зоомагазин',     'pet',      (320, 1900),  None),
    ('Зоо-Сити',              'pet',      (290, 1700),  None),
    ('Флора и Фауна',         'pet',      (350, 2100),  None),
    ('Питомец',               'pet',      (310, 1800),  None),
    ('Zveruga.net',           'pet',      (380, 2400),  None),
    ('Айболит зоомагазин',    'pet',      (300, 1700),  None),
    # Аптеки
    ('Ригла',                 'pharmacy', (180, 1900),  None),
    ('Апрель',                'pharmacy', (190, 1700),  None),
    ('Радуга аптека',         'pharmacy', (170, 1500),  None),
    ('Аптека Валентина',      'pharmacy', (200, 1600),  None),
    ('Здравсити',             'pharmacy', (160, 1700),  None),
    ('Лаки-Фарма',            'pharmacy', (180, 1700),  None),
    # АЗС
    ('АЗС Роснефть',          'gas',      (1500, 3500), 'https://logo.clearbit.com/rosneft.ru'),
    ('АЗС Газпромнефть',      'gas',      (1700, 3800), 'https://logo.clearbit.com/gpnbonus.ru'),
    ('АЗС Лукойл',            'gas',      (1500, 3500), 'https://logo.clearbit.com/lukoil.ru'),
    ('АЗС Shell',             'gas',      (1700, 3700), 'https://cdn.simpleicons.org/shell/FFD500'),
    # Транспорт. ВАЖНО: «Метро» / «Автобус» (55-60 ₽) разрешены несколько раз
    # за день, это реально похоже на жизнь. Но никаких регулярных «пополнений
    # Тройки» — это (а) Москва, (б) визуально похоже на «месячный платёж», что
    # путало пользователя. См. также удаление «ЖКХ доплата» ниже.
    ('Метро',                 'metro',    (55, 55),     None),
    ('Автобус',               'bus',      (55, 60),     None),
    ('Делимобиль',            'taxi',     (250, 1900),  None),
    ('BelkaCar',              'taxi',     (220, 1500),  None),
    ('Яндекс Go',             'taxi',     (180, 950),   'https://cdn.simpleicons.org/yandex/FFCC00'),
    ('Ситимобил',             'taxi',     (180, 980),   None),
    ('Maxim такси',           'taxi',     (160, 850),   None),
    # ТЦ и рынки
    ('ТРК Красная Площадь',   'market',   (480, 4500),  None),
    ('Галерея Краснодар',     'market',   (520, 4200),  None),
    ('OZ MALL',               'market',   (450, 3800),  None),
    ('ТРЦ Галактика',         'market',   (390, 3400),  None),
    ('ТРЦ Центр Города',      'market',   (350, 3100),  None),
    ('СБС Мегацентр',         'market',   (380, 3400),  None),
    ('Центральный рынок',     'grocery',  (250, 2200),  None),
    ('Сенной рынок',          'grocery',  (220, 1800),  None),
    ('Восточный рынок',       'grocery',  (250, 1600),  None),
    ('Рынок Вишняки',         'grocery',  (220, 1700),  None),
    # Цветы
    ('Green Garden',          'flowers',  (480, 3500),  None),
    ('Topflora',              'flowers',  (550, 3200),  None),
    ('Лейка',                 'flowers',  (450, 2500),  None),
    ('Аленький цветочек',     'flowers',  (380, 2000),  None),
    # Спорт и фитнес
    ('Orange Fitness',        'fitness',  (1500, 4500), None),
    ('X-FIT',                 'fitness',  (1900, 5500), None),
    ('Light Fit',             'fitness',  (1200, 3800), None),
    ('Territory of Fitness',  'fitness',  (1300, 4200), None),
    ('Megafitness',           'fitness',  (1100, 3500), None),
    ('Alex Fitness',          'fitness',  (1400, 4500), None),
    ('Seven Fitness',         'fitness',  (1300, 4200), None),
    ('Спортмастер',           'shop',     (980, 5400),  'https://logo.clearbit.com/sportmaster.ru'),
    # Красота
    ('Седьмое небо салон',    'beauty',   (1200, 3800), None),
    ('СемьЯ салон',           'beauty',   (1100, 3500), None),
    ('Вельвет',               'beauty',   (1300, 4200), None),
    ('Aliers',                'beauty',   (950, 3200),  None),
    ('Paul Mitchell',         'beauty',   (1900, 6500), None),
    ('Brow How?!',            'beauty',   (450, 2200),  None),
    # Медицина
    ('Клиника №1',            'health',   (980, 5500),  None),
    ('Будь Здоров',           'health',   (850, 4800),  None),
    ('Евромед',               'health',   (1100, 6500), None),
    ('City Clinic',           'health',   (1200, 7000), None),
    ('ККБ СМП',               'health',   (650, 3500),  None),
    ('ГБ №2',                 'health',   (450, 2500),  None),
    ('Детская краевая больница','health', (520, 3200),  None),
    # Ветеринария
    ('Dr.Vet',                'vet',      (650, 3500),  None),
    ('КЗВС',                  'vet',      (520, 2800),  None),
    # Маркетплейсы и книги
    ('Ozon',                  'shop',     (450, 4900),  'https://logo.clearbit.com/ozon.ru'),
    ('Wildberries',           'shop',     (390, 3800),  'https://logo.clearbit.com/wildberries.ru'),
    ('Яндекс Маркет',         'shop',     (520, 4200),  'https://cdn.simpleicons.org/yandex/FFCC00'),
    ('Читай-город',           'shop',     (320, 1500),  None),
    # Бытовое. ЖКХ-подобные платежи (квартплата, электричество, доплата за
    # коммуналку) НЕ в этом списке: они идут только через регулярные подписки
    # (RecurringPayment). Это исключает ситуацию, когда «ЖКХ» дважды появляется
    # в одном календарном месяце у одного пользователя.
    ('Химчистка',             'shop',     (350, 1100),  None),
]


def random_merchant_icon(merchant_name: str, category: str, brand_icon: str | None) -> str:
    if brand_icon:
        return brand_icon
    return CATEGORY_ICON_URLS.get(category, '')


def random_transactions_for_user(seed_key: str, count: int, exclude_merchants=None):
    """Детерминированный список (мерчант, сумма, days_ago, hour, minute).

    days_ago всегда лежит в окне [_RANDOM_DAYS_AGO_MIN, _RANDOM_DAYS_AGO_MAX],
    что соответствует периоду «1 апреля – 10 мая» относительно PIVOT_DATE.
    RNG сидируется логином, поэтому повторный запуск seed_data даёт ровно
    тот же набор и не плодит дубли.

    Дедуп: пара (merchant, days_ago) не повторяется в выдаче — это исключает
    «два одинаковых списания за один день». Также мерчанты из exclude_merchants
    (обычно — названия регулярных подписок пользователя) пропускаются, чтобы
    случайный «Магнит» не наложился на регулярную «Магнит-подписку».
    """
    rng = random.Random(seed_key)
    avoid = set(exclude_merchants or [])
    used_pairs: set[tuple[str, int]] = set()
    txs: list[tuple[str, Decimal, int, int, int]] = []
    attempts = 0
    max_attempts = count * 30
    while len(txs) < count and attempts < max_attempts:
        attempts += 1
        merchant, _category, (lo, hi), _brand = rng.choice(RANDOM_MERCHANTS)
        if merchant in avoid:
            continue
        days_ago = rng.randint(_RANDOM_DAYS_AGO_MIN, _RANDOM_DAYS_AGO_MAX)
        key = (merchant, days_ago)
        if key in used_pairs:
            continue
        used_pairs.add(key)
        if lo == hi:
            amount = Decimal(lo)
        else:
            value = rng.randint(lo, hi)
            value = (value // 10) * 10  # шаг 10₽
            if rng.random() < 0.25:
                value += rng.choice([0.50, 0.99, 0.30, 0.70])
            amount = Decimal(str(value))
        hour = rng.randint(8, 22)
        minute = rng.randint(0, 59)
        txs.append((merchant, amount, days_ago, hour, minute))
    return txs


# Иконки магазинов / сервисов. Используем публичные CDN, не требующие ключа:
#   https://cdn.simpleicons.org/<slug>/<HEX>      Цветные SVG иконки
#   https://logo.clearbit.com/<domain>            Фавиконы компаний
# Для сервисов без устойчивого бренд логотипа (ЖКХ, электричество, ОСАГО)
# оставляем пустую строку, фронтенд покажет дефолтную плашку.
def _si(slug, hex_color):
    return f'https://cdn.simpleicons.org/{slug}/{hex_color}'


def _cb(domain):
    return f'https://logo.clearbit.com/{domain}'


SERVICE_ICON_URLS = {
    # Развлечения / стриминг
    'Яндекс Плюс':         _si('yandex', 'FFCC00'),
    'KION':                _cb('kion.ru'),
    'Netflix':             _si('netflix', 'E50914'),
    'Spotify':             _si('spotify', '1DB954'),
    'START':               _cb('start.ru'),
    'Самокат':             _cb('samokat.ru'),
    'Wildberries':         _cb('wildberries.ru'),
    'Apple Music':         _si('applemusic', 'FA243C'),
    'Amazon Prime':        _si('amazon', 'FF9900'),
    'Xbox Game Pass':      _si('xbox', '107C10'),
    'PlayStation Plus':    _si('playstation', '003791'),
    'YouTube Premium':     _si('youtube', 'FF0000'),
    # IT / cloud
    'VPS reg.ru':          _cb('reg.ru'),
    'GitHub':              _si('github', '181717'),
    'Figma':               _si('figma', 'F24E1E'),
    'Notion':              _si('notion', '000000'),
    'Домен .ru':           _cb('reg.ru'),
    'Dropbox':             _si('dropbox', '0061FF'),
    'iCloud+':             _si('icloud', '3693F3'),
    'Google One':          _si('googleone', '4285F4'),
    # Доставка / транспорт
    'Glovo':               _cb('glovoapp.com'),
    'Uber One':            _si('uber', '000000'),
    'Яндекс Go Plus':      _si('yandex', 'FFCC00'),
    # Спорт / здоровье
    'World Class':         _cb('worldclass.ru'),
    # Кредиты
    'Ипотека Сбербанк':    _cb('sberbank.ru'),
    'Автокредит ВТБ':      _cb('vtb.ru'),
    'Кредит Тинькофф':     _cb('tinkoff.ru'),
    # Без устойчивого брендового логотипа, оставляем пустыми, fallback на фронте.
    'ЖКХ (Квартплата)':    '',
    'Электричество':       '',
    'Страховка ОСАГО':     '',
    # Связь / финансы
    'Интернет Ростелеком': _cb('rt.ru'),
    'Мобильная связь МТС': _cb('mts.ru'),
    'Обслуживание счёта':  _cb('tinkoff.ru'),
    'Tinkoff Pro':         _cb('tinkoff.ru'),
}


ALL_SERVICES = [
    # Развлечения
    {'name': 'Яндекс Плюс',       'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'KION',               'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Netflix',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Spotify',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'START',              'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Самокат',            'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'Wildberries',        'category': 'Подписки',    'is_mandatory': False},
    {'name': 'Apple Music',        'category': 'Подписки',    'is_mandatory': False},
    {'name': 'Amazon Prime',       'category': 'Подписки',    'is_mandatory': False},
    {'name': 'Xbox Game Pass',     'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'PlayStation Plus',   'category': 'Развлечения', 'is_mandatory': False},
    {'name': 'YouTube Premium',    'category': 'Подписки',    'is_mandatory': False},
    # IT / серверы / облако
    {'name': 'VPS reg.ru',         'category': 'Серверы',     'is_mandatory': False},
    {'name': 'GitHub',             'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Figma',              'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Notion',             'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Домен .ru',          'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Dropbox',            'category': 'Серверы',     'is_mandatory': False},
    {'name': 'iCloud+',            'category': 'Серверы',     'is_mandatory': False},
    {'name': 'Google One',         'category': 'Серверы',     'is_mandatory': False},
    # Доставка / транспорт
    {'name': 'Glovo',              'category': 'Подписки',    'is_mandatory': False},
    {'name': 'Uber One',           'category': 'Подписки',    'is_mandatory': False},
    {'name': 'Яндекс Go Plus',     'category': 'Подписки',    'is_mandatory': False},
    # Спорт / здоровье
    {'name': 'World Class',        'category': 'Подписки',    'is_mandatory': False},
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


# Дополнительные регулярные подписки, которые добавляются каждому из user1..user10
# поверх основной истории. Все суммы в ₽, периодичность — ежемесячно (используется
# единый next_charge_date в ближайшие 30 дней). Дублирование исключается через
# проверку RecurringPayment.objects.filter(user=user, service=service).exists()
# в основном цикле seed_data.
EXTRA_SUBSCRIPTIONS_PER_USER = {
    'user_1': [
        ('Apple Music',     Decimal('299.00'),  18),
        ('YouTube Premium', Decimal('399.00'),  22),
        ('Dropbox',         Decimal('990.00'),  26),
    ],
    'user_2': [
        ('Glovo',           Decimal('249.00'),   8),
        ('iCloud+',         Decimal('199.00'),  17),
        ('YouTube Premium', Decimal('399.00'),  24),
    ],
    'user_3': [
        ('Amazon Prime',    Decimal('599.00'),  16),
        ('Apple Music',     Decimal('299.00'),  21),
        ('Google One',      Decimal('229.00'),  27),
    ],
    'user_4': [
        ('Apple Music',     Decimal('299.00'),  19),
        ('Glovo',           Decimal('249.00'),  23),
        ('iCloud+',         Decimal('199.00'),  28),
    ],
    'user_5': [
        ('YouTube Premium', Decimal('399.00'),  17),
        ('iCloud+',         Decimal('199.00'),  21),
        ('Apple Music',     Decimal('299.00'),  24),
        ('World Class',     Decimal('2990.00'), 28),
    ],
    'user_6': [
        ('Amazon Prime',    Decimal('599.00'),  15),
        ('Dropbox',         Decimal('990.00'),  20),
        ('Xbox Game Pass',  Decimal('499.00'),  25),
    ],
    'user_7': [
        ('PlayStation Plus',Decimal('799.00'),  16),
        ('Apple Music',     Decimal('299.00'),  19),
        ('Google One',      Decimal('229.00'),  23),
    ],
    'user_8': [
        ('Glovo',           Decimal('249.00'),  14),
        ('iCloud+',         Decimal('199.00'),  18),
        ('YouTube Premium', Decimal('399.00'),  22),
    ],
    'user_9': [
        ('GitHub',          Decimal('560.00'),  20),  # уже есть у user3, но не у user9
        ('Apple Music',     Decimal('299.00'),  24),
        ('Uber One',        Decimal('349.00'),  27),
    ],
    'user_10': [
        ('Apple Music',     Decimal('299.00'),  15),
        ('Spotify',         Decimal('199.00'),  20),
        ('YouTube Premium', Decimal('399.00'),  25),
    ],
}

USERS_DATA = [
    {
        'username': 'user1',
        'first_name': 'Илья',
        'last_name': 'Кузнецов',
        'internal_id': 'user_1',
        'balance': Decimal('42300.00'),
        'savings_balance': Decimal('128450.30'),
        'phone': '+7 916 234-15-08',
        'email': 'ilya.kuznetsov@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/men/12.jpg',
        'smartdebit': True,
        'payments': [
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  3),
            ('Netflix',            Decimal('799.00'),   'active',  7),
            ('Мобильная связь МТС',Decimal('550.00'),   'active',  5),
            ('Интернет Ростелеком',Decimal('650.00'),   'active', 12),
        ],
    },
    {
        'username': 'user2',
        'first_name': 'Мария',
        'last_name': 'Смирнова',
        'internal_id': 'user_2',
        'balance': Decimal('18500.00'),
        'savings_balance': Decimal('57890.12'),
        'phone': '+7 925 117-44-21',
        'email': 'maria.smirnova@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/women/45.jpg',
        'smartdebit': True,
        'payments': [
            ('Ипотека Сбербанк',   Decimal('52000.00'), 'active',  1),
            ('ЖКХ (Квартплата)',   Decimal('8400.00'),  'active',  4),
            ('Электричество',      Decimal('1200.00'),  'active',  6),
            ('Яндекс Плюс',        Decimal('299.00'),   'active', 10),
            ('Обслуживание счёта', Decimal('299.00'),   'active', 15),
        ],
    },
    {
        'username': 'user3',
        'first_name': 'Алексей',
        'last_name': 'Орлов',
        'internal_id': 'user_3',
        'balance': Decimal('125000.00'),
        'savings_balance': Decimal('412300.85'),
        'phone': '+7 903 552-08-77',
        'email': 'alexey.orlov@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/men/32.jpg',
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
    },
    {
        'username': 'user4',
        'first_name': 'Анна',
        'last_name': 'Воронова',
        'internal_id': 'user_4',
        'balance': Decimal('67800.00'),
        'savings_balance': Decimal('215680.00'),
        'phone': '+7 912 663-91-04',
        'email': 'anna.voronova@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/women/68.jpg',
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
    },
    {
        'username': 'user5',
        'first_name': 'Дмитрий',
        'last_name': 'Павлов',
        'internal_id': 'user_5',
        'balance': Decimal('4200.00'),
        'savings_balance': Decimal('14290.67'),
        'phone': '+7 977 880-12-65',
        'email': 'dmitry.pavlov@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/men/53.jpg',
        'smartdebit': False,
        'payments': [
            ('Мобильная связь МТС',Decimal('300.00'),   'active',  5),
            ('Spotify',            Decimal('199.00'),   'active',  9),
            ('Яндекс Плюс',        Decimal('149.00'),   'active', 14),
        ],
    },
    {
        'username': 'user6',
        'first_name': 'Елена',
        'last_name': 'Соколова',
        'internal_id': 'user_6',
        'balance': Decimal('89000.00'),
        'savings_balance': Decimal('305120.40'),
        'phone': '+7 964 405-37-88',
        'email': 'elena.sokolova@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/women/22.jpg',
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
    },
    {
        'username': 'user7',
        'first_name': 'Никита',
        'last_name': 'Фролов',
        'internal_id': 'user_7',
        'balance': Decimal('31500.00'),
        'savings_balance': Decimal('98760.55'),
        'phone': '+7 906 712-50-43',
        'email': 'nikita.frolov@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/men/76.jpg',
        'smartdebit': True,
        'payments': [
            ('Автокредит ВТБ',     Decimal('18500.00'), 'active',  2),
            ('Страховка ОСАГО',    Decimal('5800.00'),  'active', 22),
            ('Мобильная связь МТС',Decimal('650.00'),   'active',  6),
            ('Яндекс Плюс',        Decimal('299.00'),   'active',  9),
            ('START',              Decimal('399.00'),   'active', 13),
        ],
    },
    {
        'username': 'user8',
        'first_name': 'Ольга',
        'last_name': 'Романова',
        'internal_id': 'user_8',
        'balance': Decimal('11200.00'),
        'savings_balance': Decimal('33450.10'),
        'phone': '+7 985 326-09-58',
        'email': 'olga.romanova@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/women/85.jpg',
        'smartdebit': False,
        'payments': [
            ('ЖКХ (Квартплата)',   Decimal('6800.00'),  'active',  3),
            ('Электричество',      Decimal('900.00'),   'active',  6),
            ('Мобильная связь МТС',Decimal('350.00'),   'active',  8),
            ('Интернет Ростелеком',Decimal('500.00'),   'active', 11),
        ],
    },
    {
        'username': 'user9',
        'first_name': 'Сергей',
        'last_name': 'Лебедев',
        'internal_id': 'user_9',
        'balance': Decimal('58000.00'),
        'savings_balance': Decimal('184500.00'),
        'phone': '+7 921 049-86-13',
        'email': 'sergey.lebedev@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/men/64.jpg',
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
    },
    {
        'username': 'user10',
        'first_name': 'Виктория',
        'last_name': 'Морозова',
        'internal_id': 'user_10',
        'balance': Decimal('1850.00'),
        'savings_balance': Decimal('9009.42'),
        'phone': '+7 968 770-31-29',
        'email': 'victoria.morozova@example.com',
        'avatar_url': 'https://randomuser.me/api/portraits/women/14.jpg',
        'smartdebit': True,
        'payments': [
            ('Кредит Тинькофф',    Decimal('12000.00'), 'low_balance', 1),
            ('ЖКХ (Квартплата)',   Decimal('7500.00'),  'low_balance', 2),
            ('Мобильная связь МТС',Decimal('450.00'),   'active',      6),
            ('Яндекс Плюс',        Decimal('299.00'),   'frozen',     10),
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
                defaults={
                    'category': s['category'],
                    'is_mandatory': s['is_mandatory'],
                    'icon_url': SERVICE_ICON_URLS.get(s['name'], ''),
                },
            )
            # Догружаем icon_url для уже существующих записей, если в нашем
            # справочнике появилась/изменилась ссылка.
            desired_icon = SERVICE_ICON_URLS.get(s['name'], '')
            if desired_icon and obj.icon_url != desired_icon:
                obj.icon_url = desired_icon
                obj.save(update_fields=['icon_url'])
            service_map[s['name']] = obj

        # Регистрируем мерчантов из RANDOM_MERCHANTS в справочнике с иконками.
        # Это позволяет фронту тянуть icon_url через ServiceDictionary join
        # в /api/transactions/, как и для подписочных операций.
        for name, category, _amount_range, brand_icon in RANDOM_MERCHANTS:
            desired_icon = random_merchant_icon(name, category, brand_icon)
            obj, _ = ServiceDictionary.objects.get_or_create(
                name=name,
                defaults={
                    'category': category,
                    'is_mandatory': False,
                    'icon_url': desired_icon,
                },
            )
            if desired_icon and obj.icon_url != desired_icon:
                obj.icon_url = desired_icon
                obj.save(update_fields=['icon_url'])

        created_users = 0
        created_payments = 0
        created_tx = 0
        wiped_tx = 0

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

            desired_email = data.get('email', '')
            if desired_email and auth_user.email != desired_email:
                auth_user.email = desired_email
                auth_user_updated = True

            if auth_user_updated:
                auth_user.save()

            full_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()

            user, _ = User.objects.get_or_create(
                internal_id=data['internal_id'],
                defaults={
                    'is_smartdebit_enabled': data['smartdebit'],
                    'auth_user': auth_user,
                    'phone': data.get('phone', ''),
                    'email': data.get('email', ''),
                    'full_name': full_name,
                    'avatar_url': data.get('avatar_url', ''),
                },
            )

            user_updated_fields = []
            if user.auth_user is None:
                user.auth_user = auth_user
                user_updated_fields.append('auth_user')
            if user.phone != data.get('phone', ''):
                user.phone = data.get('phone', '')
                user_updated_fields.append('phone')
            if user.email != data.get('email', ''):
                user.email = data.get('email', '')
                user_updated_fields.append('email')
            if user.full_name != full_name:
                user.full_name = full_name
                user_updated_fields.append('full_name')
            if user.avatar_url != data.get('avatar_url', ''):
                user.avatar_url = data.get('avatar_url', '')
                user_updated_fields.append('avatar_url')
            if user_updated_fields:
                user.save(update_fields=user_updated_fields)

            if created:
                created_users += 1

            account, account_created = Account.objects.get_or_create(
                user=user,
                defaults={
                    'balance': data['balance'],
                    'currency': 'RUB',
                    'savings_balance': data.get('savings_balance', Decimal('0.00')),
                },
            )

            desired_savings = data.get('savings_balance', Decimal('0.00'))
            if not account_created and account.savings_balance != desired_savings:
                account.savings_balance = desired_savings
                account.save(update_fields=['savings_balance'])

            # Перед перезаливкой авто-транзакций (recurring history + рандом)
            # вытираем предыдущие seed-операции, чтобы исправить уже накопившиеся
            # дубли (раньше повторный запуск seed_data в другой день создавал
            # вторую копию подписки на соседнее число). Ручные операции
            # (is_manual=True) НЕ трогаем — это пользовательские записи.
            removed = Transaction.objects.filter(account=account, is_manual=False).delete()
            wiped_tx += removed[0] or 0

            # Собираем все подписки пользователя в одном списке. Из этого же
            # списка генерируем историю списаний — ровно одна запись в каждом
            # календарном месяце окна [PIVOT-39, PIVOT]. Никаких ручных
            # «двойников» в data['transactions'] больше нет.
            user_subscriptions: list[tuple[str, Decimal, str, int]] = []
            for service_name, amount, payment_status, days_until in data['payments']:
                user_subscriptions.append(
                    (service_name, amount, payment_status, days_until)
                )
            for service_name, amount, days_until in EXTRA_SUBSCRIPTIONS_PER_USER.get(
                data['internal_id'], []
            ):
                user_subscriptions.append(
                    (service_name, amount, 'active', days_until)
                )

            for service_name, amount, payment_status, days_until in user_subscriptions:
                service = service_map.get(service_name)
                if not service:
                    continue
                if not RecurringPayment.objects.filter(user=user, service=service).exists():
                    RecurringPayment.objects.create(
                        user=user,
                        service=service,
                        amount=amount,
                        status=payment_status,
                        next_charge_date=date.today() + timedelta(days=days_until),
                    )
                    created_payments += 1

            # Регулярная история (подписки/кредиты/связь): авто-генерируется из
            # списка подписок пользователя. Для каждой подписки получаем список
            # дат прошлых списаний (не более одного раза в месяц) и пишем
            # ровно одну транзакцию на каждое попавшее в окно число.
            # 'frozen' и 'cancelled' исключаются — они не списываются.
            recurring_merchant_names: set[str] = set()
            for service_name, amount, payment_status, days_until in user_subscriptions:
                if payment_status in ('frozen', 'cancelled'):
                    continue
                recurring_merchant_names.add(service_name)
                # Время суток для подписок: 09:00 + смещение по hash имени, чтобы
                # 5 подписок одного дня не лепились в одну минуту.
                base_minute = (sum(ord(c) for c in service_name) * 7) % 50
                for tx_date in _recurring_history_dates(days_until):
                    Transaction.objects.create(
                        account=account,
                        merchant_name=service_name,
                        amount=amount,
                        transaction_date=_make_dt(
                            tx_date,
                            hour=9,
                            minute=base_minute,
                        ),
                        status='completed',
                        is_manual=False,
                    )
                    created_tx += 1

            # Ad-hoc история «1 апреля – 10 мая»: выпечка, транспорт (55₽),
            # столовые, ЖКХ, аптеки, заправки, маркетплейсы и краснодарские
            # локальные заведения. RNG сидируется логином, поэтому набор
            # стабилен между запусками. Дедуп по (мерчант, день) и исключение
            # имён регулярных подписок чтобы не плодить пересечения.
            random_count = 120
            for merchant, amount, days_ago, hour, minute in random_transactions_for_user(
                seed_key=data['username'],
                count=random_count,
                exclude_merchants=recurring_merchant_names,
            ):
                tx_date = PIVOT_DATE - timedelta(days=days_ago)
                Transaction.objects.create(
                    account=account,
                    merchant_name=merchant,
                    amount=amount,
                    transaction_date=_make_dt(tx_date, hour=hour, minute=minute),
                    status='completed',
                    is_manual=False,
                )
                created_tx += 1

        self.stdout.write(self.style.SUCCESS(
            f'Seed completed: users_created={created_users}, '
            f'payments_added={created_payments}, transactions_added={created_tx}, '
            f'wiped_old_auto_tx={wiped_tx}'
        ))
        self.stdout.write(self.style.WARNING(
            'Logins: user1/user1 ... user10/user10'
        ))
