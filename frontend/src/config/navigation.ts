// Путь: frontend/src/config/navigation.ts
import { ArrowLeftRight, CreditCard, Home, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Единый источник правды для пунктов основной навигации.
 *
 * Используется и в верхней панели (`AppHeader` — топбар + мобильное меню),
 * и в нижней навигации (`BottomNav`), чтобы иконки и подписи всегда
 * совпадали и не разъезжались между разными экранами.
 *
 * Все иконки берём из lucide-react — той же библиотеки, что уже подключена
 * в проекте, чтобы не плодить зависимости.
 */
export interface NavItem {
  /** Целевой маршрут (`to` для `<NavLink>` / `<Link>`). */
  to: string
  /** Подпись пункта меню. */
  label: string
  /** Иконка из lucide-react. */
  icon: LucideIcon
  /**
   * Совпадает ли текущий путь с этим пунктом меню.
   * Нужен из-за того, что `/operations` и `/operations/smartdebit`
   * пересекаются по префиксу.
   */
  match: (pathname: string) => boolean
  /** Передаётся в `NavLink` для точного сравнения путей. */
  end: boolean
  /** Показывать ли бейдж "NEW" рядом с пунктом. */
  newChip?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Главная',
    icon: Home,
    end: true,
    match: (pathname) => pathname === '/',
  },
  {
    to: '/operations',
    label: 'Операции',
    icon: ArrowLeftRight,
    end: true,
    match: (pathname) =>
      pathname.startsWith('/operations') && !pathname.includes('/smartdebit'),
  },
  {
    to: '/payments',
    label: 'Платежи',
    icon: CreditCard,
    end: false,
    match: (pathname) => pathname.startsWith('/payments'),
  },
  {
    to: '/operations/smartdebit',
    label: 'SmartDebit',
    icon: Shield,
    end: false,
    match: (pathname) => pathname.includes('/smartdebit'),
    newChip: true,
  },
]
