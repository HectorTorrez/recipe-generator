import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeComparison } from '../components/RecipeComparison'
import { RecipeForm } from '../components/RecipeForm'
import { useGuestMigration } from '../hooks/useGuestMigration'
import { usePreferencesSync } from '../hooks/usePreferencesSync'
import { authClient } from '../lib/auth-client'
import {
  RateLimitError,
  fetchQuota,
  generateRecipes,
  generateRecipesStream,
} from '../lib/api'
import { appendGuestHistoryEntry } from '../lib/guest-history'
import { HISTORY_LIMIT_DISCLAIMER, HISTORY_LIMIT_FULL_MESSAGE } from '../lib/history-limits'
import { HistoryLimitError, saveHistoryEntry } from '../lib/history-api'
import { recipesToMarkdown } from '../lib/recipeMarkdown'
import {
  getPreferencesSnapshot,
  getRecipesSnapshot,
  getServerPreferencesSnapshot,
  getServerRecipesSnapshot,
  requestFromPreferences,
  subscribePreferences,
  subscribeRecipes,
  updatePreferences,
  updateRecipes,
} from '../lib/storage'
import type { Recipe } from '../types/recipe'

type HomeSearch = {
  regenerate?: string
}

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    regenerate:
      typeof search.regenerate === 'string' ? search.regenerate : undefined,
  }),
})

type HomeState = {
  isLoading: boolean
  error: string | null
  copiedAll: boolean
  historyWarning: string | null
  quotaMessage: string | null
  quotaExceeded: boolean
  useStreaming: boolean
}

type HomeAction =
  | { type: 'generateStart' }
  | { type: 'generateSuccess' }
  | { type: 'generateError'; message: string }
  | { type: 'setCopiedAll'; value: boolean }
  | { type: 'setHistoryWarning'; value: string | null }
  | { type: 'setQuota'; message: string | null; exceeded: boolean }
  | { type: 'setUseStreaming'; value: boolean }

const initialHomeState: HomeState = {
  isLoading: false,
  error: null,
  copiedAll: false,
  historyWarning: null,
  quotaMessage: null,
  quotaExceeded: false,
  useStreaming: true,
}

function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case 'generateStart':
      return { ...state, isLoading: true, error: null, historyWarning: null }
    case 'generateSuccess':
      return { ...state, isLoading: false, error: null }
    case 'generateError':
      return { ...state, isLoading: false, error: action.message }
    case 'setCopiedAll':
      return { ...state, copiedAll: action.value }
    case 'setHistoryWarning':
      return { ...state, historyWarning: action.value }
    case 'setQuota':
      return {
        ...state,
        quotaMessage: action.message,
        quotaExceeded: action.exceeded,
      }
    case 'setUseStreaming':
      return { ...state, useStreaming: action.value }
    default:
      return state
  }
}

function formatQuotaMessage(used: number, limit: number, bucket: string): string {
  const remaining = Math.max(0, limit - used)
  const unit = bucket === 'user' ? 'today' : 'this hour'
  return `${remaining} of ${limit} generations left ${unit}`
}

function replaceRecipeAtIndex(
  recipes: Recipe[],
  index: number,
  updated: Recipe,
): Recipe[] {
  const next = [...recipes]
  next[index] = updated
  return next
}

