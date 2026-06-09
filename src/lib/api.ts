import type { RecipeRequest, RecipeResponse } from '../types/recipe'
import { getApiBase } from './auth-token'

export async function generateRecipes(
  request: RecipeRequest,
): Promise<RecipeResponse> {
  const response = await fetch(`${getApiBase()}/api/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const data = (await response.json()) as RecipeResponse & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to generate recipes')
  }

  return data
}
