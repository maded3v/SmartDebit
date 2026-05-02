import {
  Phone,
  Smartphone,
  Wifi,
  Home,
  Zap,
  GraduationCap,
  Car,
  Tv,
  Stethoscope,
  Dumbbell,
  ShoppingBag,
  Train,
  type LucideIcon,
} from 'lucide-react'
import type { Payment, NotificationItem, ChartSlice } from './types'

export interface AppUser {
  username: string
  password: string
  fullName: string
}

export interface UserOperation {
  id: string
  title: string
  subtitle: string
  dateLabel: string
  /** Days ago, used to derive ISO date at runtime so dates are always recent. */
  daysAgo: number
  amount: number
  smartTag?: string
}

export interface UserFavorite {
  id: string
  title: string
  subtitle: string
  account: string
  lastAmount: number
  iconKey: string
}

export interface UserUpcoming {
  id: string
  title: string
  provider: string
  amount: number
  category: string
  mandatory: boolean
  /** 'overdue' for past-due items; 'expected' for normal upcoming. */
  status: 'overdue' | 'expected' | 'low_balance' | 'cancelled' | 'frozen' | 'active'
  /** Days from today; negative = overdue. */
  daysFromToday: number
}

export interface UserDataset {
  user: AppUser
  balance: number
  operations: UserOperation[]
  favorites: UserFavorite[]
  upcoming: UserUpcoming[]
}

const ICON_MAP: Record<string, LucideIcon> = {
  phone: Phone,
  smartphone: Smartphone,
  wifi: Wifi,
  home: Home,
  zap: Zap,
  school: GraduationCap,
  car: Car,
  tv: Tv,
  health: Stethoscope,
  fit: Dumbbell,
  shop: ShoppingBag,
  transit: Train,
}

export function getFavoriteIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Phone
}

const FULL_NAME = 'Иван Иванов'

function mkUser(username: string): AppUser {
  return { username, password: username, fullName: FULL_NAME }
}

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isoFromDaysFromToday(days: number) {
  return isoDaysAgo(-days)
}

/** Given a UserOperation, returns the runtime ISO date for sorting/grouping. */
export function operationISO(op: UserOperation) {
  return isoDaysAgo(op.daysAgo)
}

