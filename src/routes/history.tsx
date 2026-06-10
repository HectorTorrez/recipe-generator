import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useReducer, useState } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { authClient } from '../lib/auth-client'
import {
  deleteGuestHistoryEntry,
  loadGuestHistory,
} from '../lib/guest-history'
import {
  HISTORY_LIMIT_DISCLAIMER,
  MAX_HISTORY_ENTRIES,
} from '../lib/history-limits'
import { deleteHistoryEntry, fetchHistory } from '../lib/history-api'
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
  | { type: 'deleteEntry'; id: string }

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
    case 'deleteEntry':
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.id !== action.id),
      }
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
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadHistory() {
    dispatch({ type: 'loadStart' })

    try {
      const data = session?.user
        ? await fetchHistory()
        : loadGuestHistory()
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
    void loadHistory()
  }, [isPending, session?.user])

  async function handleDelete(id: string) {
    setDeletingId(id)

    try {
      if (session?.user) {
        await deleteHistoryEntry(id)
      } else {
        deleteGuestHistoryEntry(id)
      }

      if (expandedId === id) {
        setExpandedId(null)
      }

      dispatch({ type: 'deleteEntry', id })
    } catch (err) {
      dispatch({
        type: 'loadError',
        message:
          err instanceof Error ? err.message : 'Failed to delete history entry',
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar__inner">
          <Link to="/" className="top-bar__brand">
            <span className="top-bar__logo" aria-hidden="true">
              ◐
            </span>
            Pantry
          </Link>
          <AuthHeader />
        </div>
      </header>

      <section className="hero hero--compact">
        <div className="hero__inner">
          <p className="hero__eyebrow">Saved generations</p>
          <h1 className="hero__title">Recipe history</h1>
          <p className="hero__lead">
            Up to {MAX_HISTORY_ENTRIES} saved batches
            {session?.user ? ' when you are signed in' : ' stored on this device'}.
          </p>
        </div>
      </section>

      <main className="workspace workspace--single">
        <section className="panel panel--wide">
          <div className="results-header">
            <div>
              <h2 className="panel__title">
                Past generations
                {!isLoading && !error && (
                  <span className="history-slots">
                    {entries.length} of {MAX_HISTORY_ENTRIES}
                  </span>
                )}
              </h2>
            </div>
            <Link to="/" className="btn btn-ghost btn-sm">
              Back to pantry
            </Link>
          </div>

          <p className="history-disclaimer" role="note">
            {HISTORY_LIMIT_DISCLAIMER}
          </p>

          {isPending && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Checking your account…</p>
            </div>
          )}

          {!isPending && !session?.user && (
            <div className="status-message">
              <p>
                Showing generations saved on this device. Sign in to sync them
                across browsers.
              </p>
            </div>
          )}

          {!isPending && isLoading && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Loading your history…</p>
            </div>
          )}

          {!isPending && error && (
            <div className="status-message status-message--error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {!isPending && !isLoading && !error && entries.length === 0 && (
            <div className="empty-recipes">
              <p className="empty-recipes__title">No saved generations yet</p>
              <p className="empty-recipes__text">
                Generate recipes on the home page to build your history.{' '}
                <Link to="/" className="inline-link">
                  Go to pantry
                </Link>
              </p>
            </div>
          )}

          <div className="history-list">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isDeleting = deletingId === entry.id

              return (
                <article key={entry.id} className="history-item">
                  <div className="history-item__header">
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
                      <span className="history-item__chevron">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm history-item__delete"
                      onClick={() => void handleDelete(entry.id)}
                      disabled={isDeleting}
                      aria-label={`Delete generation from ${formatDate(entry.createdAt)}`}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>

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
