import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

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

  return render(<App />)
}

describe('open navigation flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows home page without auth gate on root path', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Добрый день, Иван' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument()
  })

  it('opens profile route directly', async () => {
    renderApp('/profile')

    expect(await screen.findByRole('heading', { name: 'Ваши данные' })).toBeInTheDocument()
  })

  it('redirects unknown routes to home page', async () => {
    renderApp('/unknown-page')

    expect(await screen.findByRole('heading', { name: 'Добрый день, Иван' })).toBeInTheDocument()
  })
})
