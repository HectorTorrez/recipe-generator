import { useReducer } from 'react'
import { authClient } from '../lib/auth-client'
import { extractBearerToken, setBearerToken } from '../lib/auth-token'

type AuthModalProps = {
  mode: 'sign-in' | 'sign-up'
  onClose: () => void
  onSwitchMode: (mode: 'sign-in' | 'sign-up') => void
}

type FormState = {
  name: string
  email: string
  password: string
  error: string | null
  isSubmitting: boolean
}

type FormAction =
  | { type: 'setField'; field: 'name' | 'email' | 'password'; value: string }
  | { type: 'submitStart' }
  | { type: 'submitError'; message: string }
  | { type: 'submitSuccess' }

const initialFormState: FormState = {
  name: '',
  email: '',
  password: '',
  error: null,
  isSubmitting: false,
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value, error: null }
    case 'submitStart':
      return { ...state, isSubmitting: true, error: null }
    case 'submitError':
      return { ...state, isSubmitting: false, error: action.message }
    case 'submitSuccess':
      return { ...state, isSubmitting: false, error: null }
    default:
      return state
  }
}

export function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const [form, dispatch] = useReducer(formReducer, initialFormState)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    dispatch({ type: 'submitStart' })

    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          name: form.name.trim() || form.email.split('@')[0] || 'Chef',
          email: form.email.trim(),
          password: form.password,
          fetchOptions: {
            onSuccess: (ctx) => {
              const token = extractBearerToken(ctx.response)
              if (token) setBearerToken(token)
            },
          },
        })

        if (result.error) {
          throw new Error(result.error.message ?? 'Sign up failed')
        }
      } else {
        const result = await authClient.signIn.email({
          email: form.email.trim(),
          password: form.password,
          fetchOptions: {
            onSuccess: (ctx) => {
              const token = extractBearerToken(ctx.response)
              if (token) setBearerToken(token)
            },
          },
        })

        if (result.error) {
          throw new Error(result.error.message ?? 'Sign in failed')
        }
      }

      dispatch({ type: 'submitSuccess' })
      onClose()
    } catch (err) {
      dispatch({
        type: 'submitError',
        message: err instanceof Error ? err.message : 'Authentication failed',
      })
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="auth-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <header className="auth-modal__header">
          <h2 id="auth-modal-title">
            {mode === 'sign-in' ? 'Sign in to sync history' : 'Create an account'}
          </h2>
          <button
            type="button"
            className="auth-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="auth-modal__hint">
          Sign in to save up to 3 generations and access them from any browser.
          To add a new one when your history is full, delete an existing entry
          first — this helps us keep the site free.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'sign-up' && (
            <label className="form-section">
              <span className="form-label">Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  dispatch({
                    type: 'setField',
                    field: 'name',
                    value: event.target.value,
                  })
                }
                autoComplete="name"
              />
            </label>
          )}

          <label className="form-section">
            <span className="form-label">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                dispatch({
                  type: 'setField',
                  field: 'email',
                  value: event.target.value,
                })
              }
              required
              autoComplete="email"
            />
          </label>

          <label className="form-section">
            <span className="form-label">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                dispatch({
                  type: 'setField',
                  field: 'password',
                  value: event.target.value,
                })
              }
              required
              minLength={8}
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
            />
          </label>

          {form.error && (
            <p className="auth-form__error" role="alert">
              {form.error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={form.isSubmitting}
          >
            {form.isSubmitting
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-modal__switch">
          {mode === 'sign-in' ? (
            <>
              Need an account?{' '}
              <button
                type="button"
                className="auth-modal__link"
                onClick={() => onSwitchMode('sign-up')}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-modal__link"
                onClick={() => onSwitchMode('sign-in')}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
