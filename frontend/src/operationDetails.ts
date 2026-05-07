export interface OperationDetail {
  id: string
  title: string
  subtitle: string
  amount: number
  dateTimeLabel: string
  statusLabel: string
  statusTone: 'success' | 'warning' | 'pending'
  category: string
  mcc?: string
  paymentMethod: string
  location?: string
  operationCode: string
  smartTag?: string
  logoUrl?: string
  brandInitial: string
  brandColor: string
}

// Иконки магазинов / сервисов для строк операций.
// Часть логотипов лежит в /public/icons/ — используем их как первый источник.
// Для дополнительных подписок берём цветные SVG с публичного CDN simpleicons.org
// (https://simpleicons.org/), который не требует ключа и отдаёт логотипы в
// фирменных цветах. Если матча по регулярке нет — вызывающий код покажет
// дефолтную иконку «магазина» (Store) поверх плашки с первой буквой.
const SIMPLE_ICON = (slug: string, hex?: string) =>
  `https://cdn.simpleicons.org/${slug}${hex ? `/${hex}` : ''}`

const MERCHANT_LOGOS: Array<{ match: RegExp; src: string; alt: string }> = [
  { match: /зарплат|аванс|salary|advance/i, src: '/icons/brands/salary.svg', alt: 'Зарплата' },
  { match: /самокат|samokat/i, src: '/icons/samokat.png', alt: 'Самокат' },
  { match: /wildberries/i, src: '/icons/wildberries-sign-logo.png', alt: 'Wildberries' },
  { match: /ozon/i, src: '/icons/ozon-icon-logo.png', alt: 'Ozon' },
  { match: /yandex go plus|яндекс go plus/i, src: SIMPLE_ICON('yandex', 'FFCC00'), alt: 'Яндекс Go Plus' },
  { match: /яндекс|yandex/i, src: '/icons/Yandex_icon.svg.png', alt: 'Яндекс' },
  { match: /kion/i, src: '/icons/kion.jpg', alt: 'KION' },
  { match: /start/i, src: '/icons/start.jpg', alt: 'START' },
  { match: /магнит|magnit/i, src: '/icons/magnit.png', alt: 'Магнит' },
  { match: /сбер|sber|ипотек/i, src: '/icons/icon_sber-01-370x370.png', alt: 'Сбербанк' },
  { match: /мтс|mts/i, src: '/icons/mts-logo.png', alt: 'МТС' },
  { match: /ростелеком|rostelecom/i, src: '/icons/RGB_RT_logo-vertical_main_ru.png', alt: 'Ростелеком' },
  { match: /втб|vtb/i, src: '/icons/vtb-logo-eng.png', alt: 'ВТБ' },
  { match: /жкх|квартплат/i, src: '/icons/jkh.jpg', alt: 'ЖКХ' },
  { match: /электрич/i, src: '/icons/electichestvo.jpg', alt: 'Электричество' },
  { match: /vps reg\.ru|reg\.ru/i, src: '/icons/reg_ru.png', alt: 'reg.ru' },
  { match: /домен \.ru/i, src: '/icons/domen.jpg', alt: 'Домен .ru' },
  { match: /осаго|страхов/i, src: '/icons/strahovanie.png', alt: 'Страхование' },
  { match: /обслуживание сч[её]та/i, src: '/favicon.svg', alt: 'Т-Банк' },
  { match: /тиньк|tinkoff|t-bank|т-банк/i, src: '/favicon.svg', alt: 'Т-Банк' },
  {
    match: /ручное пополнение|ручное списание|пополнение через тест|пополнение счета/i,
    src: '/icons/manual-transfer.svg',
    alt: 'Ручная операция',
  },
  { match: /github/i, src: '/icons/github-icon-logo.png', alt: 'GitHub' },
  { match: /figma/i, src: '/icons/figma-sign-logo.png', alt: 'Figma' },
  { match: /notion/i, src: '/icons/notion-icon-logo.png', alt: 'Notion' },
  { match: /spotify/i, src: '/icons/spotify-sign-logo.png', alt: 'Spotify' },
  { match: /netflix/i, src: '/icons/Netflix_icon.svg.png', alt: 'Netflix' },
  // Подписки, для которых локальных PNG нет — используем simpleicons CDN.
  { match: /apple music/i, src: SIMPLE_ICON('applemusic', 'FA243C'), alt: 'Apple Music' },
  { match: /amazon prime|amazon/i, src: SIMPLE_ICON('amazon', 'FF9900'), alt: 'Amazon' },
  { match: /xbox/i, src: SIMPLE_ICON('xbox', '107C10'), alt: 'Xbox' },
  { match: /playstation/i, src: SIMPLE_ICON('playstation', '003791'), alt: 'PlayStation' },
  { match: /youtube/i, src: SIMPLE_ICON('youtube', 'FF0000'), alt: 'YouTube' },
  { match: /dropbox/i, src: SIMPLE_ICON('dropbox', '0061FF'), alt: 'Dropbox' },
  { match: /icloud/i, src: SIMPLE_ICON('icloud', '3693F3'), alt: 'iCloud' },
  { match: /google one/i, src: SIMPLE_ICON('googleone', '4285F4'), alt: 'Google One' },
  { match: /glovo/i, src: SIMPLE_ICON('glovo', 'FFC244'), alt: 'Glovo' },
  { match: /uber/i, src: SIMPLE_ICON('uber', '000000'), alt: 'Uber' },
  { match: /world class/i, src: SIMPLE_ICON('worldclass', 'E10A1B'), alt: 'World Class' },
]

