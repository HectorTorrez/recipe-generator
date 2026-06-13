import type { Recipe, RecipeResponse } from './types'

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  )
}

export function parseMissingIngredients(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) =>
    typeof item === 'string' && item.trim().length > 0 ? [item.trim()] : [],
  )
}

export function parseRecipeResponse(
  raw: string,
  maxCookingTimeMinutes: number,
): RecipeResponse {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI response is not valid JSON')
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as RecipeResponse).recipes) ||
    (parsed as RecipeResponse).recipes.length === 0
  ) {
    throw new Error('AI response missing recipes array')
  }

  const timeToleranceMinutes = 5
  const recipes = (parsed as RecipeResponse).recipes.map((recipe, index) => {
    if (!recipe || typeof recipe !== 'object') {
      throw new Error(`Recipe ${index + 1} is not a valid object`)
    }

    const {
      name,
      description,
      estimatedTimeMinutes,
      ingredients,
      instructions,
      whyRecommended,
      missingIngredients,
    } = recipe as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`Recipe ${index + 1} is missing a valid name`)
    }

    if (typeof description !== 'string' || !description.trim()) {
      throw new Error(`Recipe ${index + 1} is missing a valid description`)
    }

    if (typeof whyRecommended !== 'string' || !whyRecommended.trim()) {
      throw new Error(`Recipe ${index + 1} is missing whyRecommended`)
    }

    if (!isStringArray(ingredients)) {
      throw new Error(`Recipe ${index + 1} is missing a valid ingredients list`)
    }

    if (!isStringArray(instructions)) {
      throw new Error(`Recipe ${index + 1} is missing valid instructions`)
    }

    const time =
      typeof estimatedTimeMinutes === 'number'
        ? estimatedTimeMinutes
        : Number(estimatedTimeMinutes)

    if (!Number.isFinite(time) || time <= 0) {
      throw new Error(`Recipe ${index + 1} has an invalid estimated time`)
    }

    if (time > maxCookingTimeMinutes + timeToleranceMinutes) {
      throw new Error(
        `Recipe ${index + 1} exceeds the ${maxCookingTimeMinutes}-minute time limit`,
      )
    }

    const result: Recipe = {
      name: name.trim(),
      description: description.trim(),
      estimatedTimeMinutes: Math.round(time),
      ingredients,
      instructions,
      whyRecommended: whyRecommended.trim(),
      missingIngredients: parseMissingIngredients(missingIngredients),
    }

    return result
  })

  return { recipes }
}

export function parseSubstitutionResponse(raw: string): string {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned) as { substitution?: string }
  if (typeof parsed.substitution !== 'string' || !parsed.substitution.trim()) {
    throw new Error('Invalid substitution response')
  }

  return parsed.substitution.trim()
}

export function parseVisionResponse(raw: string): string[] {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned) as { ingredients?: unknown }
  if (!isStringArray(parsed.ingredients)) {
    throw new Error('Invalid vision response')
  }

  return parsed.ingredients
}
