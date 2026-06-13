import type { FavoriteEntry } from './types'

export async function listFavorites(
  db: D1Database,
  userId: string,
): Promise<FavoriteEntry[]> {
  const result = await db
    .prepare(
      `SELECT id, created_at, recipe_json, request_json
       FROM recipe_favorites
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>()

  return (result.results ?? []).flatMap((row) => {
    try {
      return [
        {
          id: String(row.id),
          createdAt: Number(row.created_at),
          recipe: JSON.parse(String(row.recipe_json)),
          request: JSON.parse(String(row.request_json)),
        },
      ]
    } catch {
      return []
    }
  })
}

export async function saveFavorite(
  db: D1Database,
  userId: string,
  recipe: FavoriteEntry['recipe'],
  request: FavoriteEntry['request'],
): Promise<FavoriteEntry> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()

  await db
    .prepare(
      `INSERT INTO recipe_favorites (id, user_id, recipe_json, request_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, JSON.stringify(recipe), JSON.stringify(request), createdAt)
    .run()

  return { id, createdAt, recipe, request }
}

export async function deleteFavorite(
  db: D1Database,
  userId: string,
  favoriteId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM recipe_favorites WHERE id = ? AND user_id = ?`,
    )
    .bind(favoriteId, userId)
    .run()

  return (result.meta.changes ?? 0) > 0
}

export async function migrateGuestFavorites(
  db: D1Database,
  userId: string,
  entries: FavoriteEntry[],
): Promise<{ imported: number; skipped: number }> {
  const outcomes = await Promise.all(
    entries.map(async (entry) => {
      const existing = await db
        .prepare(
          `SELECT id FROM recipe_favorites
           WHERE user_id = ? AND recipe_json LIKE ?`,
        )
        .bind(userId, `%"name":"${entry.recipe.name.replace(/"/g, '\\"')}"%`)
        .first<{ id: string }>()

      if (existing) return 'skipped' as const

      await saveFavorite(db, userId, entry.recipe, entry.request)
      return 'imported' as const
    }),
  )

  return {
    imported: outcomes.filter((o) => o === 'imported').length,
    skipped: outcomes.filter((o) => o === 'skipped').length,
  }
}