export function findMerchantLogo(...parts: string[]) {
  const value = parts.join(' ').trim()
  if (!value) return null
  return MERCHANT_LOGOS.find((merchant) => merchant.match.test(value)) ?? null
}

const BRAND_PALETTE = [
  '#FFD748',
  '#7CB7FF',
  '#A0F0C8',
  '#FFB59E',
  '#C8B8FF',
  '#FF9CB7',
  '#9BE6E0',
  '#FFD8B5',
]

export function brandColorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return BRAND_PALETTE[hash % BRAND_PALETTE.length]
}

export function brandInitial(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return '•'
  const first = trimmed.split(/\s+/)[0]
  return first.slice(0, 1).toUpperCase()
}

interface MerchantMeta {
  category: string
  mcc?: string
  location?: string
}

const MERCHANT_META: Array<{ match: RegExp; meta: MerchantMeta }> = [
  {
    match: /зарплат|аванс|salary|advance/i,
    meta: { category: 'Зарплата', mcc: '0000', location: 'Входящий перевод от банка' },
  },
  { match: /самокат|samokat/i, meta: { category: 'Супермаркеты', mcc: '5411', location: 'Москва, Россия' } },
  { match: /wildberries/i, meta: { category: 'Маркетплейс', mcc: '5399', location: 'Wildberries Online' } },
  { match: /ozon/i, meta: { category: 'Маркетплейс', mcc: '5399', location: 'Ozon Online' } },
  { match: /яндекс еда|yandex eda/i, meta: { category: 'Кафе и доставка', mcc: '5814', location: 'Москва' } },
  { match: /яндекс плюс|yandex plus/i, meta: { category: 'Подписки и сервисы', mcc: '4899' } },
  { match: /яндекс|yandex/i, meta: { category: 'Сервисы Яндекса', mcc: '4899' } },
  { match: /kion/i, meta: { category: 'Стриминг и кино', mcc: '4899' } },
  { match: /start/i, meta: { category: 'Стриминг и кино', mcc: '4899' } },
  { match: /магнит|magnit/i, meta: { category: 'Супермаркеты', mcc: '5411', location: 'Москва, Россия' } },
  { match: /сбер|sber|ипотек/i, meta: { category: 'Кредиты и ипотека', mcc: '6012', location: 'ПАО Сбербанк' } },
  { match: /мтс|mts/i, meta: { category: 'Мобильная связь', mcc: '4814' } },
  { match: /мегафон|megafon/i, meta: { category: 'Мобильная связь', mcc: '4814' } },
  { match: /tele2/i, meta: { category: 'Мобильная связь', mcc: '4814' } },
  { match: /wifi|интернет/i, meta: { category: 'Интернет-провайдер', mcc: '4814' } },
]

