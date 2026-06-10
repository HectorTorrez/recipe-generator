import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'
import { clearBearerToken } from '../lib/auth-token'
import { AuthModal } from './AuthModal'

export function AuthHeader() {
  const { data: session, isPending } = authClient.useSession()
  const [modalMode, setModalMode] = useState<'sign-in' | 'sign-up' | null>(null)

  async function handleSignOut() {
    await authClient.signOut()
    clearBearerToken()
  }

  return (
    <>
      <nav className="auth-header" aria-label="Account">
        {isPending ? (
          <span className="auth-header__status">Loading…</span>
        ) : session?.user ? (
          <div className="auth-header__signed-in">
            <span className="auth-header__user">{session.user.email}</span>
            <Link to="/history" className="btn btn-ghost btn-sm">
              History
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="auth-header__guest">
            <span className="auth-header__badge">Guest</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setModalMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setModalMode('sign-up')}
            >
              Sign up
            </button>
          </div>
        )}
      </nav>

      {modalMode && (
        <AuthModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSwitchMode={setModalMode}
        />
      )}
    </>
  )
}
