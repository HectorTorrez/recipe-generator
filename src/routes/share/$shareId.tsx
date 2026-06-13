import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useReducer } from 'react'
import { RecipeCard } from '../../components/RecipeCard'
import { fetchSharedGeneration } from '../../lib/api'
import type { Recipe, RecipeRequest } from '../../types/recipe'

export const Route = createFileRoute('/share/$shareId')({
  component: SharePage,
})

type ShareState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | {
      status: 'success'
      recipes: Recipe[]
      request: RecipeRequest | null
      createdAt: number | null
    }

type ShareAction =
  | { type: 'loadStart' }
  | {
      type: 'loadSuccess'
      recipes: Recipe[]
      request: RecipeRequest
      createdAt: number
    }
  | { type: 'loadError'; error: string }

function shareReducer(state: ShareState, action: ShareAction): ShareState {
  switch (action.type) {
    case 'loadStart':
      return { status: 'loading' }
    case 'loadSuccess':
      return {
        status: 'success',
        recipes: action.recipes,
        request: action.request,
        createdAt: action.createdAt,
      }
    case 'loadError':
      return { status: 'error', error: action.error }
    default:
      return state
  }
}

function SharePage() {
  const { shareId } = Route.useParams()
  const [state, dispatch] = useReducer(shareReducer, { status: 'loading' })

  useEffect(() => {
    dispatch({ type: 'loadStart' })
    void fetchSharedGeneration(shareId)
      .then((data) => {
        dispatch({
          type: 'loadSuccess',
          recipes: data.entry.recipes,
          request: data.entry.request,
          createdAt: data.entry.createdAt,
        })
      })
      .catch((err) => {
        dispatch({
          type: 'loadError',
          error: err instanceof Error ? err.message : 'Share not found',
        })
      })
  }, [shareId])

  const recipes = state.status === 'success' ? state.recipes : []
  const request = state.status === 'success' ? state.request : null
  const createdAt = state.status === 'success' ? state.createdAt : null

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
        </div>
      </header>

      <section className="hero hero--compact">
        <div className="hero__inner">
          <p className="hero__eyebrow">Shared recipes</p>
          <h1 className="hero__title">Recipe collection</h1>
          {createdAt && (
            <p className="hero__lead">
              Shared on{' '}
              {new Date(createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
      </section>

      <main className="workspace workspace--single">
        <section className="panel panel--wide">
          {state.status === 'loading' && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Loading shared recipes…</p>
            </div>
          )}

          {state.status === 'error' && (
            <p className="status-message status-message--error">{state.error}</p>
          )}

          <div className="recipe-grid">
            {recipes.map((recipe, index) => (
              <RecipeCard
                key={`${recipe.name}-${index}`}
                recipe={recipe}
                request={request ?? undefined}
                pantryIngredients={request?.ingredients ?? EMPTY_PANTRY}
                showActions={false}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

const EMPTY_PANTRY: string[] = []
