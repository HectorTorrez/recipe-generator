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
          <p className="app-header__eyebrow">AI-powered meal planning</p>
          <h1>Smart Recipe Generator</h1>
          <p className="app-header__subtitle">
            Tell us what you have and how much time you have. We will suggest
            recipes that fit your kitchen and schedule.
          </p>
        </div>
      </header>

      <main className="app-main">
        <section className="panel panel--form">
          <h2>What are you cooking with?</h2>
          <RecipeForm
            preferences={preferences}
            onChange={updatePreferences}
            onSubmit={handleGenerate}
            isLoading={isLoading}
          />
        </section>

        <section className="panel panel--results">
          <div className="results-header">
            <h2>Recipe recommendations</h2>
            {recipes.length > 0 && (
              <div className="results-header__actions">
                <span className="results-count">{recipes.length} recipes</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyAll}
                >
                  {copiedAll ? 'Copied!' : 'Copy all'}
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="status-message status-message--loading">
              <div className="spinner" aria-hidden="true" />
              <p>Our chef AI is crafting recipes for you…</p>
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
                Add your ingredients and click Generate recipes to get
                personalized suggestions.
              </p>
            </div>
          )}

          <div className="recipe-grid">
            {recipes.map((recipe, index) => (
              <RecipeCard key={`${recipe.name}-${index}`} recipe={recipe} index={index} />
            ))}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Preferences are saved locally in your browser. Sign in to sync your
          recipe history across devices.
        </p>
      </footer>
    </div>
  )
}
