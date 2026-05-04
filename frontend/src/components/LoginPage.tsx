import { useState, type FormEvent } from 'react'
import { LogIn, AlertCircle } from 'lucide-react'

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password.trim()) {
      setError('Введите логин и пароль')
      return
    }

    setSubmitting(true)
    try {
      await onLogin(normalizedUsername, password)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Ошибка входа'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/favicon-32x32.png" alt="" />
          <span>Банк</span>
        </div>
        <h1>Вход в SmartDebit</h1>
        <p className="login-subtitle">
          Используйте логин и пароль, чтобы войти в личный кабинет.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Логин
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="user1"
              maxLength={32}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••"
              maxLength={32}
              required
            />
          </label>
          {error ? (
            <div className="login-error" role="alert">
              <AlertCircle size={16} aria-hidden />
              {error}
            </div>
          ) : null}
          <button type="submit" className="login-submit" disabled={submitting}>
            <LogIn size={18} aria-hidden />
            {submitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
        <p className="login-hint">
          Тестовые учётные записи: <code>user1</code> … <code>user10</code>. Пароль совпадает с
          логином.
        </p>
      </div>
    </div>
  )
}
