import type { FavoriteEntry, Recipe, RecipeRequest } from '../types/recipe'

const FAVORITES_KEY = 'recipe-generator-favorites'

export function loadGuestFavorites(): FavoriteEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (entry): entry is FavoriteEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as FavoriteEntry).id === 'string' &&
        typeof (entry as FavoriteEntry).recipe === 'object',
    )
  } catch {
    return []
  }
}

export function saveGuestFavorites(entries: FavoriteEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(entries))
}

export function addGuestFavorite(
  recipe: Recipe,
  request: RecipeRequest,
): FavoriteEntry {
  const entry: FavoriteEntry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    recipe,
    request,
  }

  const next = [entry, ...loadGuestFavorites()]
  saveGuestFavorites(next)
  return entry
}

export function removeGuestFavorite(id: string): FavoriteEntry[] {
  const next = loadGuestFavorites().filter((entry) => entry.id !== id)
  saveGuestFavorites(next)
  return next
}

export function isGuestFavorite(recipeName: string): boolean {
  return loadGuestFavorites().some((entry) => entry.recipe.name === recipeName)
}

export function clearGuestFavorites(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(FAVORITES_KEY)
}

export function hasGuestFavorites(): boolean {
  return loadGuestFavorites().length > 0
}
