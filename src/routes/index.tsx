import { Link, createFileRoute } from '@tanstack/react-router'
import { useReducer, useState, useSyncExternalStore } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeForm } from '../components/RecipeForm'
import { useGuestMigration } from '../hooks/useGuestMigration'
import { authClient } from '../lib/auth-client'
import { RateLimitError, generateRecipes } from '../lib/api'
import { appendGuestHistoryEntry } from '../lib/guest-history'
import { HISTORY_LIMIT_DISCLAIMER, HISTORY_LIMIT_FULL_MESSAGE } from '../lib/history-limits'
import { GENERATION_LIMIT_HINT } from '../lib/generation-limits'
import { HistoryLimitError, saveHistoryEntry } from '../lib/history-api'
import { recipesToMarkdown } from '../lib/recipeMarkdown'
import {
  getPreferencesSnapshot,
  getRecipesSnapshot,
  getServerPreferencesSnapshot,
  getServerRecipesSnapshot,
  subscribePreferences,
  subscribeRecipes,
  updatePreferences,
  updateRecipes,
} from '../lib/storage'
import type { RecipeRequest } from '../types/recipe'

export const Route = createFileRoute('/')({ component: Home })

type HomeState = {
  isLoading: boolean
  error: string | null
}

type HomeAction =
  | { type: 'generateStart' }
  | { type: 'generateSuccess' }
  | { type: 'generateError'; message: string }

const initialHomeState: HomeState = {
  isLoading: false,
  error: null,
}

function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case 'generateStart':
      return { isLoading: true, error: null }
    case 'generateSuccess':
      return { isLoading: false, error: null }
    case 'generateError':
      return { isLoading: false, error: action.message }
    default:
      return state
  }
}

function buildRecipeRequest(preferences: ReturnType<typeof getPreferencesSnapshot>): RecipeRequest {
  return {
    ingredients: preferences.ingredients,
    cookingTimeMinutes: preferences.cookingTimeMinutes,
    difficulty: preferences.difficulty,
    dietaryPreferences:
      preferences.dietaryPreferences.length > 0
        ? preferences.dietaryPreferences
        : undefined,
    equipment:
      preferences.equipment.length > 0 ? preferences.equipment : undefined,
  }
}

function Home() {
  const { data: session } = authClient.useSession()
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getServerPreferencesSnapshot,
  )
  const recipes = useSyncExternalStore(
    subscribeRecipes,
    getRecipesSnapshot,
    getServerRecipesSnapshot,
  )
  const [{ isLoading, error }, dispatch] = useReducer(
    homeReducer,
    initialHomeState,
  )
  const [copiedAll, setCopiedAll] = useState(false)
  const [historyWarning, setHistoryWarning] = useState<string | null>(null)

  useGuestMigration()

  async function handleCopyAll() {
    if (recipes.length === 0) return

    try {
      await navigator.clipboard.writeText(recipesToMarkdown(recipes))
      setCopiedAll(true)
      window.setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      setCopiedAll(false)
    }
  }

  async function handleGenerate() {
    dispatch({ type: 'generateStart' })
    setHistoryWarning(null)

    const request = buildRecipeRequest(preferences)

    try {
      const response = await generateRecipes(request)

      updateRecipes(response.recipes)

      if (session?.user) {
        try {
          await saveHistoryEntry(request, response.recipes)
        } catch (err) {
          if (err instanceof HistoryLimitError) {
            setHistoryWarning(HISTORY_LIMIT_FULL_MESSAGE)
          }
        }
      } else {
        const { saved } = appendGuestHistoryEntry(request, response.recipes)
        if (!saved) {
          setHistoryWarning(HISTORY_LIMIT_FULL_MESSAGE)
        }
      }

      dispatch({ type: 'generateSuccess' })
    } catch (err) {
      updateRecipes([])

      let message =
        err instanceof Error ? err.message : 'Something went wrong. Try again.'

      if (err instanceof RateLimitError && err.retryAfterSeconds) {
        const minutes = Math.max(1, Math.ceil(err.retryAfterSeconds / 60))
        message = `${err.message} (about ${minutes} min)`
      }

      dispatch({
        type: 'generateError',
        message,
      })
    }
  }

  const ingredientCount = preferences.ingredients.length

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

      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">From fridge to table</p>
          <h1 className="hero__title">Cook what's already in your kitchen</h1>
          <p className="hero__lead">
            List what you have, set your time, and get recipes built around real
            ingredients — not a shopping list.
          </p>

          <div
            className={`cutting-board${ingredientCount > 0 ? ' cutting-board--active' : ''}`}
            aria-live="polite"
            aria-label={
              ingredientCount > 0
                ? `${ingredientCount} ingredients on the board`
                : 'No ingredients added yet'
            }
          >
            {ingredientCount > 0 ? (
              <ul className="cutting-board__items">
                {preferences.ingredients.map((ingredient) => (
                  <li key={ingredient} className="cutting-board__item">
                    {ingredient}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cutting-board__empty">
                Your ingredients will show up here as you add them
              </p>
            )}
          </div>
        </div>
      </section>

      <main className="workspace">
        <aside className="workspace__sidebar">
          <div className="panel panel--form">
            <h2 className="panel__title">What's on the counter?</h2>
            <RecipeForm
              preferences={preferences}
              onChange={updatePreferences}
              onSubmit={handleGenerate}
              isLoading={isLoading}
            />
          </div>
        </aside>

        <section className="workspace__main">
          <div className="panel panel--results">
            <div className="results-header">
              <div>
                <h2 className="panel__title">Your recipes</h2>
                {recipes.length > 0 && (
                  <p className="results-header__meta">
                    {recipes.length} suggestion{recipes.length === 1 ? '' : 's'}{' '}
                    based on what you listed
                  </p>
                )}
              </div>
              {recipes.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyAll}
                >
                  {copiedAll ? 'Copied' : 'Copy all'}
                </button>
              )}
            </div>

            {isLoading && (
              <div className="status-message status-message--loading">
                <div className="spinner" aria-hidden="true" />
                <p>Working through combinations…</p>
              </div>
            )}

            {error && (
              <div className="status-message status-message--error" role="alert">
                <p>{error}</p>
              </div>
            )}

            {historyWarning && (
              <div className="status-message status-message--warn" role="status">
                <p>
                  {historyWarning}{' '}
                  <Link to="/history" className="inline-link">
                    Manage history
                  </Link>
                </p>
              </div>
            )}

            {!isLoading && !error && recipes.length === 0 && (
              <div className="empty-recipes">
                <p className="empty-recipes__title">Nothing cooking yet</p>
                <p className="empty-recipes__text">
                  Add at least one ingredient on the left, then hit Generate
                  recipes to see suggestions here.
                </p>
              </div>
            )}

            <div
              className={`recipe-grid${recipes.length > 0 && !isLoading ? ' recipe-grid--animated' : ''}`}
            >
              {recipes.map((recipe, index) => (
                <RecipeCard key={`${recipe.name}-${index}`} recipe={recipe} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Preferences stay in this browser. Sign in to sync history across
          devices. {HISTORY_LIMIT_DISCLAIMER} {GENERATION_LIMIT_HINT}
        </p>
      </footer>
    </div>
  )
}
