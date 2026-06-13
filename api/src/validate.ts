import type { Cuisine, MealType, RecipeRequest } from './types'

const VALID_CUISINES: Cuisine[] = [
  'italian',
  'mexican',
  'asian',
  'mediterranean',
  'american',
]

const VALID_MEAL_TYPES: MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]

export function validateRequest(body: unknown): RecipeRequest | null {
  if (!body || typeof body !== 'object') return null

  const data = body as Record<string, unknown>

  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    return null
  }

  if (
    typeof data.cookingTimeMinutes !== 'number' ||
    data.cookingTimeMinutes < 5
  ) {
    return null
  }

  const ingredients = data.ingredients.flatMap((item) => {
    const trimmed = typeof item === 'string' ? item.trim() : ''
    return trimmed ? [trimmed] : []
  })

  if (ingredients.length === 0) return null

  const servings =
    typeof data.servings === 'number' && data.servings >= 1 && data.servings <= 12
      ? data.servings
      : undefined

  const allergies = Array.isArray(data.allergies)
    ? data.allergies.flatMap((item) =>
        typeof item === 'string' && item.trim().length > 0
          ? [item.trim()]
          : [],
      )
    : undefined

  const cuisine = VALID_CUISINES.includes(data.cuisine as Cuisine)
    ? (data.cuisine as Cuisine)
    : undefined

  const mealType = VALID_MEAL_TYPES.includes(data.mealType as MealType)
    ? (data.mealType as MealType)
    : undefined

  return {
    ingredients,
    cookingTimeMinutes: data.cookingTimeMinutes,
    servings,
    difficulty:
      data.difficulty === 'beginner' ||
      data.difficulty === 'intermediate' ||
      data.difficulty === 'advanced'
        ? data.difficulty
        : undefined,
    dietaryPreferences: Array.isArray(data.dietaryPreferences)
      ? (data.dietaryPreferences as RecipeRequest['dietaryPreferences'])
      : undefined,
    equipment: Array.isArray(data.equipment)
      ? (data.equipment as RecipeRequest['equipment'])
      : undefined,
    allergies: allergies && allergies.length > 0 ? allergies : undefined,
    cuisine,
    mealType,
  }
}