/** Each user gets its own carefully picked set so users feel distinct. */
export const USER_DATASETS: UserDataset[] = [
  {
    user: mkUser('user1'),
    balance: 1_250_000,
    operations: [
      { id: 'u1-salary', title: 'Зарплата', subtitle: 'Acme Team', dateLabel: 'Сегодня, 09:12', daysAgo: 0, amount: 145000 },
      { id: 'u1-samokat', title: 'Самокат', subtitle: 'Еда и продукты', dateLabel: 'Сегодня, 12:41', daysAgo: 0, amount: -1450 },
      { id: 'u1-wb', title: 'Wildberries', subtitle: 'Покупки', dateLabel: 'Вчера, 21:07', daysAgo: 1, amount: -3450 },
      { id: 'u1-magnit', title: 'Магнит', subtitle: 'Супермаркеты', dateLabel: 'Позавчера, 18:50', daysAgo: 2, amount: -2340 },
      { id: 'u1-yaeda', title: 'Яндекс Еда', subtitle: 'Кафе и доставка', dateLabel: '3 дня назад, 14:25', daysAgo: 3, amount: -890 },
      { id: 'u1-mts', title: 'МТС', subtitle: 'Мобильная связь', dateLabel: '5 дней назад, 10:00', daysAgo: 5, amount: -600, smartTag: 'SmartDebit · Ежемесячно, 5 числа' },
    ],
    favorites: [
      { id: 'u1-fav-mts', title: 'МТС', subtitle: 'Мобильная связь', account: '+7 (925) 123-45-67', lastAmount: 600, iconKey: 'smartphone' },
      { id: 'u1-fav-rt', title: 'Ростелеком', subtitle: 'Интернет', account: 'Договор №847291', lastAmount: 890, iconKey: 'wifi' },
      { id: 'u1-fav-zhkh', title: 'ЖКХ Квартплата', subtitle: 'УК «Домсервис»', account: 'ЛС 4820193847', lastAmount: 8500, iconKey: 'home' },
    ],
    upcoming: [
      { id: 'u1-up-1', title: 'Ипотека Сбербанк', provider: 'Сбербанк', amount: 45000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -5 },
      { id: 'u1-up-2', title: 'Кредит на ремонт', provider: 'Альфа-Банк', amount: 18000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -2 },
      { id: 'u1-up-3', title: 'Яндекс Плюс', provider: 'Yandex', amount: 299, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u1-up-4', title: 'KION Подписка', provider: 'KION', amount: 499, category: 'Кино', mandatory: false, status: 'expected', daysFromToday: 3 },
      { id: 'u1-up-5', title: 'МТС Мобайл', provider: 'МТС', amount: 600, category: 'Связь', mandatory: false, status: 'expected', daysFromToday: 5 },
    ],
  },
  {
    user: mkUser('user2'),
    balance: 980_000,
    operations: [
      { id: 'u2-salary', title: 'Зарплата', subtitle: 'Mira Studio', dateLabel: 'Сегодня, 11:00', daysAgo: 0, amount: 92000 },
      { id: 'u2-perekrestok', title: 'Перекрёсток', subtitle: 'Супермаркеты', dateLabel: 'Сегодня, 19:32', daysAgo: 0, amount: -2810 },
      { id: 'u2-ozon', title: 'Ozon', subtitle: 'Маркетплейс', dateLabel: 'Вчера, 14:08', daysAgo: 1, amount: -4790 },
      { id: 'u2-taxi', title: 'Яндекс Go', subtitle: 'Такси', dateLabel: 'Вчера, 22:41', daysAgo: 1, amount: -640 },
      { id: 'u2-cafe', title: 'Шоколадница', subtitle: 'Кафе и доставка', dateLabel: '2 дня назад, 13:10', daysAgo: 2, amount: -880 },
      { id: 'u2-cb', title: 'Кэшбек T-Bank', subtitle: 'Возврат кэшбэка', dateLabel: '4 дня назад, 09:00', daysAgo: 4, amount: 520 },
    ],
    favorites: [
      { id: 'u2-fav-mgts', title: 'МГТС', subtitle: 'Городская связь', account: '8 (495) 555-22-11', lastAmount: 350, iconKey: 'phone' },
      { id: 'u2-fav-mosenergo', title: 'МосЭнерго', subtitle: 'Электроэнергия', account: 'ЛС 7391028456', lastAmount: 2100, iconKey: 'zap' },
      { id: 'u2-fav-school', title: 'Детский сад №42', subtitle: 'Образование', account: 'ИНН 7701234567', lastAmount: 5400, iconKey: 'school' },
    ],
    upcoming: [
      { id: 'u2-up-1', title: 'Кредитная карта', provider: 'Тинькофф', amount: 15500, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -7 },
      { id: 'u2-up-2', title: 'Каско Авто', provider: 'Ингосстрах', amount: 27000, category: 'Авто', mandatory: true, status: 'overdue', daysFromToday: -3 },
      { id: 'u2-up-3', title: 'Spotify Premium', provider: 'Spotify', amount: 199, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u2-up-4', title: 'Netflix', provider: 'Netflix', amount: 599, category: 'Развлечения', mandatory: false, status: 'expected', daysFromToday: 4 },
    ],
  },
  {
    user: mkUser('user3'),
    balance: 1_650_000,
    operations: [
      { id: 'u3-salary', title: 'Зарплата', subtitle: 'Northern Lights LLC', dateLabel: 'Сегодня, 08:45', daysAgo: 0, amount: 178000 },
      { id: 'u3-aliexpress', title: 'AliExpress', subtitle: 'Маркетплейс', dateLabel: 'Сегодня, 15:22', daysAgo: 0, amount: -3120 },
      { id: 'u3-vkusvill', title: 'ВкусВилл', subtitle: 'Супермаркеты', dateLabel: 'Вчера, 19:11', daysAgo: 1, amount: -1740 },
      { id: 'u3-kfc', title: 'KFC', subtitle: 'Кафе и доставка', dateLabel: 'Позавчера, 13:00', daysAgo: 2, amount: -780 },
      { id: 'u3-fitness', title: 'World Class', subtitle: 'Фитнес', dateLabel: '4 дня назад, 19:30', daysAgo: 4, amount: -4500, smartTag: 'SmartDebit · Ежемесячно, 1 числа' },
      { id: 'u3-cinema', title: 'Каро Фильм', subtitle: 'Развлечения', dateLabel: '6 дней назад, 21:50', daysAgo: 6, amount: -1200 },
    ],
    favorites: [
      { id: 'u3-fav-megafon', title: 'МегаФон', subtitle: 'Мобильная связь', account: '+7 (916) 778-90-12', lastAmount: 540, iconKey: 'smartphone' },
      { id: 'u3-fav-tvinternet', title: 'Билайн ТВ+Интернет', subtitle: 'ТВ и интернет', account: 'ЛС 901223344', lastAmount: 1190, iconKey: 'tv' },
      { id: 'u3-fav-fit', title: 'World Class', subtitle: 'Абонемент', account: 'Карта №19443', lastAmount: 4500, iconKey: 'fit' },
    ],
    upcoming: [
      { id: 'u3-up-1', title: 'Автокредит Toyota', provider: 'Газпромбанк', amount: 32000, category: 'Авто', mandatory: true, status: 'overdue', daysFromToday: -8 },
      { id: 'u3-up-2', title: 'Подписка World Class', provider: 'World Class', amount: 4500, category: 'Спорт', mandatory: false, status: 'overdue', daysFromToday: -2 },
      { id: 'u3-up-3', title: 'Английский Skyeng', provider: 'Skyeng', amount: 6800, category: 'Образование', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u3-up-4', title: 'Apple iCloud', provider: 'Apple', amount: 149, category: 'Сервисы', mandatory: false, status: 'expected', daysFromToday: 6 },
      { id: 'u3-up-5', title: 'Каско авто', provider: 'РЕСО', amount: 8800, category: 'Авто', mandatory: true, status: 'expected', daysFromToday: 14 },
    ],
  },
  {
    user: mkUser('user4'),
    balance: 720_000,
    operations: [
      { id: 'u4-salary', title: 'Премия', subtitle: 'Acme Team', dateLabel: 'Сегодня, 10:00', daysAgo: 0, amount: 60000 },
      { id: 'u4-pyat', title: 'Пятёрочка', subtitle: 'Супермаркеты', dateLabel: 'Сегодня, 18:14', daysAgo: 0, amount: -1980 },
      { id: 'u4-zoo', title: 'Зоомагазин «Бетховен»', subtitle: 'Зоотовары', dateLabel: 'Вчера, 16:00', daysAgo: 1, amount: -2200 },
      { id: 'u4-sapsan', title: 'Сапсан Москва-СПб', subtitle: 'Транспорт', dateLabel: '2 дня назад, 07:30', daysAgo: 2, amount: -5400 },
      { id: 'u4-burger', title: 'Burger King', subtitle: 'Кафе и доставка', dateLabel: '3 дня назад, 14:00', daysAgo: 3, amount: -540 },
    ],
    favorites: [
      { id: 'u4-fav-tele2', title: 'Tele2', subtitle: 'Мобильная связь', account: '+7 (905) 555-22-33', lastAmount: 480, iconKey: 'smartphone' },
      { id: 'u4-fav-train', title: 'Тройка', subtitle: 'Транспорт', account: 'Карта №9012345', lastAmount: 2000, iconKey: 'transit' },
      { id: 'u4-fav-zhkh', title: 'ЖКХ Квартплата', subtitle: 'УК «Альтернатива»', account: 'ЛС 5512309877', lastAmount: 7300, iconKey: 'home' },
    ],
    upcoming: [
      { id: 'u4-up-1', title: 'Ипотека ВТБ', provider: 'ВТБ', amount: 38000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -10 },
      { id: 'u4-up-2', title: 'Стоматолог. абонемент', provider: 'СМ-Клиника', amount: 9500, category: 'Здоровье', mandatory: false, status: 'overdue', daysFromToday: -4 },
      { id: 'u4-up-3', title: 'Apple Music', provider: 'Apple', amount: 169, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u4-up-4', title: 'Тройка пополнение', provider: 'Метро Москвы', amount: 2000, category: 'Транспорт', mandatory: false, status: 'expected', daysFromToday: 5 },
    ],
  },
  {
    user: mkUser('user5'),
    balance: 2_100_000,
    operations: [
      { id: 'u5-salary', title: 'Зарплата', subtitle: 'Tech Vision', dateLabel: 'Сегодня, 09:30', daysAgo: 0, amount: 215000 },
      { id: 'u5-bonus', title: 'Премия', subtitle: 'Tech Vision', dateLabel: 'Вчера, 17:00', daysAgo: 1, amount: 45000 },
      { id: 'u5-mvideo', title: 'М.Видео', subtitle: 'Электроника', dateLabel: 'Вчера, 13:25', daysAgo: 1, amount: -29900 },
      { id: 'u5-spar', title: 'SPAR', subtitle: 'Супермаркеты', dateLabel: 'Позавчера, 20:00', daysAgo: 2, amount: -3200 },
      { id: 'u5-park', title: 'Парковка центр', subtitle: 'Транспорт', dateLabel: '3 дня назад, 12:50', daysAgo: 3, amount: -350 },
      { id: 'u5-dom', title: 'Домодедово Aero', subtitle: 'Путешествия', dateLabel: '7 дней назад, 06:00', daysAgo: 7, amount: -12500 },
    ],
    favorites: [
      { id: 'u5-fav-yota', title: 'Yota', subtitle: 'Мобильная связь', account: '+7 (911) 765-43-21', lastAmount: 700, iconKey: 'smartphone' },
      { id: 'u5-fav-ml', title: 'Mosenergosbyt', subtitle: 'Электроэнергия', account: 'ЛС 9988776655', lastAmount: 3400, iconKey: 'zap' },
      { id: 'u5-fav-akado', title: 'Акадо ТВ', subtitle: 'Кабельное ТВ', account: 'Договор №AK-1024', lastAmount: 990, iconKey: 'tv' },
    ],
    upcoming: [
      { id: 'u5-up-1', title: 'Ипотека ДОМ.РФ', provider: 'ДОМ.РФ', amount: 56000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -6 },
      { id: 'u5-up-2', title: 'IELTS Подписка', provider: 'IDP', amount: 12000, category: 'Образование', mandatory: false, status: 'overdue', daysFromToday: -3 },
      { id: 'u5-up-3', title: 'Patreon Stas', provider: 'Patreon', amount: 690, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u5-up-4', title: 'GitHub Pro', provider: 'GitHub', amount: 380, category: 'Сервисы', mandatory: false, status: 'expected', daysFromToday: 7 },
      { id: 'u5-up-5', title: 'Caсhback карты', provider: 'T-Bank', amount: 0, category: 'Финансы', mandatory: false, status: 'expected', daysFromToday: 12 },
    ],
  },
  {
    user: mkUser('user6'),
    balance: 540_000,
    operations: [
      { id: 'u6-salary', title: 'Зарплата', subtitle: 'Lightning Co', dateLabel: 'Сегодня, 10:30', daysAgo: 0, amount: 78000 },
      { id: 'u6-okey', title: 'О’КЕЙ', subtitle: 'Супермаркеты', dateLabel: 'Сегодня, 19:42', daysAgo: 0, amount: -4120 },
      { id: 'u6-sushi', title: 'Sushi Wok', subtitle: 'Кафе и доставка', dateLabel: 'Вчера, 13:00', daysAgo: 1, amount: -990 },
      { id: 'u6-decath', title: 'Декатлон', subtitle: 'Спорттовары', dateLabel: 'Позавчера, 16:30', daysAgo: 2, amount: -7800 },
      { id: 'u6-bus', title: 'Автобус Москва-Тула', subtitle: 'Транспорт', dateLabel: '3 дня назад, 08:00', daysAgo: 3, amount: -1450 },
    ],
    favorites: [
      { id: 'u6-fav-bee', title: 'Билайн', subtitle: 'Мобильная связь', account: '+7 (903) 100-22-33', lastAmount: 690, iconKey: 'smartphone' },
      { id: 'u6-fav-internet', title: 'Дом.ру Интернет', subtitle: 'Интернет', account: 'Договор №R-77123', lastAmount: 750, iconKey: 'wifi' },
      { id: 'u6-fav-school', title: 'Школа №2009', subtitle: 'Образование', account: 'ЛС 7701004567', lastAmount: 4200, iconKey: 'school' },
    ],
    upcoming: [
      { id: 'u6-up-1', title: 'Кредит наличными', provider: 'Райффайзен', amount: 24500, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -9 },
      { id: 'u6-up-2', title: 'Окей онлайн ', provider: 'OKEY', amount: 1200, category: 'Супермаркеты', mandatory: false, status: 'overdue', daysFromToday: -2 },
      { id: 'u6-up-3', title: 'Boosty подписка', provider: 'Boosty', amount: 350, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u6-up-4', title: 'Школа №2009', provider: 'ГБОУ', amount: 4200, category: 'Образование', mandatory: true, status: 'expected', daysFromToday: 8 },
    ],
  },
  {
    user: mkUser('user7'),
    balance: 1_900_000,
    operations: [
      { id: 'u7-deposit', title: 'Перевод от Анны', subtitle: 'Семья', dateLabel: 'Сегодня, 11:11', daysAgo: 0, amount: 50000 },
      { id: 'u7-vkusvill', title: 'ВкусВилл', subtitle: 'Супермаркеты', dateLabel: 'Сегодня, 19:50', daysAgo: 0, amount: -2480 },
      { id: 'u7-letual', title: "Л'Этуаль", subtitle: 'Косметика', dateLabel: 'Вчера, 16:30', daysAgo: 1, amount: -3200 },
      { id: 'u7-yandex', title: 'Яндекс Маркет', subtitle: 'Маркетплейс', dateLabel: 'Позавчера, 11:00', daysAgo: 2, amount: -8990 },
      { id: 'u7-spa', title: 'СПА Сандуны', subtitle: 'Здоровье', dateLabel: '5 дней назад, 18:00', daysAgo: 5, amount: -6500 },
      { id: 'u7-cinema', title: 'Формула Кино', subtitle: 'Развлечения', dateLabel: '6 дней назад, 21:00', daysAgo: 6, amount: -1100 },
    ],
    favorites: [
      { id: 'u7-fav-mts', title: 'МТС Premium', subtitle: 'Мобильная связь', account: '+7 (926) 401-22-33', lastAmount: 1200, iconKey: 'smartphone' },
      { id: 'u7-fav-zhkh', title: 'ЖКХ Москвы', subtitle: 'УК «Жилищник»', account: 'ЛС 6612008833', lastAmount: 9800, iconKey: 'home' },
      { id: 'u7-fav-wc', title: 'World Class Premium', subtitle: 'Абонемент', account: 'Карта №66719', lastAmount: 5400, iconKey: 'fit' },
    ],
    upcoming: [
      { id: 'u7-up-1', title: 'Ипотека Сбербанк', provider: 'Сбербанк', amount: 65000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -12 },
      { id: 'u7-up-2', title: 'Лечение зубов', provider: 'СМ-Клиника', amount: 12500, category: 'Здоровье', mandatory: false, status: 'overdue', daysFromToday: -5 },
      { id: 'u7-up-3', title: 'Beauty box', provider: 'L’Etoile', amount: 1990, category: 'Красота', mandatory: false, status: 'overdue', daysFromToday: -2 },
      { id: 'u7-up-4', title: 'Детский сад', provider: 'ГБОУ №123', amount: 5400, category: 'Образование', mandatory: true, status: 'expected', daysFromToday: 9 },
    ],
  },
  {
    user: mkUser('user8'),
    balance: 1_100_000,
    operations: [
      { id: 'u8-salary', title: 'Зарплата', subtitle: 'Acme Team', dateLabel: 'Сегодня, 09:55', daysAgo: 0, amount: 102000 },
      { id: 'u8-perek', title: 'Перекрёсток', subtitle: 'Супермаркеты', dateLabel: 'Сегодня, 20:01', daysAgo: 0, amount: -2150 },
      { id: 'u8-tinkmoney', title: 'Перевод другу', subtitle: 'СБП', dateLabel: 'Вчера, 14:21', daysAgo: 1, amount: -7000 },
      { id: 'u8-amazon', title: 'Amazon', subtitle: 'Маркетплейс', dateLabel: 'Позавчера, 12:00', daysAgo: 2, amount: -10560 },
      { id: 'u8-pharm', title: 'Аптека «Ригла»', subtitle: 'Здоровье', dateLabel: '4 дня назад, 19:00', daysAgo: 4, amount: -1820 },
    ],
    favorites: [
      { id: 'u8-fav-yota', title: 'Yota', subtitle: 'Интернет 4G', account: 'ЛС 11203344', lastAmount: 700, iconKey: 'wifi' },
      { id: 'u8-fav-mosc', title: 'МосЭнергоСбыт', subtitle: 'Электроэнергия', account: 'ЛС 4422556677', lastAmount: 2700, iconKey: 'zap' },
      { id: 'u8-fav-pharm', title: 'Ригла Premium', subtitle: 'Аптека', account: 'Карта №774001', lastAmount: 1500, iconKey: 'health' },
    ],
    upcoming: [
      { id: 'u8-up-1', title: 'Кредит на обучение', provider: 'Сбербанк', amount: 19500, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -6 },
      { id: 'u8-up-2', title: 'Аренда квартиры', provider: 'ИП Иванов', amount: 65000, category: 'Жильё', mandatory: true, status: 'overdue', daysFromToday: -3 },
      { id: 'u8-up-3', title: 'YouTube Premium', provider: 'Google', amount: 199, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u8-up-4', title: 'Ригла Premium', provider: 'Ригла', amount: 1500, category: 'Здоровье', mandatory: false, status: 'expected', daysFromToday: 7 },
    ],
  },
  {
    user: mkUser('user9'),
    balance: 870_000,
    operations: [
      { id: 'u9-pension', title: 'Стипендия', subtitle: 'МГУ', dateLabel: 'Сегодня, 12:00', daysAgo: 0, amount: 22000 },
      { id: 'u9-tech', title: 'DNS', subtitle: 'Электроника', dateLabel: 'Сегодня, 16:40', daysAgo: 0, amount: -18900 },
      { id: 'u9-coffee', title: 'Coffix', subtitle: 'Кафе и доставка', dateLabel: 'Вчера, 11:30', daysAgo: 1, amount: -210 },
      { id: 'u9-mk', title: 'Магнит Косметик', subtitle: 'Косметика', dateLabel: 'Позавчера, 19:00', daysAgo: 2, amount: -1340 },
      { id: 'u9-cinema', title: 'Каро Фильм', subtitle: 'Развлечения', dateLabel: '3 дня назад, 22:00', daysAgo: 3, amount: -780 },
      { id: 'u9-uber', title: 'Яндекс Go', subtitle: 'Такси', dateLabel: '4 дня назад, 23:15', daysAgo: 4, amount: -540 },
    ],
    favorites: [
      { id: 'u9-fav-mts', title: 'МТС Студенческий', subtitle: 'Мобильная связь', account: '+7 (985) 222-11-66', lastAmount: 350, iconKey: 'smartphone' },
      { id: 'u9-fav-univ', title: 'МГУ Общежитие', subtitle: 'Образование', account: 'ЛС МГУ-12099', lastAmount: 2200, iconKey: 'school' },
      { id: 'u9-fav-tr', title: 'Тройка', subtitle: 'Транспорт', account: 'Карта №3344219', lastAmount: 1500, iconKey: 'transit' },
    ],
    upcoming: [
      { id: 'u9-up-1', title: 'Кредит на технику', provider: 'Кредит Европа Банк', amount: 8900, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -7 },
      { id: 'u9-up-2', title: 'МГУ Общежитие', provider: 'МГУ', amount: 2200, category: 'Образование', mandatory: true, status: 'overdue', daysFromToday: -2 },
      { id: 'u9-up-3', title: 'Сериалы START', provider: 'START', amount: 299, category: 'Развлечения', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u9-up-4', title: 'Тройка авто-пополнение', provider: 'Метро Москвы', amount: 1500, category: 'Транспорт', mandatory: false, status: 'expected', daysFromToday: 6 },
    ],
  },
  {
    user: mkUser('user10'),
    balance: 3_400_000,
    operations: [
      { id: 'u10-bonus', title: 'Дивиденды', subtitle: 'Акции', dateLabel: 'Сегодня, 09:10', daysAgo: 0, amount: 320000 },
      { id: 'u10-azbuka', title: 'Азбука вкуса', subtitle: 'Премиум-маркеты', dateLabel: 'Сегодня, 19:30', daysAgo: 0, amount: -5430 },
      { id: 'u10-tsum', title: 'ЦУМ', subtitle: 'Универмаги', dateLabel: 'Вчера, 14:25', daysAgo: 1, amount: -64500 },
      { id: 'u10-resto', title: 'White Rabbit', subtitle: 'Рестораны', dateLabel: 'Вчера, 21:30', daysAgo: 1, amount: -18700 },
      { id: 'u10-spa', title: 'Sky Spa', subtitle: 'Здоровье', dateLabel: '3 дня назад, 17:00', daysAgo: 3, amount: -12000 },
      { id: 'u10-airline', title: 'Аэрофлот', subtitle: 'Путешествия', dateLabel: '5 дней назад, 06:00', daysAgo: 5, amount: -89000 },
    ],
    favorites: [
      { id: 'u10-fav-mts', title: 'МТС Premium', subtitle: 'Мобильная связь', account: '+7 (985) 909-00-12', lastAmount: 1500, iconKey: 'smartphone' },
      { id: 'u10-fav-power', title: 'МосЭнерго Premium', subtitle: 'Электроэнергия', account: 'ЛС 8800123344', lastAmount: 5200, iconKey: 'zap' },
      { id: 'u10-fav-conc', title: 'Концертный сервис', subtitle: 'Билеты VIP', account: 'Профиль №880', lastAmount: 25000, iconKey: 'shop' },
    ],
    upcoming: [
      { id: 'u10-up-1', title: 'Ипотека VIP', provider: 'ВТБ Private', amount: 120000, category: 'Финансы', mandatory: true, status: 'overdue', daysFromToday: -10 },
      { id: 'u10-up-2', title: 'Личный тренер', provider: 'Encore Sport', amount: 28000, category: 'Спорт', mandatory: false, status: 'overdue', daysFromToday: -4 },
      { id: 'u10-up-3', title: 'Membership Sky Spa', provider: 'Sky Spa', amount: 12000, category: 'Здоровье', mandatory: false, status: 'overdue', daysFromToday: -1 },
      { id: 'u10-up-4', title: 'Аренда офиса', provider: 'Capital LLC', amount: 95000, category: 'Бизнес', mandatory: true, status: 'expected', daysFromToday: 10 },
      { id: 'u10-up-5', title: 'Концерт VIP-loft', provider: 'TicketLand', amount: 25000, category: 'Развлечения', mandatory: false, status: 'expected', daysFromToday: 14 },
    ],
  },
]

const STATUS_LABELS: Record<UserUpcoming['status'], string> = {
  overdue: 'Просрочено',
  expected: 'Активен',
  active: 'Активен',
  low_balance: 'Недостаточно средств',
  cancelled: 'Отключен',
  frozen: 'Пропущен',
}

const PERIOD_LABELS: Record<string, string> = {}

/** Convert UserDataset.upcoming → DashboardPayload.upcoming-compatible Payment list. */
export function toUpcomingPayments(items: UserUpcoming[]): Payment[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    provider: item.provider,
    amount: item.amount,
    category: item.category,
    mandatory: item.mandatory,
    status: item.status,
    statusLabel: STATUS_LABELS[item.status] ?? 'Активен',
    nextChargeDate: isoFromDaysFromToday(item.daysFromToday),
    periodLabel: PERIOD_LABELS[item.id] ?? 'Ежемесячно',
    source: 'auto',
  }))
}

/** Build chart slices from the user's upcoming payments. */
export function buildUserChart(items: UserUpcoming[]): ChartSlice[] {
  const palette = ['#5b8def', '#ffd24c', '#7ed3a3', '#ff8a72', '#a78bfa', '#34d3c0', '#fb7185']
  const totals = new Map<string, number>()
  items.forEach((item) => {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount)
  })
  return Array.from(totals.entries()).map(([category, amount], index) => ({
    category,
    amount,
    color: palette[index % palette.length],
  }))
}

/** Build notifications: one per overdue + a couple for expected. */
export function buildUserNotifications(items: UserUpcoming[]): NotificationItem[] {
  const overdue = items.filter((item) => item.status === 'overdue')
  const expected = items.filter((item) => item.status === 'expected').slice(0, 2)
  return [
    ...overdue.map<NotificationItem>((item) => ({
      id: `notif-overdue-${item.id}`,
      title: `Просрочено: ${item.title}`,
      subtitle: `${item.amount.toLocaleString('ru-RU')} ₽ · ${Math.abs(item.daysFromToday)} дн. просрочки`,
      level: 'critical',
    })),
    ...expected.map<NotificationItem>((item) => ({
      id: `notif-expected-${item.id}`,
      title: `Скоро списание: ${item.title}`,
      subtitle: `${item.amount.toLocaleString('ru-RU')} ₽ · через ${item.daysFromToday} дн.`,
      level: 'neutral',
    })),
  ]
}

export function findUser(username: string, password: string): UserDataset | null {
  const normalizedName = username.trim().toLowerCase()
  const normalizedPassword = password.trim().toLowerCase()
  const match = USER_DATASETS.find(
    (entry) =>
      entry.user.username === normalizedName &&
      entry.user.password === normalizedPassword,
  )
  return match ?? null
}
