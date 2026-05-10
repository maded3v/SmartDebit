import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BellOff,
  Check,
  LogOut,
  Menu,
  User,
  X,
} from 'lucide-react'
import type { NotificationItem } from '../types'
import { NAV_ITEMS } from '../config/navigation'

interface AppHeaderProps {
  notifications: NotificationItem[]
  profileName: string
  avatarUrl?: string
  onLogout?: () => void
}

function getNameInitial(fullName: string) {
  const normalized = fullName.trim()
  if (!normalized) {
    return 'U'
  }
  return normalized.slice(0, 1).toUpperCase()
}

export function AppHeader({ notifications, profileName, avatarUrl, onLogout }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isProfileActive = location.pathname.startsWith('/profile')
  const profileInitial = getNameInitial(profileName)
  const trimmedAvatarUrl = (avatarUrl || '').trim()

  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)

  const notificationWrapRef = useRef<HTMLDivElement | null>(null)

  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications])
  const unreadCount = useMemo(
    () => visibleNotifications.filter((item) => !readIds.has(item.id)).length,
    [visibleNotifications, readIds],
  )

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

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  function handleMarkAllAsRead() {
    setReadIds(new Set(visibleNotifications.map((item) => item.id)))
  }

  function handleMarkAsRead(id: string) {
    setReadIds((current) => {
      if (current.has(id)) {
        return current
      }
      const next = new Set(current)
      next.add(id)
      return next
    })
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-burger"
        onClick={() => setIsMobileMenuOpen(true)}
        aria-label="Открыть меню"
        aria-expanded={isMobileMenuOpen}
      >
        <Menu size={20} />
      </button>

      <Link to="/" className="brand">
        <img src="/favicon-32x32.png" alt="" className="brand-logo" />
        <strong>Банк</strong>
      </Link>

      <nav className="topbar-nav" aria-label="Основная навигация">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(location.pathname)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/operations'}
              className={isActive ? 'active' : ''}
              onClick={() => setIsNotificationOpen(false)}
            >
              {item.label}
              {item.newChip ? <span className="nav-new-chip">NEW</span> : null}
            </NavLink>
          )
        })}
      </nav>

      <div className="topbar-actions">
        <div
          className={isNotificationOpen ? 'notification-wrap active' : 'notification-wrap'}
          ref={notificationWrapRef}
        >
          <button
            type="button"
            className="notification-btn"
            onClick={() => setIsNotificationOpen((value) => !value)}
            aria-label={
              unreadCount
                ? `Уведомления, ${unreadCount} новых`
                : 'Уведомления'
            }
            aria-expanded={isNotificationOpen}
            aria-controls="notifications-dropdown"
          >
            <Bell size={20} />
            {unreadCount ? (
              <span className="notification-badge" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationOpen ? (
            <>
              <div
                className="notification-backdrop"
                onClick={() => setIsNotificationOpen(false)}
                aria-hidden="true"
              />
              <div
                className="notification-dropdown"
                id="notifications-dropdown"
                role="dialog"
                aria-label="Уведомления"
              >
                <div className="notification-dropdown-head">
                  <div className="notification-dropdown-title">
                    <span>Уведомления</span>
                    {unreadCount ? (
                      <span className="notification-count-chip">{unreadCount}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="notification-mark-all"
                    onClick={handleMarkAllAsRead}
                    disabled={unreadCount === 0}
                  >
                    <Check size={14} />
                    Прочитать всё
                  </button>
                </div>

                {visibleNotifications.length ? (
                  <ul className="notification-list">
                    {visibleNotifications.map((notification) => {
                      const isRead = readIds.has(notification.id)
                      const className = [
                        'notification-item',
                        notification.level === 'critical' ? 'critical' : '',
                        isRead ? 'read' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')

                      return (
                        <li key={notification.id}>
                          <button
                            type="button"
                            className={className}
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <span className="notification-item-dot" aria-hidden="true" />
                            <span className="notification-item-body">
                              <strong>{notification.title}</strong>
                              <small>{notification.subtitle}</small>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="notification-empty">
                    <BellOff size={22} />
                    <strong>Уведомлений пока нет</strong>
                    <small>Здесь появятся напоминания о платежах и переводах</small>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        <NavLink
          to="/profile"
          className={isProfileActive ? 'topbar-user active' : 'topbar-user'}
          aria-label="Профиль"
        >
          <span className="user-avatar" aria-hidden="true">
            {trimmedAvatarUrl && failedAvatarUrl !== trimmedAvatarUrl ? (
              <img
                src={trimmedAvatarUrl}
                alt=""
                className="user-avatar-img"
                onError={() => setFailedAvatarUrl(trimmedAvatarUrl)}
              />
            ) : (
              <span className="user-avatar-fallback">{profileInitial}</span>
            )}
          </span>
          <span className="topbar-user-name">{profileName}</span>
        </NavLink>
        {onLogout ? (
          <button
            type="button"
            className="topbar-logout"
            onClick={onLogout}
            aria-label="Выйти из аккаунта"
            title="Выйти"
          >
            <LogOut size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      {isMobileMenuOpen ? (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Меню">
          <div
            className="mobile-menu-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="mobile-menu-panel">
            <div className="mobile-menu-head">
              <Link to="/" className="brand" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/favicon-32x32.png" alt="" className="brand-logo" />
                <strong>Банк</strong>
              </Link>
              <button
                type="button"
                className="mobile-menu-close"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Закрыть меню"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="mobile-menu-nav" aria-label="Мобильное меню">
              {NAV_ITEMS.map((item) => {
                const isActive = item.match(location.pathname)
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    type="button"
                    className={isActive ? 'mobile-menu-link active' : 'mobile-menu-link'}
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      startTransition(() => {
                        navigate(item.to)
                      })
                    }}
                  >
                    <span className="mobile-menu-link-icon">
                      <Icon size={18} />
                    </span>
                    <span className="mobile-menu-link-label">{item.label}</span>
                    {item.newChip ? <span className="nav-new-chip">NEW</span> : null}
                  </button>
                )
              })}
              <button
                type="button"
                className={
                  isProfileActive ? 'mobile-menu-link active' : 'mobile-menu-link'
                }
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  startTransition(() => {
                    navigate('/profile')
                  })
                }}
              >
                <span className="mobile-menu-link-icon">
                  <User size={18} />
                </span>
                <span className="mobile-menu-link-label">Профиль</span>
              </button>
              {onLogout ? (
                <button
                  type="button"
                  className="mobile-menu-link"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    onLogout()
                  }}
                >
                  <span className="mobile-menu-link-icon">
                    <LogOut size={18} />
                  </span>
                  <span className="mobile-menu-link-label">Выйти</span>
                </button>
              ) : null}
            </nav>
          </aside>
        </div>
      ) : null}
    </header>
  )
}
