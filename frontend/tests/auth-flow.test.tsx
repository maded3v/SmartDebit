import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { AuthProvider } from '../src/auth/AuthContext'
import { createMockAuthAdapter } from '../src/auth/mockAuthAdapter'

vi.mock('../src/api', () => {
  return {
    smartDebitApi: {
      getDashboard: vi.fn(async () => ({
        enabled: true,
        account: {
          balance: 116783,
          available: 95000,
        },
        alerts: [],
        upcoming: [],
        chart: [],
        notifications: [],
        generatedAt: '2026-04-17T10:00:00.000Z',
      })),
      toggle: vi.fn(async () => ({ enabled: true })),
      payDebt: vi.fn(async () => ({
        message: 'Платеж успешно оплачен',
        account: {
          balance: 116783,
          available: 95000,
        },
      })),
      updateStatus: vi.fn(async () => ({
        message: 'Статус платежа обновлен',
      })),
      addPayment: vi.fn(async () => ({
        message: 'Новый платеж добавлен',
        payment: null,
      })),
    },
  }
})

function renderApp(initialPath = '/') {
  window.history.pushState({}, '', initialPath)

  return render(
    <AuthProvider adapter={createMockAuthAdapter()}>
      <App />
    </AuthProvider>,
  )
}

describe('auth flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows guest landing when user is not authenticated', async () => {
    renderApp('/')

    expect(await screen.findByText('Вход в банковский кабинет')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Выйти' })).not.toBeInTheDocument()
  })

  it('logs in and hides auth buttons', async () => {
    const user = userEvent.setup()

    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Войти' }))

    const dialog = await screen.findByRole('dialog', { name: 'Авторизация' })

    await user.type(within(dialog).getByLabelText('Email'), 'demo@example.com')
    await user.type(within(dialog).getByLabelText('Пароль'), '123456')
    await user.click(within(dialog).getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Регистрация' })).not.toBeInTheDocument()
  })

  it('redirects guest from protected route to guest landing', async () => {
    renderApp('/profile')

    expect(await screen.findByText('Вход в банковский кабинет')).toBeInTheDocument()
  })
})
