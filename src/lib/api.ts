import type { RecipeRequest, RecipeResponse } from '../types/recipe'

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

export async function generateRecipes(
  request: RecipeRequest,
): Promise<RecipeResponse> {
  const response = await fetch(`${API_BASE}/api/recipes`, {
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
