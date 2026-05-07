import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../config/navigation'

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => {
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
