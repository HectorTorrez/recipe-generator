import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useReducer } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { authClient } from '../lib/auth-client'
import { fetchFavorites } from '../lib/api'
import { loadGuestFavorites } from '../lib/favorites'
import { useGuestMigration } from '../hooks/useGuestMigration'
import type { FavoriteEntry } from '../types/recipe'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
})

type FavoritesState = {
  entries: FavoriteEntry[]
  isLoading: boolean
  error: string | null
}

type FavoritesAction =
  | { type: 'loadStart' }
  | { type: 'loadSuccess'; entries: FavoriteEntry[] }
  | { type: 'loadError'; message: string }

const initialFavoritesState: FavoritesState = {
  entries: [],
  isLoading: true,
  error: null,
}

function favoritesReducer(
  state: FavoritesState,
  action: FavoritesAction,
): FavoritesState {
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

function FavoritesPage() {
  const { data: session, isPending } = authClient.useSession()
  const [{ entries, isLoading, error }, dispatch] = useReducer(
    favoritesReducer,
    initialFavoritesState,
  )

  const loadFavorites = useCallback(async () => {
    dispatch({ type: 'loadStart' })
    try {
      const data = session?.user
        ? await fetchFavorites()
        : loadGuestFavorites()
      dispatch({ type: 'loadSuccess', entries: data })
    } catch (err) {
      dispatch({
        type: 'loadError',
        message: err instanceof Error ? err.message : 'Failed to load favorites',
      })
    }
  }, [session?.user])

  useGuestMigration(() => {
    void loadFavorites()
  })

  useEffect(() => {
    if (isPending) return
    void loadFavorites()
  }, [isPending, loadFavorites])

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
          <p className="hero__eyebrow">Saved recipes</p>
          <h1 className="hero__title">Favorites</h1>
          <p className="hero__lead">
            Recipes you've starred from any generation.
          </p>
        </div>
      </section>

      <main className="workspace workspace--single">
        <section className="panel panel--wide">
          <div className="results-header">
            <h2 className="panel__title">Starred recipes</h2>
            <Link to="/" className="btn btn-ghost btn-sm">
              Back to pantry
            </Link>
          </div>

          {isLoading && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Loading favorites…</p>
            </div>
          )}

          {error && (
            <p className="status-message status-message--error">{error}</p>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="empty-recipes">
              <p className="empty-recipes__title">No favorites yet</p>
              <p className="empty-recipes__text">
                Star a recipe from your results to save it here.
              </p>
            </div>
          )}

          <div className="recipe-grid">
            {entries.map((entry) => (
              <RecipeCard
                key={entry.id}
                recipe={entry.recipe}
                request={entry.request}
                pantryIngredients={entry.request.ingredients}
                showActions={false}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
