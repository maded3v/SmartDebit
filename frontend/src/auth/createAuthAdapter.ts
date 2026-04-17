import type { AuthAdapter } from './types'
import { createBackendAuthAdapter } from './backendAuthAdapter'
import { createMockAuthAdapter } from './mockAuthAdapter'

const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || 'mock'

export function createAuthAdapter(): AuthAdapter {
  if (AUTH_PROVIDER === 'backend') {
    return createBackendAuthAdapter()
  }

  return createMockAuthAdapter()
}