function Home() {
  const { data: session } = authClient.useSession()
  const { regenerate } = Route.useSearch()
  const navigate = useNavigate()
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
  const [
    {
      isLoading,
      error,
      copiedAll,
      historyWarning,
      quotaMessage,
      quotaExceeded,
      useStreaming,
    },
    dispatch,
  ] = useReducer(homeReducer, initialHomeState)
  const regenerateTriggered = useRef(false)

  useGuestMigration()
  usePreferencesSync()

  const refreshQuota = useCallback(() => {
    void fetchQuota()
      .then((quota) => {
        dispatch({
          type: 'setQuota',
          message: formatQuotaMessage(quota.used, quota.limit, quota.bucket),
          exceeded: quota.used >= quota.limit,
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshQuota()
  }, [session?.user, refreshQuota])

  const handleGenerate = useCallback(async () => {
    dispatch({ type: 'generateStart' })

    const request = requestFromPreferences(preferences)

    try {
      let generated: Recipe[] = []

      if (useStreaming) {
        updateRecipes([])
        await generateRecipesStream(request, (recipe) => {
          generated = [...generated, recipe]
          updateRecipes(generated)
        })
      } else {
        const response = await generateRecipes(request)
        generated = response.recipes
        updateRecipes(generated)
      }

      if (session?.user) {
        try {
          await saveHistoryEntry(request, generated)
        } catch (err) {
          if (err instanceof HistoryLimitError) {
            dispatch({
              type: 'setHistoryWarning',
              value: HISTORY_LIMIT_FULL_MESSAGE,
            })
          }
        }
      } else {
        const { saved } = appendGuestHistoryEntry(request, generated)
        if (!saved) {
          dispatch({
            type: 'setHistoryWarning',
            value: HISTORY_LIMIT_FULL_MESSAGE,
          })
        }
      }

      dispatch({ type: 'generateSuccess' })
      refreshQuota()
    } catch (err) {
      if (!useStreaming) {
        updateRecipes([])
      }

      let message =
        err instanceof Error ? err.message : 'Something went wrong. Try again.'

      if (err instanceof RateLimitError && err.retryAfterSeconds) {
        const minutes = Math.max(1, Math.ceil(err.retryAfterSeconds / 60))
        message = `${err.message} (about ${minutes} min)`
        dispatch({
          type: 'setQuota',
          message: null,
          exceeded: true,
        })
      }

      dispatch({ type: 'generateError', message })
    }
  }, [preferences, session?.user, useStreaming, refreshQuota])

  useEffect(() => {
    if (
      regenerate === '1' &&
      preferences.ingredients.length > 0 &&
      !regenerateTriggered.current &&
      !isLoading
    ) {
      regenerateTriggered.current = true
      void handleGenerate().then(() => {
        void navigate({ to: '/', search: {}, replace: true })
      })
    }
  }, [
    regenerate,
    preferences.ingredients.length,
    isLoading,
    handleGenerate,
    navigate,
  ])

  async function handleCopyAll() {
    if (recipes.length === 0) return
    try {
      await navigator.clipboard.writeText(recipesToMarkdown(recipes))
      dispatch({ type: 'setCopiedAll', value: true })
      window.setTimeout(
        () => dispatch({ type: 'setCopiedAll', value: false }),
        2000,
      )
    } catch {
      dispatch({ type: 'setCopiedAll', value: false })
    }
  }

  function handlePrint() {
    window.print()
  }

  const ingredientCount = preferences.ingredients.length
  const currentRequest = requestFromPreferences(preferences)

  return (
    <div className="app">
      <header className="top-bar no-print">
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

      <section className="hero no-print">
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
        <aside className="workspace__sidebar no-print">
          <div className="panel panel--form">
            <h2 className="panel__title">What's on the counter?</h2>
            <RecipeForm
              preferences={preferences}
              onChange={updatePreferences}
              onSubmit={() => void handleGenerate()}
              isLoading={isLoading}
              quotaExceeded={quotaExceeded}
              quotaMessage={quotaMessage}
              useStreaming={useStreaming}
              onStreamingChange={(value) =>
                dispatch({ type: 'setUseStreaming', value })
              }
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
                <div className="results-header__actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm no-print"
                    onClick={handlePrint}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm no-print"
                    onClick={handleCopyAll}
                  >
                    {copiedAll ? 'Copied' : 'Copy all'}
                  </button>
                </div>
              )}
            </div>

            {recipes.length > 1 && (
              <RecipeComparison recipes={recipes} request={currentRequest} />
            )}

            {isLoading && (
              <div className="status-message status-message--loading">
                <div className="spinner" aria-hidden="true" />
                <p>Working through combinations…</p>
              </div>
            )}

            {error && (
              <p className="status-message status-message--error">{error}</p>
            )}

            {historyWarning && (
              <output className="status-message status-message--warn">
                <p>
                  {historyWarning}{' '}
                  <Link to="/history" className="inline-link">
                    Manage history
                  </Link>
                </p>
              </output>
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
                <RecipeCard
                  key={`${recipe.name}-${index}`}
                  recipe={recipe}
                  request={currentRequest}
                  pantryIngredients={preferences.ingredients}
                  onRecipeUpdate={(updated) =>
                    updateRecipes(replaceRecipeAtIndex(recipes, index, updated))
                  }
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer no-print">
        <p>
          Preferences stay in this browser. Sign in to sync across devices.{' '}
          {HISTORY_LIMIT_DISCLAIMER}
          {quotaMessage && <> {quotaMessage}.</>}
        </p>
      </footer>
    </div>
  )
}
