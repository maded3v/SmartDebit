import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { createAuthAdapter } from './auth/createAuthAdapter'

const authAdapter = createAuthAdapter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider adapter={authAdapter}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
