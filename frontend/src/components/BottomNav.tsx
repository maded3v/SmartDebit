// Путь: frontend/src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import { User } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'

const BOTTOM_NAV_ITEMS = [
  ...NAV_ITEMS,
  {
    to: '/profile',
    label: 'Профиль',
    icon: User,
    end: false,
  },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {BOTTOM_NAV_ITEMS.map((item) => {
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