function metaFor(...parts: string[]): MerchantMeta {
  const value = parts.join(' ').trim()
  for (const entry of MERCHANT_META) {
    if (entry.match.test(value)) return entry.meta
  }
  return { category: 'Прочие операции' }
}

/** Public helper for filter UI: returns the human-friendly category name. */
export function categoryFor(...parts: string[]): string {
  return metaFor(...parts).category
}

const RU_MONTH: Record<string, string> = {
  янв: 'января',
  фев: 'февраля',
  мар: 'марта',
  апр: 'апреля',
  мая: 'мая',
  май: 'мая',
  июн: 'июня',
  июл: 'июля',
  авг: 'августа',
  сен: 'сентября',
  окт: 'октября',
  ноя: 'ноября',
  дек: 'декабря',
}

function expandRussianMonth(rawDate: string) {
  const trimmed = rawDate.trim()
  const match = trimmed.match(/^(\d{1,2})\s+([а-яё]{3,})$/i)
  if (!match) return trimmed
  const [, day, monthRaw] = match
  const monthKey = monthRaw.slice(0, 3).toLowerCase()
  const expanded = RU_MONTH[monthKey] ?? monthRaw
  return `${day} ${expanded}`
}

function deriveDateTimeLabel(label: string, fallbackTime?: string) {
  const trimmed = label.trim()
  if (!trimmed) return fallbackTime ?? '—'

  if (/^списание:/i.test(trimmed)) {
    return trimmed.replace(/^списание:\s*/i, 'Запланировано на ')
  }

  if (/^сегодня|^вчера/i.test(trimmed)) {
    return trimmed
  }

  const time = fallbackTime ?? deterministicTime(trimmed)
  return `${expandRussianMonth(trimmed)} в ${time}`
}

function deterministicTime(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) >>> 0
  }
  const hour = 7 + (hash % 14)
  const minute = (hash >>> 4) % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function deriveStatus(amount: number, dateLabel: string): {
  statusLabel: string
  statusTone: OperationDetail['statusTone']
} {
  if (/^списание:/i.test(dateLabel)) {
    return { statusLabel: 'Запланировано', statusTone: 'pending' }
  }
  if (amount > 0) {
    return { statusLabel: 'Зачислено', statusTone: 'success' }
  }
  return { statusLabel: 'Оплачено', statusTone: 'success' }
}

function buildOperationCode(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 131 + id.charCodeAt(i)) >>> 0
  }
  const part = String(hash).padStart(10, '0').slice(-10)
  return `№ ${part.slice(0, 4)} ${part.slice(4, 7)} ${part.slice(7, 10)}`
}

function brandSubtitle(title: string, fallback: string): string {
  if (fallback && fallback !== title) return fallback
  return metaFor(title).category
}

interface BuildArgs {
  id: string
  title: string
  subtitle: string
  amount: number
  dateLabel: string
  smartTag?: string
  cardLast4?: string
  statusOverride?: { label: string; tone: OperationDetail['statusTone'] }
}

export function buildOperationDetail(args: BuildArgs): OperationDetail {
  const meta = metaFor(args.title, args.subtitle)
  const logo = findMerchantLogo(args.title, args.subtitle)
  const status = args.statusOverride
    ? { statusLabel: args.statusOverride.label, statusTone: args.statusOverride.tone }
    : deriveStatus(args.amount, args.dateLabel)

  const initial = brandInitial(args.title)
  const subtitle = brandSubtitle(args.title, args.subtitle)

  return {
    id: args.id,
    title: args.title,
    subtitle,
    amount: args.amount,
    dateTimeLabel: deriveDateTimeLabel(args.dateLabel),
    statusLabel: status.statusLabel,
    statusTone: status.statusTone,
    category: meta.category,
    mcc: meta.mcc,
    location: meta.location,
    paymentMethod: `T-Bank Black •• ${args.cardLast4 ?? '4218'}`,
    operationCode: buildOperationCode(args.id),
    smartTag: args.smartTag,
    logoUrl: logo?.src,
    brandInitial: initial,
    brandColor: brandColorFor(args.title),
  }
}
