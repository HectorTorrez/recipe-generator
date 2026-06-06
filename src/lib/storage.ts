import type { Recipe, UserPreferences } from '../types/recipe'

const STORAGE_KEY = 'recipe-generator-preferences'
const RECIPES_STORAGE_KEY = 'recipe-generator-last-recipes'

export const defaultPreferences: UserPreferences = {
  ingredients: [],
  cookingTimeMinutes: 30,
  difficulty: 'beginner',
  dietaryPreferences: [],
  equipment: ['stove'],
}

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return defaultPreferences

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPreferences

    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return {
      ...defaultPreferences,
      ...parsed,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      dietaryPreferences: Array.isArray(parsed.dietaryPreferences)
        ? parsed.dietaryPreferences
        : [],
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : ['stove'],
    }
  } catch {
    return defaultPreferences
  }
}

export function savePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export function loadRecipes(): Recipe[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(RECIPES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (recipe): recipe is Recipe =>
        !!recipe &&
        typeof recipe === 'object' &&
        typeof (recipe as Recipe).name === 'string',
    )
  } catch {
    return []
  }
}

export function saveRecipes(recipes: Recipe[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes))
}

const preferenceListeners = new Set<() => void>()
const recipeListeners = new Set<() => void>()

export function subscribePreferences(onStoreChange: () => void): () => void {
  preferenceListeners.add(onStoreChange)
  return () => preferenceListeners.delete(onStoreChange)
}

export function subscribeRecipes(onStoreChange: () => void): () => void {
  recipeListeners.add(onStoreChange)
  return () => recipeListeners.delete(onStoreChange)
}

export function getPreferencesSnapshot(): UserPreferences {
  return loadPreferences()
}

export function getServerPreferencesSnapshot(): UserPreferences {
  return defaultPreferences
}

export function getRecipesSnapshot(): Recipe[] {
  return loadRecipes()
}

export function getServerRecipesSnapshot(): Recipe[] {
  return []
}

export function updatePreferences(preferences: UserPreferences): void {
  savePreferences(preferences)
  preferenceListeners.forEach((listener) => listener())
}

export function updateRecipes(recipes: Recipe[]): void {
  saveRecipes(recipes)
  recipeListeners.forEach((listener) => listener())
}
