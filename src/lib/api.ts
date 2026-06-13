import type {
  FavoriteEntry,
  QuotaInfo,
  Recipe,
  RecipeRequest,
  RecipeResponse,
  UserPreferences,
} from '../types/recipe'
import { authHeaders, getApiBase } from './auth-token'

export class RateLimitError extends Error {
  readonly retryAfterSeconds?: number

  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

async function handleRateLimit(response: Response, data: { error?: string; retryAfterSeconds?: number }) {
  if (response.status === 429) {
    throw new RateLimitError(
      data.error ?? 'Rate limit exceeded. Try again later.',
      data.retryAfterSeconds,
    )
  }
}

export async function fetchQuota(): Promise<QuotaInfo> {
  const response = await fetch(`${getApiBase()}/api/quota`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch quota')
  }

  return (await response.json()) as QuotaInfo
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

  await handleRateLimit(response, data)

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to generate recipes')
  }

  return data
}

export async function generateRecipesStream(
  request: RecipeRequest,
  onRecipe: (recipe: Recipe) => void,
): Promise<void> {
  const response = await fetch(`${getApiBase()}/api/recipes/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(request),
  })

  if (response.status === 429) {
    const data = (await response.json()) as {
      error?: string
      retryAfterSeconds?: number
    }
    throw new RateLimitError(
      data.error ?? 'Rate limit exceeded.',
      data.retryAfterSeconds,
    )
  }

  if (!response.ok || !response.body) {
    throw new Error('Failed to start recipe stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as {
        type: string
        recipe?: Recipe
        error?: string
      }

      if (event.type === 'recipe' && event.recipe) {
        onRecipe(event.recipe)
      } else if (event.type === 'error') {
        throw new Error(event.error ?? 'Stream failed')
      }
    }
  }
}

export async function generateSingleRecipe(
  request: RecipeRequest,
  action: 'regenerate' | 'refine',
  recipe?: Recipe,
  refinement?: string,
): Promise<Recipe> {
  const response = await fetch(`${getApiBase()}/api/recipes/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ request, action, recipe, refinement }),
  })

  const data = (await response.json()) as { recipe?: Recipe; error?: string; retryAfterSeconds?: number }

  await handleRateLimit(response, data)

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to generate recipe')
  }

  if (!data.recipe) {
    throw new Error('No recipe returned')
  }

  return data.recipe
}

export async function suggestSubstitution(
  ingredient: string,
  pantry: string[],
): Promise<string> {
  const response = await fetch(`${getApiBase()}/api/recipes/substitute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ ingredient, pantry }),
  })

  const data = (await response.json()) as {
    substitution?: string
    error?: string
    retryAfterSeconds?: number
  }

  await handleRateLimit(response, data)

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to suggest substitution')
  }

  return data.substitution ?? ''
}

export async function detectIngredientsFromImage(
  imageBase64: string,
): Promise<string[]> {
  const response = await fetch(`${getApiBase()}/api/ingredients/from-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ image: imageBase64 }),
  })

  const data = (await response.json()) as {
    ingredients?: string[]
    error?: string
    retryAfterSeconds?: number
  }

  await handleRateLimit(response, data)

  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to analyze image')
  }

  return data.ingredients ?? []
}

export async function fetchFavorites(): Promise<FavoriteEntry[]> {
  const response = await fetch(`${getApiBase()}/api/favorites`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new Error('Failed to load favorites')
  }

  const data = (await response.json()) as { entries: FavoriteEntry[] }
  return data.entries
}

export async function saveFavorite(
  recipe: Recipe,
  request: RecipeRequest,
): Promise<FavoriteEntry> {
  const response = await fetch(`${getApiBase()}/api/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ recipe, request }),
  })

  if (!response.ok) {
    throw new Error('Failed to save favorite')
  }

  const data = (await response.json()) as { entry: FavoriteEntry }
  return data.entry
}

export async function deleteFavorite(id: string): Promise<void> {
  const response = await fetch(`${getApiBase()}/api/favorites/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new Error('Failed to delete favorite')
  }
}

export async function migrateGuestFavorites(
  entries: FavoriteEntry[],
): Promise<{ imported: number; skipped: number }> {
  const response = await fetch(`${getApiBase()}/api/favorites/migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ entries }),
  })

  if (!response.ok) {
    throw new Error('Failed to migrate favorites')
  }

  return (await response.json()) as { imported: number; skipped: number }
}

export async function fetchPreferences(): Promise<{
  preferences: UserPreferences | null
  updatedAt: number
}> {
  const response = await fetch(`${getApiBase()}/api/preferences`, {
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new Error('Failed to load preferences')
  }

  return (await response.json()) as {
    preferences: UserPreferences | null
    updatedAt: number
  }
}

export async function savePreferences(
  preferences: UserPreferences,
): Promise<{ updatedAt: number }> {
  const response = await fetch(`${getApiBase()}/api/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ preferences }),
  })

  if (!response.ok) {
    throw new Error('Failed to save preferences')
  }

  return (await response.json()) as { updatedAt: number }
}

export async function createShareLink(
  historyId: string,
): Promise<{ shareId: string; expiresAt: number }> {
  const response = await fetch(`${getApiBase()}/api/history/${historyId}/share`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })

  if (!response.ok) {
    throw new Error('Failed to create share link')
  }

  return (await response.json()) as { shareId: string; expiresAt: number }
}

export async function fetchSharedGeneration(shareId: string): Promise<{
  entry: {
    request: RecipeRequest
    recipes: Recipe[]
    createdAt: number
  }
}> {
  const response = await fetch(`${getApiBase()}/api/share/${shareId}`)

  if (!response.ok) {
    throw new Error('Share not found or expired')
  }

  return (await response.json()) as {
    entry: {
      request: RecipeRequest
      recipes: Recipe[]
      createdAt: number
    }
  }
}
