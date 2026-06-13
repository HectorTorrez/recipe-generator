import type { UserPreferences } from '../types/recipe'

const STORAGE_KEY = 'recipe-generator-preferences'
const RECIPES_STORAGE_KEY = 'recipe-generator-last-recipes'

export const defaultPreferences: UserPreferences = {
  ingredients: [],
  cookingTimeMinutes: 30,
  servings: 2,
  difficulty: 'beginner',
  dietaryPreferences: [],
  equipment: ['stove'],
  allergies: [],
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
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
      servings:
        typeof parsed.servings === 'number' && parsed.servings > 0
          ? parsed.servings
          : defaultPreferences.servings,
    }
  } catch {
    return defaultPreferences
  }
}

export function savePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export function loadRecipes(): import('../types/recipe').Recipe[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(RECIPES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (recipe): recipe is import('../types/recipe').Recipe =>
        !!recipe &&
        typeof recipe === 'object' &&
        typeof (recipe as import('../types/recipe').Recipe).name === 'string',
    )
  } catch {
    return []
  }
}

export function saveRecipes(recipes: import('../types/recipe').Recipe[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes))
}

const EMPTY_RECIPES: import('../types/recipe').Recipe[] = []

const preferenceListeners = new Set<() => void>()
const recipeListeners = new Set<() => void>()

let preferencesSnapshot: UserPreferences = defaultPreferences
let recipesSnapshot: import('../types/recipe').Recipe[] = EMPTY_RECIPES

if (typeof window !== 'undefined') {
  preferencesSnapshot = loadPreferences()
  const loaded = loadRecipes()
  recipesSnapshot = loaded.length === 0 ? EMPTY_RECIPES : loaded
}

export function subscribePreferences(onStoreChange: () => void): () => void {
  preferenceListeners.add(onStoreChange)
  return () => preferenceListeners.delete(onStoreChange)
}

export function subscribeRecipes(onStoreChange: () => void): () => void {
  recipeListeners.add(onStoreChange)
  return () => recipeListeners.delete(onStoreChange)
}

export function getPreferencesSnapshot(): UserPreferences {
  return preferencesSnapshot
}

export function getServerPreferencesSnapshot(): UserPreferences {
  return defaultPreferences
}

export function getRecipesSnapshot(): import('../types/recipe').Recipe[] {
  return recipesSnapshot
}

export function getServerRecipesSnapshot(): import('../types/recipe').Recipe[] {
  return EMPTY_RECIPES
}

export function updatePreferences(preferences: UserPreferences): void {
  savePreferences(preferences)
  preferencesSnapshot = preferences
  preferenceListeners.forEach((listener) => listener())
}

export function updateRecipes(recipes: import('../types/recipe').Recipe[]): void {
  saveRecipes(recipes)
  recipesSnapshot = recipes.length === 0 ? EMPTY_RECIPES : recipes
  recipeListeners.forEach((listener) => listener())
}

export function requestFromPreferences(
  preferences: UserPreferences,
): import('../types/recipe').RecipeRequest {
  return {
    ingredients: preferences.ingredients,
    cookingTimeMinutes: preferences.cookingTimeMinutes,
    servings: preferences.servings,
    difficulty: preferences.difficulty,
    dietaryPreferences:
      preferences.dietaryPreferences.length > 0
        ? preferences.dietaryPreferences
        : undefined,
    equipment:
      preferences.equipment.length > 0 ? preferences.equipment : undefined,
    allergies:
      preferences.allergies.length > 0 ? preferences.allergies : undefined,
    cuisine: preferences.cuisine,
    mealType: preferences.mealType,
  }
}
