import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RecipeCard } from '../components/RecipeCard'
import { RecipeForm } from '../components/RecipeForm'
import { generateRecipes } from '../lib/api'
import {
  defaultPreferences,
  loadPreferences,
  loadRecipes,
  savePreferences,
  saveRecipes,
} from '../lib/storage'
import type { Recipe, UserPreferences } from '../types/recipe'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [preferences, setPreferences] =
    useState<UserPreferences>(defaultPreferences)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setPreferences(loadPreferences())
    setRecipes(loadRecipes())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    savePreferences(preferences)
  }, [preferences, isHydrated])

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await generateRecipes({
        ingredients: preferences.ingredients,
        cookingTimeMinutes: preferences.cookingTimeMinutes,
        difficulty: preferences.difficulty,
        dietaryPreferences:
          preferences.dietaryPreferences.length > 0
            ? preferences.dietaryPreferences
            : undefined,
        equipment:
          preferences.equipment.length > 0 ? preferences.equipment : undefined,
      })

      setRecipes(response.recipes)
      saveRecipes(response.recipes)
    } catch (err) {
      setRecipes([])
      saveRecipes([])
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__content">
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
            onChange={setPreferences}
            onSubmit={handleGenerate}
            isLoading={isLoading}
          />
        </section>

        <section className="panel panel--results">
          <div className="results-header">
            <h2>Recipe recommendations</h2>
            {recipes.length > 0 && (
              <span className="results-count">{recipes.length} recipes</span>
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
        <p>Preferences are saved locally in your browser.</p>
      </footer>
    </div>
  )
}
