import { NavLink } from 'react-router-dom'
import { Home, ArrowLeftRight, CreditCard, Sparkles } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/operations', label: 'Операции', icon: ArrowLeftRight, end: true },
  { to: '/payments', label: 'Платежи', icon: CreditCard, end: false },
  { to: '/operations/smartdebit', label: 'SmartDebit', icon: Sparkles, end: false },
] as const

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `bottom-nav-link${isActive ? ' active' : ''}`
            }
          >
            <Icon aria-hidden />
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
