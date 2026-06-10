import type { RecipeRequest, RecipeResponse } from '../types/recipe'
import { authHeaders, getApiBase } from './auth-token'

export class RateLimitError extends Error {
  readonly retryAfterSeconds?: number

  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function generateRecipes(
  request: RecipeRequest,
): Promise<RecipeResponse> {
  const response = await fetch(`${getApiBase()}/api/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  })

  const data = (await response.json()) as RecipeResponse & {
    error?: string
    retryAfterSeconds?: number
  }

  if (response.status === 429) {
    throw new RateLimitError(
      data.error ?? 'Rate limit exceeded. Try again later.',
      data.retryAfterSeconds,
    )
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to generate recipes')
  }

  return data
}
