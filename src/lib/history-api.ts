import type { GuestHistoryEntry, HistoryEntry, RecipeRequest, Recipe } from '../types/recipe'
import { authHeaders, getApiBase } from './auth-token'

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const response = await fetch(`${getApiBase()}/api/history`, {
    headers: {
      ...authHeaders(),
    },
  })

  if (!response.ok) {
    throw new Error('Failed to load recipe history')
  }

  const data = (await response.json()) as { entries: HistoryEntry[] }
  return data.entries
}

export async function saveHistoryEntry(
  request: RecipeRequest,
  recipes: Recipe[],
): Promise<HistoryEntry> {
  const response = await fetch(`${getApiBase()}/api/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ request, recipes }),
  })

  if (!response.ok) {
    throw new Error('Failed to save recipe history')
  }

  const data = (await response.json()) as { entry: HistoryEntry }
  return data.entry
}

export async function migrateGuestHistory(
  entries: GuestHistoryEntry[],
): Promise<{ imported: number; skipped: number }> {
  const response = await fetch(`${getApiBase()}/api/history/migrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ entries }),
  })

  if (!response.ok) {
    throw new Error('Failed to migrate guest history')
  }

  return (await response.json()) as { imported: number; skipped: number }
}
