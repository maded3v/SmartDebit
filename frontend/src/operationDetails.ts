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

const MERCHANT_LOGOS: Array<{ match: RegExp; src: string; alt: string }> = [
  { match: /зарплат|аванс|salary|advance/i, src: '/icons/brands/salary.svg', alt: 'Зарплата' },
  { match: /самокат|samokat/i, src: '/icons/brands/samokat.svg', alt: 'Самокат' },
  { match: /wildberries/i, src: '/icons/brands/wildberries.svg', alt: 'Wildberries' },
  { match: /ozon/i, src: '/icons/brands/ozon.svg', alt: 'Ozon' },
  { match: /яндекс|yandex/i, src: '/icons/brands/yandex.svg', alt: 'Яндекс' },
  { match: /kion/i, src: '/icons/brands/kion.svg', alt: 'KION' },
  { match: /start/i, src: '/icons/brands/start.svg', alt: 'START' },
  { match: /магнит|magnit/i, src: '/icons/brands/magnit.svg', alt: 'Магнит' },
  { match: /сбер|sber|ипотек/i, src: '/icons/brands/sber.svg', alt: 'Сбербанк' },
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
