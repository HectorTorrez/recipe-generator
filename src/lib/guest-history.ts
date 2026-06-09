import { MAX_HISTORY_ENTRIES } from './history-limits'
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

export function isGuestHistoryFull(): boolean {
  return loadGuestHistory().length >= MAX_HISTORY_ENTRIES
}

export function appendGuestHistoryEntry(
  request: RecipeRequest,
  recipes: Recipe[],
): { saved: boolean; entries: GuestHistoryEntry[] } {
  const current = loadGuestHistory()

  if (current.length >= MAX_HISTORY_ENTRIES) {
    return { saved: false, entries: current }
  }

  const entry: GuestHistoryEntry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    request,
    recipes,
  }

  const next = [entry, ...current]
  saveGuestHistory(next)
  return { saved: true, entries: next }
}

export function deleteGuestHistoryEntry(id: string): GuestHistoryEntry[] {
  const next = loadGuestHistory().filter((entry) => entry.id !== id)
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
