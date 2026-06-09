import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useReducer, useState } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { authClient } from '../lib/auth-client'
import { fetchHistory } from '../lib/history-api'
import { useGuestMigration } from '../hooks/useGuestMigration'
import type { HistoryEntry } from '../types/recipe'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

type HistoryState = {
  entries: HistoryEntry[]
  isLoading: boolean
  error: string | null
}

type HistoryAction =
  | { type: 'loadStart' }
  | { type: 'loadSuccess'; entries: HistoryEntry[] }
  | { type: 'loadError'; message: string }

const initialHistoryState: HistoryState = {
  entries: [],
  isLoading: true,
  error: null,
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, isLoading: true, error: null }
    case 'loadSuccess':
      return { entries: action.entries, isLoading: false, error: null }
    case 'loadError':
      return { ...state, isLoading: false, error: action.message }
    default:
      return state
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function HistoryPage() {
  const { data: session, isPending } = authClient.useSession()
  const [{ entries, isLoading, error }, dispatch] = useReducer(
    historyReducer,
    initialHistoryState,
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function loadHistory() {
    dispatch({ type: 'loadStart' })

    try {
      const data = await fetchHistory()
      dispatch({ type: 'loadSuccess', entries: data })
    } catch (err) {
      dispatch({
        type: 'loadError',
        message:
          err instanceof Error ? err.message : 'Failed to load history',
      })
    }
  }

  useGuestMigration(() => {
    void loadHistory()
  })

  useEffect(() => {
    if (isPending) return

    if (!session?.user) {
      dispatch({ type: 'loadSuccess', entries: [] })
      return
    }

    void loadHistory()
  }, [isPending, session?.user])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__content">
          <AuthHeader />
          <div className="app-header__brand">
            <span className="app-header__mark">Pantry</span>
            <p className="app-header__eyebrow">Saved generations</p>
          </div>
          <h1>Recipe history</h1>
          <p className="app-header__subtitle">
            Every batch you've generated, kept when you're signed in.
          </p>
        </div>
      </header>

      <main className="app-main app-main--single">
        <section className="panel">
          <div className="results-header">
            <h2>Past generations</h2>
            <Link to="/" className="btn btn-secondary btn-sm">
              Back to pantry
            </Link>
          </div>

          {isPending && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Checking your account…</p>
            </div>
          )}

          {!isPending && !session?.user && (
            <div className="status-message">
              <p>
                Sign in to view your recipe history across devices. Guest recipes
                are saved locally until you create an account.
              </p>
            </div>
          )}

          {session?.user && isLoading && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Loading your history…</p>
            </div>
          )}

          {session?.user && error && (
            <div className="status-message status-message--error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {session?.user && !isLoading && !error && entries.length === 0 && (
            <div className="status-message">
              <p>
                No saved generations yet. Generate recipes on the home page to
                build your history.
              </p>
            </div>
          )}

          <div className="history-list">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id

              return (
                <article key={entry.id} className="history-item">
                  <button
                    type="button"
                    className="history-item__toggle"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.id)
                    }
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <strong>{formatDate(entry.createdAt)}</strong>
                      <p className="history-item__summary">
                        {entry.recipes.length} recipes ·{' '}
                        {entry.request.ingredients.join(', ')}
                      </p>
                    </div>
                    <span>{isExpanded ? 'Hide' : 'Show'}</span>
                  </button>

                  {isExpanded && (
                    <div className="recipe-grid history-item__recipes">
                      {entry.recipes.map((recipe, index) => (
                        <RecipeCard
                          key={`${entry.id}-${recipe.name}-${index}`}
                          recipe={recipe}
                        />
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
