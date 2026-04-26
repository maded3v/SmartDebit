import { useRef, useState, useEffect } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Bell, Home, Shield, ArrowLeftRight } from 'lucide-react'
import type { NotificationItem } from '../types'

interface AppHeaderProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  notifications: NotificationItem[]
  profileName: string
}

function getNameInitial(fullName: string) {
  const normalized = fullName.trim()
  if (!normalized) {
    return 'U'
  }
  return normalized.slice(0, 1).toUpperCase()
}

export function AppHeader({
  theme,
  onToggleTheme,
  notifications,
  profileName,
}: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isPaymentsActive = location.pathname.startsWith('/payments')
  const isHomeActive = location.pathname === '/'
  const isOperationsActive =
    location.pathname.startsWith('/operations') && !location.pathname.includes('/smartdebit')
  const isSmartDebitActive = location.pathname.includes('/smartdebit')

  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const notificationWrapRef = useRef<HTMLDivElement | null>(null)
  const unreadNotifications = notifications.slice(0, 4)
  const profileInitial = getNameInitial(profileName)

  useEffect(() => {
    if (!isNotificationOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (notificationWrapRef.current?.contains(event.target as Node)) {
        return
      }
      setIsNotificationOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNotificationOpen])

  return (
    <header className="topbar">
      <Link
        to="/"
        className="brand"
        onClick={() => {
          setIsNotificationOpen(false)
        }}
      >
        <span className="brand-logo">Т</span>
        <strong>Банк</strong>
      </Link>

      <nav className="topbar-nav" aria-label="Основная навигация">
        <NavLink
          to="/"
          end
          className={isHomeActive ? 'active' : ''}
          onClick={() => {
            setIsNotificationOpen(false)
          }}
        >
          <Home size={17} />
          Главная
        </NavLink>
        <NavLink
          to="/operations"
          end
          className={isOperationsActive ? 'active' : ''}
          onClick={() => {
            setIsNotificationOpen(false)
          }}
        >
          <ArrowLeftRight size={17} />
          Операции
        </NavLink>
        <NavLink
          to="/operations/smartdebit"
          className={isSmartDebitActive ? 'active' : ''}
          onClick={() => {
            setIsNotificationOpen(false)
          }}
        >
          <Shield size={17} />
          SmartDebit
          <span className="nav-new-chip">NEW</span>
        </NavLink>
        <button
          type="button"
          className={isPaymentsActive ? 'payments-nav-button active' : 'payments-nav-button'}
          onClick={() => {
            setIsNotificationOpen(false)
            navigate('/payments')
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
          Платежи
        </button>
      </nav>

      <div className="topbar-actions">
        <div className="notification-wrap" ref={notificationWrapRef}>
          <button
            type="button"
            className="notification-btn"
            onClick={() => setIsNotificationOpen((value) => !value)}
            aria-label="Уведомления"
            aria-expanded={isNotificationOpen}
            aria-controls="notifications-dropdown"
          >
            <Bell size={19} />
            {unreadNotifications.length ? <span className="notification-dot" /> : null}
          </button>

          {isNotificationOpen ? (
            <div className="notification-dropdown" id="notifications-dropdown">
              <p>Уведомления</p>
              {unreadNotifications.length ? (
                unreadNotifications.map((notification) => (
                  <div key={notification.id} className="notification-item">
                    <strong>{notification.title}</strong>
                    <small>{notification.subtitle}</small>
                  </div>
                ))
              ) : (
                <div className="notification-item">
                  <strong>Новых уведомлений нет</strong>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <button type="button" className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
        </button>
      </div>

      <NavLink
        to="/profile"
        className="topbar-user"
        onClick={() => {
          setIsNotificationOpen(false)
        }}
      >
        <span className="user-avatar">{profileInitial}</span>
        <span>{profileName}</span>
      </NavLink>
    </header>
  )
}
