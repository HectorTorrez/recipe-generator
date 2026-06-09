import type { GuestHistoryEntry, Recipe, RecipeRequest } from '../types/recipe'

const GUEST_HISTORY_KEY = 'recipe-generator-guest-history'

export function loadGuestHistory(): GuestHistoryEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (entry): entry is GuestHistoryEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as GuestHistoryEntry).id === 'string' &&
        Array.isArray((entry as GuestHistoryEntry).recipes),
    )
  } catch {
    return []
  }
}

export function saveGuestHistory(entries: GuestHistoryEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(entries))
}

export function appendGuestHistoryEntry(
  request: RecipeRequest,
  recipes: Recipe[],
): GuestHistoryEntry[] {
  const entry: GuestHistoryEntry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    request,
    recipes,
  }

  const next = [entry, ...loadGuestHistory()]
  saveGuestHistory(next)
  return next
}

export function clearGuestHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GUEST_HISTORY_KEY)
}

export function hasGuestHistory(): boolean {
  return loadGuestHistory().length > 0
}
