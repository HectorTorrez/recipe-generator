import { createFileRoute } from '@tanstack/react-router'
import { useReducer, useState, useSyncExternalStore } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeForm } from '../components/RecipeForm'
import { useGuestMigration } from '../hooks/useGuestMigration'
import { authClient } from '../lib/auth-client'
import { generateRecipes } from '../lib/api'
import { appendGuestHistoryEntry } from '../lib/guest-history'
import { saveHistoryEntry } from '../lib/history-api'
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

    const request = buildRecipeRequest(preferences)

    try {
      const response = await generateRecipes(request)

      updateRecipes(response.recipes)

      if (session?.user) {
        await saveHistoryEntry(request, response.recipes)
      } else {
        appendGuestHistoryEntry(request, response.recipes)
      }

      dispatch({ type: 'generateSuccess' })
    } catch (err) {
      updateRecipes([])
      dispatch({
        type: 'generateError',
        message:
          err instanceof Error ? err.message : 'Something went wrong. Try again.',
      })
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__content">
          <AuthHeader />
          <div className="app-header__brand">
            <span className="app-header__mark">Pantry</span>
            <p className="app-header__eyebrow">From fridge to table</p>
          </div>
          <h1>Cook what's already in your kitchen</h1>
          <p className="app-header__subtitle">
            List what you have, set your time, and get recipes built around
            real ingredients — not a shopping list.
          </p>
        </div>
      </header>

      <main className="app-main">
        <section className="panel panel--form">
          <span className="panel__label">Prep station</span>
          <h2>What's on the counter?</h2>
          <RecipeForm
            preferences={preferences}
            onChange={updatePreferences}
            onSubmit={handleGenerate}
            isLoading={isLoading}
          />
        </section>

        <section className="panel panel--results">
          <div className="results-header">
            <h2>Your recipes</h2>
            {recipes.length > 0 && (
              <div className="results-header__actions">
                <span className="results-count">{recipes.length} ready</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyAll}
                >
                  {copiedAll ? 'Copied' : 'Copy all'}
                </button>
              </div>
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

          {!isLoading && !error && recipes.length === 0 && (
            <div className="status-message">
              <p>
                Add at least one ingredient, then generate recipes to see
                suggestions here.
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
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Your preferences stay in this browser. Sign in to keep recipe history
          across devices.
        </p>
      </footer>
    </div>
  )
}
