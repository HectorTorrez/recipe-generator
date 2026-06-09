import type { Recipe, RecipeRequest } from './types'

export type HistoryEntry = {
  id: string
  createdAt: number
  request: RecipeRequest
  recipes: Recipe[]
}

export type GuestHistoryEntry = {
  id: string
  createdAt: number
  request: RecipeRequest
  recipes: Recipe[]
}

function parseHistoryRow(row: Record<string, unknown>): HistoryEntry | null {
  try {
    const request = JSON.parse(String(row.request_json)) as RecipeRequest
    const recipes = JSON.parse(String(row.recipes_json)) as Recipe[]

    if (!Array.isArray(recipes) || recipes.length === 0) return null

    return {
      id: String(row.id),
      createdAt: Number(row.created_at),
      request,
      recipes,
    }
  } catch {
    return null
  }
}

export async function listHistory(
  db: D1Database,
  userId: string,
): Promise<HistoryEntry[]> {
  const result = await db
    .prepare(
      `SELECT id, created_at, request_json, recipes_json
       FROM recipe_generations
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>()

  return (result.results ?? [])
    .map((row) => parseHistoryRow(row))
    .filter((entry): entry is HistoryEntry => entry !== null)
}

export async function saveHistoryEntry(
  db: D1Database,
  userId: string,
  request: RecipeRequest,
  recipes: Recipe[],
  sourceId?: string,
): Promise<HistoryEntry> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  await db
    .prepare(
      `INSERT INTO recipe_generations
       (id, user_id, source_id, created_at, request_json, recipes_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      sourceId ?? null,
      createdAt,
      JSON.stringify(request),
      JSON.stringify(recipes),
    )
    .run()

  return { id, createdAt, request, recipes }
}

export async function migrateGuestHistory(
  db: D1Database,
  userId: string,
  entries: GuestHistoryEntry[],
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const entry of entries) {
    if (!entry.id || !Array.isArray(entry.recipes) || entry.recipes.length === 0) {
      skipped += 1
      continue
    }

    const existing = await db
      .prepare(
        `SELECT id FROM recipe_generations
         WHERE user_id = ? AND source_id = ?`,
      )
      .bind(userId, entry.id)
      .first<{ id: string }>()

    if (existing) {
      skipped += 1
      continue
    }

    await saveHistoryEntry(
      db,
      userId,
      entry.request,
      entry.recipes,
      entry.id,
    )
    imported += 1
  }

  return { imported, skipped }
}
